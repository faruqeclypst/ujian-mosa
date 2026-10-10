// ============================================================
// Helper: baca konfigurasi infrastruktur dari vps/infra.conf
// ============================================================
// Penggunaan:
//   import { INFRA, VPS_HOST, WORKER_HOST } from './infra-config.js';
//
// Semua IP terpusat di vps/infra.conf — jangan hardcode IP di script.
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadInfraConf() {
  const confPath = path.join(__dirname, '..', 'vps', 'infra.conf');
  const conf = { MASTER_IP: '', MASTER_USER: 'root', WORKER_IP: '', WORKER_USER: 'root' };
  try {
    const content = fs.readFileSync(confPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      // Hapus quote pembungkus
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key in conf) conf[key] = val;
    }
  } catch (e) {
    console.error(`[infra-config] Gagal baca ${confPath}: ${e.message}`);
  }
  return conf;
}

export const INFRA = loadInfraConf();
export const VPS_HOST = `${INFRA.MASTER_USER}@${INFRA.MASTER_IP}`;
export const WORKER_HOST = `${INFRA.WORKER_USER}@${INFRA.WORKER_IP}`;
