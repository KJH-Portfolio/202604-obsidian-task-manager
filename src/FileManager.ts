import { App, TFile, MarkdownView } from "obsidian";

export class FileManager {
    private app: App;
    // 플러그인이 직접 수정한 파일 경로와 콘텐츠 해시를 추적하여 vault.on('modify')에서 이중 동기화 필터링
    // 타임스탬프(1초 임계값) 방식은 클라우드 동기화 환경에서 이벤트 지연으로 무력화될 수 있어 해시 비교로 전환
    private pluginWritingFiles: Map<string, string>;

    constructor(app: App, pluginWritingFiles: Map<string, string>) {
        this.app = app;
        this.pluginWritingFiles = pluginWritingFiles;
    }

    /**
     * 문자열을 빠른 32bit 정수 해시로 변환.
     * vault.on('modify') 이벤트 필터링 시 콘텐츠 동일 여부를 확인하는 데 사용.
     */
    public simpleHash(str: string): string {
        // BUG FIX: Windows \r\n 차이로 인한 해시 불일치 무한루프 방지
        str = str.replace(/\r/g, '');
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // 32bit integer로 강제
        }
        return hash.toString(36);
    }

    getFile(path: string): TFile | null {
        if (!path) return null;
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            return file;
        }
        return null;
    }

    /**
     * 경로 상의 노트를 안전하게 가져오고, 없으면 상위 폴더와 기본 노트를 자동으로 뚝딱 생성.
     * 사용자가 노트를 삭제하더라도 에러 없이 자동 복구 생성됨.
     */
    async ensureFileExists(path: string, defaultContent = ""): Promise<TFile | null> {
        if (!path) return null;
        let file = this.getFile(path);
        if (file) return file;

        const findInVault = this.app.vault.getFiles().find(f => f.path === path);
        if (findInVault instanceof TFile) return findInVault;

        const lastSlash = path.lastIndexOf('/');
        if (lastSlash !== -1) {
            const folder = path.substring(0, lastSlash);
            const parts = folder.split('/');
            let current = '';
            for (const p of parts) {
                if (!p) continue;
                current = current === '' ? p : `${current}/${p}`;
                if (!this.app.vault.getAbstractFileByPath(current)) {
                    try { await this.app.vault.createFolder(current); } catch {}
                }
            }
        }

        try {
            return await this.app.vault.create(path, defaultContent);
        } catch {
            return this.getFile(path) || this.app.vault.getFiles().find(f => f.path === path) || null;
        }
    }

    async getActiveViewOrFileText(file: TFile): Promise<string> {
        // --- 성능개선 3번 수정: 모든 열린 탭 스캔 (Fallback) ---
        // 사용자가 타이핑 직후 다른 탭으로 이동(active-leaf-change)하면 해당 파일은 더 이상 'active'가 아닙니다.
        // 따라서 getActiveViewOfType 대신 모든 markdown 탭을 순회하여 방금 전까지 치던 미저장 텍스트를 안전하게 가져옵니다.
        const leaves = this.app.workspace.getLeavesOfType("markdown");
        for (const leaf of leaves) {
            if (leaf.view instanceof MarkdownView && leaf.view.file && leaf.view.file.path === file.path) {
                const state = leaf.getViewState();
                if (state.state && state.state.mode === "source") {
                    return leaf.view.editor.getValue();
                }
            }
        }

        // 백그라운드 탭에 있거나 아예 열려있지 않은 나머지 파일들은 무조건 빠르고 가벼운 디스크 읽기(vault.read)
        return await this.app.vault.read(file);
    }

    /**
     * 플러그인이 직접 vault.modify를 호출해야 할 때 사용.
     * 저장하는 콘텐츠의 해시를 pluginWritingFiles에 기록하여,
     * vault.on('modify') 이벤트 발생 시 이중 동기화를 유발하지 않도록 필터링한다.
     */
    async pluginWrite(file: TFile, content: string): Promise<void> {
        this.pluginWritingFiles.set(file.path, this.simpleHash(content));
        await this.app.vault.modify(file, content);
    }

    async saveIfChanged(file: TFile, originalContent: string, newContent: string): Promise<boolean> {
        if (originalContent === newContent) return false;

        // 저장할 콘텐츠의 해시를 등록하여 vault.on('modify') 이벤트 발생 시 이중 동기화를 방지
        this.pluginWritingFiles.set(file.path, this.simpleHash(newContent));

        // 열려있는 에디터(Live View) 중 이 파일을 편집 중인 탭을 찾음
        // 1. 현재 활성 뷰를 최우선으로 확인
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const priorityLeaf = (activeView && activeView.file && activeView.file.path === file.path && activeView.getState().mode === 'source') ? activeView.leaf : null;

        const leaves = this.app.workspace.getLeavesOfType("markdown");
        // 2. 활성 뷰가 아니면 전체 창에서 순회 탐색
        const activeLeaf = priorityLeaf ?? leaves.find(l => {
            const view = l.view as MarkdownView;
            return view && view.file && view.file.path === file.path && l.getViewState().state?.mode === "source";
        });

        if (activeLeaf) {
            const view = activeLeaf.view as MarkdownView;
            const editor = view.editor;

            // 3. 에디터 렌더링 미완료 예외 처리 (뷰는 열렸으나 DOM 로드 전)
            if (editor.lineCount() === 0) {
                await this.pluginWrite(file, newContent);
                return true;
            }

            const origLines = originalContent.split("\n");
            const newLines = newContent.split("\n");

            // 줄 수가 같든 다르든 항상 diff 기반 핀셋 교체를 사용하여 스크롤 튐 완전 방지.
            // 전체 교체(from:0 ~ to:끝)를 하면 CM6가 뷰포트를 커서 위치로 강제 스크롤하므로
            // 변경이 발생한 구간만 정밀하게 교체하는 방식으로 통일한다.
            const changes = this.diffLines(origLines, newLines);
            if (changes.length > 0) {
                editor.transaction({ changes });
            }

            // BUG FIX: editor.transaction()은 vault.modify 이벤트를 발생시키지 않는다.
            // 따라서 pluginWritingFiles에 해시가 남아있으면, 이후 사용자 편집 시 vault.modify가
            // 발생했을 때 비동기 해시비교를 거치게 되어 탭 전환 타이밍에 따라 modifiedFiles에
            // 파일이 추가되기 전에 active-leaf-change가 먼저 발생하는 경쟁 조건(Race Condition)이 생긴다.
            // editor.transaction 경로에서는 vault.modify가 없으므로 여기서 즉시 정리한다.
            this.pluginWritingFiles.delete(file.path);
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

        // 줄 수가 같을 경우: 변경된 각 줄을 독립적으로 교체 (스크롤 및 한글 IME 조합 보존)
        if (origLines.length === newLines.length) {
            const changes: { from: { line: number; ch: number }; to: { line: number; ch: number }; text: string }[] = [];
            for (let i = startIdx; i <= origEnd; i++) {
                const oLine = origLines[i];
                const nLine = newLines[i];
                if (oLine !== nLine) {
                    if (nLine.startsWith(oLine)) {
                        // 텍스트가 뒤에 추가된 경우 (예: ^id 가 맨 뒤에 붙음)
                        // 한글 IME 조합(Composing)을 끊지 않기 위해 맨 끝에 삽입(insert)만 수행
                        changes.push({
                            from: { line: i, ch: oLine.length },
                            to: { line: i, ch: oLine.length },
                            text: nLine.substring(oLine.length)
                        });
                    } else if (oLine.startsWith(nLine)) {
                        // 텍스트가 뒤에서 삭제된 경우
                        changes.push({
                            from: { line: i, ch: nLine.length },
                            to: { line: i, ch: oLine.length },
                            text: ""
                        });
                    } else {
                        // 그 외의 경우 줄 전체 교체
                        changes.push({
                            from: { line: i, ch: 0 },
                            to: { line: i, ch: oLine.length },
                            text: nLine
                        });
                    }
                }
            }
            return changes;
        }

        // 줄 수가 다를 경우:
        if (origEnd < startIdx) {
            // 순수 줄 삽입: 삭제 없이 줄이 새로 들어온 경우
            const insertText = newLines.slice(startIdx, newEnd + 1).join("\n") + "\n";
            return [{
                from: { line: startIdx, ch: 0 },
                to:   { line: startIdx, ch: 0 },
                text: insertText
            }];
        }

        if (newEnd < startIdx) {
            // 순수 줄 삭제: 줄이 완전히 지워진 경우
            const endLineIndex = origEnd + 1 < origLines.length ? origEnd + 1 : origEnd;
            const endCh = origEnd + 1 < origLines.length ? 0 : origLines[origEnd].length;
            return [{
                from: { line: startIdx, ch: 0 },
                to:   { line: endLineIndex, ch: endCh },
                text: ""
            }];
        }

        // 구간 교체: 일부 삭제 후 일부 삽입
        const replacementText = newLines.slice(startIdx, newEnd + 1).join("\n");
        return [{
            from: { line: startIdx, ch: 0 },
            to:   { line: origEnd,  ch: origLines[origEnd].length },
            text: replacementText
        }];
    }

}
