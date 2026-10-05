import fs from 'fs';
import path from 'path';

const capConfigPath = path.resolve('capacitor.config.ts');
let config = fs.readFileSync(capConfigPath, 'utf8');

if (!config.includes('CapacitorHttp')) {
  config = config.replace(
    /plugins:\s*\{/,
    `plugins: {
    CapacitorHttp: {
      enabled: true
    },`
  );
  fs.writeFileSync(capConfigPath, config);
  console.log('CapacitorHttp plugin enabled in capacitor.config.ts');
} else {
  console.log('CapacitorHttp plugin already enabled');
}
