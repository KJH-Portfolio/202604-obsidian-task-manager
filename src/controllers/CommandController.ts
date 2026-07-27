import { App } from "obsidian";
import MyWorldTaskManagerPlugin from "../main";

/**
 * CommandController - 명령어 등록 모듈 (현재 미사용 예비 컨트롤러)
 *
 * 모든 addCommand() 구현은 main.ts의 onload() 내부에서 직접 관리됩니다.
 */
export class CommandController {
    private app: App;
    private plugin: MyWorldTaskManagerPlugin;

    constructor(app: App, plugin: MyWorldTaskManagerPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    // 명령어 등록은 main.ts의 onload()에서 직접 처리됩니다.
    registerCommands(): void {
        if (!this.app || !this.plugin) return;
    }
}
