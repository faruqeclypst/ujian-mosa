// pb-examku: PocketBase v0.36.9 dengan endpoint auth native Go (paralel).
//
// Fast login untuk siswa — alternatif ringan pengganti bcrypt.
// POST /api/fast-login { username, password }
// Verifikasi: SHA-256(pepper + username + password) vs field fastHash.
// Pepper dari env FAST_LOGIN_PEPPER (disarankan) atau file
// <dataDir>/../fastlogin_pepper.key (auto-generate via crypto/rand).
// Rate limit: 20/menit per-akun + 2000/menit per-IP (ramah NAT sekolah).
// HANYA untuk collection "students".
//
// Login kartu ujian juga native: POST /api/student/exam-login
// { username|nisn, password } — verifikasi examPassword plain vs record
// siswa (examUsername || username || examNumber), terbitkan token auth.
// Plus POST /api/student/generate-exam-credentials untuk generate massal
// kredensial kartu. Keduanya menggantikan pb_hooks/student_exam_login.pb.js
// yang serial (goja) dan kolaps pada badai login (LT43: 2.155/2.500 gagal
// di tahap attempt, instance OOM). Versi Go ini paralel penuh.
package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"log"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"strconv"
	"sync"
	"time"

	"github.com/pocketbase/dbx"
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
// Login kartu ujian (exam-login) + generate kredensial — native Go.
// Kontrak respons identik dengan hook JS lama agar frontend tidak berubah.
// ---------------------------------------------------------------------------

func setExamCORS(e *core.RequestEvent) {
	h := e.Response.Header()
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Token")
}

func examOptionsHandler(e *core.RequestEvent) error {
	setExamCORS(e)
	return e.NoContent(http.StatusNoContent)
}

// POST /api/student/exam-login { username|nisn, password }
// Siswa login dengan kredensial tercetak di kartu ujian (examUsername /
// username NISN / examNumber + examPassword plain), terhubung ke akun
// siswa sebenarnya tanpa password akun pribadi.
func examLoginHandler(app *pocketbase.PocketBase) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		setExamCORS(e)

		var body struct {
			Username string `json:"username"`
			Nisn     string `json:"nisn"`
			Password string `json:"password"`
		}
		_ = e.BindBody(&body) // body boleh kosong; validasi di bawah
		username := strings.TrimSpace(body.Username)
		if username == "" {
			username = strings.TrimSpace(body.Nisn)
		}
		password := strings.TrimSpace(body.Password)

		if username == "" || password == "" {
			return e.JSON(http.StatusBadRequest, map[string]any{
				"ok": false, "message": "Username dan Password ujian wajib diisi."})
		}

		student, err := app.FindFirstRecordByFilter(
			"students",
			"examUsername = {:u} || username = {:u} || examNumber = {:u}",
			dbx.Params{"u": username},
		)
		if err != nil || student == nil {
			return e.JSON(http.StatusNotFound, map[string]any{
				"ok": false, "message": "Akun peserta ujian tidak ditemukan."})
		}

		saved := student.GetString("examPassword")
		if saved == "" || subtle.ConstantTimeCompare([]byte(saved), []byte(password)) != 1 {
			return e.JSON(http.StatusUnauthorized, map[string]any{
				"ok": false, "message": "Kredensial ujian tidak cocok. Pastikan username dan password sesuai dengan yang tercetak di kartu ujian."})
		}

		token, err := student.NewAuthToken()
		if err != nil || token == "" {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"ok": false, "message": "Gagal membuat sesi login peserta ujian."})
		}

		// Samakan dengan fast-login: jangan bocorkan field sensitif.
		out := student.PublicExport()
		delete(out, "password")
		delete(out, "tokenKey")
		delete(out, "fastHash")

		return e.JSON(http.StatusOK, map[string]any{
			"ok": true, "token": token, "record": out, "examLogin": true})
	}
}

