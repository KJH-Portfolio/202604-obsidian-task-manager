const { JSDOM } = require("jsdom");

const dom = new JSDOM(`<!DOCTYPE html><html><body><li id="task">기한 : 📅 2026-07-10 ~ 📅 2026-07-10</li></body></html>`);
const doc = dom.window.document;
const taskEl = doc.getElementById("task");

const walker = doc.createTreeWalker(taskEl, dom.window.NodeFilter.SHOW_TEXT);
const nodesToProcess = [];
let n;
while ((n = walker.nextNode())) {
    if (/📅\s*\d{4}-\d{2}-\d{2}/.test(n.textContent || "")) {
        nodesToProcess.push(n);
    }
}

let globalDateIndex = 0;
const processTextNode = (textNode) => {
    const text = textNode.textContent || "";
    const match = text.match(/(📅\s*)(\d{4}-\d{2}-\d{2})/);
    if (!match || match.index === undefined) return;

    const currentTargetIndex = globalDateIndex++;
    const dateStr = match[2];
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);

    const frag = doc.createDocumentFragment();
    if (before) frag.appendChild(doc.createTextNode(before));

    const dateSpan = doc.createElement("span");
    dateSpan.className = "myworld-date-clickable";
    dateSpan.textContent = match[0];
    frag.appendChild(dateSpan);
    
    const afterNode = doc.createTextNode(after);
    frag.appendChild(afterNode);
    
    // Replace textNode with fragment
    if (textNode.parentNode) {
        textNode.parentNode.replaceChild(frag, textNode);
    } else {
        console.log("No parent node for:", textNode.textContent);
    }
    
    processTextNode(afterNode);
};

nodesToProcess.forEach(processTextNode);

console.log(taskEl.innerHTML);
