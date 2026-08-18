import { App, TFile } from "obsidian";
import { PluginSettings } from "./settings";
import { TaskUtils } from "./TaskUtils";
import { REGEX } from "./Constants";
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



    // 1. 프로젝트 노트 식별자 자동 부여 (계획 ↔ 실행 양방향 연동용)
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
                if (!silent) {
                    // 수동 조작 시 로깅 처리
                }
            }
        } catch (e) {
            console.error("Project Identifier Sync Error:", e);
        }
    }
}