// POST /api/student/generate-exam-credentials { prefix?, studentIds?, onlyEmpty? }
// Generate / regenerate examUsername + examPassword massal dalam 1 transaksi.
func generateExamCredentialsHandler(app *pocketbase.PocketBase) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		setExamCORS(e)

		var body struct {
			Prefix     string   `json:"prefix"`
			StudentIDs []string `json:"studentIds"`
			OnlyEmpty  bool     `json:"onlyEmpty"`
		}
		_ = e.BindBody(&body)
		prefix := strings.ToUpper(strings.TrimSpace(body.Prefix))
		if prefix == "" {
			prefix = "TU"
		}

		query := "SELECT id, username FROM students WHERE 1=1"
		if body.OnlyEmpty {
			query += " AND (examUsername = '' OR examUsername IS NULL OR examPassword = '' OR examPassword IS NULL)"
		}

		type credRow struct {
			ID       string `db:"id"`
			Username string `db:"username"`
		}
		rows := []credRow{}
		if err := app.DB().NewQuery(query).All(&rows); err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"ok": false, "message": "Gagal menghasilkan kredensial ujian: " + err.Error()})
		}

		targets := rows
		if len(body.StudentIDs) > 0 {
			set := make(map[string]bool, len(body.StudentIDs))
			for _, id := range body.StudentIDs {
				set[id] = true
			}
			targets = nil
			for _, r := range rows {
				if set[r.ID] {
					targets = append(targets, r)
				}
			}
		}

		type genCred struct {
			ID           string `json:"id"`
			ExamUsername string `json:"examUsername"`
			ExamPassword string `json:"examPassword"`
		}
		generated := make([]genCred, 0, len(targets))
		updated := 0

		// Satu transaksi SQLite untuk seluruh siswa (1 fsync), seperti versi JS.
		err := app.RunInTransaction(func(txApp core.App) error {
			for _, r := range targets {
				nisn := strings.TrimSpace(r.Username)
				examUser := prefix + nisn
				if nisn == "" {
					short := r.ID
					if len(short) > 8 {
						short = short[:8]
					}
					examUser = prefix + short
				}

				// Password acak 5 digit angka + '*' (contoh: 28327*)
				n, rerr := rand.Int(rand.Reader, big.NewInt(90000))
				num := int64(10000)
				if rerr == nil {
					num += n.Int64()
				}
				examPass := strconv.FormatInt(num, 10) + "*"

				if _, err := txApp.DB().NewQuery(
					"UPDATE students SET examUsername = {:u}, examPassword = {:p} WHERE id = {:id}",
				).Bind(dbx.Params{"u": examUser, "p": examPass, "id": r.ID}).Execute(); err != nil {
					log.Println("[GENERATE_EXAM_CREDENTIALS_ERR] Student id:", r.ID, err)
					continue
				}
				updated++
				generated = append(generated, genCred{ID: r.ID, ExamUsername: examUser, ExamPassword: examPass})
			}
			return nil
		})
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"ok": false, "message": "Gagal menghasilkan kredensial ujian: " + err.Error()})
		}

		return e.JSON(http.StatusOK, map[string]any{
			"ok":           true,
			"message":      "Berhasil menghasilkan kredensial ujian untuk " + strconv.Itoa(updated) + " siswa dalam sekejap.",
			"updatedCount": updated,
			"prefix":       prefix,
			"credentials":  generated,
		})
	}
}

// ---------------------------------------------------------------------------
// Start attempt native + bulk create/delete untuk import & hapus massal.
// Jalur API record biasa mengantre di badai (LT45: create attempt p50 11 dtk)
// dan loop per-record di frontend membuat import/hapus ribuan baris lambat.
// Endpoint ini: auth token -> 1 transaksi -> respons ringkas.
// ---------------------------------------------------------------------------

// authFromHeader mengambil record auth dari header Authorization
// (token mentah ala SDK PocketBase, atau skema Bearer).
func authFromHeader(app *pocketbase.PocketBase, e *core.RequestEvent) *core.Record {
	token := strings.TrimSpace(strings.TrimPrefix(e.Request.Header.Get("Authorization"), "Bearer "))
	if token == "" {
		return nil
	}
	rec, err := app.FindAuthRecordByToken(token)
	if err != nil {
		return nil
	}
	return rec
}

func isStaff(rec *core.Record) bool {
	if rec == nil {
		return false
	}
	name := rec.Collection().Name
	return name == "_superusers" || name == "users"
}

