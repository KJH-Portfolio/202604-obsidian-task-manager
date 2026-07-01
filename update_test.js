const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

css = css.replace(/\/\* 라이브 뷰 콜아웃 내부 체크박스 핀셋 보정 \(테스트용\) \*\/[\s\S]*?\}\r?\n/g, '');

const testCss = '\n\n/* 라이브 뷰 콜아웃 내부 체크박스 핀셋 보정 (테스트용 20px) */\nbody .workspace-leaf-content .callout input[type="checkbox"],\nbody .workspace-leaf-content .cm-quote input[type="checkbox"] {\n    transform: translateY(20px) !important;\n}\n';

fs.writeFileSync('styles.css', css + testCss, 'utf8');
console.log('Updated test CSS');
