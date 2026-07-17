import { App, TFile, Notice } from "obsidian";
import { PluginSettings } from "./settings";
import { t } from "./i18n";
import { TaskUtils, REGEX } from "./TaskUtils";
import { DateManager } from "./DateManager";
import { FileManager } from "./FileManager";

export class Synchronizer {
    app: App;
    settings: PluginSettings;
    utils: TaskUtils;
    dateManager: DateManager;
    fileManager: FileManager;

    constructor(app: App, settings: PluginSettings, utils: TaskUtils, dateManager: DateManager, fileManager: FileManager) {
        this.app = app;
        this.settings = settings;
        this.utils = utils;
        this.dateManager = dateManager;
        this.fileManager = fileManager;
    }



    // 1. 데일리 스케줄 관리 노트 관점 동기화 (기존 98번 스크립트 역할)
    async syncDailyTasks(dailyFile: TFile, silent = false): Promise<void> {
        // catch 블록에서 롤백에 사용하기 위해 try 바깥에 선언
        let originalContent = "";
        try {
            if (!silent) this.utils.showLoadingOverlay("⏳ 스케줄 동기화 중...");
            if (!silent) new Notice(t("sync_full_start", this.settings.language));
            // BUG-18: vault.read 대신 getActiveViewOrFileText를 사용하여 에디터 미저장 내용도 반영
            originalContent = await this.fileManager.getActiveViewOrFileText(dailyFile);
            let content = this.utils.preprocessContent(originalContent);
            const now = this.dateManager.getAdjustedNow();
            const todayObj = now.clone().startOf('day').toDate();



            // # Todo 섹션의 기한 마커 정렬 및 전파
            content = this.utils.processSectionLogic(content, "# Todo", todayObj, false, true);

            await this.fileManager.saveIfChanged(dailyFile, originalContent, content);
            if (!silent) new Notice(t("sync_full_complete", this.settings.language));
        } catch (e) {
            console.error("Task Manage Error:", e instanceof Error ? e.message : String(e));
            // 스케줄 파일 원본 복구 시도
            try {
                await this.fileManager.pluginWrite(dailyFile, originalContent);
                new Notice(t("sync_fail_restore", this.settings.language));
            } catch (rollbackErr) {
                console.error("Rollback failed for daily file:", dailyFile.path, rollbackErr);
                new Notice(t("sync_fail_critical", this.settings.language));
            }
        } finally {
            if (!silent) this.utils.hideLoadingOverlay();
        }
    }

    // 2. 프로젝트 노트 식별자 자동 부여
    async syncProjectNoteIdentifiers(projectFile: TFile, silent = false): Promise<void> {
        let originalContent = "";
        try {
            originalContent = await this.fileManager.getActiveViewOrFileText(projectFile);
            const lines = originalContent.split("\n");
            let isModified = false;
            let inTargetSection = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (REGEX.TOP_HEADING_START.test(line)) {
                    inTargetSection = REGEX.EXEC_HEADER.test(line.trim()) || REGEX.PLAN_HEADER.test(line.trim());
                    continue;
                }

                if (inTargetSection && REGEX.MATCH_TASK.test(line)) {
                    const match = line.match(REGEX.EXTRACT_ID);
                    if (!match || !match[2]) {
                        const newId = this.utils.generateBlockId([projectFile]);
                        lines[i] = `${line.trimEnd()} ^${newId}`;
                        isModified = true;
                    }
                }
            }

            if (isModified) {
                const newContent = lines.join("\n");
                await this.fileManager.saveIfChanged(projectFile, originalContent, newContent);
            }
        } catch (e) {
            console.error("Project Identifier Sync Error:", e);
        }
    }
}