// POST /api/student/start-attempt { examRoomId, answers?, startedAt? }
// Membuat (atau memakai ulang) attempt ongoing siswa yang login.
// Di server offline (di luar path cloud) endpoint menolak halus (403
// NATIVE_UNAVAILABLE) agar klien fallback ke jalur lama tempat gerbang
// lisensi offline ditegakkan — penegakan itu tidak boleh dilompati.
func startAttemptHandler(app *pocketbase.PocketBase) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		setExamCORS(e)

		dataDir := app.DataDir()
		if !strings.Contains(dataDir, "/opt/pocketbase") && !strings.Contains(dataDir, "/schools/") {
			return e.JSON(http.StatusForbidden, map[string]any{
				"ok": false, "code": "NATIVE_UNAVAILABLE",
				"message": "Endpoint native tidak dipakai di server offline."})
		}

		authRec := authFromHeader(app, e)
		if authRec == nil {
			return e.JSON(http.StatusUnauthorized, map[string]any{
				"ok": false, "message": "Sesi login tidak valid."})
		}
		if authRec.Collection().Name != "students" {
			return e.JSON(http.StatusForbidden, map[string]any{
				"ok": false, "message": "Hanya siswa yang dapat memulai attempt."})
		}

		var body struct {
			ExamRoomID string         `json:"examRoomId"`
			Answers    map[string]any `json:"answers"`
			StartedAt  string         `json:"startedAt"`
		}
		_ = e.BindBody(&body)
		roomID := strings.TrimSpace(body.ExamRoomID)
		if roomID == "" {
			return e.JSON(http.StatusBadRequest, map[string]any{
				"ok": false, "message": "examRoomId wajib diisi."})
		}
		if _, err := app.FindRecordById("exam_rooms", roomID); err != nil {
			return e.JSON(http.StatusNotFound, map[string]any{
				"ok": false, "message": "Ruang ujian tidak ditemukan."})
		}

		now := time.Now().UTC()
		var result *core.Record
		existing := false
		err := app.RunInTransaction(func(txApp core.App) error {
			// Dedupe: attempt ongoing siswa+ruang yang sama dipakai ulang
			// (pengganti cek getFullList + create di klien).
			found, ferr := txApp.FindFirstRecordByFilter("attempts",
				"studentId = {:s} && examRoomId = {:r} && status = 'ongoing'",
				dbx.Params{"s": authRec.Id, "r": roomID})
			if ferr == nil && found != nil {
				result = found
				existing = true
				return nil
			}
			coll, cerr := txApp.FindCollectionByNameOrId("attempts")
			if cerr != nil {
				return cerr
			}
			rec := core.NewRecord(coll)
			rec.Set("examRoomId", roomID)
			rec.Set("studentId", authRec.Id)
			rec.Set("status", "ongoing")
			rec.Set("cheatCount", 0)
			if body.Answers != nil {
				rec.Set("answers", body.Answers)
			}
			rec.Set("answeredCount", 0)
			if strings.TrimSpace(body.StartedAt) != "" {
				rec.Set("startedAt", body.StartedAt)
			} else {
				rec.Set("startedAt", now)
			}
			rec.Set("isOnline", true)
			rec.Set("lastHeartbeat", now)
			if err := txApp.Save(rec); err != nil {
				return err
			}
			result = rec
			return nil
		})
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"ok": false, "message": "Gagal memulai attempt: " + err.Error()})
		}

		return e.JSON(http.StatusOK, map[string]any{
			"ok": true, "existing": existing, "record": result.PublicExport()})
	}
}

var bulkCreateWhitelist = map[string]bool{
	"questions": true, "students": true, "classes": true, "subjects": true,
	"teachers": true, "users": true,
}

var bulkDeleteWhitelist = map[string]bool{
	"questions": true, "attempts": true, "exams": true, "exam_rooms": true,
	"students": true, "classes": true, "subjects": true,
	"teachers": true, "users": true,
}

