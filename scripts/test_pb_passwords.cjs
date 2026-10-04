const http = require('http');

const candidates = [
  'admin',
  'admin123',
  'admin1234',
  'admin12345',
  'admin123456',
  '123456',
  '12345678',
  'password',
  'password123',
  'exam',
  'examaa',
  'examku',
  'sd1pagarair',
  'admin@gmail.com',
  'Admin123',
  'Admin123!',
  'admin@123',
  'superadmin',
  'bismillah',
  'indonesia',
  '123456789',
  '1234567890'
];

async function tryAuth(identity, password) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ identity, password });
    const req = http.request(
      'http://127.0.0.1:8090/api/collections/users/auth-with-password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 2000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('error', (err) => resolve({ error: err.message }));
    req.write(data);
    req.end();
  });
}

async function trySuperuser(identity, password) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ identity, password });
    const req = http.request(
      'http://127.0.0.1:8090/api/collections/_superusers/auth-with-password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 2000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('error', (err) => resolve({ error: err.message }));
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("Mencoba kandidat password untuk admin@gmail.com di tabel users...");
  for (const pw of candidates) {
    const res = await tryAuth('admin@gmail.com', pw);
    if (res.status === 200) {
      console.log(`\n>>> BERHASIL (users)! Email: admin@gmail.com, Password: ${pw} <<<`);
      return;
    }
    const resUser = await tryAuth('admin', pw);
    if (resUser.status === 200) {
      console.log(`\n>>> BERHASIL (users)! Username: admin, Password: ${pw} <<<`);
      return;
    }
  }

  console.log("\nMencoba kandidat untuk _superusers (PocketBase Admin)...");
  for (const pw of candidates) {
    const res = await trySuperuser('admin@gmail.com', pw);
    if (res.status === 200) {
      console.log(`\n>>> BERHASIL (_superusers)! Email: admin@gmail.com, Password: ${pw} <<<`);
      return;
    }
  }

  console.log("\nTidak ada password kandidat umum yang cocok.");
}

main();
