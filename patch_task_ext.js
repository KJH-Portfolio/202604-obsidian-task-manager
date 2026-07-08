const fs = require('fs');

let content = fs.readFileSync('src/ui/TaskClickExtension.ts', 'utf8');
content = content.replace(/\r\n/g, '\n');

const regexToReplace = /const blockContainer = target\.closest\('\.cm-line, \.cm-embed-block'\) \|\| target\.ownerDocument\.body;[\s\S]*?if \(i > line\.number \+ 200\) break;\n                    \}/;

const replacement = `const text = line.text;
                    
                    const regex = /^(\\s*(?:>\\s*)*[-*+]\\s+\\[)(.)(\\])/;
                    const match = text.match(regex);
                    
                    if (match) {
                        e.preventDefault();
                        e.stopPropagation();

                        const currentMarker = match[2];
                        const nextMarker = /^[xX]$/.test(currentMarker) ? ' ' : 'x';

                        const from = line.from + (match.index ?? 0);
                        const to = from + match[0].length;
                        const newPrefix = match[1] + nextMarker + match[3];

                        view.dispatch({
                            changes: { from, to, insert: newPrefix }
                        });
                        return true;
                    }`;

if (regexToReplace.test(content)) {
    content = content.replace(regexToReplace, replacement);
    fs.writeFileSync('src/ui/TaskClickExtension.ts', content, 'utf8');
    console.log("SUCCESS");
} else {
    console.log("FAILED TO MATCH");
}
