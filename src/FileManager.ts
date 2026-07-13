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

}
