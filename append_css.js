const fs = require('fs');
const css = '\n\n/* 라이브 뷰 콜아웃 내부 체크박스 핀셋 보정 (테스트용) */\nbody .workspace-leaf-content .cm-line.cm-quote.HyperMD-task-line input[type="checkbox"] {\n    transform: translateY(10px) !important;\n}\n';
fs.appendFileSync('styles.css', css, 'utf8');
console.log('Appended test CSS');
