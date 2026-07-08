const fs = require('fs');
const p = 'c:/Users/kim50/OneDrive/Desktop/Obsidian/3. Resource/01.Tools/Obsidian tools/01.Templater/03.프로젝트.md';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/수정일: 2026-06-16T14:04/, '수정일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"');
c = c.replace(/- 기한 :[ \t]*/, '- 기한 : \uD83D\uDCC5 2099-12-31 ~ \uD83D\uDCC5 2099-12-31');
fs.writeFileSync(p, c, 'utf8');
