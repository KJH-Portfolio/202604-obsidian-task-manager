const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

const colors = [
    { task: "0", color: "233, 49, 71, 0.8" },
    { task: "1", color: "255, 210, 0, 0.8" },
    { task: "2", color: "68, 207, 110, 0.8" },
    { task: "3", color: "8, 109, 221, 0.8" },
    { task: "7", color: "150, 150, 150, 0.8" },
    { task: "!", color: "140, 0, 40, 0.9" }
];

for (let c of colors) {
    const searchStr = `body .workspace-leaf-content .markdown-rendered li[data-task="${c.task}"]>input[type="checkbox"]:checked,\nbody .workspace-leaf-content .cm-line.HyperMD-task-line[data-task="${c.task}"] input[type="checkbox"] {\n    border: 1px solid rgba(); border-radius: var(--checkbox-radius, 4px); width: var(--checkbox-size, 16px); height: var(--checkbox-size, 16px); box-sizing: border-box; box-shadow: none;\n}`;
    const replaceStr = `body .workspace-leaf-content .markdown-rendered li[data-task="${c.task}"]>input[type="checkbox"]:checked,\nbody .workspace-leaf-content .cm-line.HyperMD-task-line[data-task="${c.task}"] input[type="checkbox"] {\n    border: 1px solid rgba(${c.color}); border-radius: var(--checkbox-radius, 4px); width: var(--checkbox-size, 16px); height: var(--checkbox-size, 16px); box-sizing: border-box; box-shadow: none;\n}`;
    css = css.replace(searchStr, replaceStr);
}

fs.writeFileSync('styles.css', css, 'utf8');
console.log('Fixed colors and size properties');
