const fs = require('fs');

let content = fs.readFileSync('src/TaskUtils.ts', 'utf8');
content = content.replace(/\r\n/g, '\n');

const regexToReplace = /        \/\/ issuedIds 크기 제한: 1000개 초과 시 가장 오래된 것 삭제\n        if \(this\.issuedIds\.size >= 1000\) \{\n            const firstKey = this\.issuedIds\.values\(\)\.next\(\)\.value;\n            if \(firstKey !== undefined\) this\.issuedIds\.delete\(firstKey\);\n        \}/;

if (regexToReplace.test(content)) {
    content = content.replace(regexToReplace, '');
    fs.writeFileSync('src/TaskUtils.ts', content, 'utf8');
    console.log("SUCCESS");
} else {
    // try a more generic match
    const regex2 = /        if \(this\.issuedIds\.size >= 1000\) \{\n            const firstKey = this\.issuedIds\.values\(\)\.next\(\)\.value;\n            if \(firstKey !== undefined\) this\.issuedIds\.delete\(firstKey\);\n        \}/;
    if (regex2.test(content)) {
        content = content.replace(regex2, '');
        fs.writeFileSync('src/TaskUtils.ts', content, 'utf8');
        console.log("SUCCESS");
    } else {
        console.log("FAILED TO MATCH");
    }
}
