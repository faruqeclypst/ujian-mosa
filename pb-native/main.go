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
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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

var (
	rlUser = newRateLimiter(20)   // per-username: cegah brute force 1 akun
	rlIP   = newRateLimiter(2000) // per-IP longgar: ramah NAT sekolah
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
		if !rlIP.allow(clientIP(e)) {
			return e.JSON(429, map[string]string{"message": "Terlalu banyak percobaan. Tunggu sebentar."})
		}

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
