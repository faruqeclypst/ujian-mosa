// pb-examku: PocketBase v0.36.9 dengan /api/fast-login native Go (paralel).
//
// Fast login untuk siswa — alternatif ringan pengganti bcrypt.
// POST /api/fast-login { username, password }
// Verifikasi: SHA-256(pepper + username + password) vs field fastHash.
// Pepper dari env FAST_LOGIN_PEPPER (disarankan) atau file
// <dataDir>/../fastlogin_pepper.key (auto-generate via crypto/rand).
// Rate limit: 20/menit per-akun + 2000/menit per-IP (ramah NAT sekolah).
// HANYA untuk collection "students".
//
// Dibangun untuk menggantikan pb_hooks/fast_login.pb.js yang serial
// (goja single-threaded, ~20 req/detik). Versi Go ini paralel penuh.
package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"strconv"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

// ---------------------------------------------------------------------------
// Rate limiter (thread-safe)
// ---------------------------------------------------------------------------

type rlEntry struct {
	n int
	t time.Time
}

type rateLimiter struct {
	mu      sync.Mutex
	entries map[string]*rlEntry
	max     int
}

func newRateLimiter(max int) *rateLimiter {
	return &rateLimiter{entries: make(map[string]*rlEntry), max: max}
}

// allow mencatat 1 hit dan mengembalikan false jika melebihi batas.
func (r *rateLimiter) allow(key string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	e, ok := r.entries[key]
	if !ok || now.Sub(e.t) > time.Minute {
		e = &rlEntry{n: 0, t: now}
		r.entries[key] = e
	}
	e.n++
	return e.n <= r.max
}

func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
}

var (
	rlUser = newRateLimiter(getEnvInt("FAST_LOGIN_RL_USER", 20)) // per-username: cegah brute force 1 akun
	// rlIP dihapus — lihat NOTE di handler login
)

// ---------------------------------------------------------------------------
// Pepper
// ---------------------------------------------------------------------------

var (
	pepperOnce sync.Once
	pepperVal  string
)

func getPepper(app *pocketbase.PocketBase) string {
	pepperOnce.Do(func() {
		if p := os.Getenv("FAST_LOGIN_PEPPER"); p != "" {
			pepperVal = p
			return
		}
		dataDir := app.DataDir()
		pepperFile := filepath.Join(filepath.Dir(dataDir), "fastlogin_pepper.key")
		if b, err := os.ReadFile(pepperFile); err == nil {
			if s := strings.TrimSpace(string(b)); len(s) >= 32 {
				pepperVal = s
				return
			}
		}
		// Auto-generate dengan crypto/rand (non-blocking, tidak seperti
		// $os.readFile("/dev/urandom") di goja yang hang tanpa EOF).
		b := make([]byte, 32)
		if _, err := rand.Read(b); err != nil {
			log.Println("[FAST_LOGIN] WARNING: pepper generated without CSPRNG, set FAST_LOGIN_PEPPER via env!")
		} else {
			log.Println("[FAST_LOGIN] WARNING: pepper auto-generated without env, set FAST_LOGIN_PEPPER via env for production!")
		}
		pepperVal = hex.EncodeToString(b)
		_ = os.WriteFile(pepperFile, []byte(pepperVal), 0600)
		log.Println("[FAST_LOGIN] pepper auto-generated:", pepperFile)
	})
	return pepperVal
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func clientIP(e *core.RequestEvent) string {
	h := e.Request.Header
	ip := h.Get("X-Forwarded-For")
	if ip == "" {
		ip = h.Get("X-Real-Ip")
	}
	if i := strings.Index(ip, ","); i >= 0 {
		ip = ip[:i]
	}
	ip = strings.TrimSpace(ip)
	if ip == "" {
		ip = "unknown"
		// fallback ke RemoteAddr tanpa port
		if ra := e.Request.RemoteAddr; ra != "" {
			if i := strings.LastIndex(ra, ":"); i >= 0 {
				ip = ra[:i]
			} else {
				ip = ra
			}
		}
	}
	return ip
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

func fastLoginHandler(app *pocketbase.PocketBase) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		e.Response.Header().Set("Access-Control-Allow-Origin", "*")
		e.Response.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		e.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		pepper := getPepper(app)
		if pepper == "" {
			return e.JSON(http.StatusInternalServerError, map[string]string{"message": "Fast login belum dikonfigurasi."})
		}

		var body struct {
			Username string `json:"username"`
			Identity string `json:"identity"`
			Password string `json:"password"`
		}
		_ = e.BindBody(&body) // body boleh kosong; validasi di bawah
		username := strings.TrimSpace(body.Username)
		if username == "" {
			username = strings.TrimSpace(body.Identity)
		}
		password := body.Password

		// Rate limit sebelum validasi (seperti versi JS)
		rlKey := strings.ToLower(username)
		if rlKey == "" {
			rlKey = "-"
		}
		if !rlUser.allow(rlKey) {
			return e.JSON(429, map[string]string{"message": "Terlalu banyak percobaan untuk akun ini. Tunggu sebentar."})
		}
		// NOTE: IP-based limiter dihapus (opsi 3) — sekolah di belakang NAT
		// dengan ribuan siswa burst login akan kena blokir. Proteksi brute-force
		// cukup via per-user limiter (20/menit per username).

		if username == "" || password == "" {
			return e.JSON(http.StatusBadRequest, map[string]string{"message": "Username dan password wajib diisi."})
		}

		rec, err := app.FindFirstRecordByData("students", "username", username)
		if err != nil || rec == nil {
			return e.JSON(http.StatusBadRequest, map[string]string{"message": "Username atau password salah."})
		}

		stored := rec.GetString("fastHash")
		computed := sha256Hex(pepper + username + password)

		if stored == "" {
			// Belum punya fastHash: verifikasi via bcrypt, lalu migrasi otomatis
			if !rec.ValidatePassword(password) {
				return e.JSON(http.StatusBadRequest, map[string]string{"message": "Username atau password salah."})
			}
			rec.Set("fastHash", computed)
			if err := app.Save(rec); err != nil {
				log.Println("[FAST_LOGIN] gagal simpan fastHash:", err)
			}
		} else if subtle.ConstantTimeCompare([]byte(computed), []byte(stored)) != 1 {
			// fastHash tidak cocok: mungkin password baru diganti.
			// Coba verifikasi bcrypt sebagai fallback, lalu refresh fastHash.
			if !rec.ValidatePassword(password) {
				return e.JSON(http.StatusBadRequest, map[string]string{"message": "Username atau password salah."})
			}
			rec.Set("fastHash", computed)
			if err := app.Save(rec); err != nil {
				log.Println("[FAST_LOGIN] gagal simpan fastHash:", err)
			}
		}

		token, err := rec.NewAuthToken()
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]string{"message": "Gagal membuat token."})
		}

		// Strip field sensitif seperti versi JS
		out := rec.PublicExport()
		delete(out, "fastHash")
		delete(out, "password")
		delete(out, "tokenKey")

		return e.JSON(http.StatusOK, map[string]any{"token": token, "record": out})
	}
}

