#!/bin/bash

# ==========================================================================
# E-UJIAN SCHOOL SETUP AUTOMATION
# Dasar script dari E-Ujian Master Handbook
# ==========================================================================

# Pastikan dijalankan sebagai root atau dengan sudo
if [[ $EUID -ne 0 ]]; then
   echo "Script ini harus dijalankan sebagai root (gunakan sudo)." 
   exit 1
fi

# Variabel Input
read -p "Masukkan Nama Sekolah (contoh: sch-smanmodalbangsa): " SCHOOL_NAME
read -p "Masukkan Domain (contoh: ujian.sekolah-a.com): " DOMAIN
read -p "Masukkan Port (contoh: 8090): " PORT
read -p "Masukkan Email Admin (default: admin@mosa.com): " ADMIN_EMAIL
# Jika kosong, gunakan default
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@mosa.com}
read -p "Masukkan Password Admin (min 10 karakter): " ADMIN_PASS

# Validasi input
if [[ -z "$SCHOOL_NAME" || -z "$DOMAIN" || -z "$PORT" || -z "$ADMIN_PASS" ]]; then
    echo "Error: Field Nama, Domain, Port, dan Password harus diisi!"
    exit 1
fi

BASE_DIR="/var/www/$SCHOOL_NAME"

# Tambahan: Cek apakah kita ingin memindahkah file dari root ke base_dir
CURRENT_DIR=$(pwd)

echo "----------------------------------------------------"
echo "Menyiapkan lingkungan untuk: $DOMAIN ($SCHOOL_NAME) di Port: $PORT"
echo "----------------------------------------------------"

# 1. Buat struktur folder
echo "[1/5] Membuat direktori di $BASE_DIR..."
mkdir -p "$BASE_DIR/pb_public"

# 2. Download/Copy PocketBase
# Cek apakah pocketbase sudah ada di folder /usr/local/bin (Global)
if [ ! -f "/usr/local/bin/pocketbase" ]; then
    echo "PocketBase belum terinstal secara global. Mengunduh versi terbaru..."
    wget https://github.com/pocketbase/pocketbase/releases/download/v0.36.8/pocketbase_0.36.8_linux_amd64.zip
    apt install unzip -y
    unzip pocketbase_0.36.8_linux_amd64.zip -d /usr/local/bin/
    rm pocketbase_0.36.8_linux_amd64.zip
    chmod +x /usr/local/bin/pocketbase
fi

# Copy executable ke folder lokal (opsional, tapi disarankan per instance)
cp /usr/local/bin/pocketbase "$BASE_DIR/pocketbase"

# 2.5 Deploy Website Files (React dist)
echo "[1.5/5] Mendeploy file website ke $BASE_DIR/pb_public..."
if [ -d "$CURRENT_DIR/dist" ]; then
    cp -r "$CURRENT_DIR/dist/"* "$BASE_DIR/pb_public/"
    echo "Berhasil menyalin file dari $CURRENT_DIR/dist ke $BASE_DIR/pb_public"
elif [ -d "$CURRENT_DIR/pb_public" ]; then
    cp -r "$CURRENT_DIR/pb_public/"* "$BASE_DIR/pb_public/"
    echo "Berhasil menyalin file dari $CURRENT_DIR/pb_public ke $BASE_DIR/pb_public"
else
    echo "Peringatan: Tidak ditemukan folder 'dist' atau 'pb_public' di $CURRENT_DIR."
    echo "Pastikan Anda sudah menjalankan 'npm run build' jika ini adalah project React."
fi

# 2.6 Sinkronisasi Struktur Database (Migrations)
echo "[1.6/5] Menyalin struktur database (migrations) ke $BASE_DIR..."
if [ -d "$CURRENT_DIR/pb_migrations" ]; then
    cp -r "$CURRENT_DIR/pb_migrations" "$BASE_DIR/"
    echo "Folder pb_migrations ditemukan dan berhasil disalin."
elif [ -f "$CURRENT_DIR/pb_schema.json" ]; then
    mkdir -p "$BASE_DIR/pb_migrations"
    cp "$CURRENT_DIR/pb_schema.json" "$BASE_DIR/pb_schema.json"
    echo "File pb_schema.json ditemukan. Anda bisa meng-import-nya secara manual di Dashboard Admin atau menggunakan migrasi."
fi

# 3. Buat Systemd Service agar PocketBase jalan di background
echo "[2/5] Membuat Systemd Service (pb-$SCHOOL_NAME.service)..."
cat <<EOF > /etc/systemd/system/pb-$SCHOOL_NAME.service
[Unit]
Description=PocketBase for $SCHOOL_NAME
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$BASE_DIR
ExecStart=$BASE_DIR/pocketbase serve --http="127.0.0.1:$PORT"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Jalankan Service
systemctl daemon-reload
systemctl enable pb-$SCHOOL_NAME
systemctl start pb-$SCHOOL_NAME

# 4. Buat Konfigurasi Nginx
echo "[3/5] Membuat konfigurasi Nginx..."
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
cat <<EOF > "$NGINX_CONF"
server {
    listen 80;
    server_name $DOMAIN;
    root $BASE_DIR/pb_public;
    index index.html;

    # Mendukung React Router (SPA)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Teruskan request API dan Admin ke PocketBase
    location ~ ^/(api|_) {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Max upload size (untuk upload file ujian/foto)
    client_max_body_size 100M;
}
EOF

# Active Nginx Config
ln -s "$NGINX_CONF" "/etc/nginx/sites-enabled/"

# 5. Buat Akun Admin PocketBase
echo "[4/5] Membuat akun admin PocketBase..."
cd "$BASE_DIR"
# Jalankan perintah migrate up dulu agar tabel sistem (admin) terbentuk
./pocketbase migrate up

# Jalankan perintah create superuser
./pocketbase superuser create "$ADMIN_EMAIL" "$ADMIN_PASS" || echo "Info: Akun superuser mungkin sudah ada atau format tidak valid."

# 6. Cek Nginx dan Restart
echo "[5/5] Memverifikasi dan Restart Nginx..."
nginx -t
if [ $? -eq 0 ]; then
    systemctl restart nginx
    echo "----------------------------------------------------"
    echo "BERHASIL! Sekolah baru telah di-setup."
    echo "Domain: http://$DOMAIN"
    echo "PocketBase Admin: http://$DOMAIN/_/"
    echo "Direktori Deploy: $BASE_DIR"
    echo "----------------------------------------------------"
    echo "Langkah selanjutnya:"
    echo "1. Pastikan DNS A-Record $DOMAIN sudah diarahkan ke IP VPS ini."
    echo "2. Jalankan certbot --nginx untuk SSL."
else
    echo "Terjadi kesalahan pada konfigurasi Nginx!"
fi
