const fs = require('fs');
const path = require('path');

const scratchDir = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\39ae1804-2f60-4143-acaf-39830562b4a2\\scratch';
const logoB64 = fs.readFileSync(path.join(scratchDir, 'logo_b64.txt'), 'utf8').trim();
const logoDataUri = 'data:image/png;base64,' + logoB64;

const templatePath = path.join(__dirname, 'template.html');
let html = fs.readFileSync(templatePath, 'utf8');
html = html.replace(/__LOGO_DATA_URI__/g, logoDataUri);

fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
console.log('Successfully created promo-video/index.html with embedded logo!');
