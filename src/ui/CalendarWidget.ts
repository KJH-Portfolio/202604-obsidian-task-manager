/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { App } from "obsidian";
import { ViewPlugin, DecorationSet, Decoration, EditorView, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// ─────────────────────────────────────────────────────────────
// 1. 달력 팝업
// ─────────────────────────────────────────────────────────────
export function buildCalendarPopup(
    initialDate: string,
    posLeft: number,
    posTop: number,
    onSelect: (date: string | null) => void
) {
    // @ts-ignore
    const today = window.moment();
    let curYear = parseInt(initialDate.split("-")[0]);
    let curMonth = parseInt(initialDate.split("-")[1]) - 1;
    if (isNaN(curYear) || isNaN(curMonth)) {
        curYear = today.year();
        curMonth = today.month();
    }

    // 기존 팝업 제거
    document.querySelectorAll(".myworld-cal-popup").forEach(el => el.remove());

    const popup = document.createElement("div");
    popup.className = "myworld-cal-popup";
    popup.style.position = "fixed";
    popup.style.left = `${posLeft}px`;
    popup.style.top = `${posTop}px`;
    popup.style.zIndex = "9999";

    const outsideClickHandler = (e: MouseEvent) => {
        if (!popup.contains(e.target as Node)) {
            popup.remove();
            document.removeEventListener("mousedown", outsideClickHandler);
        }
    };

    const cleanupAndClose = () => {
        popup.remove();
        document.removeEventListener("mousedown", outsideClickHandler);
    };

    const render = () => {
        popup.innerHTML = "";

        const todayStr = today.format("YYYY-MM-DD");
        // @ts-ignore
        const firstDay = window.moment({ year: curYear, month: curMonth, day: 1 });
        const daysInMonth = firstDay.daysInMonth();
        const startDow = firstDay.day(); // 0=Sun

        const monthLabel = `${curYear}년 ${curMonth + 1}월`;
        const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

        // Header
        const header = document.createElement("div");
        header.className = "myworld-cal-header";

        const btnPrev = document.createElement("button");
        btnPrev.className = "myworld-cal-nav";
        btnPrev.textContent = "‹";
        btnPrev.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            curMonth--;
            if (curMonth < 0) { curMonth = 11; curYear--; }
            render();
        });

        const spanMonth = document.createElement("span");
        spanMonth.className = "myworld-cal-month";
        spanMonth.textContent = monthLabel;

        const btnNext = document.createElement("button");
        btnNext.className = "myworld-cal-nav";
        btnNext.textContent = "›";
        btnNext.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            curMonth++;
            if (curMonth > 11) { curMonth = 0; curYear++; }
            render();
        });

        header.appendChild(btnPrev);
        header.appendChild(spanMonth);
        header.appendChild(btnNext);
        popup.appendChild(header);

        // Day of week row
        const dowRow = document.createElement("div");
        dowRow.className = "myworld-cal-dow";
        DAYS.forEach(d => {
            const cell = document.createElement("div");
            cell.textContent = d;
            dowRow.appendChild(cell);
        });
        popup.appendChild(dowRow);

        // Grid
        const grid = document.createElement("div");
        grid.className = "myworld-cal-grid";

        for (let i = 0; i < startDow; i++) {
            grid.appendChild(document.createElement("div"));
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const ds = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const cell = document.createElement("div");
            cell.className = "myworld-cal-day";
            if (ds === todayStr) cell.classList.add("myworld-cal-today");
            if (ds === initialDate) cell.classList.add("myworld-cal-selected");
            const dow = (startDow + d - 1) % 7;
            if (dow === 0) cell.classList.add("myworld-cal-sun");
            if (dow === 6) cell.classList.add("myworld-cal-sat");
            cell.textContent = String(d);
            cell.setAttribute("data-date", ds);
            cell.addEventListener("mousedown", (e) => {
                e.preventDefault(); e.stopPropagation();
                onSelect(ds);
                cleanupAndClose();
            });
            grid.appendChild(cell);
        }
        popup.appendChild(grid);

        // Footer
        const footer = document.createElement("div");
        footer.className = "myworld-cal-footer";

        const btnDelete = document.createElement("button");
        btnDelete.className = "myworld-cal-foot-btn";
        btnDelete.textContent = "삭제";
        btnDelete.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            onSelect(null);
            cleanupAndClose();
        });

        const btnToday = document.createElement("button");
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
    document.body.appendChild(popup);
    setTimeout(() => {
        document.addEventListener("mousedown", outsideClickHandler);
    }, 0);
}

