const PocketBase = require('pocketbase/cjs');

async function setPasswordViaApi() {
  console.log("[1] Mengubah password via PocketBase Superuser API...");
  const pb = new PocketBase('http://127.0.0.1:8090');

  try {
    // Login superuser (12345678 tetap)
    await pb.collection('_superusers').authWithPassword('admin@gmail.com', '12345678');
    console.log("    Superuser auth: OK");

    // Cari user admin
    const user = await pb.collection('users').getFirstListItem('email = "admin@gmail.com" || username = "admin"');
    console.log(`    User ditemukan: ID=${user.id}, Email=${user.email}, Username=${user.username}`);

    // Update password menjadi "sudahlupa"
    await pb.collection('users').update(user.id, {
      password: 'sudahlupa',
      passwordConfirm: 'sudahlupa',
      hasChangedPassword: true,
      verified: true,
      role: 'admin'
    });
    console.log("    Update password menjadi 'sudahlupa': BERHASIL!");
  } catch (err) {
    console.error("[-] Error:", err);
  }
}

setPasswordViaApi();
