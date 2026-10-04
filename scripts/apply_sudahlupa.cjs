const PocketBase = require('pocketbase/cjs');

async function main() {
  const pb = new PocketBase('http://127.0.0.1:8090');

  try {
    console.log("[+] Mengautentikasi sebagai Superuser...");
    await pb.collection('_superusers').authWithPassword('admin@gmail.com', '12345678');
    console.log("    Superuser OK!");

    console.log("[+] Mencari akun admin di tabel users...");
    const user = await pb.collection('users').getFirstListItem('email = "admin@gmail.com" || username = "admin"');
    console.log(`    User ditemukan: ID=${user.id}, Email=${user.email}, Username=${user.username}`);

    console.log("[+] Mengubah kata sandi menjadi 'sudahlupa'...");
    await pb.collection('users').update(user.id, {
      password: 'sudahlupa',
      passwordConfirm: 'sudahlupa',
      hasChangedPassword: true,
      verified: true
    });
    console.log("    Password berhasil diubah!");

    // Verifikasi login dengan password baru 'sudahlupa'
    console.log("\n[+] Menguji login dengan email 'admin@gmail.com' dan password 'sudahlupa'...");
    const pbUser1 = new PocketBase('http://127.0.0.1:8090');
    const auth1 = await pbUser1.collection('users').authWithPassword('admin@gmail.com', 'sudahlupa');
    console.log("    BERHASIL LOGIN via Email! ID:", auth1.record.id, "Role:", auth1.record.role);

    console.log("\n[+] Menguji login dengan username 'admin' dan password 'sudahlupa'...");
    const pbUser2 = new PocketBase('http://127.0.0.1:8090');
    const auth2 = await pbUser2.collection('users').authWithPassword('admin', 'sudahlupa');
    console.log("    BERHASIL LOGIN via Username! ID:", auth2.record.id, "Role:", auth2.record.role);

    console.log("\n[+] Memastikan Superuser tetap 'admin@gmail.com' / '12345678'...");
    const pbSu = new PocketBase('http://127.0.0.1:8090');
    const authSu = await pbSu.collection('_superusers').authWithPassword('admin@gmail.com', '12345678');
    console.log("    BERHASIL LOGIN Superuser! Email:", authSu.record.email);

  } catch (err) {
    console.error("[-] Terjadi kesalahan:", err);
  }
}

main();
