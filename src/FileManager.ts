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
            const view = activeLeaf.view as MarkdownView;
            const editor = view.editor;
            const origLines = originalContent.split("\n");
            const newLines = newContent.split("\n");

            // 줄 수가 같든 다르든 항상 diff 기반 핀셋 교체를 사용하여 스크롤 튐 완전 방지.
            // 전체 교체(from:0 ~ to:끝)를 하면 CM6가 뷰포트를 커서 위치로 강제 스크롤하므로
            // 변경이 발생한 구간만 정밀하게 교체하는 방식으로 통일한다.
            const changes = this.diffLines(origLines, newLines);
            if (changes.length > 0) {
                editor.transaction({ changes });
            }
        } else {
            // 에디터에 열려있지 않거나 읽기 모드라면 조용히 백그라운드 실제 파일 수정
            await this.app.vault.modify(file, newContent);
        }

        return true;
    }

    /**
     * 두 줄 배열을 비교해 실제로 달라진 구간만 EditorChange 배열로 반환한다.
     * 줄 수가 같으면 변경된 줄만, 줄 수가 다르면 달라지기 시작한 지점부터
     * 달라지는 마지막 지점까지를 하나의 change로 묶어서 반환한다.
     * 이 방식은 CM6에게 "문서 전체"가 아닌 "좁은 구간"만 바뀌었음을 알려주므로
     * 뷰포트 스크롤 리셋이 발생하지 않는다.
     */
    private diffLines(
        origLines: string[],
        newLines: string[]
    ): { from: { line: number; ch: number }; to: { line: number; ch: number }; text: string }[] {
        // 앞쪽에서 공통 줄을 건너뜀
        let startIdx = 0;
        const minLen = Math.min(origLines.length, newLines.length);
        while (startIdx < minLen && origLines[startIdx] === newLines[startIdx]) {
            startIdx++;
        }

        // 변경이 없으면 빈 배열 반환
        if (startIdx === origLines.length && startIdx === newLines.length) {
            return [];
        }

        // 뒤쪽에서 공통 줄을 건너뜀
        let origEnd = origLines.length - 1;
        let newEnd = newLines.length - 1;
        while (
            origEnd >= startIdx &&
            newEnd >= startIdx &&
            origLines[origEnd] === newLines[newEnd]
        ) {
            origEnd--;
            newEnd--;
        }

        // 줄 수가 같을 경우: 변경된 각 줄을 독립적으로 교체 (스크롤 영향 최소화)
        if (origLines.length === newLines.length) {
            const changes: { from: { line: number; ch: number }; to: { line: number; ch: number }; text: string }[] = [];
            for (let i = startIdx; i <= origEnd; i++) {
                if (origLines[i] !== newLines[i]) {
                    changes.push({
                        from: { line: i, ch: 0 },
                        to: { line: i, ch: origLines[i].length },
                        text: newLines[i]
                    });
                }
            }
            return changes;
        }

        // 줄 수가 다를 경우: startIdx~origEnd 구간을 newLines의 startIdx~newEnd로 교체.
        // 전체 문서가 아닌 "실제로 달라진 구간"만 교체하므로 스크롤 튐이 발생하지 않는다.
        const replacementText = newLines.slice(startIdx, newEnd + 1).join("\n");
        return [{
            from: { line: startIdx, ch: 0 },
            to:   { line: origEnd,  ch: origLines[origEnd].length },
            text: replacementText
        }];
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
