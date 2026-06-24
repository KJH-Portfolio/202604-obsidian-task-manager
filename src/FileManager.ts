import { App, TFile, Notice, MarkdownView } from "obsidian";

export class FileManager {
    private app: App;
    // BUG-01/05/04: 플러그인이 직접 수정한 파일 경로와 시간을 추적하여 vault.on('modify')에서 필터링 (Debounce)
    private pluginWritingFiles: Map<string, number>;

    constructor(app: App, pluginWritingFiles: Map<string, number>) {
        this.app = app;
        this.pluginWritingFiles = pluginWritingFiles;
    }

    getFile(path: string): TFile | null {
        if (!path) return null;
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            return file;
        }
        return null;
    }

    async getActiveViewOrFileText(file: TFile): Promise<string> {
        // 모든 열려있는 마크다운 탭(Leaf)을 순회하며 해당 파일을 찾음
        const leaves = this.app.workspace.getLeavesOfType("markdown");
        for (const leaf of leaves) {
            const view = leaf.view as MarkdownView;
            if (view && view.file && view.file.path === file.path) {
                const state = leaf.getViewState();
                // 라이브 뷰(source 모드)일 경우에만 에디터의 최신 입력 내용을 즉시 가져옴
                if (state.state && state.state.mode === "source") {
                    return view.editor.getValue();
                }
            }
        }
        
        // 창이 없거나, 읽기 모드(preview)일 경우 옵시디언 캐시(실제 파일) 데이터를 가져옴
        return await this.app.vault.read(file);
    }

    /**
     * BUG-01: 플러그인이 직접 vault.modify를 호출해야 할 때 사용.
     * pluginWritingFiles에 경로와 현재 시간을 등록하여 vault.on('modify')가 이를 1초간 무시하도록 한다.
     */
    async pluginWrite(file: TFile, content: string): Promise<void> {
        this.pluginWritingFiles.set(file.path, Date.now());
        await this.app.vault.modify(file, content);
    }

    async saveIfChanged(file: TFile, originalContent: string, newContent: string): Promise<boolean> {
        if (originalContent === newContent) return false;

        // 저장 전 타임스탬프를 등록하여 vault.on('modify') 이벤트가 무한 루프를 돌지 않도록 방지
        this.pluginWritingFiles.set(file.path, Date.now());

        // 열려있는 에디터(Live View) 중 이 파일을 편집 중인 탭을 찾음
        const leaves = this.app.workspace.getLeavesOfType("markdown");
        const activeLeaf = leaves.find(l => {
            const view = l.view as MarkdownView;
            return view && view.file && view.file.path === file.path && l.getViewState().state?.mode === "source";
        });

        if (activeLeaf) {
            // 에디터 트랜잭션을 사용하여 외부 수정 경고(Merge Conflict) 방지 및 스크롤 보존
            const view = activeLeaf.view as MarkdownView;
            const editor = view.editor;
            
            const origLines = originalContent.split("\n");
            const newLines = newContent.split("\n");
            
            if (origLines.length === newLines.length) {
                // 줄 수가 같을 경우 (대부분의 스케줄/날짜 동기화) -> 변경된 줄만 핀셋 교체 (스크롤 흔들림 0%)
                const changes = [];
                for (let i = 0; i < origLines.length; i++) {
                    if (origLines[i] !== newLines[i]) {
                        changes.push({
                            from: { line: i, ch: 0 },
                            to: { line: i, ch: origLines[i].length },
                            text: newLines[i]
                        });
                    }
                }
                if (changes.length > 0) {
                    editor.transaction({ changes });
                }
            } else {
                // 줄 수가 다를 경우 전체 교체하되 커서 위치는 보존 시도
                const cursor = editor.getCursor();
                const lastLine = editor.lineCount() > 0 ? editor.lineCount() - 1 : 0;
                const lastCh = editor.lineCount() > 0 ? editor.getLine(lastLine).length : 0;
                
                editor.transaction({
                    changes: [{
                        from: { line: 0, ch: 0 },
                        to: { line: lastLine, ch: lastCh },
                        text: newContent
                    }],
                    selections: [{ anchor: cursor, head: cursor }]
                });
            }
        } else {
            // 에디터에 열려있지 않거나 읽기 모드라면 조용히 백그라운드 실제 파일 수정
            await this.app.vault.modify(file, newContent);
        }

        return true;
    }

    async modifyWithRollback(files: TFile[], modificationCallback: () => Promise<void>): Promise<boolean> {
        // 백업을 위한 파일 내용 캐싱
        const backups = new Map<string, string>();
        for (const f of files) {
            if (f instanceof TFile) {
                const text = await this.getActiveViewOrFileText(f);
                backups.set(f.path, text);
            }
        }

        try {
            await modificationCallback();
            return true;
        } catch (e) {
            new Notice("❌ 작업 중 오류가 발생하여 롤백합니다.");
            // 오류 발생 시 캐싱해둔 원본 내용으로 복구
            for (const f of files) {
                if (f instanceof TFile && backups.has(f.path)) {
                    const originalText = backups.get(f.path);
                    if (originalText !== undefined) {
                        const currentText = await this.getActiveViewOrFileText(f);
                        if (currentText !== originalText) {
                            await this.saveIfChanged(f, currentText, originalText);
                        }
                    }
                }
            }
            throw e; // 오류를 다시 던져서 상위에서 인지할 수 있게 함
        }
    }
}