// POST /api/bulk/create { collection, records: [...] } — khusus staf.
// Semua record dibuat dalam 1 transaksi; kegagalan per baris dilaporkan
// per indeks tanpa membatalkan baris lain.
func bulkCreateHandler(app *pocketbase.PocketBase) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		setExamCORS(e)

		if !isStaff(authFromHeader(app, e)) {
			return e.JSON(http.StatusForbidden, map[string]any{
				"ok": false, "message": "Hanya staf yang dapat memakai bulk create."})
		}

		var body struct {
			Collection string           `json:"collection"`
			Records    []map[string]any `json:"records"`
		}
		_ = e.BindBody(&body)
		if !bulkCreateWhitelist[body.Collection] {
			return e.JSON(http.StatusBadRequest, map[string]any{
				"ok": false, "message": "Collection tidak diizinkan untuk bulk create: " + body.Collection})
		}
		if len(body.Records) == 0 || len(body.Records) > 2000 {
			return e.JSON(http.StatusBadRequest, map[string]any{
				"ok": false, "message": "Jumlah records harus 1..2000."})
		}

		type rowErr struct {
			Index   int    `json:"index"`
			Message string `json:"message"`
		}
		ids := make([]string, 0, len(body.Records))
		rowErrs := make([]rowErr, 0)

		err := app.RunInTransaction(func(txApp core.App) error {
			coll, cerr := txApp.FindCollectionByNameOrId(body.Collection)
			if cerr != nil {
				return cerr
			}
			pepper := ""
			if body.Collection == "students" {
				pepper = getPepper(app)
			}
			for i, m := range body.Records {
				rec := core.NewRecord(coll)
				if body.Collection == "students" || body.Collection == "users" {
					// Samakan perilaku jalur request untuk collection auth:
					// lengkapi passwordConfirm. fastHash hanya untuk students
					// (fast-login memang hanya mencari di students).
					if pw, ok := m["password"].(string); ok && pw != "" {
						if _, has := m["passwordConfirm"]; !has {
							m["passwordConfirm"] = pw
						}
						if body.Collection == "students" && pepper != "" {
							if un, ok := m["username"].(string); ok && strings.TrimSpace(un) != "" {
								if _, has := m["fastHash"]; !has {
									m["fastHash"] = sha256Hex(pepper + strings.TrimSpace(un) + pw)
								}
							}
						}
					}
				}
				for k, v := range m {
					rec.Set(k, v)
				}
				if err := txApp.Save(rec); err != nil {
					rowErrs = append(rowErrs, rowErr{Index: i, Message: err.Error()})
					continue
				}
				ids = append(ids, rec.Id)
			}
			return nil
		})
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"ok": false, "message": "Bulk create gagal: " + err.Error()})
		}

		return e.JSON(http.StatusOK, map[string]any{
			"ok": true, "created": len(ids), "ids": ids, "errors": rowErrs})
	}
}

var bulkUpdateWhitelist = map[string]bool{
	"questions": true, "students": true, "classes": true, "subjects": true,
}

// POST /api/bulk/update { collection, records: [{id, ...fields}] } — khusus staf.
// Semua update dalam 1 transaksi; baris yang id-nya tidak ditemukan atau
// gagal validasi dilaporkan per indeks tanpa membatalkan baris lain.
func bulkUpdateHandler(app *pocketbase.PocketBase) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		setExamCORS(e)

		if !isStaff(authFromHeader(app, e)) {
			return e.JSON(http.StatusForbidden, map[string]any{
				"ok": false, "message": "Hanya staf yang dapat memakai bulk update."})
		}

		var body struct {
			Collection string           `json:"collection"`
			Records    []map[string]any `json:"records"`
		}
		_ = e.BindBody(&body)
		if !bulkUpdateWhitelist[body.Collection] {
			return e.JSON(http.StatusBadRequest, map[string]any{
				"ok": false, "message": "Collection tidak diizinkan untuk bulk update: " + body.Collection})
		}
		if len(body.Records) == 0 || len(body.Records) > 2000 {
			return e.JSON(http.StatusBadRequest, map[string]any{
				"ok": false, "message": "Jumlah records harus 1..2000."})
		}

		type rowErr struct {
			Index   int    `json:"index"`
			ID      string `json:"id"`
			Message string `json:"message"`
		}
		rowErrs := make([]rowErr, 0)
		updated := 0

		err := app.RunInTransaction(func(txApp core.App) error {
			pepper := ""
			if body.Collection == "students" {
				pepper = getPepper(app)
			}
			for i, m := range body.Records {
				idVal, _ := m["id"].(string)
				if strings.TrimSpace(idVal) == "" {
					rowErrs = append(rowErrs, rowErr{Index: i, Message: "id kosong"})
					continue
				}
				rec, ferr := txApp.FindRecordById(body.Collection, idVal)
				if ferr != nil || rec == nil {
					rowErrs = append(rowErrs, rowErr{Index: i, ID: idVal, Message: "record tidak ditemukan"})
					continue
				}
				if body.Collection == "students" {
					// Ganti password lewat bulk: lengkapi passwordConfirm +
					// hitung ulang fastHash dengan username efektif.
					if pw, ok := m["password"].(string); ok && pw != "" {
						if _, has := m["passwordConfirm"]; !has {
							m["passwordConfirm"] = pw
						}
						if pepper != "" {
							un := rec.GetString("username")
							if u2, ok := m["username"].(string); ok && strings.TrimSpace(u2) != "" {
								un = strings.TrimSpace(u2)
							}
							m["fastHash"] = sha256Hex(pepper + un + pw)
						}
					}
				}
				for k, v := range m {
					if k == "id" {
						continue
					}
					rec.Set(k, v)
				}
				if err := txApp.Save(rec); err != nil {
					rowErrs = append(rowErrs, rowErr{Index: i, ID: idVal, Message: err.Error()})
					continue
				}
				updated++
			}
			return nil
		})
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"ok": false, "message": "Bulk update gagal: " + err.Error()})
		}

		return e.JSON(http.StatusOK, map[string]any{
			"ok": true, "updated": updated, "errors": rowErrs})
	}
}

