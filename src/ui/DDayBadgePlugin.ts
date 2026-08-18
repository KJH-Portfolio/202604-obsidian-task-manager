import { App, MarkdownView } from "obsidian";
import { ViewPlugin, DecorationSet, Decoration, EditorView, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";

class DDayBadgeWidget extends WidgetType {
    constructor(public badge: string, public color: string) {
        super();
    }
    eq(other: DDayBadgeWidget) {
        return other.badge === this.badge && other.color === this.color;
    }
    toDOM() {
        const span = createSpan({ cls: "dday-virtual-badge" });
        span.textContent = this.badge;
        span.style.color = this.color;
        return span;
    }
}

const RebuildDecorations = StateEffect.define<null>();

export const buildDDayBadgePlugin = (app: App) => ViewPlugin.fromClass(class {
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
        } else if (update.docChanged || update.selectionSet || update.focusChanged) {
            if (this.timer) window.clearTimeout(this.timer);
            this.timer = window.setTimeout(() => {
                update.view.dispatch({ effects: RebuildDecorations.of(null) });
            }, 300);
        }
    }

    buildDeco(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();
        const leaf = app.workspace.getLeavesOfType("markdown").find(l => l.view.containerEl.contains(view.dom));
        const activeFile = leaf ? (leaf.view as MarkdownView).file : null;
        if (!activeFile) return builder.finish();

        const today = window.moment().startOf('day');
        
        const tabSize = view.state.tabSize || 4;
        
        const getIndent = (text: string) => {
            const match = text.match(/^[\s]*/);
            if (!match) return 0;
            const spaces = match[0].replace(/\t/g, " ".repeat(tabSize));
            return spaces.length;
        };
        
        for (const { from, to } of view.visibleRanges) {
            let pos = from;
            while (pos <= to) {
                const line = view.state.doc.lineAt(pos);
                pos = line.to + 1;
                
                const taskMatch = line.text.match(/^([\s]*(?:>\s*)*[-*+]\s+\[(.)\])/);
                if (taskMatch && taskMatch[2] === " ") {
                    let dateStr: string | null = null;
                    const dateMatch = line.text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                    
                    if (dateMatch) {
                        dateStr = dateMatch[1];
                    } else {
                        // Look upwards for inherited date
                        let currentIndent = getIndent(line.text);
                        let lineNo = line.number - 1;
                        while (lineNo >= 1) {
                            const pLine = view.state.doc.line(lineNo);
                            const pText = pLine.text;
                            const pTaskMatch = pText.match(/^([\s]*(?:>\s*)*[-*+]\s+\[.\])/);
                            if (pTaskMatch) {
                                const pIndent = getIndent(pText);
                                if (pIndent < currentIndent) {
                                    const pDateMatch = pText.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                                    if (pDateMatch) {
                                        dateStr = pDateMatch[1];
                                        break;
                                    }
                                    currentIndent = pIndent;
                                    if (currentIndent === 0) break;
                                }
                            } else if (!/^\s*$/.test(pText)) {
                                if (/^\S/.test(pText)) break;
                            }
                            lineNo--;
                        }
                    }

                    if (dateStr) {
                        const targetDate = window.moment(dateStr, "YYYY-MM-DD", true);
                        if (targetDate.isValid()) {
                            const diff = targetDate.diff(today, 'days');
                            let badge = "";
                            let color = "";
                            
                            if (diff < 0) { badge = "[!]"; color = "#8c0028"; }
                            else if (diff === 0) { badge = "[D]"; color = "#e93147"; }
                            else if (diff === 1) { badge = "[D]"; color = "#ffd200"; }
                            else if (diff === 2) { badge = "[D]"; color = "#44cf6e"; }
                            else if (diff === 3) { badge = "[D]"; color = "#086ddd"; }
                            else { badge = "[D]"; color = "#969696"; }

                            const deco = Decoration.widget({
                                widget: new DDayBadgeWidget(badge, color),
                                side: 1
                            });
                            
                            const insertPos = line.from + taskMatch[1].length;
                            builder.add(insertPos, insertPos, deco);
                        }
                    }
                }
            }
        }
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});
