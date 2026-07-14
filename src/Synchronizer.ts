import { SyncTask } from "./types";
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

    async logSyncChange(file: TFile, actionName: string, originalContent: string, newContent: string): Promise<void> {
        if (originalContent === newContent) return;
        const MAX_LOG_ENTRIES = 10;

        try {
            const inboxPath = this.settings.syncLogPath || "0. Inbox/자동화_노트.md";
            const nowStr = this.dateManager.getAdjustedNow().format("YYYY-MM-DD HH:mm:ss");
            const newEntry = `## [${nowStr}] ${actionName}\n` +
                             `- 대상 파일: [[${file.basename}]]\n` +
                             `<details><summary>변경 전 원본 데이터 백업</summary>\n\n\`\`\`markdown\n${originalContent}\n\`\`\`\n\n</details>`;

            const existingFile = this.app.vault.getAbstractFileByPath(inboxPath);
            let sections: string[] = [];

            if (existingFile && existingFile instanceof TFile) {
                const raw = await this.app.vault.read(existingFile);
                // 헤더(# 자동동기화 리포트)를 제외하고 ## 섹션 단위로 분리
                const parts = raw.split(/\n(?=## \[)/);
                sections = parts.filter(p => p.trim().startsWith("## ["));
            } else {
                const folderPath = inboxPath.includes("/") ? inboxPath.substring(0, inboxPath.lastIndexOf("/")) : "";
                if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
                    await this.app.vault.createFolder(folderPath);
                }
            }

            // 새 항목 추가 후 MAX_LOG_ENTRIES 초과 시 가장 오래된 항목(앞)부터 제거
            sections.push(newEntry);
            if (sections.length > MAX_LOG_ENTRIES) {
                sections = sections.slice(sections.length - MAX_LOG_ENTRIES);
            }

            const finalContent = `${t("header_auto_sync_report", this.settings.language)}\n\n` + sections.join("\n");

            if (existingFile && existingFile instanceof TFile) {
                // BUG-17: vault.modify 직접 호출 시 modifiedFiles에 로그파일이 추가되는 문제 방지
                await this.fileManager.pluginWrite(existingFile, finalContent);
            } else {
                await this.app.vault.create(inboxPath, finalContent);
            }
        } catch (e) {
            console.error("Failed to log sync change:", e);
        }
    }

    // 1. 데일리 스케줄 관리 노트 관점 동기화 (기존 98번 스크립트 역할)
    async syncDailyTasks(dailyFile: TFile): Promise<void> {
        // catch 블록에서 롤백에 사용하기 위해 try 바깥에 선언
        let originalContent = "";
        try {
            this.utils.showLoadingOverlay("⏳ 스케줄 동기화 중...");
            new Notice(t("sync_full_start", this.settings.language));
            // BUG-18: vault.read 대신 getActiveViewOrFileText를 사용하여 에디터 미저장 내용도 반영
            originalContent = await this.fileManager.getActiveViewOrFileText(dailyFile);
            let content = this.utils.preprocessContent(originalContent);
            const now = this.dateManager.getAdjustedNow();
            const todayObj = now.clone().startOf('day').toDate();

            // 데일리 노트 내의 프로젝트 맵 파싱
            const dailyMap = this.utils.parseDailyProjectMap(content);
            if (dailyMap) {
                this.utils.syncDailyMap(dailyMap);

                // 프로젝트 파일들로 전파 동기화
                const projectFiles = this.utils.getProjectFiles();
                const filesForCollisionCheck = [...projectFiles, dailyFile];

                const overrideData = await this.utils.syncDailyToProjects(
                    this.app,
                    dailyMap,
                    projectFiles,
                    filesForCollisionCheck,
                    false // isReset: false
                );

                // 메인 스케줄의 # Project 대시보드 갱신
                const projectResults = await this.utils.getAllFullProjectResults(todayObj, overrideData, false);
                const newSectionText = this.utils.renderProjectDashboardSection(projectResults);
                content = this.utils.replaceSection(content, "# Project", newSectionText || t("empty_project_dashboard", this.settings.language));

            }

            // # Todo 섹션의 기한 마커 정렬 및 전파
            content = this.utils.processSectionLogic(content, "# Todo", todayObj, false, true);

            // 실질적 변경 발생 시 저장
            if (originalContent !== content) {
                await this.logSyncChange(dailyFile, "스케줄 노트 전체 동기화", originalContent, content);
            }
            await this.fileManager.saveIfChanged(dailyFile, originalContent, content);
            new Notice(t("sync_full_complete", this.settings.language));
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
            this.utils.hideLoadingOverlay();
        }
    }

    // 2. 개별 프로젝트 노트 관점 동기화 (기존 102번 스크립트 역할)
    async pushProjectToSchedule(projectFile: TFile): Promise<void> {
        // BUG-19: vault.read 대신 getActiveViewOrFileText를 사용하여 에디터 미저장 내용도 반영
        const originalActive = await this.fileManager.getActiveViewOrFileText(projectFile);
        let originalSchedule = "";

        try {
            this.utils.showLoadingOverlay("⏳ 스케줄 반영 중...");
            const noteName = projectFile.basename;
            new Notice(t("sync_dashboard_start", this.settings.language));
            const now = this.dateManager.getAdjustedNow();
            const todayObj = now.clone().startOf('day').toDate();

            let content = this.utils.preprocessContent(originalActive);
            let lines = content.split("\n");
            let inExec = false, inPlan = false;
            let execTasks: { id: string | null; status?: string; line: string; type?: string; deleted?: boolean }[] = [];
            let planTasksTotal = 0, planTasksDone = 0;
            let originalPlanLines: string[] = [];


            let planStartLine = -1;
            // 데이터 수집
            for (let i = 0; i < lines.length; i++) {
                let l = lines[i];
                if (REGEX.TOP_HEADING_START.test(l)) {
                    inExec = REGEX.EXEC_HEADER.test(l.trim());
                    inPlan = REGEX.WORK_SUMMARY_HEADER.test(l.trim());
                    if (inPlan) planStartLine = i;
                } else if (inExec) {
                    if (REGEX.MATCH_TASK.test(l) || /^##\s/.test(l.trim())) {
                        const tM = l.match(REGEX.TASK_LINE);
                        if (tM) {
                            let { text, id } = this.utils.extractIdAndText(tM[3]);
                            const isDeleted = /;;$/.test(text.trim());
                            if (!id) {
                                // BUG-24: 충돌 체크 대상 파일 전달로 ID 중복 방지
                                id = this.utils.generateBlockId([projectFile]);
                                lines[i] = l + " ^" + id;
                            }
                            execTasks.push({ id, status: tM[2], line: lines[i], deleted: isDeleted });
                        } else if (/^##\s/.test(l.trim())) {
                            execTasks.push({ id: null, type: 'header', line: l });
                        }
                    }
                } else if (inPlan && planStartLine !== -1) {
                    if (l.startsWith("> **") && (l.includes("진행도") || l.includes("Progress"))) continue;
                    originalPlanLines.push(l);
                    const m = l.match(REGEX.TASK_LINE);
                    if (m) {
                        let { id } = this.utils.extractIdAndText(m[3]);
                        if (id) { /* planTasks 수집 제거 — 미사용 변수였음 */ }
                    }
                }
            }

            // In-place 계획 섹션 업데이트
            if (planStartLine !== -1) {
                let newPlanLines: string[] = [];
                const execMap = new Map<string, SyncTask>();
                execTasks.forEach(et => {
                    if (et.id) execMap.set(et.id, { id: et.id, line: et.line, status: et.status, deleted: et.deleted });
                });
                const originalIds = new Set<string>();

                originalPlanLines.forEach(l => {
                    const pMatch = l.match(REGEX.TASK_LINE);
                    if (pMatch) {
                        let { id } = this.utils.extractIdAndText(pMatch[3]);
                        if (id) {
                            originalIds.add(id);
                            if (execMap.has(id)) {
                                const et = execMap.get(id);
                                if (et && !et.deleted) {
                                    const tM = et.line.match(REGEX.TASK_LINE);
                                    if (tM) {
                                        const { text: execText } = this.utils.extractIdAndText(tM[3]);
                                        newPlanLines.push(`${pMatch[1]} [${et.status}] ${execText} ^${id}`);
                                    } else {
                                        newPlanLines.push(l);
                                    }
                                    planTasksTotal++;
                                    if (REGEX.MATCH_TASK_COMPLETED.test(et.line)) planTasksDone++;
                                }
                            } else {
                                newPlanLines.push(l);
                                planTasksTotal++;
                                if (REGEX.MATCH_TASK_COMPLETED.test(l)) planTasksDone++;
                            }
                        } else {
                            const newId = this.utils.generateBlockId([projectFile]);
                            newPlanLines.push(`${l} ^${newId}`);
                            planTasksTotal++;
                            if (REGEX.MATCH_TASK_COMPLETED.test(l)) planTasksDone++;
                        }
                    } else {
                        newPlanLines.push(l);
                    }
                });

                const statBar = this.utils.renderProgressBar(planTasksDone, planTasksTotal, noteName);
                const newPlanBody = "> " + statBar + "\n" + newPlanLines.join("\n");

                const updatedContent = this.utils.replaceSection(lines.join("\n"), t("header_plan", this.settings.language), newPlanBody);
                lines = updatedContent.split("\n");
            }

            // 프로젝트 노트 최종 저장 (완료 항목 삭제는 일일 리셋에서만 수행)
            const newActiveContent = lines.join("\n");
            if (originalActive !== newActiveContent) {
                await this.logSyncChange(projectFile, "개별 프로젝트 ➔ 스케줄 반영 (프로젝트 노트 갱신)", originalActive, newActiveContent);
            }
            // BUG-01: pluginWrite로 교체하여 vault.on('modify')의 무한 재동기화 방지
            await this.fileManager.saveIfChanged(projectFile, originalActive, newActiveContent);

            // 3. 메인 스케줄 파일 업데이트
            const schedulePath = this.settings.mainSchedulePath;
            const scheduleFile = this.app.vault.getAbstractFileByPath(schedulePath);
            if (scheduleFile && scheduleFile instanceof TFile) {
                originalSchedule = await this.fileManager.getActiveViewOrFileText(scheduleFile);

                const overrideData: Record<string, { execTasks: string[]; planTasksDone: number; planTasksTotal: number }> = {};
                overrideData[noteName] = {
                    execTasks: (() => {
                        let buf: string[] = [], inEx = false;
                        for (const cl of lines) {
                            if (REGEX.TOP_HEADING_START.test(cl)) {
                                inEx = REGEX.EXEC_HEADER.test(cl.trim());
                                continue;
                            }
                            if (inEx && (REGEX.MATCH_TASK.test(cl) || /^##\s/.test(cl.trim()))) buf.push(cl);
                        }
                        return buf;
                    })(),
                    planTasksDone,
                    planTasksTotal
                };

                const projectResults = await this.utils.getAllFullProjectResults(todayObj, overrideData, false);
                const newSectionText = this.utils.renderProjectDashboardSection(projectResults);

                let sBody = this.utils.replaceSection(originalSchedule, "# Project", newSectionText || t("empty_project_dashboard", this.settings.language));
                if (originalSchedule !== sBody) {
                    await this.logSyncChange(scheduleFile, `개별 프로젝트 ➔ 스케줄 반영 (스케줄 대시보드 갱신 - ${noteName})`, originalSchedule, sBody);
                }
                // BUG-06: 타입 캐스팅 제거 (이미 instanceof TFile)
                await this.fileManager.saveIfChanged(scheduleFile, originalSchedule, sBody);
                if (newSectionText) {
                    new Notice(t("sync_project_complete", this.settings.language, { noteName }));
                } else {
                    new Notice(t("notice_project_emptied", this.settings.language, { noteName: noteName }));
                }
            } else {
                new Notice(t("sync_no_main", this.settings.language));
            }
        } catch (e) {
            console.error("Push Project Schedule Error:", e instanceof Error ? e.message : String(e));
            // 실패 시 프로젝트 원본 파일 복구 시도
            let projectRolledBack = false;
            let scheduleRolledBack = false;
            try {
                await this.fileManager.pluginWrite(projectFile, originalActive);
                projectRolledBack = true;
            } catch (rollbackErr) {
                console.error("Rollback failed for project file:", projectFile.path, rollbackErr);
            }
            if (originalSchedule) {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    try {
                        await this.fileManager.pluginWrite(scheduleFile, originalSchedule);
                        scheduleRolledBack = true;
                    } catch (rollbackErr) {
                        console.error("Rollback failed for schedule file:", rollbackErr);
                    }
                }
            }
            // 롤백 성공/실패 여부를 사용자에게 명확히 알림
            if (projectRolledBack && (!originalSchedule || scheduleRolledBack)) {
                new Notice(t("sync_update_fail_restore", this.settings.language));
            } else {
                new Notice(t("sync_update_fail_critical", this.settings.language));
            }
        } finally {
            this.utils.hideLoadingOverlay();
        }
    }
}
