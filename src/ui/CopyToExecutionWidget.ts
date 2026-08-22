import { App, MarkdownView, Notice, TFile } from "obsidian";
import { ViewPlugin, DecorationSet, Decoration, EditorView, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";

class CopyToExecutionWidget extends WidgetType {
    constructor(
        public getView: () => EditorView,
        public lang: string,
        public fileManager: { getActiveViewOrFileText: (f: TFile) => Promise<string>, pluginWrite: (f: TFile, text: string) => Promise<void> },
        public activeFile: TFile
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
        span.className = "myworld-copy-btn";
        span.textContent = "⬆️";
        span.title = this.lang === 'ko' ? "실행 탭으로 복사" : "Copy to Execution";
        span.contentEditable = "false";

        span.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();

            void (async () => {
                try {
                    const clickedView = this.getView();
                    const pos = clickedView.posAtDOM(span);
                    if (pos === null || pos < 0 || pos > clickedView.state.doc.length) return;
                    const line = clickedView.state.doc.lineAt(pos);
                    const taskText = line.text;

                    const rawContent = await this.fileManager.getActiveViewOrFileText(this.activeFile);
                    const lines = rawContent.split("\n");
                    
                    let targetIndex = -1;
                    for (let i = 0; i < lines.length; i++) {
                        const h = lines[i].trim().toLowerCase();
                        if (h === "# 실행" || h === "# execution") {
                            targetIndex = i + 1;
                            while (targetIndex < lines.length) {
                                if (lines[targetIndex].startsWith("#")) {
                                    while(targetIndex > i + 1 && lines[targetIndex - 1].trim() === "") {
                                        targetIndex--;
                                    }
                                    break;
                                }
                                targetIndex++;
                            }
                            break;
                        }
                    }

                    if (targetIndex !== -1) {
                        const getIndent = (s: string) => {
                            const m = s.match(/^([\s\t]*)/);
                            if (!m) return 0;
                            // 탭(\t)을 4칸 스페이스로 치환하여 혼용 시에도 정확한 들여쓰기 길이 측정
                            return m[1].replace(/\t/g, "    ").length;
                        };
                        
                        const baseIndent = getIndent(taskText);
                        let textToCopy = taskText;
                        
                        let nextLine = line.number + 1;
                        while (nextLine <= clickedView.state.doc.lines) {
                            const nextText = clickedView.state.doc.line(nextLine).text;
                            if (nextText.trim() === "") {
                                nextLine++;
                                continue;
                            }
                            if (getIndent(nextText) <= baseIndent) {
                                break;
                            }
                            textToCopy += "\n" + nextText;
                            nextLine++;
                        }

                        lines.splice(targetIndex, 0, textToCopy);
                        await this.fileManager.pluginWrite(this.activeFile, lines.join("\n"));
                        new Notice(this.lang === 'ko' ? "실행 탭으로 복사 완료!" : "Copied to Execution tab!");
                    } else {
                        new Notice(this.lang === 'ko' ? "# 실행 탭을 찾을 수 없습니다." : "Could not find # Execution tab.");
                    }
                } catch(err) {
                    console.error("CopyToExecution error:", err);
                }
            })();
        });

        return span;
    }
}

const RebuildDecorations = StateEffect.define<null>();

export function buildCopyToExecutionButtonExtension(app: App, getPlugin: () => { settings: { mainSchedulePath: string; projectDirectory: string; language: string }, fileManager: { getActiveViewOrFileText: (f: TFile) => Promise<string>, pluginWrite: (f: TFile, text: string) => Promise<void> } }) {
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

        destroy() {
            if (this.timer) {
                window.clearTimeout(this.timer);
                this.timer = null;
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const leaf = app.workspace.getLeavesOfType("markdown").find(l => l.view.containerEl.contains(view.dom));
            const activeFile = leaf ? (leaf.view as MarkdownView).file : null;
            if (!activeFile) return builder.finish();

            const plugin = getPlugin();
            const activePath = activeFile.path.replace(/\\/g, "/");
            const schedulePath = (plugin.settings.mainSchedulePath || "").replace(/\\/g, "/");
            const projectDir = (plugin.settings.projectDirectory || "").replace(/\\/g, "/");
            const dirPrefix = projectDir.endsWith("/") ? projectDir : projectDir + "/";
            const isProject = activePath.startsWith(dirPrefix) && activePath !== schedulePath;
            if (!isProject) return builder.finish();

            const getView = () => this.currentView;
            const lang = plugin.settings.language || "en";

            // 단일 패스 순방향 파서:
            // visible range 시작점에서 단 1번만 위로 역추적하여 초기 헤더 컨텍스트 파악
            let currentHeader = "";
            if (view.visibleRanges.length > 0) {
                const firstLineNo = view.state.doc.lineAt(view.visibleRanges[0].from).number;
                for (let i = firstLineNo; i > 0; i--) {
                    const l = view.state.doc.line(i).text.trim();
                    const m = l.match(/^#\s+(.*)$/);
                    if (m) { currentHeader = m[1].trim().toLowerCase(); break; }
                }
            }

            for (const { from, to } of view.visibleRanges) {
                let pos = from;
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos);
                    const text = line.text;

                    // 헤더 라인이면 currentHeader 갱신 후 계속
                    const headerMatch = text.trim().match(/^#\s+(.*)$/);
                    if (headerMatch) {
                        currentHeader = headerMatch[1].trim().toLowerCase();
                        pos = line.to + 1;
                        continue;
                    }

                    const match = text.match(/^(?:\s*>\s*)*\s*[-*+]\s+\[(.)\]/);
                    if (match && match[1] === " ") {
                        const isInPlanSection = currentHeader === "계획" || currentHeader === "plan";

                        if (isInPlanSection) {
                            builder.add(
                                line.to, line.to,
                                Decoration.widget({
                                    widget: new CopyToExecutionWidget(getView, lang, plugin.fileManager, activeFile),
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
