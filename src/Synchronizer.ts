import { SyncTask } from "./types";
import { App, TFile, Notice } from "obsidian";
import { PluginSettings } from "./settings";
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

        try {
            const inboxPath = "Inbox/자동동기화_리포트.md";
            let logContent = "";
            const nowStr = this.dateManager.getAdjustedNow().format("YYYY-MM-DD HH:mm:ss");
            
            const existingFile = this.app.vault.getAbstractFileByPath(inboxPath);
            if (existingFile && existingFile instanceof TFile) {
                logContent = await this.app.vault.read(existingFile);
            } else {
                const folderPath = "Inbox";
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (!folder) await this.app.vault.createFolder(folderPath);
                logContent = `# 자동동기화 리포트\n\n`;
            }

            const diffSummary = `\n## [${nowStr}] ${actionName}\n` +
                                `- 대상 파일: [[${file.basename}]]\n` +
                                `<details><summary>변경 전 원본 데이터 백업</summary>\n\n\`\`\`markdown\n${originalContent}\n\`\`\`\n\n</details>\n`;
            
            logContent += diffSummary;
            
            if (existingFile && existingFile instanceof TFile) {
                // BUG-17: vault.modify 직접 호출 시 modifiedFiles에 로그파일이 추가되는 문제 방지
                await this.fileManager.pluginWrite(existingFile, logContent);
            } else {
                await this.app.vault.create(inboxPath, logContent);
            }
        } catch (e) {
            console.error("Failed to log sync change:", e);
        }
    }

    // 1. 데일리 스케줄 관리 노트 관점 동기화 (기존 98번 스크립트 역할)
    async syncDailyTasks(dailyFile: TFile): Promise<void> {
        try {
            new Notice("⏳ 프로젝트 동기화 시작...");
            // BUG-18: vault.read 대신 getActiveViewOrFileText를 사용하여 에디터 미저장 내용도 반영
            const originalContent = await this.fileManager.getActiveViewOrFileText(dailyFile);
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
                content = this.utils.replaceSection(content, "# Project", newSectionText || "> (진행 중인 프로젝트가 없습니다.)");

                // #### 프로젝트 (오늘의 마감 작업 리스트) 갱신
                const todayProjectTasks = this.utils.renderTodayProjectTasks(projectResults, todayObj);
                content = this.utils.replaceSection(content, "#### 프로젝트", todayProjectTasks || "> (오늘 할 일 없음)");
            }

            // # Todo 섹션의 기한 마커 정렬 및 전파
            content = this.utils.processSectionLogic(content, "# Todo", todayObj, false, true);

            // 실질적 변경 발생 시 저장
            if (originalContent !== content) {
                await this.logSyncChange(dailyFile, "스케줄 노트 전체 동기화", originalContent, content);
            }
            await this.fileManager.saveIfChanged(dailyFile, originalContent, content);
            new Notice("✅ 프로젝트 동기화 완료!");
        } catch (e) {
            console.error("Task Manage Error:", e instanceof Error ? e.message : String(e));
            new Notice("🚨 동기화 실패: 에러가 발생했습니다.");
        }
    }

    // 2. 개별 프로젝트 노트 관점 동기화 (기존 102번 스크립트 역할)
    async pushProjectToSchedule(projectFile: TFile): Promise<void> {
        // BUG-19: vault.read 대신 getActiveViewOrFileText를 사용하여 에디터 미저장 내용도 반영
        const originalActive = await this.fileManager.getActiveViewOrFileText(projectFile);
        let originalSchedule = "";
        
        try {
            const noteName = projectFile.basename;
            new Notice("⏳ 스케줄 반영 및 대시보드 갱신 중...");
            const now = this.dateManager.getAdjustedNow();
            const todayObj = now.clone().startOf('day').toDate();

            let content = this.utils.preprocessContent(originalActive);
            let lines = content.split("\n");
            let inExec = false, inPlan = false;
            let execTasks: { id: string | null; status?: string; indent?: number; line: string; type?: string; deleted?: boolean }[] = [];
            let planTasks: { id: string; line: string }[] = [];
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
                            const isDeleted = /\/\/$/.test(text.trim());
                            if (!id) { 
                                // BUG-24: 충돌 체크 대상 파일 전달로 ID 중복 방지
                                id = this.utils.generateBlockId([projectFile]); 
                                lines[i] = l + " ^" + id; 
                            }
                            execTasks.push({ id, status: tM[2], indent: (l.match(REGEX.INDENT)||[''])[0].length, line: lines[i], deleted: isDeleted });
                        } else if (/^##\s/.test(l.trim())) {
                            execTasks.push({ id: null, type: 'header', line: l });
                        }
                    }
                } else if (inPlan && planStartLine !== -1) {
                    if (l.startsWith("> **") && l.includes("진행도")) continue;
                    originalPlanLines.push(l);
                    const m = l.match(REGEX.TASK_LINE);
                    if (m) {
                        let { id } = this.utils.extractIdAndText(m[3]);
                        if (id) planTasks.push({ id, line: l });
                    }
                }
            }

            // In-place 계획 섹션 업데이트
            if (planStartLine !== -1) {
                let newPlanLines: string[] = [];
                const execMap = new Map<string, SyncTask>();
                execTasks.forEach(et => {
                    if (et.id) execMap.set(et.id, et);
                });
                const originalIds = new Set<string>();
                
                originalPlanLines.forEach(l => {
                    const pMatch = l.match(REGEX.TASK_LINE);
                    if (pMatch) {
                        let { id } = this.utils.extractIdAndText(pMatch[3]);
                        if (id) {
                            originalIds.add(id);
                            if (execMap.has(id)) {
                                const et = execMap.get(id)!;
                                if (!et.deleted) {
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
                            const newId = this.utils.generateBlockId();
                            newPlanLines.push(`${l} ^${newId}`);
                            planTasksTotal++;
                            if (REGEX.MATCH_TASK_COMPLETED.test(l)) planTasksDone++;
                        }
                    } else {
                        newPlanLines.push(l);
                    }
                });

                // 신규 태스크 계획에 추가
                const newExecTasks = execTasks.filter(et => et.id && !et.deleted && !originalIds.has(et.id));
                if (newExecTasks.length > 0) {
                    newExecTasks.forEach(net => {
                        let anchorId: string | null = null;
                        const idx = execTasks.indexOf(net);
                        for (let j = idx - 1; j >= 0; j--) {
                            if (execTasks[j].id) { anchorId = execTasks[j].id; break; }
                        }

                        let inserted = false;
                        if (anchorId) {
                            let anchorIdx = -1;
                            for (let k = newPlanLines.length - 1; k >= 0; k--) {
                                if (newPlanLines[k].includes(`^${anchorId}`)) { anchorIdx = k; break; }
                            }
                            if (anchorIdx !== -1) {
                                const parentIndentLevel = (newPlanLines[anchorIdx].match(REGEX.INDENT) || [""])[0].length;
                                let insertAt = anchorIdx + 1;
                                while (insertAt < newPlanLines.length) {
                                    let nextL = newPlanLines[insertAt];
                                    const nextIndent = nextL.trim() === "" ? 999 : (nextL.match(REGEX.INDENT) || [""])[0].length;
                                    if (nextIndent > parentIndentLevel) insertAt++;
                                    else break;
                                }
                                newPlanLines.splice(insertAt, 0, net.line);
                                inserted = true;
                            }
                        }
                        if (!inserted) {
                            newPlanLines.push(net.line);
                        }
                        planTasksTotal++;
                        if (REGEX.MATCH_TASK_COMPLETED.test(net.line)) planTasksDone++;
                    });
                }

                const statBar = this.utils.renderProgressBar(planTasksDone, planTasksTotal, noteName);
                const newPlanBody = "> " + statBar + "\n" + newPlanLines.join("\n");
                
                const updatedContent = this.utils.replaceSection(lines.join("\n"), "# 계획", newPlanBody);
                lines = updatedContent.split("\n");
            }

            // 실행 섹션 내 완료 항목(및 하위 자식) 삭제
            let execBuf: string[] = [], cleanedLines: string[] = [], inCleanExSec = false;
            for (let i = 0; i < lines.length; i++) {
                const cl = lines[i];
                if (REGEX.TOP_HEADING_START.test(cl)) {
                    const wasExec = inCleanExSec;
                    inCleanExSec = REGEX.EXEC_HEADER.test(cl.trim());
                    if (wasExec && !inCleanExSec && execBuf.length > 0) {
                        cleanedLines.push(...this.utils.filterResetTasks(execBuf, true));
                        execBuf = [];
                    }
                    cleanedLines.push(cl);
                    continue;
                }
                if (inCleanExSec) {
                    execBuf.push(cl);
                } else {
                    cleanedLines.push(cl);
                }
            }
            if (execBuf.length > 0) { 
                cleanedLines.push(...this.utils.filterResetTasks(execBuf, true)); 
            }

            // 프로젝트 노트 최종 저장
            const newActiveContent = cleanedLines.join("\n");
            if (originalActive !== newActiveContent) {
                await this.logSyncChange(projectFile, "개별 프로젝트 ➔ 스케줄 반영 (프로젝트 노트 갱신)", originalActive, newActiveContent);
            }
            // BUG-01: pluginWrite로 교체하여 vault.on('modify')의 무한 재동기화 방지
            await this.fileManager.pluginWrite(projectFile, newActiveContent);

            // 3. 메인 스케줄 파일 업데이트
            const schedulePath = this.settings.mainSchedulePath;
            const scheduleFile = this.app.vault.getAbstractFileByPath(schedulePath);
            if (scheduleFile && scheduleFile instanceof TFile) {
                originalSchedule = await this.app.vault.read(scheduleFile);
                
                const overrideData: Record<string, { execTasks: string[]; planTasksDone: number; planTasksTotal: number }> = {};
                overrideData[noteName] = { 
                    execTasks: (() => {
                        let buf: string[] = [], inEx = false;
                        for (const cl of cleanedLines) {
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
                
                let sBody = this.utils.replaceSection(originalSchedule, "# Project", newSectionText || "> (진행 중인 프로젝트가 없습니다.)");
                if (originalSchedule !== sBody) {
                    await this.logSyncChange(scheduleFile as TFile, `개별 프로젝트 ➔ 스케줄 반영 (스케줄 대시보드 갱신 - ${noteName})`, originalSchedule, sBody);
                }
                // BUG-06: 타입 캐스팅 명시 (instanceof TFile 검사 이후이므로 안전)
                await this.fileManager.saveIfChanged(scheduleFile as TFile, originalSchedule, sBody);
                if (newSectionText) {
                    new Notice(`✅ [${noteName}] 스케줄 반영 완료!`);
                } else {
                    new Notice(`✅ [${noteName}] 프로젝트가 비워져 스케줄에 반영되었습니다.`);
                }
            } else {
                new Notice("🚨 메인 스케줄 파일을 찾을 수 없습니다.");
            }
        } catch (e) {
            // 실패 시 프로젝트 원본 파일 복구 (롤백은 pluginWrite로 처리)
            await this.fileManager.pluginWrite(projectFile, originalActive);
            if (originalSchedule) {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    await this.fileManager.pluginWrite(scheduleFile, originalSchedule);
                }
            }
            console.error("Push Project Schedule Error:", e instanceof Error ? e.message : String(e));
            new Notice("🚨 반영 실패: 원본 데이터를 복구했습니다.");
        }
    }
}
