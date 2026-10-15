# fast_login.pb.js — DIGANTI oleh Go native

File `fast_login.pb.js` dipindah ke sini pada 2026-10-15 karena
`/api/fast-login` sekarang diimplementasikan native di Go
(di dalam binary `pocketbase` custom, source: `~/workspace/pb-examku/main.go`).

Alasan: hook JS jalan serial di goja (~20 req/detik). Versi Go paralel
penuh (612 req/detik terukur).

JANGAN taruh kembali `fast_login.pb.js` ke `pb_hooks/` — akan menyebabkan
panic "route conflict" karena Go binary sudah mendaftarkan route yang sama.

Rollback: kembalikan file ini ke `pb_hooks/` DAN ganti binary dengan
`pocketbase.stock.bak` (tersimpan di tiap folder sekolah di VPS).
