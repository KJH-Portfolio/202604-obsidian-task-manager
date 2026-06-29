/* eslint-disable @typescript-eslint/no-unsafe-assignment -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-call -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-return -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Complex type casting needed for markdown AST */
import { App, Modal, TFile, Notice } from "obsidian";
import { PluginSettings } from "./settings";
import { TaskUtils } from "./TaskUtils";
import { DateManager } from "./DateManager";
import { FileManager } from "./FileManager";
// 1. 일간 마감 입력 팝업 모달 정의
export class DailyResetModal extends Modal {
    review: string;
    step: string;
    onSubmit: (review: string, step: string) => Promise<void> | void;

    constructor(app: App, defaultReview: string, onSubmit: (review: string, step: string) => Promise<void> | void) {
        super(app);
        this.review = defaultReview;
        this.step = "";
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("myworld-padding-20-10");

        contentEl.createEl("h2", { text: "🌤️ 일간 마감 및 데일리 리셋", cls: "myworld-mt-0-mb-25" });

        // 오늘의 회고
        const reviewContainer = contentEl.createDiv({ cls: "myworld-mb-25" });
        const reviewHeader = reviewContainer.createDiv({ cls: "myworld-flex-baseline-gap10-mb10" });
        const reviewLabel = reviewHeader.createEl("h4", { text: "오늘의 회고" });
        reviewLabel.addClass("myworld-margin-0");
        reviewHeader.createEl("span", { text: "오늘 하루의 생각이나 소회를 기입하세요.", cls: "myworld-text-muted-sm" });
        
        const reviewInputEl = reviewContainer.createEl("textarea", { attr: { placeholder: "여기에 오늘의 회고를 작성하세요..." } });
        reviewInputEl.value = this.review;
        reviewInputEl.addClass("myworld-w-100");
        reviewInputEl.addClass("myworld-h-100px");
        reviewInputEl.addClass("myworld-p-12-15");
        reviewInputEl.addClass("myworld-text-1em");
        reviewInputEl.addClass("myworld-rounded-6");
        reviewInputEl.addClass("myworld-border-std");
        reviewInputEl.addClass("myworld-resize-v");
        reviewInputEl.addEventListener("input", (e) => {
            this.review = (e.target as HTMLTextAreaElement).value;
        });

        // 내일의 Step
        const stepContainer = contentEl.createDiv({ cls: "myworld-mb-35" });
        const stepHeader = stepContainer.createDiv({ cls: "myworld-flex-baseline-gap10-mb10" });
        const stepLabel = stepHeader.createEl("h4", { text: "내일의 Step" });
        stepLabel.addClass("myworld-margin-0");
        stepHeader.createEl("span", { text: "내일 실행할 핵심 디데이 목표를 기입하세요.", cls: "myworld-text-muted-sm" });
        
        const stepInputEl = stepContainer.createEl("input", { type: "text", attr: { placeholder: "예: 계획 따라 움직이기 등..." } });
        stepInputEl.value = this.step;
        stepInputEl.addClass("myworld-w-100");
        stepInputEl.addClass("myworld-p-12-15");
        stepInputEl.addClass("myworld-text-1em");
        stepInputEl.addClass("myworld-rounded-6");
        stepInputEl.addClass("myworld-border-std");
        stepInputEl.addEventListener("input", (e) => {
            this.step = (e.target as HTMLInputElement).value;
        });
        
        const submitAction = () => {
            this.close();
            void this.onSubmit(this.review, this.step);
        };

        // Enter key handling for Step
        stepInputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                submitAction();
            }
        });

        // Submit Button
        const btnContainer = contentEl.createDiv({ cls: "myworld-flex-end" });
        const btn = btnContainer.createEl("button", { text: "제출 및 마감" });
        btn.addClass("mod-cta");
        btn.addClass("myworld-p-10-30");
        btn.addClass("myworld-text-1em");
        btn.addEventListener("click", submitAction);
        
        // Focus review input automatically
        window.setTimeout(() => reviewInputEl.focus(), 50);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 2. 일간 마감 및 통계 아카이브 처리기 정의
