const fs = require('fs');

let content = fs.readFileSync('src/FileManager.ts', 'utf8');
content = content.replace(/\r\n/g, '\n');

const regexToReplace = /    public simpleHash\(str: string\): string \{\n        let hash = 0;/;
const replacement = `    public simpleHash(str: string): string {
        // BUG FIX: Windows \\r\\n 차이로 인한 해시 불일치 무한루프 방지
        str = str.replace(/\\r/g, '');
        let hash = 0;`;

if (regexToReplace.test(content)) {
    content = content.replace(regexToReplace, replacement);
    fs.writeFileSync('src/FileManager.ts', content, 'utf8');
    console.log("SUCCESS FileManager");
} else {
    console.log("FAILED TO MATCH in FileManager.ts");
}
