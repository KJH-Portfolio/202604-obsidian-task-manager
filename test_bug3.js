const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = `
<!DOCTYPE html>
<html>
<body>
  <div class="markdown-source-view">
    <!-- HTML checkboxes on top lines -->
    <div class="some-custom-block">
      <input type="checkbox" id="html-cb-1">
      <input type="checkbox" id="html-cb-2">
    </div>
    
    <!-- Markdown tasks below, let's pretend .cm-line is missing or renamed by a theme -->
    <div class="HyperMD-task-line" id="task-line-1">
      <input type="checkbox" id="md-cb-1"> Task 1
    </div>
    <div class="HyperMD-task-line" id="task-line-2">
      <input type="checkbox" id="md-cb-2"> Task 2
    </div>
  </div>
</body>
</html>
`;

const dom = new JSDOM(html);
const document = dom.window.document;

// Simulate the logic in TaskClickExtension.ts
function simulateClick(targetId, lineNumber) {
    const target = document.getElementById(targetId);
    if (!target) return console.log("Target not found");

    const taskEl = target.closest('.task-list-item, .HyperMD-task-line');
    if (!taskEl) {
        console.log(`[${targetId}] taskEl not found, ignoring click.`);
        return;
    }

    const blockContainer = target.closest('.cm-line, .cm-embed-block') || target.ownerDocument.body;
    const allCheckboxes = Array.from(blockContainer.querySelectorAll('input[type="checkbox"]'));
    const checkboxIndex = allCheckboxes.indexOf(target);

    console.log(`[${targetId}] Clicked! blockContainer is:`, blockContainer.tagName);
    console.log(`[${targetId}] checkboxIndex determined as: ${checkboxIndex}`);

    let matchCount = 0;
    
    // Fake document with lines
    const lines = [
        "", // 0
        "<input type='checkbox'>", // 1
        "<input type='checkbox'>", // 2
        "- [ ] Task 1", // 3 (lineNumber = 3)
        "- [ ] Task 2", // 4 (lineNumber = 4)
        "- [ ] Task 3", // 5
        "- [ ] Task 4"  // 6
    ];

    let modifiedLine = -1;

    for (let i = lineNumber; i < lines.length; i++) {
        const text = lines[i];
        const regex = /^(\s*(?:>\s*)*[-*+]\s+\[)(.)(\])/;
        const match = text.match(regex);
        
        if (match) {
            if (matchCount === checkboxIndex) {
                modifiedLine = i;
                break;
            }
            matchCount++;
        }
    }

    if (modifiedLine !== -1) {
        console.log(`[${targetId}] The plugin would toggle line number: ${modifiedLine} ("${lines[modifiedLine]}")`);
        if (modifiedLine !== lineNumber) {
            console.log(`[🚨 BUG CONFIRMED] Clicked on line ${lineNumber}, but modified line ${modifiedLine}!!`);
        } else {
            console.log(`[OK] Correct line modified.`);
        }
    } else {
        console.log(`[${targetId}] No matching task found to toggle.`);
    }
}

console.log("--- TEST 1: Missing .cm-line (Fallback to body) ---");
simulateClick("md-cb-1", 3);
simulateClick("md-cb-2", 4);