export class ResetManager {
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

    async runDailyReset(dailyFile: TFile): Promise<void> {
        try {
            new Notice("⏳ 일간 마감 준비 중...");
            
            // 에디터의 실시간 내용을 우선 읽어옴 (읽기 모드 포함 안전 처리)
            const originalContent = await this.fileManager.getActiveViewOrFileText(dailyFile);
            
            let content = this.utils.preprocessContent(originalContent);
            const now = this.utils.getAdjustedNow(); // 설정된 자정 보정 적용
            
            // 리셋 기준일을 내일 아침으로 설정하기 위해 하루 더함
            const todayObj = now.clone().add(1, 'days').startOf('day').toDate();
            
            // 기존 오늘의 Step 및 회고 추출
            const dailyMeta = this.utils.extractDailyMetadata(content);
            const defaultReview = dailyMeta.review === "미작성" ? "" : dailyMeta.review;

            // 회고/Step 입력 창 띄우기
            new DailyResetModal(this.app, defaultReview, async (reviewInput, stepInput) => {
                const originalProjectsCache: Map<TFile, string> = new Map();
                try {
                    this.utils.showLoadingOverlay("⏳ 일간 마감 처리 중...");
                    new Notice("⏳ 일간 마감 및 리셋 시작...");
                    let content = this.utils.preprocessContent(originalContent);

                    // --- [Step 1] 미니 테이블 데이터 추출 및 체크리스트 본 표 이관 ---
                    const miniTableRegex = /(\|.*\|\n\|(?:\s*[:-]+[ -]*\|)+\n)([^\n]+)/;
                    const miniMatch = content.match(miniTableRegex);
                    
                    if (miniMatch) {
                        const fullMatch = miniMatch[0];
                        const headerPart = miniMatch[1];
                        const dataLine = miniMatch[2];
                        
                        // [추가] 상단 미니 표의 헤더와 데이터 매핑
                        const topHeaderLine = headerPart.split('\n')[0];
                        const topHeaders = topHeaderLine.trim().replace(/^\||\|$/g, '').split('|').map(s => s.trim());
                        
                        const innerData = dataLine.trim().replace(/^\||\|$/g, '');
                        const rowCols = innerData.split('|');
                        
                        const topDataMap = new Map<string, string>();
                        topHeaders.forEach((h, i) => {
                            topDataMap.set(h, rowCols[i] || '      ');
                        });
                        
                        const currentDateStr = (rowCols[0] || "").trim();
                        const todayDateNum = now.date();
                        const dateStr = currentDateStr || todayDateNum.toString();
                        
                        const chkRange = this.utils.getSectionRange(content, "# 체크리스트") as { start: number, end: number };
                        if (chkRange) {
                            let beforeChk = content.substring(0, chkRange.start);
                            let chkSection = content.substring(chkRange.start, chkRange.end);
                            const afterChk = content.substring(chkRange.end);
                            
                            // [추가] 하단 마스터 표의 헤더를 읽어와 동적으로 데이터 행 생성
                            const botTableRegex = /(\|.*\|\n\|(?:\s*[:-]+[ -]*\|)+\n)/;
                            const botMatch = chkSection.match(botTableRegex);
                            let newChecklistRow = "";
                            
                            if (botMatch) {
                                const botHeaderLine = botMatch[1].split('\n')[0];
                                const botHeaders = botHeaderLine.trim().replace(/^\||\|$/g, '').split('|').map(s => s.trim());
                                
                                const botRowCols = botHeaders.map(h => {
                                    if (h === '날짜' || h === 'Date') return ` ${dateStr.padEnd(3, ' ')} `;
                                    return topDataMap.has(h) ? topDataMap.get(h) : '      ';
                                });
                                newChecklistRow = `|${botRowCols.join('|')}|`;
                            } else {
                                newChecklistRow = `| ${dateStr.padEnd(3, ' ')} |${rowCols.slice(1).join('|')}|`;
                            }
                            
                            const rowToReplaceRegex = new RegExp(`\\|\\s*${dateStr}\\s*\\|.*\\|`);
                            if (rowToReplaceRegex.test(chkSection)) {
                                chkSection = chkSection.replace(rowToReplaceRegex, newChecklistRow);
                            }
                            
                            const nextDateNum = todayObj.getDate();
                            const emptyRowCols = [` ${nextDateNum.toString().padEnd(3, ' ')} `].concat(Array(Math.max(0, rowCols.length - 1)).fill('      '));
                            const newMiniTableRow = `|${emptyRowCols.join('|')}|`;
                            
                            beforeChk = beforeChk.replace(fullMatch, headerPart + newMiniTableRow);
                            
                            content = beforeChk + chkSection + afterChk;
                        }
                    }

                    // --- [Step 2] 프로젝트 파일 동기화 (# Project 리셋 모드) ---
                    const dailyMap = this.utils.parseDailyProjectMap(content);
                    const allFiles = this.utils.getProjectFiles();
                    const filesForCollisionCheck = [...allFiles, dailyFile];

                    // [트랜잭션 백업] 프로젝트 파일 원본 캐싱 (미저장 에디터 내용 포함) - 병렬 처리로 최적화
                    await Promise.all(allFiles.map(async (f) => {
                        const fileContent = await this.fileManager.getActiveViewOrFileText(f);
                        originalProjectsCache.set(f, fileContent);
                    }));

                    if (dailyMap) {
                        this.utils.syncDailyMap(dailyMap);
                        const overrideData = await this.utils.syncDailyToProjects(this.app, dailyMap, allFiles, filesForCollisionCheck, true); // isReset: true
                        
                        // 성능 개선: 무거운 집계 함수 1회만 호출하여 변수 재사용
                        const projectResults = await this.utils.getAllFullProjectResults(todayObj, overrideData, true);
                        
                        const newProjSectionText = this.utils.renderProjectDashboardSection(projectResults);
                        if (newProjSectionText) {
                            content = this.utils.replaceSection(content, "# Project", newProjSectionText);
                        }

                        // #### 프로젝트 섹션 (오늘의 프로젝트 할 일 리스트)
                        const todayProjectTasks = this.utils.renderTodayProjectTasks(projectResults, todayObj);
                        content = this.utils.replaceSection(content, "#### 프로젝트", todayProjectTasks || "> (오늘 할 일 없음)");
                    }

                    // --- [Step 3] 할 일 리셋 및 정렬 ---
                    content = this.utils.processSectionLogic(content, "# Todo", todayObj, true, true);
                    content = this.utils.formatChecklistTable(content);

                    // --- [Step 4] 루틴 체크박스 리셋 및 Step(목표) 업데이트 ---
                    let finalL: string[] = [], allL = content.split('\n'), inRoutine = false, routineType = "";
                    for (let i = 0; i < allL.length; i++) {
                        let l = allL[i];
                        if (/^>\s*\[!routine\]/i.test(l)) { inRoutine = true; routineType = "callout"; }
                        else if (/^#+\s*루틴/i.test(l)) { inRoutine = true; routineType = "header"; }
                        else if (inRoutine) {
                            if (routineType === "header" && l.startsWith('#') && !/^#+\s*루틴/i.test(l)) inRoutine = false;
                            else if (routineType === "callout" && !l.startsWith('>') && l.trim() !== '') inRoutine = false;
                        }
                        if (inRoutine && /^((?:>\s*)*\s*[-*+]\s+)\[[^ ]\]/.test(l)) {
                            l = l.replace(/^((?:>\s*)*\s*[-*+]\s+)\[[^ ]\]/, "$1[ ]");
                        }
                        if (/^((?:>\s*)+.*?(?:[Ss]tep|도전)\s*:).*$/.test(l)) {
                            l = l.replace(/^((?:>\s*)+.*?(?:[Ss]tep|도전)\s*:).*$/, (_match, p1) => `${p1} ${stepInput || " "}`);
                        }
                        finalL.push(l);
                    }

                    let mainContent = finalL.join('\n');
                    const dailyStatsHeader = "# 통계";
                    let tailContent = "";
                    const fullStatsRange = this.utils.getSectionRange(mainContent, dailyStatsHeader) as { start: number, end: number };
                    if (fullStatsRange) {
                        tailContent = mainContent.substring(fullStatsRange.end);
                        mainContent = mainContent.substring(0, fullStatsRange.start).trimEnd();
                    }

                    // --- [Step 5] 체크리스트 달성도 통계 그래프 대시보 재생성 ---
                    const tableStr = this.utils.getChecklistTable(mainContent);
                    let archiveStatsDashboard = "";
                    const archiveDayLabel = now.format("YYYY-MM-DD (ddd)");
                    const dailyRecord = (reviewInput || dailyMeta.step !== "미작성") ? `> [!quote]+ 📅 **${archiveDayLabel}**\n> **Step**: ${dailyMeta.step}\n> **회고**: ${reviewInput || "미작성"}\n` : "";

                    if (tableStr) {
                        const tableLines = tableStr.trim().split("\n").filter(l => l.includes("|"));
                        const tableHeader = tableLines[0];
                        const dataRows = tableLines.filter(l => {
                            let cols = l.split("|");
                            return cols.length > 2 && !isNaN(parseInt(cols[1]));
                        });

                        archiveStatsDashboard = this.utils.generateSegmentedDashboards(tableHeader, dataRows);
                        mainContent = this.utils.updateRoutineSectionBold(mainContent, this.utils.getDeficientItems(tableHeader, dataRows));
                    }

                    let statsSection = archiveStatsDashboard ? "\n\n" + dailyStatsHeader + "\n\n" + archiveStatsDashboard : "\n\n" + dailyStatsHeader + "\n\n> (기록 없음)";

                    // --- [Step 6] 주간/월간 아카이브 문서에 통계 및 일지 적재 ---
                    // 1. 주간 아카이브 처리
                    if (tableStr || dailyRecord) {
                        new Notice(`📂 주간 아카이브 갱신 중...`);
                        const tableLines = tableStr ? tableStr.split('\n').filter(l => l.trim().startsWith("|")) : [];
                        const tableHeader = tableLines[0] || "| 날짜 | Step | Block | 멘탈 | 식단 | 운동 | 취침 | 디톡스 |";
                        
                        const dataRows = tableLines.filter(l => {
                            const cols = l.split("|");
                            return cols.length > 2 && !isNaN(parseInt(cols[1]));
                        });

                        const weekGroups: Record<string, string[]> = {};
                        dataRows.forEach(row => {
                            const day = parseInt(row.split("|")[1]);
                            const rowDate = this.utils.getActualDate(now, day);
                            const weekKey = rowDate.format("gggg-[W]ww");
                            if (!weekGroups[weekKey]) weekGroups[weekKey] = [];
                            weekGroups[weekKey].push(row);
                        });

                        const todayWeekKey = now.format("gggg-[W]ww");
                        if (Object.keys(weekGroups).length === 0) {
                            weekGroups[todayWeekKey] = [];
                        }

                        for (const [weekKey, rows] of Object.entries(weekGroups)) {
                            const isTodayWeek = (weekKey === todayWeekKey);
                            const targetDate = isTodayWeek ? now : this.utils.getActualDate(now, parseInt(rows[0].split("|")[1]));
                            await this.utils.updateWeeklyNoteStats(this.app, targetDate, tableHeader, rows, isTodayWeek ? dailyRecord : "");
                        }
                    }

                    // 2. 월간 아카이브 처리
                    if (archiveStatsDashboard) {
                        await this.utils.updateMonthlyArchiveStats(this.app, now, archiveStatsDashboard);
                    }

                    // 최종 파일 저장
                    const newContent = mainContent + statsSection + tailContent;
                    await this.fileManager.saveIfChanged(dailyFile, originalContent, newContent);
                    new Notice("✅ 새로운 하루 준비 완료!");
                } catch (innerErr) {
                    console.error("Daily Reset Execution Error:", innerErr);
                    
                    // [트랜잭션 롤백] 데일리 파일 복구 (해시 필터 등록 후 안전하게 저장)
                    try {
                        await this.fileManager.pluginWrite(dailyFile, originalContent);
                    } catch (e) {
                        console.error("Rollback failed for daily file", dailyFile.path, e);
                    }

                    // [트랜잭션 롤백] 프로젝트 파일들 일괄 복구 (해시 필터 우회 방지)
                    for (const [f, c] of originalProjectsCache.entries()) {
                        try {
                            await this.fileManager.pluginWrite(f, c);
                        } catch (e) {
                            console.error("Rollback failed for", f.path, e);
                        }
                    }
                    
                    new Notice("🚨 리셋 실패: 모든 연관 파일을 복구했습니다.");
                } finally {
                    this.utils.hideLoadingOverlay();
                }
            }).open();
        } catch (e) {
            console.error("Daily Task Reset Initialization Error:", e);
            new Notice("🚨 리셋 초기화 실패: 에러가 발생했습니다.");
        }
    }

    async runManualArchive(dailyFile: TFile): Promise<void> {
        try {
            this.utils.showLoadingOverlay("⏳ 월간 통계 아카이빙 중...");
            new Notice("⏳ 월간 통계 수동 아카이빙 시작...");
            
            // 에디터의 실시간 내용을 우선 읽어옴 (읽기 모드 포함 안전 처리)
            const originalContent = await this.fileManager.getActiveViewOrFileText(dailyFile);
            
            const content = this.utils.preprocessContent(originalContent);
            const now = this.utils.getAdjustedNow(); // 설정된 자정 보정 적용

            const tableStr = this.utils.getChecklistTable(content);
            if (!tableStr) {
                new Notice("⚠️ 아카이빙할 체크리스트 표를 찾을 수 없습니다.");
                return;
            }

            const tLines = tableStr.trim().split("\n").filter(l => l.includes("|"));
            if (tLines.length < 2) {
                new Notice("⚠️ 체크리스트 표에 데이터가 부족합니다.");
                return;
            }

            const tableHeader = tLines[0];
            const dataRows = tLines.filter(l => {
                const cols = l.split("|");
                return cols.length > 2 && !isNaN(parseInt(cols[1]));
            });

            const archiveStatsDashboard = this.utils.generateSegmentedDashboards(tableHeader, dataRows);
            if (archiveStatsDashboard) {
                await this.utils.updateMonthlyArchiveStats(this.app, now, archiveStatsDashboard);
                
                // 스케줄 노트의 # 통계 섹션도 업데이트
                const dailyStatsHeader = "# 통계";
                let mainContent = content;
                const fullStatsRange = this.utils.getSectionRange(mainContent, dailyStatsHeader) as { start: number, end: number };
                
                let tailContent = "";
                if (fullStatsRange) {
                    tailContent = mainContent.substring(fullStatsRange.end);
                    mainContent = mainContent.substring(0, fullStatsRange.start).trimEnd();
                }
                
                const statsSection = "\n\n" + dailyStatsHeader + "\n\n" + archiveStatsDashboard;
                const newContent = mainContent + statsSection + tailContent;
                
                // 취약 항목 볼드 강조 갱신
                let updatedContent = this.utils.updateRoutineSectionBold(newContent, this.utils.getDeficientItems(tableHeader, dataRows));
                
                // 통계 숫자 파싱 로직 포함 (테이블 내 숫자 1~4를 이모지로 치환)
                updatedContent = this.utils.formatChecklistTable(updatedContent);
                
                await this.fileManager.saveIfChanged(dailyFile, originalContent, updatedContent);
                new Notice("✅ 월간 통계 수동 아카이빙 및 대시보드 갱신 완료!");
            } else {
                new Notice("⚠️ 생성된 통계 대시보드가 없습니다.");
            }
        } catch (e) {
            console.error("Manual Archive Error:", e);
            new Notice("🚨 아카이빙 중 에러가 발생했습니다.");
        } finally {
            this.utils.hideLoadingOverlay();
        }
    }
}


/* eslint-enable @typescript-eslint/no-unsafe-assignment -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-member-access -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-call -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-argument -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-return -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unnecessary-type-assertion -- Re-enable strict rules */
