import fs from 'fs';
import path from 'path';

const configPath = path.resolve('configs/examaa.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

delete config.serverUrl;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Removed serverUrl from configs/examaa.json');