// POST /api/bulk/delete { collection, ids: [...] } — khusus staf.
// Semua penghapusan dalam 1 transaksi lewat app.Delete (hook model +
// pembersihan file tetap berjalan), kegagalan per id dilaporkan.
func bulkDeleteHandler(app *pocketbase.PocketBase) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		setExamCORS(e)

		if !isStaff(authFromHeader(app, e)) {
			return e.JSON(http.StatusForbidden, map[string]any{
				"ok": false, "message": "Hanya staf yang dapat memakai bulk delete."})
		}

		var body struct {
			Collection string   `json:"collection"`
			IDs        []string `json:"ids"`
		}
		_ = e.BindBody(&body)
		if !bulkDeleteWhitelist[body.Collection] {
			return e.JSON(http.StatusBadRequest, map[string]any{
				"ok": false, "message": "Collection tidak diizinkan untuk bulk delete: " + body.Collection})
		}
		if len(body.IDs) == 0 || len(body.IDs) > 5000 {
			return e.JSON(http.StatusBadRequest, map[string]any{
				"ok": false, "message": "Jumlah ids harus 1..5000."})
		}

		type rowErr struct {
			ID      string `json:"id"`
			Message string `json:"message"`
		}
		rowErrs := make([]rowErr, 0)
		deleted := 0

		err := app.RunInTransaction(func(txApp core.App) error {
			for _, id := range body.IDs {
				rec, ferr := txApp.FindRecordById(body.Collection, id)
				if ferr != nil || rec == nil {
					rowErrs = append(rowErrs, rowErr{ID: id, Message: "record tidak ditemukan"})
					continue
				}
				if err := txApp.Delete(rec); err != nil {
					rowErrs = append(rowErrs, rowErr{ID: id, Message: err.Error()})
					continue
				}
				deleted++
			}
			return nil
		})
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"ok": false, "message": "Bulk delete gagal: " + err.Error()})
		}

		return e.JSON(http.StatusOK, map[string]any{
			"ok": true, "deleted": deleted, "errors": rowErrs})
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
		se.Router.POST("/api/student/exam-login", examLoginHandler(app))
		se.Router.OPTIONS("/api/student/exam-login", examOptionsHandler)
		se.Router.POST("/api/student/generate-exam-credentials", generateExamCredentialsHandler(app))
		se.Router.OPTIONS("/api/student/generate-exam-credentials", examOptionsHandler)
		log.Println("[EXAM_LOGIN] go-native loaded: POST /api/student/exam-login + generate-exam-credentials (paralel)")
		se.Router.POST("/api/student/start-attempt", startAttemptHandler(app))
		se.Router.OPTIONS("/api/student/start-attempt", examOptionsHandler)
		se.Router.POST("/api/bulk/create", bulkCreateHandler(app))
		se.Router.OPTIONS("/api/bulk/create", examOptionsHandler)
		se.Router.POST("/api/bulk/update", bulkUpdateHandler(app))
		se.Router.OPTIONS("/api/bulk/update", examOptionsHandler)
		se.Router.POST("/api/bulk/delete", bulkDeleteHandler(app))
		se.Router.OPTIONS("/api/bulk/delete", examOptionsHandler)
		log.Println("[START_ATTEMPT+BULK] go-native loaded: POST /api/student/start-attempt, /api/bulk/create, /api/bulk/update, /api/bulk/delete")
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
