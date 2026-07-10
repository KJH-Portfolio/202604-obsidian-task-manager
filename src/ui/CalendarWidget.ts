/* eslint-disable @typescript-eslint/no-unsafe-member-access -- window.moment 및 DOM 조작을 위해 허용 */
/* eslint-disable @typescript-eslint/no-unsafe-call -- window.moment 연산을 위해 허용 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- DOM 요소 동적 할당을 위해 허용 */
import { App, MarkdownView } from "obsidian";
import { ViewPlugin, DecorationSet, Decoration, EditorView, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// ─────────────────────────────────────────────────────────────
// 1. 달력 팝업
// ─────────────────────────────────────────────────────────────
export function buildCalendarPopup(
    initialDate: string,
    posLeft: number,
    posTop: number,
    onSelect: (date: string | null) => void,
    doc: Document = activeDocument
) {
    // @ts-ignore
    const today = window.moment();
    // @ts-ignore
    let baseDate = window.moment(initialDate, "YYYY-MM-DD", true);
    if (!baseDate.isValid()) {
        baseDate = today.clone();
    }
    
    // 과거 날짜이거나, '미정'을 의미하는 먼 미래(2099년 이상)의 날짜인 경우 오늘 기준으로 덮어씌움
    if (baseDate.isBefore(today, 'day') || baseDate.year() >= 2099) {
        baseDate = today.clone();
    }

    let weekOffset = 0;

    // 기존 팝업 제거
    doc.querySelectorAll(".myworld-cal-popup").forEach(el => el.remove());

    const popup = doc.createElement("div");
    popup.className = "myworld-cal-popup";
    popup.setCssStyles({
        position: "fixed",
        left: `${posLeft}px`,
        top: `${posTop}px`,
        transform: "translate(-50%, -50%)",
        zIndex: "9999"
    });

    const outsideClickHandler = (e: MouseEvent) => {
        if (!popup.contains(e.target as Node)) {
            popup.remove();
            doc.removeEventListener("mousedown", outsideClickHandler);
        }
    };

    const cleanupAndClose = () => {
        popup.remove();
        doc.removeEventListener("mousedown", outsideClickHandler);
    };

    const render = () => {
        popup.innerHTML = "";

        const todayStr = today.format("YYYY-MM-DD");
        // @ts-ignore
        const primaryDate = baseDate.clone().add(weekOffset, 'weeks');
        // @ts-ignore
        const startDate = primaryDate.clone().startOf('week');

        const primaryMonthNum = primaryDate.month();
        const monthLabel = `${primaryDate.format('M월')}`;
        const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

        // Header
        const header = doc.createElement("div");
        header.className = "myworld-cal-header";

        const btnPrev = doc.createElement("button");
        btnPrev.className = "myworld-cal-nav";
        btnPrev.textContent = "‹";
        btnPrev.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            weekOffset -= 5;
            render();
        });

        const spanMonth = doc.createElement("span");
        spanMonth.className = "myworld-cal-month";
        spanMonth.textContent = monthLabel;

        const btnNext = doc.createElement("button");
        btnNext.className = "myworld-cal-nav";
        btnNext.textContent = "›";
        btnNext.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            weekOffset += 5;
            render();
        });

        header.appendChild(btnPrev);
        header.appendChild(spanMonth);
        header.appendChild(btnNext);
        popup.appendChild(header);

        // Day of week row
        const dowRow = doc.createElement("div");
        dowRow.className = "myworld-cal-dow";
        DAYS.forEach(d => {
            const cell = doc.createElement("div");
            cell.textContent = d;
            dowRow.appendChild(cell);
        });
        popup.appendChild(dowRow);

        // Grid
        const grid = doc.createElement("div");
        grid.className = "myworld-cal-grid";

        for (let i = 0; i < 35; i++) {
            // @ts-ignore
            const currentCellDate = startDate.clone().add(i, 'days');
            const ds = currentCellDate.format("YYYY-MM-DD");
            
            const cell = doc.createElement("div");
            cell.className = "myworld-cal-day";
            
            if (ds < todayStr) {
                cell.classList.add("myworld-cal-past");
            } else {
                if (currentCellDate.month() !== primaryMonthNum) {
                    cell.classList.add("myworld-cal-other-month");
                }
                cell.addEventListener("mousedown", (e) => {
                    e.preventDefault(); e.stopPropagation();
                    onSelect(ds);
                    cleanupAndClose();
                });
            }

            if (ds === todayStr) cell.classList.add("myworld-cal-today");
            if (ds === initialDate) cell.classList.add("myworld-cal-selected");
            const dow = currentCellDate.day(); // 0=Sun
            if (dow === 0) cell.classList.add("myworld-cal-sun");
            if (dow === 6) cell.classList.add("myworld-cal-sat");
            cell.textContent = currentCellDate.format('D');
            cell.setAttribute("data-date", ds);
            
            grid.appendChild(cell);
        }
        popup.appendChild(grid);

        // Footer
        const footer = doc.createElement("div");
        footer.className = "myworld-cal-footer";

        const btnDelete = doc.createElement("button");
        btnDelete.className = "myworld-cal-foot-btn";
        btnDelete.textContent = "삭제";
        btnDelete.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            onSelect(null);
            cleanupAndClose();
        });

        const btnToday = doc.createElement("button");
        btnToday.className = "myworld-cal-foot-btn myworld-cal-today-btn";
        btnToday.textContent = "오늘";
        btnToday.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            onSelect(todayStr);
            cleanupAndClose();
        });

        footer.appendChild(btnDelete);
        footer.appendChild(btnToday);
        popup.appendChild(footer);
    };

    render();
    doc.body.appendChild(popup);
    window.setTimeout(() => {
        doc.addEventListener("mousedown", outsideClickHandler);
    }, 0);
}

