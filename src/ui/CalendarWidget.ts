/* eslint-disable @typescript-eslint/no-unsafe-member-access -- window.moment 및 DOM 조작을 위해 허용 */
/* eslint-disable @typescript-eslint/no-unsafe-call -- window.moment 연산을 위해 허용 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- DOM 요소 동적 할당을 위해 허용 */
import { App, MarkdownView } from "obsidian";
import { ViewPlugin, DecorationSet, Decoration, EditorView, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import { t } from "../i18n";

// ─────────────────────────────────────────────────────────────
// 1. 달력 팝업
// ─────────────────────────────────────────────────────────────
export function buildCalendarPopup(
    initialDate: string,
    posLeft: number,
    posTop: number,
    onSelect: (date: string | null) => void,
    doc: Document = activeDocument,
    lang: string = "en"
) {
    // @ts-ignore
    const today = window.moment();
    // @ts-ignore
    let baseDate = window.moment(initialDate, "YYYY-MM-DD", true);
    if (!baseDate.isValid()) {
        baseDate = today.clone();
    }
    
    // '미정'을 의미하는 먼 미래(2099년 이상)의 날짜인 경우 오늘 기준으로 덮어씌움
    if (baseDate.year() >= 2099) {
        baseDate = today.clone();
    }

    let monthOffset = 0;

    // 기존 팝업 제거
    doc.querySelectorAll(".myworld-cal-popup").forEach(el => el.remove());

    const popup = createDiv();
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
        const currentMonthStart = baseDate.clone().add(monthOffset, 'months').startOf('month');
        // @ts-ignore
        const currentMonthEnd = currentMonthStart.clone().endOf('month');
        // @ts-ignore
        const startDate = currentMonthStart.clone().startOf('week');
        // @ts-ignore
        const endDate = currentMonthEnd.clone().endOf('week');

        const primaryMonthNum = currentMonthStart.month();
        const monthLabel = lang === 'ko' ? `${currentMonthStart.format('YYYY년 M월')}` : `${currentMonthStart.format('MMMM YYYY')}`;
        const DAYS = [t("cal_sun", lang), t("cal_mon", lang), t("cal_tue", lang), t("cal_wed", lang), t("cal_thu", lang), t("cal_fri", lang), t("cal_sat", lang)];

        // Header
        const header = createDiv();
        header.className = "myworld-cal-header";

        const btnPrev = createEl("button");
        btnPrev.className = "myworld-cal-nav";
        btnPrev.textContent = "‹";
        btnPrev.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            monthOffset -= 1;
            render();
        });

        const spanMonth = createSpan();
        spanMonth.className = "myworld-cal-month";
        spanMonth.textContent = monthLabel;

        const btnNext = createEl("button");
        btnNext.className = "myworld-cal-nav";
        btnNext.textContent = "›";
        btnNext.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            monthOffset += 1;
            render();
        });

        header.appendChild(btnPrev);
        header.appendChild(spanMonth);
        header.appendChild(btnNext);
        popup.appendChild(header);

        // Day of week row
        const dowRow = createDiv();
        dowRow.className = "myworld-cal-dow";
        DAYS.forEach(d => {
            const cell = createDiv();
            cell.textContent = d;
            dowRow.appendChild(cell);
        });
        popup.appendChild(dowRow);

        // Grid
        const grid = createDiv();
        grid.className = "myworld-cal-grid";

        // @ts-ignore
        const totalDays = Math.max(35, endDate.diff(startDate, 'days') + 1);

        for (let i = 0; i < totalDays; i++) {
            // @ts-ignore
            const currentCellDate = startDate.clone().add(i, 'days');
            const ds = currentCellDate.format("YYYY-MM-DD");
            
            const cell = createDiv();
            cell.className = "myworld-cal-day";
            
            if (currentCellDate.month() !== primaryMonthNum) {
                cell.classList.add("myworld-cal-other-month");
            }
            if (ds < todayStr) {
                cell.classList.add("myworld-cal-past");
            }

            cell.addEventListener("mousedown", (e) => {
                e.preventDefault(); e.stopPropagation();
                onSelect(ds);
                cleanupAndClose();
            });

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
        const footer = createDiv();
        footer.className = "myworld-cal-footer";

        const btnDelete = createEl("button");
        btnDelete.className = "myworld-cal-foot-btn";
        btnDelete.textContent = t("cal_delete", lang);
        btnDelete.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            onSelect(null);
            cleanupAndClose();
        });

        const btnToday = createEl("button");
        btnToday.className = "myworld-cal-foot-btn myworld-cal-today-btn";
        btnToday.textContent = t("cal_today", lang);
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

