import PocketBase from 'pocketbase';

// Gunakan URL lokal untuk development, dan nantinya gunakan environment variable untuk VPS
const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090');
pb.autoCancellation(false);

// Agar tidak perlu mengetik 'pb.collection('users').authWithPassword' berulang kali,
// kita bisa export instance pb-nya saja.
export default pb;