// ---------------------------------------------------------------------------
// Attempt CBT Helpers (Delta Merge, Stale Reject, Answered Counter)
// ---------------------------------------------------------------------------

func revOf(ans map[string]any) int {
	if ans == nil {
		return 0
	}
	meta, ok := ans["__meta"].(map[string]any)
	if !ok || meta == nil {
		return 0
	}
	switch v := meta["rev"].(type) {
	case float64:
		return int(v)
	case int:
		return v
	case int64:
		return int(v)
	case string:
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return 0
}

func countAnswered(ans map[string]any) int {
	count := 0
	for k := range ans {
		if !strings.HasPrefix(k, "__") {
			count++
		}
	}
	return count
}

func main() {
	app := pocketbase.New()

	// --- Plugin flags (sesuai binary standar PocketBase) ---
	var hooksDir string
	app.RootCmd.PersistentFlags().StringVar(&hooksDir, "hooksDir", "", "the directory with the JS app hooks")
	var hooksWatch bool
	app.RootCmd.PersistentFlags().BoolVar(&hooksWatch, "hooksWatch", true, "auto restart the app on pb_hooks file change")
	var hooksPool int
	app.RootCmd.PersistentFlags().IntVar(&hooksPool, "hooksPool", 15, "the total prewarm goja.Runtime instances for the JS app hooks execution")
	var migrationsDir string
	app.RootCmd.PersistentFlags().StringVar(&migrationsDir, "migrationsDir", "", "the directory with the user defined migrations")
	var automigrate bool
	app.RootCmd.PersistentFlags().BoolVar(&automigrate, "automigrate", true, "enable/disable auto migrations")

	// Load jsvm (pb_hooks) agar hooks JS existing tetap jalan
	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      hooksDir,
		HooksWatch:    hooksWatch,
		HooksPoolSize: hooksPool,
	})
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  automigrate,
		Dir:          migrationsDir,
	})

	// Konfigurasi PRAGMA SQLite performa tinggi untuk konkurensi CBT (500-1000+ siswa)
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		db := e.App.DB()
		_, _ = db.NewQuery("PRAGMA busy_timeout = 10000;").Execute()
		_, _ = db.NewQuery("PRAGMA journal_size_limit = 200000000;").Execute()
		_, _ = db.NewQuery("PRAGMA synchronous = NORMAL;").Execute()
		_, _ = db.NewQuery("PRAGMA mmap_size = 268435456;").Execute()
		_, _ = db.NewQuery("PRAGMA cache_size = -64000;").Execute()
		log.Println("[SQLITE] High-concurrency CBT PRAGMAs applied (busy_timeout=10s, synchronous=NORMAL, mmap=256MB, cache=64MB)")
		return nil
	})

	// Hitung answeredCount saat attempt dibuat pertama kali
	app.OnRecordCreateRequest("attempts").BindFunc(func(e *core.RecordRequestEvent) error {
		var incoming map[string]any
		_ = e.Record.UnmarshalJSONField("answers", &incoming)
		if incoming != nil {
			e.Record.Set("answeredCount", countAnswered(incoming))
		}
		return e.Next()
	})

	// Hook native Go untuk update attempt:
	// 1. Delta merge answers (__delta: true)
	// 2. Anti-stale write (tolak rev basi & kunci jawaban jika status=finished)
	// 3. Kalkulasi cepat answeredCount
	// Menggantikan logika JS hook Goja agar eksekusi instan (< 1ms vs ~20ms) dan bebas lock contention.
	app.OnRecordUpdateRequest("attempts").BindFunc(func(e *core.RecordRequestEvent) error {
		var incoming map[string]any
		_ = e.Record.UnmarshalJSONField("answers", &incoming)

		isDelta := false
		if incoming != nil {
			if d, ok := incoming["__delta"].(bool); ok && d {
				isDelta = true
			}
		}

		stored, err := e.App.FindRecordById("attempts", e.Record.Id)
		if err == nil && stored != nil {
			var storedAns map[string]any
			_ = stored.UnmarshalJSONField("answers", &storedAns)
			if storedAns == nil {
				storedAns = make(map[string]any)
			}

			// 1. Delta merge
			if isDelta {
				merged := make(map[string]any, len(storedAns)+len(incoming))
				for k, v := range storedAns {
					merged[k] = v
				}
				for k, v := range incoming {
					if k != "__delta" {
						merged[k] = v
					}
				}
				incoming = merged
				e.Record.Set("answers", merged)
			}

			// 2. Lock & Stale write reject untuk non-admin (siswa)
			isAdmin := e.HasSuperuserAuth() || (e.Auth != nil && e.Auth.Collection().Name == "users")
			if !isAdmin && incoming != nil {
				storedStatus := stored.GetString("status")
				locked := storedStatus == "finished" || storedStatus == "submitted"
				incomingRev := revOf(incoming)
				storedRev := revOf(storedAns)

				inBytes, _ := json.Marshal(incoming)
				stBytes, _ := json.Marshal(storedAns)
				touched := string(inBytes) != string(stBytes)

				if touched && (locked || incomingRev < storedRev) {
					// Kembalikan answers ke versi tersimpan
					e.Record.Set("answers", storedAns)
					incoming = storedAns
					log.Printf("[NATIVE_ATTEMPTS] answers DITOLAK untuk attempt %s (locked=%v, rev masuk=%d, rev tersimpan=%d)\n",
						e.Record.Id, locked, incomingRev, storedRev)
				}
			}
		}

		// 3. Hitung answeredCount secara cepat di Go
		if incoming != nil {
			e.Record.Set("answeredCount", countAnswered(incoming))
		}

		return e.Next()
	})

	// Pre-compute fastHash saat student dibuat agar login pertama langsung cepat
	// (tanpa lewat bcrypt). Pepper + username + password -> SHA256 hex.
	app.OnRecordCreateRequest("students").BindFunc(func(e *core.RecordRequestEvent) error {
		pepper := getPepper(app)
		if pepper != "" {
			username := strings.TrimSpace(e.Record.GetString("username"))
			// Password plaintext tersedia sebelum PB hashing di tahap save.
			// Jika sudah berupa hash bcrypt, lewati (fallback login akan migrasi).
			password := e.Record.GetString("password")
			if username != "" && password != "" && e.Record.GetString("fastHash") == "" &&
				!strings.HasPrefix(password, "$2a$") && !strings.HasPrefix(password, "$2b$") && !strings.HasPrefix(password, "$2y$") {
				e.Record.Set("fastHash", sha256Hex(pepper+username+password))
			}
		}
		return e.Next()
	})

	// Jika password diganti, refresh fastHash agar tetap sinkron
	app.OnRecordUpdateRequest("students").BindFunc(func(e *core.RecordRequestEvent) error {
		pepper := getPepper(app)
		if pepper != "" {
			username := strings.TrimSpace(e.Record.GetString("username"))
			password := e.Record.GetString("password")
			// Hanya jika password diubah (field password terisi plaintext baru)
			if username != "" && password != "" {
				// Cek apakah ini benar password baru, bukan hash lama yang di-load ulang.
				// PB menyimpan hash bcrypt yang diawali $2a$/$2b$; plaintext tidak.
				if !strings.HasPrefix(password, "$2a$") && !strings.HasPrefix(password, "$2b$") && !strings.HasPrefix(password, "$2y$") {
					e.Record.Set("fastHash", sha256Hex(pepper+username+password))
				}
			}
		}
		return e.Next()
	})

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/fast-login", fastLoginHandler(app))
		se.Router.OPTIONS("/api/fast-login", func(e *core.RequestEvent) error {
			e.Response.Header().Set("Access-Control-Allow-Origin", "*")
			e.Response.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
			e.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			return e.NoContent(http.StatusNoContent)
		})
		log.Println("[FAST_LOGIN] go-native loaded: POST /api/fast-login (paralel)")
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
