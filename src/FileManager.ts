import { App, TFile, Notice, MarkdownView } from "obsidian";

export class FileManager {
    private app: App;
    // BUG-01/05: 플러그인이 직접 수정한 파일 경로를 추적하여 vault.on('modify')에서 필터링
    private pluginWritingFiles: Set<string>;

    constructor(app: App, pluginWritingFiles: Set<string>) {
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
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.file && activeView.file.path === file.path) {
            return activeView.editor.getValue();
        }
        return await this.app.vault.read(file);
    }

    /**
     * BUG-01: 플러그인이 직접 vault.modify를 호출해야 할 때 사용.
     * pluginWritingFiles에 경로를 등록하여 vault.on('modify')가 이를 무시하도록 한다.
     */
    async pluginWrite(file: TFile, content: string): Promise<void> {
        this.pluginWritingFiles.add(file.path);
        await this.app.vault.modify(file, content);
    }

    async saveIfChanged(file: TFile, originalContent: string, newContent: string): Promise<boolean> {
        if (originalContent !== newContent) {
            // BUG-01/05: 저장 전 경로를 등록하여 vault.on('modify') 이벤트가 modifiedFiles에 추가되지 않도록 방지
            this.pluginWritingFiles.add(file.path);
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && activeView.file && activeView.file.path === file.path && activeView.getMode() === "source") {
                activeView.editor.setValue(newContent);
            } else {
                await this.app.vault.modify(file, newContent);
            }
            return true;
        }
        return false;
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
