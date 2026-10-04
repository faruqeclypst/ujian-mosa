const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const pbDataDir = path.resolve('offline_package', 'pb_data');
if (fs.existsSync(pbDataDir)) {
  fs.rmSync(pbDataDir, { recursive: true, force: true });
}
fs.mkdirSync(pbDataDir, { recursive: true });

const adminEmail = 'admin@examku.local';
const adminPass = 'AdminExam123!';

// Inisialisasi migration dulu
const mig = spawn(
  path.resolve('offline_package', 'pocketbase.exe'),
  ['migrate', 'up', `--dir=${pbDataDir}`],
  { stdio: 'inherit' }
);

mig.on('close', () => {
  const child = spawn(
    path.resolve('offline_package', 'pocketbase.exe'),
    ['superuser', 'create', adminEmail, adminPass, `--dir=${pbDataDir}`],
    { stdio: 'inherit' }
  );

  child.on('close', async (code) => {
    console.log('Superuser lokal siap. Memulai server untuk load schema...');

    const srv = spawn(
      path.resolve('offline_package', 'pocketbase.exe'),
      ['serve', '--http=127.0.0.1:8199', `--dir=${pbDataDir}`],
      { stdio: 'pipe' }
    );

    await new Promise(r => setTimeout(r, 2000));

    try {
      // Login via fetch
      const loginRes = await fetch('http://127.0.0.1:8199/api/collections/_superusers/auth-with-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: adminEmail, password: adminPass })
      });
      const loginData = await loginRes.json();
      if (!loginData.token) {
        throw new Error('Gagal login admin: ' + JSON.stringify(loginData));
      }
      const token = loginData.token;
      console.log('Login admin berhasil.');

      // Get existing collections to match IDs (e.g. users)
      const existingRes = await fetch('http://127.0.0.1:8199/api/collections?perPage=100', {
        headers: { 'Authorization': token }
      });
      const existingData = await existingRes.json();
      const existingMap = new Map((existingData.items || []).map(c => [c.name, c.id]));

      const schemaPath = path.resolve('vps', 'template_school', 'pb_schema.json');
      const schemaCollections = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

      for (const coll of schemaCollections) {
        if (existingMap.has(coll.name)) {
          coll.id = existingMap.get(coll.name);
        }
      }

      const importRes = await fetch('http://127.0.0.1:8199/api/collections/import', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          collections: schemaCollections,
          deleteMissing: false
        })
      });

      if (!importRes.ok) {
        const errText = await importRes.text();
        throw new Error('Gagal import collections: ' + errText);
      }
      console.log('Koleksi (exams, questions, attempts, settings, users, dll) berhasil diimport.');

      // Buat record settings awal
      const setRes = await fetch('http://127.0.0.1:8199/api/collections/settings/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          name: 'EXAM AA - Server Mandiri',
          primary_color: '#2563eb'
        })
      });
      console.log('Record settings awal dibuat.');

      // Buat akun admin proktor awal untuk login proktor di web (/admin)
      // role: admin
      const proctorRes = await fetch('http://127.0.0.1:8199/api/collections/users/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          name: 'Proktor Utama',
          email: 'proktor@exam.local',
          password: 'password123',
          passwordConfirm: 'password123',
          role: 'admin'
        })
      });
      console.log('Akun proktor ujian (/admin): proktor@exam.local / password123');

      console.log('\n======================================================');
      console.log('✅ SUKSES: Database offline_package/pb_data sudah 100% siap!');
      console.log('======================================================\n');
    } catch (err) {
      console.error('Error inisialisasi:', err);
    } finally {
      srv.kill();
      process.exit(0);
    }
  });
});
