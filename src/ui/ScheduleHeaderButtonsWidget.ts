import { App, MarkdownView, TFile, setIcon } from "obsidian";
import { ViewPlugin, DecorationSet, Decoration, EditorView, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";

export type ScheduleHeaderActionType = "quick-capture" | "fleeting-memo" | "daily-reset" | "monthly-archive" | "routine-manager";

class ScheduleHeaderBtnWidget extends WidgetType {
    constructor(
        public actionType: ScheduleHeaderActionType,
        public iconName: string,
        public tooltip: string,
        public onClick: () => void
    ) {
        super();
    }

    eq(other: ScheduleHeaderBtnWidget) {
        return other.actionType === this.actionType && other.tooltip === this.tooltip;
    }

    ignoreEvent() {
        return true;
    }

    toDOM() {
        const span = createSpan();
        span.className = `myworld-header-action-btn myworld-btn-${this.actionType}`;
        span.title = this.tooltip;
        span.contentEditable = "false";

        // 에디터 모드(CodeMirror)는 부모 .cm-line에 CSS :has로 접근 불가하므로
        // daily-reset 버튼은 인라인 스타일로 직접 위치를 지정
        if (this.actionType === "daily-reset") {
            span.style.position = "absolute";
            span.style.right = "8px";
            span.style.top = "50%";
            span.style.transform = "translateY(-50%)";
            span.style.marginLeft = "0";
        }

        setIcon(span, this.iconName);

        span.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.onClick();
        });

        span.addEventListener("mouseenter", () => {
            if (this.actionType === "daily-reset") {
                span.style.transform = "translateY(-50%) scale(1.18)";
            }
        });

        span.addEventListener("mouseleave", () => {
            if (this.actionType === "daily-reset") {
                span.style.transform = "translateY(-50%)";
            }
        });

        return span;
    }
}

const RebuildDecorations = StateEffect.define<null>();

export function buildScheduleHeaderButtonsExtension(
    app: App,
    getPlugin: () => { settings: { mainSchedulePath: string; language: string } },
    onAction: (file: TFile, action: ScheduleHeaderActionType) => void
) {
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
            } else if (update.docChanged || update.focusChanged || update.selectionSet) {
                if (this.timer) window.clearTimeout(this.timer);
                this.timer = window.setTimeout(() => {
                    this.currentView.dispatch({ effects: RebuildDecorations.of(null) });
                }, 300);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const leaf = app.workspace.getLeavesOfType("markdown").find(l => l.view.containerEl.contains(view.dom));
            const activeFile = leaf ? (leaf.view as MarkdownView).file : null;
            if (!activeFile) return builder.finish();

            const plugin = getPlugin();
            const isSchedule = activeFile.path === plugin.settings.mainSchedulePath;
            if (!isSchedule) return builder.finish();

            const lang = plugin.settings.language || "en";
            const isKo = lang === "ko";

            // 활성 줄 제외
            const activeLines = new Set<number>();
            for (const range of view.state.selection.ranges) {
                activeLines.add(view.state.doc.lineAt(range.head).number);
                if (!range.empty) {
                    activeLines.add(view.state.doc.lineAt(range.anchor).number);
                }
            }

            for (const { from, to } of view.visibleRanges) {
                let pos = from;
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos);
                    if (activeLines.has(line.number)) {
                        pos = line.to + 1;
                        continue;
                    }

                    const text = line.text.trim();

                    // 1. # 루틴 / # Routine ➔ ⚙️ 루틴 편집 + 🌤️ 일간 마감 (가장 우측)
                    if (/^#\s+(루틴|Routine)$/i.test(text)) {
                        // .cm-line에 position: relative 클래스 부여 (daily-reset absolute 포지션용)
                        builder.add(
                            line.from, line.from,
                            Decoration.line({ class: "myworld-header-with-btn" })
                        );
                        builder.add(
                            line.to, line.to,
                            Decoration.widget({
                                widget: new ScheduleHeaderBtnWidget(
                                    "routine-manager",
                                    "settings",
                                    isKo ? "루틴 편집 및 설정" : "Edit Routine Manager",
                                    () => onAction(activeFile, "routine-manager")
                                ),
                                side: 1
                            })
                        );
                        builder.add(
                            line.to, line.to,
                            Decoration.widget({
                                widget: new ScheduleHeaderBtnWidget(
                                    "daily-reset",
                                    "sun",
                                    isKo ? "일간 마감 실행" : "Run Daily Reset",
                                    () => onAction(activeFile, "daily-reset")
                                ),
                                side: 2
                            })
                        );
                    }
                    // 2. # Todo ➔ ✏️ 빠른 추가 + 📋 임시 메모 (버튼 2개)
                    else if (/^#\s+Todo$/i.test(text)) {
                        builder.add(
                            line.to, line.to,
                            Decoration.widget({
                                widget: new ScheduleHeaderBtnWidget(
                                    "quick-capture",
                                    "pencil",
                                    isKo ? "빠른 할 일 등록" : "Quick Capture",
                                    () => onAction(activeFile, "quick-capture")
                                ),
                                side: 1
                            })
                        );
                        builder.add(
                            line.to, line.to,
                            Decoration.widget({
                                widget: new ScheduleHeaderBtnWidget(
                                    "fleeting-memo",
                                    "file-text",
                                    isKo ? "임시 메모 열기" : "Open Fleeting Memo",
                                    () => onAction(activeFile, "fleeting-memo")
                                ),
                                side: 2
                            })
                        );
                    }
                    // 3. # 체크리스트 / # Checklist ➔ 🗂️ 월간 아카이브
                    else if (/^#\s+(체크리스트|Checklist)$/i.test(text)) {
                        builder.add(
                            line.to, line.to,
                            Decoration.widget({
                                widget: new ScheduleHeaderBtnWidget(
                                    "monthly-archive",
                                    "archive",
                                    isKo ? "월간 아카이브 생성" : "Create Monthly Archive",
                                    () => onAction(activeFile, "monthly-archive")
                                ),
                                side: 1
                            })
                        );
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
