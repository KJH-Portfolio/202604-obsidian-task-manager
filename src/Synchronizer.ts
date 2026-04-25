import { App, TFile, Notice, moment } from "obsidian";
import { TaskUtils, REGEX, MARKER_PRI } from "./TaskUtils";

export class Synchronizer {
    app: App;
    utils: TaskUtils;
    settings: any;

    constructor(app: App, utils: TaskUtils, settings: any) {
        this.app = app;
        this.utils = utils;
        this.settings = settings;
    }

    async syncTaskManage(activeFile: TFile) {
        const originalContent = await this.app.vault.read(activeFile);
        let content = this.utils.preprocessContent(originalContent);
        const now = this.utils.getAdjustedNow();
        const todayObj = now.clone().startOf('day').toDate();

        const pHeader = "# Project";
        const _pRaw = content.search(/(?:^|\n)# Project[ \t]*(?=\n|$)/);
        const pStart = _pRaw === -1 ? -1 : (content[_pRaw] === '\n' ? _pRaw + 1 : _pRaw);
        
        if (pStart !== -1) {
            let pEndHash = content.indexOf("\n# ", pStart + pHeader.length);
            let pEndHr = content.indexOf("\n---", pStart + pHeader.length);
            let pEnd = content.length;
            if (pEndHash !== -1 && pEndHr !== -1) pEnd = Math.min(pEndHash, pEndHr);
            else if (pEndHash !== -1) pEnd = pEndHash;
            else if (pEndHr !== -1) pEnd = pEndHr;

            const pLines = content.substring(pStart, pEnd).split("\n");
            let currNote: string | null = null; 
            const dailyMap: any = {};
            
            for (let l of pLines) {
                const calloutMatch = l.match(/^>\s*\[![a-zA-Z]+\]-?\s+.*?\*\*([^*]+)\*\*/);
                const m = l.match(REGEX.NOTE_LINK); 
                if (calloutMatch || m) { 
                    currNote = (calloutMatch ? calloutMatch[1] : m![1]).trim().replace(/\[\[|\]\]/g, '').split('|')[0];
                    dailyMap[currNote] = { byId: {}, byText: {}, orderedTasks: [] }; continue; 
                }
                if (currNote) {
                    const cleanLine = l.replace(/^(?:> ?)+/, '');
                    if (REGEX.MATCH_TASK.test(cleanLine)) {
                        const tM = cleanLine.match(REGEX.TASK_LINE); 
                        if (tM) {
                            let { text, id } = this.utils.extractIdAndText(tM[3]);
                            const isDeleted = /\/\/$/.test(text.trim());
                            const cleanText = isDeleted ? text.replace(/\/\/$/, '').trim() : text;
                            
                            const taskData = { checked: tM[2].toLowerCase()==='x', text: cleanText, indent: tM[1], deleted: isDeleted };
                            if (id) {
                                dailyMap[currNote].byId[id] = taskData;
                            } else {
                                if (!dailyMap[currNote].byText[cleanText]) dailyMap[currNote].byText[cleanText] = [];
                                dailyMap[currNote].byText[cleanText].push(taskData);
                            }
                            dailyMap[currNote].orderedTasks.push(id ? { type: 'id', key: id } : { type: 'text', key: cleanText });
                        }
                    }
                }
            }

            const projectFiles = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(this.settings.projectDir + "/"));
            const projectResults = await Promise.all(projectFiles.map(async (file) => {
                const noteName = file.basename;
                const dailyData = dailyMap[noteName] || { byId: {}, byText: {} };
                
                let sContent = await this.app.vault.read(file);
                let sLines: (string | null)[] = sContent.split("\n");
                let mod = false;
                let execTasks: string[] = [], planTasksTotal = 0, planTasksDone = 0;
                let inEx = false, inPl = false; 
                let handledInFile = new Set();  

                let skipIndent = -1, skipCheckIndent = -1, skipCheckStatus = " ";
                for (let i = 0; i < sLines.length; i++) {
                    let l = sLines[i];
                    if (!l) continue;
                    
                    if (REGEX.TOP_HEADING_START.test(l)) {
                        inEx = REGEX.EXEC_HEADER.test(l.trim()); inPl = REGEX.WORK_SUMMARY_HEADER.test(l.trim());
                        skipIndent = -1; skipCheckIndent = -1;
                        continue;
                    } 
                    
                    if (inEx || inPl) {
                        let currentIndent = l.trim() === "" ? 999 : (l.match(REGEX.INDENT) || [""])[0].length;
                        if (skipIndent !== -1) {
                            if (currentIndent > skipIndent) { sLines[i] = null; mod = true; continue; }
                            else skipIndent = -1;
                        }

                        if (REGEX.MATCH_TASK.test(l)) {
                            const tM = l.match(REGEX.TASK_LINE);
                            if (tM) {
                                let { text, id } = this.utils.extractIdAndText(tM[3]);
                                if (!id) { id = this.utils.generateBlockId(); sLines[i] = l + " ^" + id; mod = true; }
                                
                                let data = null;
                                if (id && dailyData.byId[id]) data = dailyData.byId[id];
                                else if (dailyData.byText[text] && dailyData.byText[text].length > 0) {
                                    data = dailyData.byText[text].shift();
                                }

                                let currentStat = tM[2];
                                let newStat = currentStat;

                                if (skipCheckIndent !== -1) {
                                    if (currentIndent > skipCheckIndent) newStat = skipCheckStatus;
                                    else skipCheckIndent = -1;
                                }

                                if (data) {
                                    handledInFile.add(id || text);
                                    if (data.deleted) { 
                                        sLines[i] = null; mod = true; 
                                        skipIndent = (l.match(REGEX.INDENT) || [""])[0].length;
                                        continue; 
                                    }
                                    if (data.checked) newStat = 'x';
                                    else if (currentStat.toLowerCase() === 'x') newStat = 'x'; 
                                }
                                
                                if (newStat.toLowerCase() === 'x' || newStat === '-') {
                                    skipCheckIndent = currentIndent;
                                    skipCheckStatus = newStat;
                                }

                                if (currentStat !== newStat || text !== (data ? data.text : text)) {
                                    sLines[i] = `${tM[1]} [${newStat}] ${(data ? data.text : text)} ^${id}`;
                                    mod = true;
                                }
                            }
                        }
                    }
                }

                // Step B: New Tasks
                if (dailyData) {
                    let lastAnchorId: string | null = null;
                    const tasksToInsert: any[] = [];
                    for (let ot of dailyData.orderedTasks) {
                        if (ot.type === 'id') lastAnchorId = ot.key;
                        else {
                            let matchedLists = dailyData.byText[ot.key];
                            if (matchedLists && matchedLists.length > 0) {
                                let dt = matchedLists.shift();
                                tasksToInsert.push({ anchorId: lastAnchorId, task: { ...dt, id: this.utils.generateBlockId() } });
                            }
                        }
                    }
                    for (const [id, d] of Object.entries(dailyData.byId)) {
                        if (!handledInFile.has(id)) tasksToInsert.push({ anchorId: null, task: { ...d as any, id } });
                    }

                    if (tasksToInsert.length > 0) {
                        let exStart = -1, exEnd = sLines.length, inExSec = false;
                        for (let i = 0; i < sLines.length; i++) {
                            let l = sLines[i]; if (!l) continue;
                            if (REGEX.TOP_HEADING_START.test(l)) {
                                if (inExSec) { exEnd = i; break; }
                                inExSec = REGEX.EXEC_HEADER.test(l.trim());
                                if (inExSec) exStart = i;
                            }
                        }
                        if (exStart !== -1) {
                            let lastTaskIdx = exStart;
                            for (let i = exEnd - 1; i > exStart; i--) {
                                let l = sLines[i]; if (!l) continue;
                                if (REGEX.MATCH_TASK.test(l)) {
                                    if (lastTaskIdx === exStart) lastTaskIdx = i;
                                    const m = l.match(REGEX.TASK_LINE);
                                    if (m) {
                                        const { id } = this.utils.extractIdAndText(m[3]);
                                        if (id && tasksToInsert.some(t => t.anchorId === id)) {
                                            const matches = tasksToInsert.filter(t => t.anchorId === id);
                                            const newLines = matches.map(m => `${m.task.indent} [${m.task.checked ? 'x' : ' '}] ${m.task.text} ^${m.task.id}`);
                                            sLines.splice(i + 1, 0, ...newLines);
                                            mod = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                sLines = sLines.filter(l => l !== null);
                
                // Recalculate stats for callout
                inEx = false; inPl = false;
                for (let l of sLines) {
                    if (!l) continue;
                    if (REGEX.TOP_HEADING_START.test(l)) {
                        inEx = REGEX.EXEC_HEADER.test(l.trim()); inPl = REGEX.WORK_SUMMARY_HEADER.test(l.trim());
                    } else if (inEx) {
                        if (REGEX.MATCH_TASK.test(l) || /^##\s/.test(l.trim())) execTasks.push(l);
                    } else if (inPl && REGEX.MATCH_TASK.test(l)) {
                        planTasksTotal++;
                        if (REGEX.MATCH_TASK_COMPLETED.test(l)) planTasksDone++;
                    }
                }

                if (mod) await this.app.vault.modify(file, sLines.join("\n"));
                
                const statBar = this.utils.renderProgressBar(planTasksDone, planTasksTotal, noteName);
                const calloutText = this.utils.renderProjectCallout(noteName, execTasks, planTasksDone, planTasksTotal, todayObj, statBar);
                
                let minDiff = Infinity, sortPri = 99;
                const processed = this.utils.applyMarkersToLines(execTasks, todayObj);
                processed.forEach(t => {
                    if (REGEX.MATCH_TASK_COMPLETED.test(t)) return;
                    const dM = t.match(REGEX.DATE_LABEL);
                    if (dM) {
                        const pts = dM[0].replace('📅','').trim().split('-');
                        const diff = Math.ceil((new Date(parseInt(pts[0]), parseInt(pts[1]) - 1, parseInt(pts[2])).getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
                        if (diff < minDiff) minDiff = diff;
                    }
                });
                if (planTasksTotal > 0 && planTasksDone === planTasksTotal && execTasks.length > 0) sortPri = 100;
                else if (minDiff < 0) sortPri = 0; else if (minDiff === 0) sortPri = 1; else if (minDiff === 1) sortPri = 2; else if (minDiff === 2) sortPri = 3; else if (minDiff === 3) sortPri = 4;
                
                return { sortPri, minDiff, noteName, calloutText };
            }));

            const urgentItems = projectResults.filter(r => r !== null);
            if (urgentItems.length > 0) {
                urgentItems.sort((a: any, b: any) => a.sortPri !== b.sortPri ? a.sortPri - b.sortPri : (a.minDiff !== b.minDiff ? a.minDiff - b.minDiff : a.noteName.localeCompare(b.noteName)));
                const newProjSectionText = urgentItems.map((i: any) => i.calloutText).filter((t: any) => t.trim() !== "").join("\n\n") + "\n";
                const newContent = content.substring(0, pStart) + pHeader + "\n" + newProjSectionText.trimEnd() + "\n" + content.substring(pEnd);
                if (newContent !== originalContent) await this.app.vault.modify(activeFile, newContent);
            }
        }
    }

    async pushProjectToSchedule(activeFile: TFile) {
        const originalActive = await this.app.vault.read(activeFile);
        const noteName = activeFile.basename;
        const now = this.utils.getAdjustedNow();
        const todayObj = now.clone().startOf('day').toDate();

        let content = this.utils.preprocessContent(originalActive);
        let lines = content.split("\n"), inExec = false, inPlan = false, modifiedActive = false;
        let execTasks: any[] = [], planTasksTotal = 0, planTasksDone = 0;
        let originalPlanLines: string[] = [];

        let planStartLine = -1, planEndLine = lines.length;
        for (let i = 0; i < lines.length; i++) {
            let l = lines[i];
            if (REGEX.TOP_HEADING_START.test(l)) {
                inExec = REGEX.EXEC_HEADER.test(l.trim()); inPlan = REGEX.WORK_SUMMARY_HEADER.test(l.trim());
                if (inPlan) planStartLine = i;
            } else if (inExec) {
                if (REGEX.TASK_LINE.test(l) || /^##\s/.test(l.trim())) {
                    const tM = l.match(REGEX.TASK_LINE);
                    if (tM) {
                        let { id } = this.utils.extractIdAndText(tM[3]);
                        if (!id) { id = this.utils.generateBlockId(); lines[i] = l + " ^" + id; modifiedActive = true; }
                        execTasks.push({ id, status: tM[2], indent: (l.match(REGEX.INDENT)||[''])[0].length, line: lines[i] });
                    } else if (/^##\s/.test(l.trim())) {
                        execTasks.push({ id: null, type: 'header', line: l });
                    }
                }
            } else if (inPlan && planStartLine !== -1) {
                if (l.startsWith("> **") && l.includes("진행도")) continue;
                originalPlanLines.push(l);
            }
        }
        
        if (planStartLine !== -1) {
            for (let i = planStartLine + 1; i < lines.length; i++) {
                if (REGEX.TOP_HEADING_START.test(lines[i])) { planEndLine = i; break; }
            }
        }

        if (planStartLine !== -1) {
            let newPlanLines: string[] = [];
            const execMap = new Map();
            execTasks.forEach(et => { if (et.id) execMap.set(et.id, et); });
            const originalIds = new Set();
            
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
                            } else newPlanLines.push(l);
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
                } else newPlanLines.push(l);
            });

            const newExecTasks = execTasks.filter(et => et.id && !originalIds.has(et.id));
            newExecTasks.forEach(net => {
                newPlanLines.push(net.line);
                planTasksTotal++;
                if (REGEX.MATCH_TASK_COMPLETED.test(net.line)) planTasksDone++;
            });

            const statBar = this.utils.renderProgressBar(planTasksDone, planTasksTotal, noteName);
            lines.splice(planStartLine + 1, planEndLine - planStartLine - 1, "> " + statBar, ...newPlanLines);
            modifiedActive = true;

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
                if (inCleanExSec) execBuf.push(cl);
                else cleanedLines.push(cl);
            }
            if (execBuf.length > 0) cleanedLines.push(...this.utils.filterResetTasks(execBuf, true));

            if (modifiedActive || cleanedLines.join("\n") !== lines.join("\n")) {
                await this.app.vault.modify(activeFile, cleanedLines.join("\n"));
            }

            const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.schedulePath);
            if (scheduleFile instanceof TFile) {
                let sContent = await this.app.vault.read(scheduleFile);
                let sLines = sContent.split("\n");
                const pRange = this.utils.getSectionRange(scheduleFile, "Project", 1, sLines);
                if (pRange) {
                    const pStartIdx = pRange.startLine;
                    const pEndIdx = pRange.endLine === -1 ? sLines.length : pRange.endLine;
                    const rawExecLines = (() => {
                        let buf: string[] = [], inEx = false;
                        for (const cl of cleanedLines) {
                            if (REGEX.TOP_HEADING_START.test(cl)) { inEx = REGEX.EXEC_HEADER.test(cl.trim()); continue; }
                            if (inEx && (REGEX.MATCH_TASK.test(cl) || /^##\s/.test(cl.trim()))) buf.push(cl);
                        }
                        return buf;
                    })();
                    const newCallout = this.utils.renderProjectCallout(noteName, rawExecLines, planTasksDone, planTasksTotal, todayObj, statBar);
                    let projectFound = false;
                    for (let i = pStartIdx + 1; i < pEndIdx; i++) {
                        if (sLines[i].startsWith("> [!") && sLines[i].includes(`**${noteName}**`)) {
                            let cStart = i; while (cStart > pStartIdx && !sLines[cStart].startsWith("> [!")) cStart--;
                            let cEnd = i + 1; while (cEnd < pEndIdx && sLines[cEnd].startsWith(">") && !sLines[cEnd].startsWith("> [!")) cEnd++;
                            sLines.splice(cStart, cEnd - cStart, ...newCallout.split("\n"));
                            projectFound = true; break;
                        }
                    }
                    if (!projectFound) sLines.splice(pEndIdx, 0, "", ...newCallout.split("\n"));
                    await this.app.vault.modify(scheduleFile, sLines.join("\n"));
                    new Notice(`✅ [${noteName}] 스케줄 반영 완료!`);
                }
            }
        }
    }

    async dailyTaskReset(activeFile: TFile) {
        const originalContent = await this.app.vault.read(activeFile);
        let content = this.utils.preprocessContent(originalContent);
        const now = this.utils.getAdjustedNow();
        const todayStr = now.format("YYYY-MM-DD");
        
        // 1. 루틴 리셋 및 완료 항목 아카이빙
        let lines = content.split("\n");
        let archiveLines: string[] = [];
        let newLines: string[] = [];
        let inRoutine = false;

        for (let l of lines) {
            if (l.includes("# Routine")) inRoutine = true;
            else if (l.startsWith("# ")) inRoutine = false;

            if (REGEX.MATCH_TASK.test(l)) {
                if (REGEX.MATCH_TASK_COMPLETED.test(l)) {
                    if (inRoutine) {
                        newLines.push(l.replace(/\[.\]/, "[ ]")); // 루틴은 리셋
                    } else {
                        archiveLines.push(l); // 일반 작업은 아카이브행
                    }
                } else {
                    newLines.push(l);
                }
            } else {
                newLines.push(l);
            }
        }

        // 아카이브 파일 작성 (생략: 기존 99번 로직과 유사하게 구현 가능)
        if (archiveLines.length > 0) {
            const archivePath = `${this.settings.archiveDir}/${now.format("YYYY/YYYY-MM")}.md`;
            await this.utils.ensureFolder(`${this.settings.archiveDir}/${now.format("YYYY")}`);
            let aFile = this.app.vault.getAbstractFileByPath(archivePath);
            if (aFile instanceof TFile) {
                await this.app.vault.append(aFile, `\n### ${todayStr} 회고\n` + archiveLines.join("\n"));
            } else {
                await this.app.vault.create(archivePath, `## ${now.format("YYYY-MM")} 아카이브\n\n### ${todayStr} 회고\n` + archiveLines.join("\n"));
            }
        }

        await this.app.vault.modify(activeFile, newLines.join("\n"));
        new Notice("✅ 데일리 태스크 리셋 및 아카이빙 완료!");
    }

    async archiveMonthlyStats() {
        const now = this.utils.getAdjustedNow();
        const monthStr = now.format("YYYY-MM");
        const archivePath = `${this.settings.archiveDir}/${now.format("YYYY/YYYY-MM")}.md`;
        const aFile = this.app.vault.getAbstractFileByPath(archivePath);

        if (!(aFile instanceof TFile)) {
            new Notice("❌ 아카이브 파일을 찾을 수 없습니다.");
            return;
        }

        let content = await this.app.vault.read(aFile);
        const tableMatch = content.match(/\| 날짜 \|[\s\S]*?\n\n/);
        if (tableMatch) {
            const tableContent = tableMatch[0].trim();
            const lines = tableContent.split("\n");
            const headers = lines[0];
            const dataLines = lines.slice(2);
            
            const stats = this.utils.parseTableStats(dataLines, headers);
            const dashboard = this.utils.renderStatsDashboard(stats.sq, stats.ar, stats.cs, `${monthStr} 체크리스트 통계`);
            
            // 기존 대시보드가 있다면 교체, 없으면 상단에 추가
            const dashboardRegex = /> \[!info\]\+ 📈 \*\*.*체크리스트 통계\*\*[\s\S]*?(?=\n\n|\n#|$)/;
            if (content.match(dashboardRegex)) {
                content = content.replace(dashboardRegex, dashboard.trim());
            } else {
                content = dashboard + "\n\n" + content;
            }
            await this.app.vault.modify(aFile, content);
            new Notice(`✅ ${monthStr} 통계 아카이브 업데이트 완료!`);
        }
    }
}
