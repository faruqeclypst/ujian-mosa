const fs = require('fs');

const content = fs.readFileSync('d:\\PROJECT\\ujian\\src\\pages\\admin\\QuestionsPage.tsx', 'utf8');
const lines = content.split('\n');

let braceCount = 0;
let parenCount = 0;
let angleCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
  }
  if (braceCount === 0 && i > 300) {
    console.log(`Brace count hit 0 at line ${i + 1}`);
  }
}
console.log(`Final Brace Count: ${braceCount}`);