// ─────────────────────────────────────────────────────────────
// 2. 날짜 텍스트를 클릭 가능한 span으로 꾸미는 CM6 플러그인 (라이브 프리뷰용)
// ─────────────────────────────────────────────────────────────
function isDateClickableRange(view: EditorView, pos: number): { isMatch: boolean, dateStr: string, lineNo: number, exactFrom: number, exactTo: number } {
    const line = view.state.doc.lineAt(pos);
    const text = line.text;
    
    // 문서 내 어느 곳이든 📅 뒤에 오는 날짜 인식
    const regex = /📅\s*(\d{4}-\d{2}-\d{2})/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const start = line.from + match.index;
        const end = start + match[0].length;
        if (pos >= start && pos <= end) {
            return { isMatch: true, dateStr: match[1], lineNo: line.number, exactFrom: start, exactTo: end };
        }
    }
    
    return { isMatch: false, dateStr: "", lineNo: 0, exactFrom: 0, exactTo: 0 };
}

export const buildDateClickablePlugin = (app: App, getPlugin: () => { settings: { mainSchedulePath: string; projectDirectory: string } }) => ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.buildDeco(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = this.buildDeco(update.view);
        }
    }

    buildDeco(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();
        const leaf = app.workspace.getLeavesOfType("markdown").find(l => l.view.containerEl.contains(view.dom));
        const activeFile = leaf ? (leaf.view as MarkdownView).file : null;
        if (!activeFile) return builder.finish();

        // 캘린더 클릭 기능 스코프 제한 (스케줄 노트 또는 프로젝트 폴더 내부만)
        const plugin = getPlugin();
        const isSchedule = activeFile.path === plugin.settings.mainSchedulePath;
        const isProject = activeFile.path.startsWith(plugin.settings.projectDirectory);
        if (!isSchedule && !isProject) return builder.finish();

        const processedLines = new Set<number>();
        const marks: { start: number; end: number; isOverdue: boolean }[] = [];
        const todayStr = window.moment().format("YYYY-MM-DD");

        for (const { from, to } of view.visibleRanges) {
            for (let pos = from; pos <= to;) {
                const line = view.state.doc.lineAt(pos);
                if (!processedLines.has(line.number)) {
                    processedLines.add(line.number);
                    // 라인 형식 제한 없이 전체 텍스트에서 매칭
                    const regex = /📅\s*(\d{4}-\d{2}-\d{2})/g;
                    let match;
                    while ((match = regex.exec(line.text)) !== null) {
                        const start = line.from + match.index;
                        const end = start + match[0].length;
                        const dateStr = match[1];
                        marks.push({ start, end, isOverdue: dateStr < todayStr });
                    }
                }
                pos = line.to + 1;
            }
        }

        marks.sort((a, b) => a.start - b.start);
        for (const m of marks) {
            let cls = "myworld-date-clickable-text";
            if (m.isOverdue) cls += " myworld-overdue";
            builder.add(m.start, m.end, Decoration.mark({ class: cls }));
        }
        return builder.finish();
    }
}, {
    decorations: v => v.decorations,
    eventHandlers: {
        mousedown: (e: MouseEvent, view: EditorView) => {
            const target = e.target as HTMLElement;

            // 날짜 클릭 처리
            if (target && target.classList.contains("myworld-date-clickable-text")) {
                const pos = view.posAtDOM(target);
                                const { isMatch, dateStr, lineNo, exactFrom, exactTo } = isDateClickableRange(view, pos);
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
                                clickedView.dispatch({ changes: { from: exactFrom, to: exactTo, insert: `\uD83D\uDCC5 ${newDate}` } });
                            }
                        } catch (err) {
                            console.error("[Bug M] view dispatch 실패:", err);
                        }
                    }, doc);
                    return true;
                }
            }
        }
    }
});

