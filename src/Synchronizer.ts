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

    // 1. 데일리 스케줄 관리 노트 관점 동기화 (기존 98번 스크립트 역할)
    async syncDailyTasks(dailyFile: TFile): Promise<void> {
        try {
            new Notice("⏳ 프로젝트 동기화 시작...");
            const originalContent = await this.app.vault.read(dailyFile);
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
                if (newSectionText) {
                    content = this.utils.replaceSection(content, "# Project", newSectionText);
                }

                // #### 프로젝트 (오늘의 마감 작업 리스트) 갱신
                const todayProjectTasks = this.utils.renderTodayProjectTasks(projectResults, todayObj);
                content = this.utils.replaceSection(content, "#### 프로젝트", todayProjectTasks || "> (오늘 할 일 없음)");
            }

            // # Todo 섹션의 기한 마커 정렬 및 전파
            content = this.utils.processSectionLogic(content, "# Todo", todayObj, false, true);

            // 실질적 변경 발생 시 저장
            await this.utils.saveIfChanged(dailyFile, content, originalContent);
            new Notice("✅ 프로젝트 동기화 완료!");
        } catch (e) {
            console.error("Task Manage Error:", e);
            new Notice("🚨 동기화 실패: 에러가 발생했습니다.");
        }
    }

    // 2. 개별 프로젝트 노트 관점 동기화 (기존 102번 스크립트 역할)
    async pushProjectToSchedule(projectFile: TFile): Promise<void> {
        const originalActive = await this.app.vault.read(projectFile);
        let originalSchedule = "";
        
        try {
            const noteName = projectFile.basename;
            new Notice("⏳ 스케줄 반영 및 대시보드 갱신 중...");
            const now = this.dateManager.getAdjustedNow();
            const todayObj = now.clone().startOf('day').toDate();

            let content = this.utils.preprocessContent(originalActive);
            let lines = content.split("\n");
            let inExec = false, inPlan = false;
            let execTasks: { id: string | null; status?: string; indent?: number; line: string; type?: string }[] = [];
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
                            let { id } = this.utils.extractIdAndText(tM[3]);
                            if (!id) { 
                                id = this.utils.generateBlockId(); 
                                lines[i] = l + " ^" + id; 
                            }
                            execTasks.push({ id, status: tM[2], indent: (l.match(REGEX.INDENT)||[''])[0].length, line: lines[i] });
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
                                const et = execMap.get(id);
                                const tM = et.line.match(REGEX.TASK_LINE);
                                if (tM) {
                                    const { text: execText } = this.utils.extractIdAndText(tM[3]);
                                    newPlanLines.push(`${pMatch[1]} [${et.status}] ${execText} ^${id}`);
                                } else {
                                    newPlanLines.push(l);
                                }
                                planTasksTotal++;
                                if (REGEX.MATCH_TASK_COMPLETED.test(et.line)) planTasksDone++;
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
                const newExecTasks = execTasks.filter(et => et.id && !originalIds.has(et.id));
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
            await this.app.vault.modify(projectFile, cleanedLines.join("\n"));

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
                
                if (newSectionText) {
                    let sBody = this.utils.replaceSection(originalSchedule, "# Project", newSectionText);
                    await this.utils.saveIfChanged(scheduleFile, sBody, originalSchedule);
                    new Notice(`✅ [${noteName}] 스케줄 반영 완료!`);
                } else {
                    new Notice(`⚠️ [${noteName}] 반영할 프로젝트 데이터가 없습니다.`);
                }
            } else {
                new Notice("🚨 메인 스케줄 파일을 찾을 수 없습니다.");
            }
        } catch (e) {
            // 실패 시 프로젝트 원본 파일 복구
            await this.app.vault.modify(projectFile, originalActive);
            if (originalSchedule) {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    await this.app.vault.modify(scheduleFile, originalSchedule);
                }
            }
            console.error("Push Project Schedule Error:", e);
            new Notice("🚨 반영 실패: 원본 데이터를 복구했습니다.");
        }
    }
}
