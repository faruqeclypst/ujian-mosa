const fs = require('fs');
const path = "d:/PROJECT/ujian/src/pages/admin/ExamRoomsPage.tsx";
let content = fs.readFileSync(path, 'utf8');

// Menghapus baris yang mengandung pb.collection('answers')
content = content.split('\n').filter(line => !line.includes("pb.collection('answers')")).join('\n');

fs.writeFileSync(path, content, 'utf8');
console.log("Cleanup complete");
