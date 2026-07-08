const fs = require('fs');

let mainTs = fs.readFileSync('src/main.ts', 'utf8');
mainTs = mainTs.replace(/\r\n/g, '\n');

// 1. tasks -> listItems
mainTs = mainTs.replace(
    /const tasks = Array\.from\(element\.querySelectorAll\("\.task-list-item"\)\) as HTMLElement\[\];\n\s*if \(!tasks\.length\) return;/,
    `const listItems = Array.from(element.querySelectorAll("li")) as HTMLElement[];
            if (!listItems.length) return;`
);

// 2. tasks.forEach -> listItems.forEach
mainTs = mainTs.replace(
    /tasks\.forEach\(taskEl => \{/,
    `listItems.forEach(taskEl => {
                const isTaskItem = taskEl.classList.contains("task-list-item");`
);

// 3. [xX] skip
mainTs = mainTs.replace(
    /\/\/ \[x\] \/ \[X\] 만 스킵 — \[1\],\[0\],\[!\] 등 커스텀 마커는 처리 대상\n\s*if \(\/\^\[xX\]\$\/\.test\(taskEl\.getAttribute\("data-task"\) \?\? ""\)\) return;/,
    `// [x] / [X] skip
                if (isTaskItem && /^[xX]$/.test(taskEl.getAttribute("data-task") ?? "")) return;`
);

// 4. hasDateAttr
mainTs = mainTs.replace(
    /const hasDateAttr = Array\.from\(taskEl\.attributes\)\.some\(attr => attr\.name\.startsWith\("data-task-"\) && \/\\d\{4\}-\\d\{2\}-\\d\{2\}\/\.test\(attr\.value\)\);/,
    `const hasDateAttr = isTaskItem ? Array.from(taskEl.attributes).some(attr => attr.name.startsWith("data-task-") && /\\d{4}-\\d{2}-\\d{2}/.test(attr.value)) : false;`
);

// 5. NodeFilter accept
mainTs = mainTs.replace(
    /if \(p\.classList\.contains\("task-list-item"\)\) return NodeFilter\.FILTER_REJECT;/,
    `if (p.classList.contains("task-list-item") || p.tagName === "LI") {
                                    if (p !== taskEl) return NodeFilter.FILTER_REJECT;
                                }`
);

// 6. TreeWalker date logic
let matchDateLogicStr = `                    nodesToProcess.forEach(textNode => {
                        const text = textNode.textContent || "";
                        const match = text.match(/(📅\\s*)(\\d{4}-\\d{2}-\\d{2})/);
                        if (!match || match.index === undefined) return;`;

let endDateLogicStr = `frag.appendChild(dateSpan);
                        if (after) frag.appendChild(doc.createTextNode(after));
                        textNode.parentNode?.replaceChild(frag, textNode);
                    });`;

const startIndex = mainTs.indexOf(matchDateLogicStr);
const endIndex = mainTs.indexOf(endDateLogicStr);

if (startIndex !== -1 && endIndex !== -1) {
    const endOffset = endIndex + endDateLogicStr.length;
    
    const replacement = `                    let globalDateIndex = 0;
                    
                    const processTextNode = (textNode) => {
                        const text = textNode.textContent || "";
                        const match = text.match(/(\\uD83D\\uDCC5\\s*)(\\d{4}-\\d{2}-\\d{2})/);
                        if (!match || match.index === undefined) return;

                        const currentTargetIndex = globalDateIndex++;
                        const dateStr = match[2];
                        const before = text.slice(0, match.index);
                        const after = text.slice(match.index + match[0].length);

                        const frag = doc.createDocumentFragment();
                        if (before) frag.appendChild(doc.createTextNode(before));

                        const dateSpan = doc.createElement("span");
                        dateSpan.className = "myworld-date-clickable";
                        dateSpan.textContent = "\\uD83D\\uDCC5 " + dateStr;

                        const todayStr = this.dateManager?.getAdjustedNow().format("YYYY-MM-DD") || window.moment().format("YYYY-MM-DD");
                        if (dateStr < todayStr) dateSpan.classList.add("myworld-overdue");

                        dateSpan.addEventListener("mousedown", (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            const rect = dateSpan.getBoundingClientRect();

                            const cleanTextForMatch = rawText.replace(/^(?:>\\s*)*[-*+]\\s*(?:\\[.\\]\\s*)?/, "").replace(/\\uD83D\\uDCC5.*/, "").trim();
                            const container = taskEl.closest(".markdown-reading-view") || doc.body;
                            const allTasks = Array.from(container.querySelectorAll(isTaskItem ? ".task-list-item" : "li:not(.task-list-item)"));
                            let occurrenceIndex = 0;
                            for (const t of allTasks) {
                                const tCloned = t.cloneNode(true);
                                tCloned.querySelectorAll("ul, ol, .myworld-today-btn, .myworld-date-clickable").forEach(e => e.remove());
                                const tClean = (tCloned.textContent?.trim() || "").replace(/^(?:>\\s*)*[-*+]\\s*(?:\\[.\\]\\s*)?/, "").replace(/\\uD83D\\uDCC5.*/, "").trim();
                                if (tClean === cleanTextForMatch) {
                                    if (t === taskEl) break;
                                    occurrenceIndex++;
                                }
                            }

                            buildCalendarPopup(dateStr, rect.left, rect.bottom + 5, (newDate) => {
                                this.enqueueFileWrite(clickFile.path, async () => {
                                    const rawContent = await this.fileManager.getActiveViewOrFileText(clickFile);
                                    const fileContent = this.utils.preprocessContent(rawContent);
                                    const lines = fileContent.split("\\n");
                                    let matchCount = 0;
                                    for (let i = 0; i < lines.length; i++) {
                                        const lineHasDate = lines[i].includes(dateStr);
                                        const isLineTask = /^\\s*(?:>\\s*)*[-*+]\\s+\\[.\\]/.test(lines[i]);
                                        const isLineList = /^\\s*(?:>\\s*)*[-*+]/.test(lines[i]);

                                        if (lineHasDate && ((isTaskItem && isLineTask) || (!isTaskItem && isLineList && !isLineTask))) {
                                            let lineClean = lines[i].replace(/^\\s*(?:>\\s*)*[-*+]\\s*(?:\\[.\\]\\s*)?/, "").replace(/\\uD83D\\uDCC5\\s*\\d{4}-\\d{2}-\\d{2}/g, "").replace(/\\s+\\^[a-zA-Z0-9]+$/, "").trim();
                                            if (lineClean === cleanTextForMatch) {
                                                if (matchCount === occurrenceIndex) {
                                                    let dateOccurrence = 0;
                                                    lines[i] = lines[i].replace(/\\s*\\uD83D\\uDCC5\\s*\\d{4}-\\d{2}-\\d{2}/g, (m) => {
                                                        if (dateOccurrence === currentTargetIndex) {
                                                            dateOccurrence++;
                                                            if (newDate === null) return "";
                                                            return m.replace(/\\uD83D\\uDCC5\\s*\\d{4}-\\d{2}-\\d{2}/, \`\\uD83D\\uDCC5 \${newDate}\`);
                                                        }
                                                        dateOccurrence++;
                                                        return m;
                                                    });
                                                    await this.fileManager.pluginWrite(clickFile, lines.join("\\n"));
                                                    break;
                                                }
                                                matchCount++;
                                            }
                                        }
                                    }
                                });
                            }, doc);
                        });

                        frag.appendChild(dateSpan);
                        
                        const afterNode = doc.createTextNode(after);
                        frag.appendChild(afterNode);
                        
                        if (textNode.parentNode) {
                            textNode.parentNode.replaceChild(frag, textNode);
                        }
                        
                        processTextNode(afterNode);
                    };

                    nodesToProcess.forEach(processTextNode);`;

    mainTs = mainTs.substring(0, startIndex) + replacement + mainTs.substring(endOffset);
    console.log("Successfully replaced date logic block");
} else {
    console.log("Failed to locate date replacement logic block");
}

mainTs = mainTs.replace(
    /if \(!hasDateText && !hasDateAttr && !hasButton\) \{/g,
    `if (isTaskItem && !hasDateText && !hasDateAttr && !hasButton) {`
);

const buttonInjectionStr = `                        if (taskTextSpan) {
                            taskTextSpan.appendChild(btn);
                        } else {
                            const checkbox = taskEl.querySelector("input[type='checkbox']");
                            if (checkbox && checkbox.nextSibling) {
                                taskEl.insertBefore(btn, checkbox.nextSibling.nextSibling);
                            } else {
                                const childList = Array.from(taskEl.children).find(c => c.tagName === "UL" || c.tagName === "OL");
                                if (childList) {
                                    taskEl.insertBefore(btn, childList);
                                } else {
                                    taskEl.appendChild(btn);
                                }
                            }
                        }`;

const buttonIndex = mainTs.indexOf(buttonInjectionStr);
if (buttonIndex !== -1) {
    const buttonEndOffset = buttonIndex + buttonInjectionStr.length;
    const safeButtonInjection = `                        const checkbox = taskEl.querySelector("input[type='checkbox']");
                        if (checkbox && checkbox.nextSibling) {
                            const nextNode = checkbox.nextSibling;
                            if (nextNode.nodeType === 3 && nextNode.textContent) {
                                nextNode.textContent = nextNode.textContent.replace(/\\n$/, '');
                            }
                            taskEl.insertBefore(btn, nextNode.nextSibling);
                        } else if (taskTextSpan) {
                            taskTextSpan.appendChild(btn);
                        } else {
                            const childList = Array.from(taskEl.children).find(c => c.tagName === "UL" || c.tagName === "OL");
                            taskEl.insertBefore(btn, childList || null);
                        }`;
    mainTs = mainTs.substring(0, buttonIndex) + safeButtonInjection + mainTs.substring(buttonEndOffset);
    console.log("Successfully replaced button injection block");
} else {
    console.log("Failed to locate button injection block");
}

fs.writeFileSync('src/main.ts', mainTs, 'utf8');


let calTs = fs.readFileSync('src/ui/CalendarWidget.ts', 'utf8');
calTs = calTs.replace(/\r\n/g, '\n');

calTs = calTs.replace(
    /function isDateClickableRange\(view: EditorView, pos: number\): \{ isMatch: boolean, dateStr: string, lineNo: number \} \{/,
    `function isDateClickableRange(view: EditorView, pos: number): { isMatch: boolean, dateStr: string, lineNo: number, exactFrom: number, exactTo: number } {`
);
calTs = calTs.replace(
    /return \{ isMatch: true, dateStr: match\[1\], lineNo: line\.number \};/,
    `return { isMatch: true, dateStr: match[1], lineNo: line.number, exactFrom: start, exactTo: end };`
);
calTs = calTs.replace(
    /return \{ isMatch: false, dateStr: "", lineNo: 0 \};/,
    `return { isMatch: false, dateStr: "", lineNo: 0, exactFrom: 0, exactTo: 0 };`
);

const calLogicStr = `                const { isMatch, dateStr, lineNo } = isDateClickableRange(view, pos);
                if (isMatch) {
                    e.preventDefault();
                    const rect = target.getBoundingClientRect();
                    // Bug M: 클릭 시점 view를 캡처하여 콜백에서 사용 (getActiveViewOfType 클로저 버그 해결)
                    const clickedView = view;
                    const doc = view.dom.ownerDocument;
                    buildCalendarPopup(dateStr, rect.left + rect.width / 2, rect.top + rect.height / 2, (newDate) => {
                        try {
                            const line = clickedView.state.doc.line(lineNo);
                            const text = line.text;
                            // 클릭했던 원본 날짜를 정확히 타겟팅하기 위해 dateStr 활용
                            const regex = new RegExp(\`\\uD83D\\uDCC5\\\\s*\${dateStr}\`);
                            const match = text.match(regex);
                            if (!match || match.index === undefined) return;

                            const from = line.from + match.index;
                            const to = from + match[0].length;

                            if (newDate === null) {
                                // 날짜 앞 공백이 있으면 함께 제거
                                const removeFrom = (match.index > 0 && text[match.index - 1] === ' ') ? from - 1 : from;
                                clickedView.dispatch({ changes: { from: removeFrom, to, insert: '' } });
                            } else {
                                clickedView.dispatch({ changes: { from, to, insert: \`\\uD83D\\uDCC5 \${newDate}\` } });
                            }
                        } catch (err) {
                            console.error("[Bug M] view dispatch 실패:", err);
                        }
                    }, doc);
                    return true;
                }`;

// Wait, the original calTs will have the actual emoji `📅`, not `\uD83D\uDCC5` inside the string literal!
const calLogicStrOriginal = `                const { isMatch, dateStr, lineNo } = isDateClickableRange(view, pos);
                if (isMatch) {
                    e.preventDefault();
                    const rect = target.getBoundingClientRect();
                    // Bug M: 클릭 시점 view를 캡처하여 콜백에서 사용 (getActiveViewOfType 클로저 버그 해결)
                    const clickedView = view;
                    const doc = view.dom.ownerDocument;
                    buildCalendarPopup(dateStr, rect.left + rect.width / 2, rect.top + rect.height / 2, (newDate) => {
                        try {
                            const line = clickedView.state.doc.line(lineNo);
                            const text = line.text;
                            // 클릭했던 원본 날짜를 정확히 타겟팅하기 위해 dateStr 활용
                            const regex = new RegExp(\`📅\\\\s*\${dateStr}\`);
                            const match = text.match(regex);
                            if (!match || match.index === undefined) return;

                            const from = line.from + match.index;
                            const to = from + match[0].length;

                            if (newDate === null) {
                                // 날짜 앞 공백이 있으면 함께 제거
                                const removeFrom = (match.index > 0 && text[match.index - 1] === ' ') ? from - 1 : from;
                                clickedView.dispatch({ changes: { from: removeFrom, to, insert: '' } });
                            } else {
                                clickedView.dispatch({ changes: { from, to, insert: \`📅 \${newDate}\` } });
                            }
                        } catch (err) {
                            console.error("[Bug M] view dispatch 실패:", err);
                        }
                    }, doc);
                    return true;
                }`;

const calStartIndex = calTs.indexOf(calLogicStrOriginal);
if (calStartIndex !== -1) {
    const calEndOffset = calStartIndex + calLogicStrOriginal.length;
    let newClickLogic = `                const { isMatch, dateStr, lineNo, exactFrom, exactTo } = isDateClickableRange(view, pos);
                if (isMatch) {
                    e.preventDefault();
                    const rect = target.getBoundingClientRect();
                    // Bug M: 클릭 시점 view를 캡처하여 콜백에서 사용
                    const clickedView = view;
                    const doc = view.dom.ownerDocument;
                    buildCalendarPopup(dateStr, rect.left + rect.width / 2, rect.top + rect.height / 2, (newDate) => {
                        try {
                            const targetText = clickedView.state.doc.sliceString(exactFrom, exactTo);
                            if (!targetText.includes(dateStr)) {
                                console.warn("Date clickable position changed, aborting replacement.");
                                return;
                            }

                            if (newDate === null) {
                                const removeFrom = (exactFrom > 0 && clickedView.state.doc.sliceString(exactFrom - 1, exactFrom) === ' ') ? exactFrom - 1 : exactFrom;
                                clickedView.dispatch({ changes: { from: removeFrom, to: exactTo, insert: '' } });
                            } else {
                                clickedView.dispatch({ changes: { from: exactFrom, to: exactTo, insert: \`\\uD83D\\uDCC5 \${newDate}\` } });
                            }
                        } catch (err) {
                            console.error("[Bug M] view dispatch 실패:", err);
                        }
                    }, doc);
                    return true;
                }`;
    calTs = calTs.substring(0, calStartIndex) + newClickLogic + calTs.substring(calEndOffset);
    console.log("Successfully replaced cal logic block");
} else {
    console.log("Failed to locate cal logic block");
}

fs.writeFileSync('src/ui/CalendarWidget.ts', calTs, 'utf8');
console.log("SUCCESS");
