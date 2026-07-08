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
                    
                    const text = line.text;
                    
                    const regex = /^(\s*(?:>\s*)*[-*+]\s+\[)(.)(\])/;
                    const match = text.match(regex);
                    
                    if (match) {
                        e.preventDefault();
                        e.stopPropagation();

                        const currentMarker = match[2];
                        const nextMarker = /^[xX]$/.test(currentMarker) ? ' ' : 'x';

                        const from = line.from + (match.index ?? 0);
                        const to = from + match[0].length;
                        const newPrefix = match[1] + nextMarker + match[3];

                        view.dispatch({
                            changes: { from, to, insert: newPrefix }
                        });
                        return true;
                    }
                } catch (err) {
                    console.error('Task click handling failed in CodeMirror:', err);
                }
            }
            return false;
        }
    });
};
