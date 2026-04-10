import PocketBase from 'pocketbase';

// Gunakan URL lokal untuk development, dan nantinya gunakan environment variable untuk VPS
// Deteksi URL secara dinamis berdasarkan domain yang sedang dibuka
// Jika di production, dia akan otomatis pakai domain sekolah tersebut (misal: sekolah-a.my.id)
// Jika di local development, dia akan pakai localhost:8090
// Prioritaskan environment variable jika ada (seperti di Vercel/VPS)
// Jika tidak ada, baru gunakan deteksi origin dinamis atau default localhost
const pbUrl = import.meta.env.VITE_POCKETBASE_URL || 
  ((typeof window !== 'undefined' && window.location.hostname !== 'localhost') 
    ? window.location.origin 
    : 'http://127.0.0.1:8090');

const pb = new PocketBase(pbUrl);
pb.autoCancellation(false);

// Agar tidak perlu mengetik 'pb.collection('users').authWithPassword' berulang kali,
// kita bisa export instance pb-nya saja.
export default pb;
