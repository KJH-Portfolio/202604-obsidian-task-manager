import { App, MarkdownView, TFile, setIcon } from "obsidian";
import { ViewPlugin, DecorationSet, Decoration, EditorView, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";

export type ProjectHeaderActionType = "overview" | "plan";

class ProjectHeaderBtnWidget extends WidgetType {
    constructor(
        public actionType: ProjectHeaderActionType,
        public iconName: string,
        public tooltip: string,
        public onClick: () => void
    ) {
        super();
    }

    eq(other: ProjectHeaderBtnWidget) {
        return other.actionType === this.actionType && other.tooltip === this.tooltip;
    }

    ignoreEvent() {
        return true;
    }

    toDOM() {
        const span = createSpan();
        span.className = `myworld-header-action-btn myworld-btn-project-${this.actionType}`;
        span.title = this.tooltip;
        span.contentEditable = "false";

        setIcon(span, this.iconName);

        span.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.onClick();
        });

        return span;
    }
}

const RebuildDecorations = StateEffect.define<null>();

export function buildProjectHeaderButtonsExtension(
    app: App,
    getPlugin: () => { settings: { mainSchedulePath: string; projectDirectory: string; language: string } },
    onAction: (file: TFile, action: ProjectHeaderActionType) => void
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

            const lang = plugin.settings.language || "en";
            const isKo = lang === "ko";

            for (const { from, to } of view.visibleRanges) {
                let pos = from;
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos);
                    const text = line.text.trim();

                    // 1. # 개요 / # Overview ➔ ⚙️ 프로젝트 개요 관리
                    if (/^#\s+(개요|Overview)$/i.test(text)) {
                        builder.add(
                            line.to, line.to,
                            Decoration.widget({
                                widget: new ProjectHeaderBtnWidget(
                                    "overview",
                                    "settings",
                                    isKo ? "프로젝트 개요 관리" : "Manage Project Overview",
                                    () => onAction(activeFile, "overview")
                                ),
                                side: 1
                            })
                        );
                    }
                    // 2. # 계획 / # Plan ➔ ⚙️ 프로젝트 계획 관리
                    else if (/^#\s+(계획|Plan)$/i.test(text)) {
                        builder.add(
                            line.to, line.to,
                            Decoration.widget({
                                widget: new ProjectHeaderBtnWidget(
                                    "plan",
                                    "settings",
                                    isKo ? "프로젝트 계획 관리" : "Manage Project Plan",
                                    () => onAction(activeFile, "plan")
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
