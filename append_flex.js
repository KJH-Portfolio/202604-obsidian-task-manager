const fs = require('fs');

const appendCss = `

/* 일반 콜아웃 내부 할 일 목록 강제 중앙 정렬 (멀티라인 중앙 정렬 부작용 허용) */
body .workspace-leaf-content .callout li.task-list-item,
body .workspace-leaf-content .cm-quote.HyperMD-task-line {
    display: flex;
    align-items: center;
}

body .workspace-leaf-content .callout li.task-list-item > input[type="checkbox"],
body .workspace-leaf-content .cm-quote.HyperMD-task-line input[type="checkbox"] {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    margin-right: 8px !important;
}
`;

fs.appendFileSync('styles.css', appendCss, 'utf8');
console.log('Flexbox CSS appended successfully.');
