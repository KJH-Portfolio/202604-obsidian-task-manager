const fs = require('fs');

let content = fs.readFileSync('src/TaskUtils.ts', 'utf8');
content = content.replace(/\r\n/g, '\n');

const regexToReplace = /    replaceSection\(content: string, headerName: string, newBody: string\): string \{\n        const range = this\.getSectionRange\(content, headerName\) as \{ start: number, end: number \};\n        if \(\!range\) return content;\n        return content\.substring\(0, range\.start\) \+ headerName \+ "\\n" \+ newBody\.trimEnd\(\) \+ "\\n\\n" \+ content\.substring\(range\.end\)\.trimStart\(\);\n    \}/;

const replacement = `    replaceSection(content: string, headerName: string, newBody: string): string {
        const range = this.getSectionRange(content, headerName) as { start: number, end: number };
        if (!range) {
            // BUG FIX: 필수 섹션 누락 시 데이터 증발을 막기 위해 맨 밑에 강제 복구
            return content.trimEnd() + "\\n\\n" + headerName + "\\n" + newBody.trimEnd() + "\\n";
        }
        return content.substring(0, range.start) + headerName + "\\n" + newBody.trimEnd() + "\\n\\n" + content.substring(range.end).trimStart();
    }`;

if (regexToReplace.test(content)) {
    content = content.replace(regexToReplace, replacement);
    fs.writeFileSync('src/TaskUtils.ts', content, 'utf8');
    console.log("SUCCESS TaskUtils");
} else {
    console.log("FAILED TO MATCH in TaskUtils.ts");
}
