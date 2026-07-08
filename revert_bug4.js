const fs = require('fs');

let content = fs.readFileSync('src/TaskUtils.ts', 'utf8');
content = content.replace(/\r\n/g, '\n');

const regexToReplace = /        this\.issuedIds\.add\(id\);\n        return id;\n    \}/;

const replacement = `        // issuedIds 크기 제한: 1000개 초과 시 가장 오래된 것 삭제
        if (this.issuedIds.size >= 1000) {
            const firstKey = this.issuedIds.values().next().value;
            if (firstKey !== undefined) this.issuedIds.delete(firstKey);
        }
        this.issuedIds.add(id);
        return id;
    }`;

if (regexToReplace.test(content)) {
    content = content.replace(regexToReplace, replacement);
    fs.writeFileSync('src/TaskUtils.ts', content, 'utf8');
    console.log("SUCCESS");
} else {
    console.log("FAILED TO MATCH");
}