const RebuildDecorations = StateEffect.define<null>();

export const buildDateClickablePlugin = (app: App, getPlugin: () => { settings: { mainSchedulePath: string; projectDirectory: string; language: string } }) => ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    timer: number | null = null;

    constructor(view: EditorView) {
        this.decorations = this.buildDeco(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged) {
            this.decorations = this.decorations.map(update.changes);
        }
        
        const isTyping = update.transactions.some(tr => tr.isUserEvent("input") || tr.isUserEvent("delete"));
        const forceRebuild = update.transactions.some(tr => tr.effects.some(e => e.is(RebuildDecorations)));
        
        if (forceRebuild || (!isTyping && !update.view.composing && update.viewportChanged)) {
            this.decorations = this.buildDeco(update.view);
        } else if (!isTyping && !update.view.composing && (update.docChanged || update.selectionSet || update.focusChanged)) {
            if (this.timer) window.clearTimeout(this.timer);
            this.timer = window.setTimeout(() => {
                update.view.dispatch({ effects: RebuildDecorations.of(null) });
            }, 150);
        }
    }

    destroy() {
        if (this.timer) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }
    }

    buildDeco(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();
        const leaf = app.workspace.getLeavesOfType("markdown").find(l => l.view.containerEl.contains(view.dom));
        const activeFile = leaf ? (leaf.view as MarkdownView).file : null;
        if (!activeFile) return builder.finish();

        // 캘린더 클릭 기능 스코프 제한 (스케줄 노트 또는 프로젝트 폴더 내부만)
        const plugin = getPlugin();
        const activePath = activeFile.path.replace(/\\/g, "/");
        const schedulePath = (plugin.settings.mainSchedulePath || "").replace(/\\/g, "/");
        const projectDir = (plugin.settings.projectDirectory || "").replace(/\\/g, "/");
        const dirPrefix = projectDir.endsWith("/") ? projectDir : projectDir + "/";
        const isSchedule = activePath === schedulePath;
        const isProject = activePath.startsWith(dirPrefix);
        if (!isSchedule && !isProject) return builder.finish();

        const processedLines = new Set<number>();
        const marks: { start: number; end: number; className: string }[] = [];
        const todayStr = window.moment().format("YYYY-MM-DD");

        for (const { from, to } of view.visibleRanges) {
            for (let pos = from; pos <= to;) {
                const line = view.state.doc.lineAt(pos);
                if (!processedLines.has(line.number)) {
                    processedLines.add(line.number);
                    
                    // 1. 날짜 텍스트 마킹 (클릭 가능 및 연체 표시)
                    const regex = /📅\s*(\d{4}-\d{2}-\d{2})/g;
                    let match;
                    while ((match = regex.exec(line.text)) !== null) {
                        const start = line.from + match.index;
                        const end = start + match[0].length;
                        const dateStr = match[1];
                        let cls = "myworld-date-clickable-text";
                        if (dateStr < todayStr) cls += " myworld-overdue";
                        marks.push({ start, end, className: cls });
                    }

                    // 2. 블록 ID 완전 은닉 마킹
                    const blockIdMatch = line.text.match(/\s+(\^[a-zA-Z0-9]+)$/);
                    if (blockIdMatch && blockIdMatch.index !== undefined) {
                        const start = line.from + blockIdMatch.index;
                        const end = line.to;
                        marks.push({ start, end, className: "myworld-hidden-block-id" });
                    }
                }
                pos = line.to + 1;
            }
        }

        marks.sort((a, b) => a.start - b.start);
        for (const m of marks) {
            builder.add(m.start, m.end, Decoration.mark({ class: m.className }));
        }
        return builder.finish();
    }
}, {
    decorations: v => v.decorations,
    eventHandlers: {
        mousedown: (e: MouseEvent, view: EditorView) => {
            const lang = getPlugin().settings.language || "en";
            const target = e.target as HTMLElement;

            // 날짜 클릭 처리
            if (target && target.classList.contains("myworld-date-clickable-text")) {
                const pos = view.posAtDOM(target);
                const { isMatch, dateStr, exactFrom, exactTo } = isDateClickableRange(view, pos);
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
                    }, doc, lang);
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
        public lang: string
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
        const span = createSpan();
        span.className = "myworld-today-btn";
        span.textContent = "📅";
        span.title = t("cal_tooltip", this.lang);
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

export function buildTodayButtonExtension(app: App, getPlugin: () => { settings: { mainSchedulePath: string; projectDirectory: string; language: string } }) {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;
        currentView: EditorView;
        timer: number | null = null;

        constructor(view: EditorView) {
            this.currentView = view;
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            this.currentView = update.view;
            if (update.docChanged) {
                this.decorations = this.decorations.map(update.changes);
            }
            
            const isTyping = update.transactions.some(tr => tr.isUserEvent("input") || tr.isUserEvent("delete"));
            const forceRebuild = update.transactions.some(tr => tr.effects.some(e => e.is(RebuildDecorations)));
            
            if (forceRebuild || (!isTyping && !update.view.composing && (update.viewportChanged || update.geometryChanged))) {
                this.decorations = this.buildDecorations(update.view);
            } else if (!isTyping && !update.view.composing && (update.docChanged || update.focusChanged || update.selectionSet)) {
                if (this.timer) window.clearTimeout(this.timer);
                this.timer = window.setTimeout(() => {
                    this.currentView.dispatch({ effects: RebuildDecorations.of(null) });
                }, 150);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const leaf = app.workspace.getLeavesOfType("markdown").find(l => l.view.containerEl.contains(view.dom));
            let activeFile = leaf ? (leaf.view as MarkdownView).file : null;
            if (!activeFile) activeFile = app.workspace.getActiveFile();
            if (!activeFile) return builder.finish();

            const plugin = getPlugin();
            const activePath = activeFile.path.replace(/\\/g, "/");
            const schedulePath = (plugin.settings.mainSchedulePath || "").replace(/\\/g, "/");
            const projectDir = (plugin.settings.projectDirectory || "").replace(/\\/g, "/");
            const isSchedule = activePath === schedulePath;
            const isProject = activePath.startsWith(projectDir) && !isSchedule;
            if (!isSchedule && !isProject) return builder.finish();

            const getView = () => this.currentView;
            const lang = plugin.settings.language || "en";

            // 단일 패스 순방향 파서:
            // visible range 시작점에서 단 1번만 위로 역추적하여 초기 헤더 컨텍스트 파악
            let currentHeader = "";
            if (view.visibleRanges.length > 0) {
                const firstLineNo = view.state.doc.lineAt(view.visibleRanges[0].from).number;
                for (let i = firstLineNo; i > 0; i--) {
                    const m = view.state.doc.line(i).text.match(/^#+\s+(.*)$/);
                    if (m) { currentHeader = m[1].trim().toLowerCase(); break; }
                }
            }

            for (const { from, to } of view.visibleRanges) {
                let pos = from;
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos);
                    const text = line.text;

                    // 헤더 라인이면 currentHeader 갱신 후 계속
                    const headerMatch = text.match(/^#+\s+(.*)$/);
                    if (headerMatch) {
                        currentHeader = headerMatch[1].trim().toLowerCase();
                        pos = line.to + 1;
                        continue;
                    }

                    const isTask = /^(?:\s*>\s*)*\s*[-*+]\s+\[.\]\s+\S/.test(text);
                    const isCompleted = /^(?:\s*>\s*)*\s*[-*+]\s+\[[xX-]\]/.test(text);

                    if (isTask && !isCompleted && !/\d{4}-\d{2}-\d{2}/.test(text)) {
                        let shouldShow = false;

                        if (isSchedule) {
                            if (currentHeader.includes("todo") || currentHeader.includes("project")) shouldShow = true;
                        } else if (isProject) {
                            shouldShow = true;
                        }

                        if (shouldShow) {
                            builder.add(
                                line.to, line.to,
                                Decoration.widget({
                                    widget: new TodayEmojiWidget(getView, lang),
                                    side: 2
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