// ─────────────────────────────────────────────────────────────
// 2. 날짜 텍스트를 클릭 가능한 span으로 꾸미는 CM6 플러그인 (라이브 프리뷰용)
// ─────────────────────────────────────────────────────────────
function isDateClickableRange(view: EditorView, pos: number): { isMatch: boolean; dateStr: string; lineNo: number } {
    const line = view.state.doc.lineAt(pos);
    const text = line.text;

    // 태스크 줄인지 확인
    if (!/^\s*(?:>\s*)*[-*+]\s+\[.\]/.test(text)) return { isMatch: false, dateStr: "", lineNo: 0 };

    const match = text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
    if (!match || match.index === undefined) return { isMatch: false, dateStr: "", lineNo: 0 };

    const dateStart = line.from + match.index;
    const dateEnd = dateStart + match[0].length;

    if (pos >= dateStart && pos <= dateEnd) {
        return { isMatch: true, dateStr: match[1], lineNo: line.number };
    }
    return { isMatch: false, dateStr: "", lineNo: 0 };
}

export const buildDateClickablePlugin = (app: App) => ViewPlugin.fromClass(class {
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
        const activeFile = app.workspace.getActiveFile();
        if (!activeFile) return builder.finish();

        const processedLines = new Set<number>();
        const marks: { start: number; end: number; isOverdue: boolean }[] = [];
        const todayStr = window.moment().format("YYYY-MM-DD");

        for (const { from, to } of view.visibleRanges) {
            for (let pos = from; pos <= to;) {
                const line = view.state.doc.lineAt(pos);
                if (!processedLines.has(line.number)) {
                    processedLines.add(line.number);
                    if (/^\s*(?:>\s*)*[-*+]\s+\[.\]/.test(line.text)) {
                        const match = line.text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                        if (match && match.index !== undefined) {
                            const start = line.from + match.index;
                            const end = start + match[0].length;
                            const dateStr = match[1];
                            marks.push({ start, end, isOverdue: dateStr < todayStr });
                        }
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
                const { isMatch, dateStr, lineNo } = isDateClickableRange(view, pos);
                if (isMatch) {
                    e.preventDefault();
                    const rect = target.getBoundingClientRect();
                    // Bug M: 클릭 시점 view를 캡처하여 콜백에서 사용 (getActiveViewOfType 클로저 버그 해결)
                    const clickedView = view;
                    buildCalendarPopup(dateStr, rect.left, rect.bottom + 5, (newDate) => {
                        try {
                            const line = clickedView.state.doc.line(lineNo);
                            const text = line.text;
                            const match = text.match(/📅\s*\d{4}-\d{2}-\d{2}/);
                            if (!match || match.index === undefined) return;

                            const from = line.from + match.index;
                            const to = from + match[0].length;

                            if (newDate === null) {
                                // 날짜 앞 공백이 있으면 함께 제거
                                const removeFrom = (match.index > 0 && text[match.index - 1] === ' ') ? from - 1 : from;
                                clickedView.dispatch({ changes: { from: removeFrom, to, insert: '' } });
                            } else {
                                clickedView.dispatch({ changes: { from, to, insert: `📅 ${newDate}` } });
                            }
                        } catch (err) {
                            console.error("[Bug M] view dispatch 실패:", err);
                        }
                    });
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
        public getView: () => EditorView,
        public lineFrom: number,
        public lineNo: number,
        public app: App
    ) {
        super();
    }

    eq(other: TodayEmojiWidget) {
        return other.lineFrom === this.lineFrom;
    }

    toDOM() {
        const span = document.createElement("span");
        span.className = "myworld-today-btn";
        span.textContent = "📅";
        span.title = "날짜 지정";

        span.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const todayStr = window.moment().format("YYYY-MM-DD");
            const rect = span.getBoundingClientRect();

            buildCalendarPopup(todayStr, rect.left, rect.bottom + 5, async (newDate) => {
                if (!newDate) return;
                const view = this.getView();
                const line = view.state.doc.line(this.lineNo);
                const idMatch = line.text.match(/\s+\^[a-zA-Z0-9]+$/);
                const insertPos = idMatch ? line.to - idMatch[0].length : line.to;
                
                view.dispatch({
                    changes: { from: insertPos, insert: ` 📅 ${newDate}` }
                });
            });
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
            const activeFile = app.workspace.getActiveFile();
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
                                    widget: new TodayEmojiWidget(getView, line.from, line.number, app),
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
