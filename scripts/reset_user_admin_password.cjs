const PocketBase = require('pocketbase/cjs');

async function main() {
  const pb = new PocketBase('http://127.0.0.1:8090');

  try {
    // 1. Authenticate as Superuser (admin@gmail.com / 12345678)
    console.log("Mengautentikasi sebagai Superuser PocketBase...");
    await pb.collection('_superusers').authWithPassword('admin@gmail.com', '12345678');
    console.log("[+] Berhasil login sebagai Superuser!");

    // 2. Ambil list users
    const users = await pb.collection('users').getFullList();
    console.log(`[+] Ditemukan ${users.length} akun di tabel users:`);
    for (const u of users) {
      console.log(` - ID: ${u.id}, Email: ${u.email}, Username: ${u.username}, Role: ${u.role}, Name: ${u.name}`);
    }

    // 3. Kita update password akun admin@gmail.com menjadi "12345678" dan juga coba "admin123" / "admin"
    const targetUser = users.find(u => u.email === 'admin@gmail.com' || u.username === 'admin');
    if (targetUser) {
      console.log(`\nMenyetel ulang password untuk user ${targetUser.email || targetUser.username}...`);
      // Update password menjadi '12345678'
      await pb.collection('users').update(targetUser.id, {
        password: 'admin12345',
        passwordConfirm: 'admin12345',
      });
      console.log("[+] BERHASIL: Password akun admin sekolah telah diset ke: admin12345");

      // Coba tes login tabel users
      const pbUser = new PocketBase('http://127.0.0.1:8090');
      const authData = await pbUser.collection('users').authWithPassword('admin@gmail.com', 'admin12345');
      console.log("[+] Verifikasi authWithPassword tabel users: BERHASIL!");
      console.log("    Token:", authData.token.substring(0, 25) + '...');
    }
  } catch (err) {
    console.error("[-] Error:", err);
  }
}

main();
