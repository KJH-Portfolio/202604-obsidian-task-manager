import { App } from "obsidian";
import MyWorldTaskManagerPlugin from "../main";

export class EventController {
    private app: App;
    private plugin: MyWorldTaskManagerPlugin;

    constructor(app: App, plugin: MyWorldTaskManagerPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    /**
     * 워크스페이스 이벤트 리스너 등록
     * - vault.on('modify') 및 체크박스 핸들러는 main.ts에서 관리 (hash 필터 및 CM6 dispatch 로직 포함)
     * - MutationObserver(attachNoticeObserver)는 main.ts에서 관리 (팝아웃 창 대응 포함)
     */
    registerEvents(): void {
        // 활성 탭 변경 감지 → 이전 파일이 수정된 경우에만 자동 동기화
        this.plugin.registerEvent(
            this.app.workspace.on("active-leaf-change", () => {
                const currentFile = this.app.workspace.getActiveFile();

                if (
                    this.plugin.lastActiveFile &&
                    (!currentFile || this.plugin.lastActiveFile.path !== currentFile.path)
                ) {
                    if (this.plugin.modifiedFiles.has(this.plugin.lastActiveFile.path)) {
                        void this.plugin.triggerAutoSyncForFile(this.plugin.lastActiveFile);
                    }
                }

                this.plugin.lastActiveFile = currentFile;
            })
        );
    }
}
