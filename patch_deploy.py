import sys

with open('scripts/deploy-both-apks.js', 'r', encoding='utf-8') as f:
    code = f.read()

old_block = """  {
    key: 'browser',
    name: 'EXAM AA Browser (Custom Exam Browser)',
    targetApk: 'exam-aa-browser-latest.apk',
    targetLink: 'exam-aa-browser-latest'
  }
];"""

new_block = """  {
    key: 'browser',
    name: 'EXAM AA Browser (Custom Exam Browser)',
    targetApk: 'exam-aa-browser-latest.apk',
    targetLink: 'exam-aa-browser-latest'
  },
  {
    key: 'local',
    name: 'EXAMKU Local (Offline Server Client)',
    targetApk: 'examku-local.apk',
    targetLink: 'examku-local'
  }
];"""

code = code.replace(old_block, new_block)

old_console = """console.log(`2. APK EXAM AA Browser:`);
console.log(`   ?? https://examku.my.id/exam-aa-browser-latest`);
console.log(`   ?? https://examku.my.id/exam-aa-browser-latest.apk`);
console.log(`3. Web App:`);"""

new_console = """console.log(`2. APK EXAM AA Browser:`);
console.log(`   ?? https://examku.my.id/exam-aa-browser-latest`);
console.log(`   ?? https://examku.my.id/exam-aa-browser-latest.apk`);
console.log(`3. APK EXAMKU Local:`);
console.log(`   ?? https://examku.my.id/examku-local`);
console.log(`   ?? https://examku.my.id/examku-local.apk`);
console.log(`4. Web App:`);"""

code = code.replace(old_console, new_console)
code = code.replace("Membangun & Mengirim 2 APK", "Membangun & Mengirim 3 APK")

with open('scripts/deploy-both-apks.js', 'w', encoding='utf-8') as f:
    f.write(code)
