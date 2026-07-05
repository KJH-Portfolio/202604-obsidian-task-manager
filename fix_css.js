const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

// 1. Replace borders with inset shadow
css = css.replace(/border: 2px solid rgba\(233, 49, 71, 0\.8\);/g, 'border: 1px solid transparent; box-shadow: inset 0 0 0 2px rgba(233, 49, 71, 0.8);');
css = css.replace(/border: 2px solid rgba\(255, 210, 0, 0\.8\);/g, 'border: 1px solid transparent; box-shadow: inset 0 0 0 2px rgba(255, 210, 0, 0.8);');
css = css.replace(/border: 2px solid rgba\(68, 207, 110, 0\.8\);/g, 'border: 1px solid transparent; box-shadow: inset 0 0 0 2px rgba(68, 207, 110, 0.8);');
css = css.replace(/border: 2px solid rgba\(8, 109, 221, 0\.8\);/g, 'border: 1px solid transparent; box-shadow: inset 0 0 0 2px rgba(8, 109, 221, 0.8);');
css = css.replace(/border: 2px solid rgba\(150, 150, 150, 0\.8\);/g, 'border: 1px solid transparent; box-shadow: inset 0 0 0 2px rgba(150, 150, 150, 0.8);');
css = css.replace(/border: 2px solid rgba\(140, 0, 40, 0\.9\);/g, 'border: 1px solid transparent; box-shadow: inset 0 0 0 2px rgba(140, 0, 40, 0.9);');

// 2. Disable checkmark hiding
css = css.replace(/\/\* 체크마크 숨김 \*\/[\s\S]*?display: none;\s*\r?\n\}/g, '/* 체크마크 숨김 기능 일시 비활성화됨 */');

// 3. Remove gradient tag
const startStr = '.markdown-rendered li[data-task="0"] > input[type="checkbox"]::before';
const startIdx = css.indexOf(startStr);
if (startIdx !== -1) {
    const endStr = 'background: linear-gradient(to right, rgba(140, 0, 40, 0.3), transparent);\r\n}';
    let endIdx = css.indexOf(endStr);
    if (endIdx === -1) endIdx = css.indexOf('background: linear-gradient(to right, rgba(140, 0, 40, 0.3), transparent);\n}');
    if (endIdx !== -1) {
        css = css.substring(0, startIdx) + css.substring(endIdx + endStr.length || endIdx + 77);
    }
}

// 4. Remove the height drop added at the very end of styles.css from earlier
css = css.replace(/\/\* 커스텀 체크박스 정렬 핀셋 보정 \*\/[\s\S]*?margin-top: 2px;\r?\n\}/g, '');

fs.writeFileSync('styles.css', css, 'utf8');
console.log('Done');
