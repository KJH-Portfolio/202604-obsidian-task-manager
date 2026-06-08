const fs = require('fs');

let t = fs.readFileSync('src/TaskUtils.ts', 'utf8');
t = t.replace(/const now = moment\(\);/g, 'const now = this.dateManager.getAdjustedNow();');
t = t.replace(/moment\(\)\.format\("YYYY-MM-DDTHH:mm"\)/g, 'this.dateManager.formatDateTime(this.dateManager.getAdjustedNow())');
fs.writeFileSync('src/TaskUtils.ts', t);

let s = fs.readFileSync('src/Synchronizer.ts', 'utf8');
s = s.replace(/const now = moment\(\);/g, 'const now = this.dateManager.getAdjustedNow();');
fs.writeFileSync('src/Synchronizer.ts', s);

let m = fs.readFileSync('src/main.ts', 'utf8');
m = m.replace(/const todayObj = moment\(\)\.startOf\('day'\)\.toDate\(\);/g, 'const todayObj = this.dateManager.getTodayStart();');
m = m.replace(/const now = moment\(\);/g, 'const now = this.dateManager.getAdjustedNow();');
fs.writeFileSync('src/main.ts', m);

console.log('moment usages replaced.');
