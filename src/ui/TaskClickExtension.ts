import { App } from 'obsidian';
import { EditorView } from '@codemirror/view';

export const buildTaskClickExtension = (app: App, getPlugin: () => { settings: { mainSchedulePath: string; projectDirectory: string } }) => {
    return EditorView.domEventHandlers({
        mousedown: (e: MouseEvent, view: EditorView) => {
            const target = e.target as HTMLElement;

            if (target && target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
                const taskEl = target.closest('.task-list-item, .HyperMD-task-line');
                if (!taskEl) return false;

                try {
                    const pos = view.posAtDOM(target);
                    const line = view.state.doc.lineAt(pos);
                    
                    const blockContainer = target.closest('.cm-line, .cm-embed-block') || target.ownerDocument.body;
                    const allCheckboxes = Array.from(blockContainer.querySelectorAll('input[type="checkbox"]'));
                    const checkboxIndex = allCheckboxes.indexOf(target as HTMLInputElement);
                    
                    if (checkboxIndex === -1) return false;

                    let matchCount = 0;
                    const doc = view.state.doc;
                    
                    for (let i = line.number; i <= doc.lines; i++) {
                        const currentLine = doc.line(i);
                        const text = currentLine.text;
                        
                        const regex = /^(\s*(?:>\s*)*[-*+]\s+\[)(.)(\])/;
                        const match = text.match(regex);
                        
                        if (match) {
                            if (matchCount === checkboxIndex) {
                                e.preventDefault();
                                e.stopPropagation();

                                const currentMarker = match[2];
                                const nextMarker = /^[xX]$/.test(currentMarker) ? ' ' : 'x';

                                const from = currentLine.from + match.index!;
                                const to = from + match[0].length;
                                const newPrefix = match[1] + nextMarker + match[3];

                                view.dispatch({
                                    changes: { from, to, insert: newPrefix }
                                });
                                return true;
                            }
                            matchCount++;
                        }
                        
                        if (i > line.number + 200) break;
                    }
                } catch (err) {
                    console.error('Task click handling failed in CodeMirror:', err);
                }
            }
            return false;
        }
    });
};