// ─────────────────────────────────────────────────────────────
// 3. 오늘 버튼 위젯 (이모지만, 달력 팝업 연동) — CM6용
// ─────────────────────────────────────────────────────────────
class TodayEmojiWidget extends WidgetType {
    constructor(
        public getView: () => EditorView
    ) {
        super();
    }

    eq() {
        return true;
    }

    ignoreEvent() {
        return true;
    }

    toDOM() {
        const view = this.getView();
        const doc = view?.dom.ownerDocument || activeDocument;
        const span = doc.createElement("span");
        span.className = "myworld-today-btn";
        span.textContent = "📅";
        span.title = "날짜 지정";
        span.contentEditable = "false";

        span.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const todayStr = window.moment().format("YYYY-MM-DD");

            void (async () => {
                const clickedView = this.getView();
                const pos = clickedView.posAtDOM(span);
                const line = clickedView.state.doc.lineAt(pos);
                const idMatch = line.text.match(/\s+\^[a-zA-Z0-9]+$/);
                const insertPos = idMatch ? line.to - idMatch[0].length : line.to;
                
                clickedView.dispatch({
                    changes: { from: insertPos, insert: ` 📅 ${todayStr}` }
                });
            })();
        });

        return span;
    }
}

export function buildTodayButtonExtension(app: App, getPlugin: () => { settings: { mainSchedulePath: string; projectDirectory: string } }) {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;
        currentView: EditorView;

        constructor(view: EditorView) {
            this.currentView = view;
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            this.currentView = update.view;
            if (update.docChanged || update.viewportChanged || update.focusChanged || update.geometryChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const leaf = app.workspace.getLeavesOfType("markdown").find(l => l.view.containerEl.contains(view.dom));
            const activeFile = leaf ? (leaf.view as MarkdownView).file : null;
            if (!activeFile) return builder.finish();

            const plugin = getPlugin();
            const isSchedule = activeFile.path === plugin.settings.mainSchedulePath;
            const isProject = activeFile.path.startsWith(plugin.settings.projectDirectory);
            if (!isSchedule && !isProject) return builder.finish();

            const getView = () => this.currentView;

            for (const { from, to } of view.visibleRanges) {
                let pos = from;
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos);
                    const text = line.text;
                    const isTask = /^(?:\s*>\s*)*\s*[-*+]\s+\[.\]/.test(text);
                    const isCompleted = /^(?:\s*>\s*)*\s*[-*+]\s+\[[xX-]\]/.test(text);

                    if (isTask && !isCompleted && !/\d{4}-\d{2}-\d{2}/.test(text)) {
                        let shouldShow = false;

                        if (isSchedule) {
                            let header = "";
                            for (let i = line.number; i > 0; i--) {
                                const l = view.state.doc.line(i).text;
                                const m = l.match(/^#\s+(.*)$/);
                                if (m) { header = m[1].trim().toLowerCase(); break; }
                            }
                            if (header === "todo" || header === "project") shouldShow = true;
                        } else if (isProject) {
                            shouldShow = true;
                        }

                        if (shouldShow) {
                            builder.add(
                                line.to, line.to,
                                Decoration.widget({
                                    widget: new TodayEmojiWidget(getView),
                                    side: 1
                                })
                            );
                        }
                    }
                    pos = line.to + 1;
                }
            }
            return builder.finish();
        }
    }, {
        decorations: v => v.decorations
    });
}
/* eslint-enable @typescript-eslint/no-unsafe-member-access -- window.moment 및 DOM 조작을 위해 허용 */
/* eslint-enable @typescript-eslint/no-unsafe-call -- window.moment 연산을 위해 허용 */
/* eslint-enable @typescript-eslint/no-unsafe-assignment -- DOM 요소 동적 할당을 위해 허용 */
