import { App, MarkdownView, TFile, setIcon } from "obsidian";
import { ViewPlugin, DecorationSet, Decoration, EditorView, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";

class AddExecutionTaskWidget extends WidgetType {
    constructor(
        public onAddClick: () => void,
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
        span.className = "myworld-add-execution-btn";
        span.title = this.lang === 'ko' ? "실행 할 일 추가" : "Add Task to Execution";
        span.contentEditable = "false";

        // 요구사항: 스케줄의 빠른 추가와 동일한 연필 모양 아이콘 (pencil)
        setIcon(span, "pencil");

        span.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.onAddClick();
        });

        return span;
    }
}

const RebuildDecorations = StateEffect.define<null>();

export function buildAddExecutionTaskButtonExtension(
    app: App,
    getPlugin: () => { settings: { projectDirectory: string; language: string } },
    onOpenAddModal: (file: TFile) => void
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
            const isProject = activeFile.path.startsWith(plugin.settings.projectDirectory);
            if (!isProject) return builder.finish();

            const lang = plugin.settings.language || "en";

            for (const { from, to } of view.visibleRanges) {
                let pos = from;
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos);
                    const text = line.text.trim();
                    const isExecHeader = /^#\s+(실행|Execution)$/i.test(text);

                    if (isExecHeader) {
                        builder.add(
                            line.to, line.to,
                            Decoration.widget({
                                widget: new AddExecutionTaskWidget(() => onOpenAddModal(activeFile), lang),
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
