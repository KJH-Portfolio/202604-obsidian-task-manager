import { App, Notice } from "obsidian";
import MyWorldTaskManagerPlugin from "../main";
import { t } from "../i18n";

export class CommandController {
    private app: App;
    private plugin: MyWorldTaskManagerPlugin;

    constructor(app: App, plugin: MyWorldTaskManagerPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    /**
     * 플러그인 명령어(Command Palette) 일괄 등록
     */
    registerCommands(): void {
        // 1. 할 일 빠른 등록
        this.plugin.addCommand({
            id: "quick-capture",
            name: t("cmd_quick_capture", this.plugin.settings.language),
            callback: () => {
                this.plugin.openQuickCaptureModal();
            }
        });

        // 2. 메인 스케줄 일간 마감 (Daily Reset)
        this.plugin.addCommand({
            id: "daily-reset",
            name: t("cmd_daily_reset", this.plugin.settings.language),
            callback: () => {
                this.plugin.resetManager.openDailyResetModal();
            }
        });

        // 3. 월간 아카이브 생성
        this.plugin.addCommand({
            id: "monthly-archive",
            name: t("cmd_monthly_archive", this.plugin.settings.language),
            callback: async () => {
                const count = await this.plugin.utils.archiveOldCompletedSchedules(this.app);
                new Notice(t("notice_archived_count", this.plugin.settings.language, { count: count }));
            }
        });

        // 4. PARA 지식 관리 시스템 구축
        this.plugin.addCommand({
            id: "para-setup",
            name: t("cmd_para_setup", this.plugin.settings.language),
            callback: async () => {
                const count = await this.plugin.templateHelper.setupParaStructure();
                new Notice(t("notice_para_created", this.plugin.settings.language, { count: count }));
            }
        });

        // 5. 제텔카스텐 지식 관리 시스템 구축
        this.plugin.addCommand({
            id: "zettelkasten-setup",
            name: t("cmd_zettelkasten_setup", this.plugin.settings.language),
            callback: async () => {
                const count = await this.plugin.templateHelper.setupZettelkastenStructure();
                new Notice(t("notice_zettel_created", this.plugin.settings.language, { count: count }));
            }
        });
    }
}
