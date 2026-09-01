/* eslint-disable @typescript-eslint/no-unsafe-assignment -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-call -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-return -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Complex type casting needed for markdown AST */
import { App, Modal, TFile, Notice } from "obsidian";
import { PluginSettings } from "./settings";
import { t } from "./i18n";
import { TaskUtils } from "./TaskUtils";
import { DateManager } from "./DateManager";
import { FileManager } from "./FileManager";
import { REGEX } from "./Constants";
import { RoutineSyncEngine } from "./RoutineSyncEngine";
// 1. 일간 마감 입력 팝업 모달 정의
export class DailyResetModal extends Modal {
    review: string;
    step: string;
    language: string;
    onSubmit: (review: string, step: string) => Promise<void> | void;

    constructor(app: App, language: string, defaultReview: string, onSubmit: (review: string, step: string) => Promise<void> | void) {
        super(app);
        this.language = language;
        this.review = defaultReview;
        this.step = "";
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("myworld-padding-20-10");

        contentEl.createEl("h2", { text: t("modal_reset_title", this.language), cls: "myworld-mt-0-mb-25" });

        // 오늘의 회고
        const reviewContainer = contentEl.createDiv({ cls: "myworld-mb-25" });
        const reviewHeader = reviewContainer.createDiv({ cls: "myworld-flex-baseline-gap10-mb10" });
        const reviewLabel = reviewHeader.createEl("h4", { text: t("modal_review_label", this.language) });
        reviewLabel.addClass("myworld-margin-0");
        reviewHeader.createSpan({ text: t("modal_review_desc", this.language), cls: "myworld-text-muted-sm" });

        const reviewInputEl = reviewContainer.createEl("textarea", { attr: { placeholder: t("modal_review_placeholder", this.language) } });
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
        const stepLabel = stepHeader.createEl("h4", { text: t("modal_step_label", this.language) });
        stepLabel.addClass("myworld-margin-0");
        stepHeader.createSpan({ text: t("modal_step_desc", this.language), cls: "myworld-text-muted-sm" });

        const stepInputEl = stepContainer.createEl("input", { type: "text", attr: { placeholder: t("modal_step_placeholder", this.language) } });
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
        const btn = btnContainer.createEl("button", { text: t("modal_submit_btn", this.language) });
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
            new Notice(t("reset_prep_daily", this.settings.language));

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
            new DailyResetModal(this.app, this.settings.language, defaultReview, async (reviewInput, stepInput) => {
                const originalProjectsCache: Map<TFile, string> = new Map();
                let latestOriginalContent = "";
                try {
                    this.utils.showLoadingOverlay("⏳ 일간 마감 처리 중...");
                    new Notice(t("reset_start_daily", this.settings.language));

                    // 모달 제출 시점의 최신 에디터/파일 텍스트를 다시 읽어와 동시성 유실 방지
                    latestOriginalContent = await this.fileManager.getActiveViewOrFileText(dailyFile);
                    let resetContent = this.utils.preprocessContent(latestOriginalContent);

                    // --- [Step 1] 루틴 콜아웃 체크박스 분석 및 하단 마스터 표 자동 이관 ---
                    const routineEmojiMap = RoutineSyncEngine.calculateRoutineEmojiMap(resetContent);
                    const cleanDateStr = now.date().toString();

                    const chkRange = this.utils.getSectionRange(resetContent, t("header_checklist", this.settings.language)) as { start: number, end: number };
                    if (chkRange) {
                        let beforeChk = resetContent.substring(0, chkRange.start);
                        let chkSection = resetContent.substring(chkRange.start, chkRange.end);
                        const afterChk = resetContent.substring(chkRange.end);

                        // 하단 마스터 표 헤더 및 기존 데이터 행 파싱
                        const chkLines = chkSection.split('\n');
                        let tableStart = -1;
                        let tableEnd = -1;
                        let existingBotHeaders: string[] = [];
                        const dataRowMap: Record<string, Record<string, string>> = {};

                        for (let i = 0; i < chkLines.length; i++) {
                            const lineTrim = chkLines[i].trim();
                            if (lineTrim.startsWith('|')) {
                                if (tableStart === -1) {
                                    tableStart = i;
                                    existingBotHeaders = lineTrim.replace(/^\||\|$/g, '').split('|').map(s => s.trim());
                                }
                                tableEnd = i;

                                // 데이터 행 파싱
                                const cols = lineTrim.split('|').map(s => s.trim());
                                if (cols.length > 2 && !isNaN(parseInt(cols[1]))) {
                                    const d = parseInt(cols[1]).toString();
                                    const rowValMap: Record<string, string> = {};
                                    existingBotHeaders.slice(1).forEach((h, idx) => {
                                        if (h) rowValMap[h] = cols[idx + 2] || '      ';
                                    });
                                    dataRowMap[d] = rowValMap;
                                }
                            } else if (tableStart !== -1 && lineTrim !== '' && !lineTrim.startsWith('#')) {
                                break;
                            }
                        }

                        // targetBotHeaders 구성: 기존 첫 번째 컬럼(날짜/Date)을 존중하고 루틴 카테고리 동기화
                        const firstColName = (existingBotHeaders.length > 0 && (existingBotHeaders[0] === '날짜' || existingBotHeaders[0] === 'Date'))
                            ? existingBotHeaders[0]
                            : (this.settings.language === 'ko' ? '날짜' : 'Date');

                        const targetBotHeaders = [firstColName];
                        routineEmojiMap.forEach((_, catName) => {
                            if (!targetBotHeaders.includes(catName)) {
                                targetBotHeaders.push(catName);
                            }
                        });

                        existingBotHeaders.forEach((h, idx) => {
                            if (idx > 0 && h && !targetBotHeaders.includes(h)) {
                                targetBotHeaders.push(h);
                            }
                        });

                        // 당일(cleanDateStr) 데이터 업데이트 (루틴 콜아웃 이모지 자동 주입)
                        if (!dataRowMap[cleanDateStr]) dataRowMap[cleanDateStr] = {};
                        routineEmojiMap.forEach((emoji, catName) => {
                            dataRowMap[cleanDateStr][catName] = emoji;
                        });

                        // 새 마스터 표 생성
                        const newHeaderLine = `| ${targetBotHeaders.join(" | ")} |`;
                        const newSepLine = `| :-: | ${targetBotHeaders.slice(1).map(() => ":--:").join(" | ")} |`;

                        // 1~31일 데이터 행 재구성
                        const newRows: string[] = [];
                        const maxDays = now.daysInMonth();
                        for (let d = 1; d <= maxDays; d++) {
                            const dStr = d.toString();
                            const rowData = dataRowMap[dStr] || {};
                            const rowVals = targetBotHeaders.slice(1).map(h => rowData[h] || '      ');
                            newRows.push(`| ${d.toString().padStart(2, ' ')} | ${rowVals.join(" | ")} |`);
                        }

                        const newTableStr = [newHeaderLine, newSepLine, ...newRows].join('\n');

                        if (tableStart !== -1) {
                            chkSection = chkLines.slice(0, tableStart).join('\n') + '\n' + newTableStr + '\n' + chkLines.slice(tableEnd + 1).join('\n');
                        } else {
                            chkSection = chkSection.trim() + '\n\n' + newTableStr + '\n';
                        }

                        resetContent = beforeChk + chkSection + afterChk;
                    }

                    // --- [Step 1-1] 상단 루틴 콜아웃 체크박스 초기화 (다음 날을 위해 클린 리셋) ---
                    resetContent = RoutineSyncEngine.resetRoutineCalloutCheckboxes(resetContent);


                    // --- [Step 2] 프로젝트 파일 획득 (완료 항목 정리를 위해) ---
                    const allFiles = this.utils.getProjectFiles();

                    // [트랜잭션 백업] 프로젝트 파일 원본 캐싱 (미저장 에디터 내용 포함)
                    for (const f of allFiles) {
                        const fileContent = await this.fileManager.getActiveViewOrFileText(f);
                        originalProjectsCache.set(f, fileContent);
                    }

                    // --- [Step 2-1] 프로젝트 파일 실행 섹션 완료 항목 정리 및 식별자 동기화 ---
                    for (const projFile of allFiles) {
                        const projContent = await this.fileManager.getActiveViewOrFileText(projFile);
                        const projLines = projContent.split("\n");

                        // 1. 실행 탭 내 완료된 항목의 식별자 추출
                        const completedIds = new Set<string>();
                        let inExecForExtract = false;
                        for (const line of projLines) {
                            if (REGEX.TOP_HEADING_START.test(line)) {
                                inExecForExtract = REGEX.EXEC_HEADER.test(line.trim());
                                continue;
                            }
                            if (inExecForExtract && REGEX.MATCH_TASK_COMPLETED.test(line)) {
                                const match = line.match(REGEX.EXTRACT_ID);
                                if (match && match[2]) {
                                    completedIds.add(match[2]);
                                }
                            }
                        }

                        // 2. 원본(계획 탭 등) 완료 처리 및 실행 탭 청소
                        let execBuf: string[] = [], cleanedProjLines: string[] = [], inExecSec = false;
                        for (let i = 0; i < projLines.length; i++) {
                            let cl = projLines[i];
                            if (REGEX.TOP_HEADING_START.test(cl)) {
                                const wasExec = inExecSec;
                                inExecSec = REGEX.EXEC_HEADER.test(cl.trim());
                                if (wasExec && !inExecSec && execBuf.length > 0) {
                                    cleanedProjLines.push(...this.utils.filterResetTasks(execBuf, true));
                                    execBuf = [];
                                }
                                cleanedProjLines.push(cl);
                                continue;
                            }
                            if (inExecSec) {
                                execBuf.push(cl);
                            } else {
                                // 실행 탭이 아닌 구역(계획 등)에서 식별자가 일치하는 미완료 태스크를 [x]로 변경
                                if (REGEX.MATCH_TASK.test(cl) && !REGEX.MATCH_TASK_COMPLETED.test(cl)) {
                                    const match = cl.match(REGEX.EXTRACT_ID);
                                    if (match && match[2] && completedIds.has(match[2])) {
                                        cl = cl.replace(/^(\s*(?:>\s*)*[-*+]\s+\[)(.)(\])/, `$1x$3`);
                                    }
                                }
                                cleanedProjLines.push(cl);
                            }
                        }
                        if (execBuf.length > 0) {
                            cleanedProjLines.push(...this.utils.filterResetTasks(execBuf, true));
                        }

                        let newProjContent = cleanedProjLines.join("\n");

                        // 3. 프로젝트 실행 탭 긴급도/마감일 자동 정렬
                        const execHeaderMatch = newProjContent.match(/(?:^|\n)(#+\s+(?:🏃‍♂️\s*)?(?:실행|Execution))[ \t]*(?=\n|$)/i);
                        if (execHeaderMatch && execHeaderMatch[1]) {
                            newProjContent = this.utils.processSectionLogic(newProjContent, execHeaderMatch[1].trim(), todayObj, false, true);
                        }

                        if (projContent !== newProjContent) {
                            await this.fileManager.pluginWrite(projFile, newProjContent);
                        }
                    }

                    // --- [Step 3] 할 일 리셋 및 정렬 ---
                    resetContent = this.utils.processSectionLogic(resetContent, "# Todo", todayObj, true, true);
                    resetContent = this.utils.formatChecklistTable(resetContent);

                    // --- [Step 4] Step(목표) 업데이트 ---
                    let finalL: string[] = [], allL = resetContent.split('\n');
                    for (let i = 0; i < allL.length; i++) {
                        let l = allL[i];
                        if (stepInput && stepInput.trim() && /^((?:>\s*|[-*+]\s*|\s*)*.*?(?:[Ss]tep|도전)\s*:).*$/i.test(l)) {
                            l = l.replace(/^((?:>\s*|[-*+]\s*|\s*)*.*?(?:[Ss]tep|도전)\s*:).*$/i, (_match, p1) => `${p1} ${stepInput.trim()}`);
                        }
                        finalL.push(l);
                    }

                    let mainContent = finalL.join('\n');
                    const dailyStatsHeader = t("header_stats", this.settings.language);
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
                    const isKo = this.settings.language === "ko";
                    const reviewLabel = isKo ? "회고" : "Review";
                    const noReviewText = isKo ? "미작성" : "Not written";
                    const dailyRecord = (reviewInput.trim() || stepInput.trim()) ? `> [!quote]+ 📅 **${archiveDayLabel}**\n> **Step**: ${stepInput.trim() || dailyMeta.step}\n> **${reviewLabel}**: ${reviewInput || noReviewText}\n` : "";

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
                        new Notice(t("notice_archive_updating", this.settings.language));
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

                    // 빈 컬럼 제거 (루틴에서 삭제된 항목 정리 - 일간 리셋 시)
                    mainContent = this.utils.formatChecklistTable(mainContent);

                    // 완료된 Task 개수 카운트
                    const completedMatches = latestOriginalContent.match(/^(\s*(?:>\s*)*[-*+]\s+\[[xX]\])/gm);
                    const todayCompletedTasksCount = completedMatches ? completedMatches.length : 0;

                    // 최종 파일 저장
                    const newContent = mainContent + statsSection + tailContent;
                    await this.fileManager.saveIfChanged(dailyFile, latestOriginalContent, newContent);

                    const isKoLang = this.settings.language === 'ko';
                    const taskMsg = isKoLang
                      ? `\n🎯 오늘 완료한 Task: 총 ${todayCompletedTasksCount}개`
                      : `\n🎯 Completed Tasks Today: ${todayCompletedTasksCount}`;

                    new Notice(t("reset_complete", this.settings.language) + taskMsg, 8000);
                } catch (innerErr) {
                    console.error("Daily Reset Execution Error:", innerErr);

                    // [트랜잭션 롤백] 데일리 파일 복구 (해시 필터 등록 후 안전하게 저장)
                    try {
                        const rollbackTargetContent = latestOriginalContent || originalContent;
                        await this.fileManager.pluginWrite(dailyFile, rollbackTargetContent);
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

                    new Notice(t("reset_fail_restore", this.settings.language));
                } finally {
                    this.utils.hideLoadingOverlay();
                }
            }).open();
        } catch (e) {
            console.error("Daily Task Reset Initialization Error:", e);
            new Notice(t("reset_fail_error", this.settings.language));
        }
    }

    async runManualArchive(dailyFile: TFile): Promise<void> {
        // catch 블록에서 롤백에 사용하기 위해 try 바깥에 선언
        let originalContent = "";
        try {
            this.utils.showLoadingOverlay("⏳ 월간 통계 아카이빙 중...");
            new Notice(t("reset_archive_start", this.settings.language));

            // 에디터의 실시간 내용을 우선 읽어옴 (읽기 모드 포함 안전 처리)
            originalContent = await this.fileManager.getActiveViewOrFileText(dailyFile);

            const content = this.utils.preprocessContent(originalContent);
            const now = this.utils.getAdjustedNow(); // 설정된 자정 보정 적용

            const tableStr = this.utils.getChecklistTable(content);
            if (!tableStr) {
                new Notice(t("reset_archive_no_table", this.settings.language));
                return;
            }

            const tLines = tableStr.trim().split("\n").filter(l => l.includes("|"));
            if (tLines.length < 2) {
                new Notice(t("reset_archive_no_data", this.settings.language));
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
                const dailyStatsHeader = t("header_stats", this.settings.language);
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
                new Notice(t("reset_archive_complete", this.settings.language));
            } else {
                new Notice(t("reset_archive_no_dashboard", this.settings.language));
            }
        } catch (e) {
            console.error("Manual Archive Error:", e);
            // 실패 시 데일리 파일 원본 복구 시도
            try {
                const currentContent = await this.fileManager.getActiveViewOrFileText(dailyFile);
                // saveIfChanged 호출 전이므로 originalContent와 다를 경우에만 복구
                if (currentContent !== originalContent) {
                    await this.fileManager.pluginWrite(dailyFile, originalContent);
                    new Notice(t("reset_archive_fail_restore", this.settings.language));
                } else {
                    new Notice(t("reset_archive_fail_error", this.settings.language));
                }
            } catch (rollbackErr) {
                console.error("Rollback failed for daily file:", dailyFile.path, rollbackErr);
                new Notice(t("reset_archive_fail_critical", this.settings.language));
            }
        } finally {
            this.utils.hideLoadingOverlay();
        }
    }

    /**
     * 월 전환 시 지난 달 체크리스트 및 통계를 아카이브하고,
     * 스케줄 노트의 체크리스트 표(1일~말일)를 깨끗하게 '-'로 초기화합니다.
     */
    async runMonthlyResetAndArchive(dailyFile: TFile, onSettingsSave?: () => Promise<void>): Promise<boolean> {
        let originalContent = "";
        try {
            this.utils.showLoadingOverlay("⏳ 새 달 맞이 아카이빙 및 체크리스트 초기화 중...");
            originalContent = await this.fileManager.getActiveViewOrFileText(dailyFile);
            const content = this.utils.preprocessContent(originalContent);
            const now = this.utils.getAdjustedNow(); // 현재 기준일
            const currentMonthStr = now.format("YYYY-MM");
            const prevMonthMoment = now.clone().subtract(1, "month");

            // 1. 기존 체크리스트 표 및 통계 데이터 추출하여 지난달 아카이브 저장
            const tableStr = this.utils.getChecklistTable(content);
            if (tableStr) {
                const tLines = tableStr.trim().split("\n").filter(l => l.includes("|"));
                if (tLines.length >= 2) {
                    const tableHeader = tLines[0];
                    const dataRows = tLines.filter(l => {
                        const cols = l.split("|");
                        return cols.length > 2 && !isNaN(parseInt(cols[1]));
                    });

                    // 8월(또는 직전 달) 아카이브 생성
                    const archiveStatsDashboard = this.utils.generateSegmentedDashboards(tableHeader, dataRows);
                    if (archiveStatsDashboard) {
                        await this.utils.updateMonthlyArchiveStats(this.app, prevMonthMoment, archiveStatsDashboard);
                    }
                }
            }

            // 2. 스케줄 노트 내 # 체크리스트 섹션 표를 1일~말일까지 '-'로 클린 초기화
            const chkRange = this.utils.getSectionRange(content, t("header_checklist", this.settings.language)) as { start: number; end: number };
            let updatedContent = content;

            if (chkRange) {
                const beforeChk = content.substring(0, chkRange.start);
                const chkSection = content.substring(chkRange.start, chkRange.end);
                const afterChk = content.substring(chkRange.end);

                // 기존 표의 헤더 컬럼들 추출 (| 날짜 | Step | 명상 | ... |)
                const chkLines = chkSection.split("\n");
                let existingHeaders: string[] = [];
                for (const line of chkLines) {
                    const trim = line.trim();
                    if (trim.startsWith("|")) {
                        existingHeaders = trim.replace(/^\||\|$/g, "").split("|").map(s => s.trim());
                        break;
                    }
                }

                if (existingHeaders.length === 0) {
                    existingHeaders = [
                        this.settings.language === "ko" ? "날짜" : "Date",
                        "Step", "명상", "몰입", "식단", "운동", "수면"
                    ];
                }

                const newHeaderLine = `| ${existingHeaders.join(" | ")} |`;
                const newSepLine = `| :-: | ${existingHeaders.slice(1).map(() => ":--:").join(" | ")} |`;

                // 1일부터 이번 달 말일(예: 9월은 30일)까지 '-' 채우기
                const maxDays = now.daysInMonth();
                const newRows: string[] = [];
                for (let d = 1; d <= maxDays; d++) {
                    const blankCols = existingHeaders.slice(1).map(() => " - ");
                    newRows.push(`| ${d.toString().padStart(2, " ")} | ${blankCols.join(" | ")} |`);
                }

                const newTableStr = [newHeaderLine, newSepLine, ...newRows].join("\n");
                const newChkSection = `${t("header_checklist", this.settings.language)}\n${newTableStr}\n`;

                updatedContent = beforeChk + newChkSection + afterChk;
            }

            // 3. # 통계 섹션도 새 달을 위해 초기화
            const dailyStatsHeader = t("header_stats", this.settings.language);
            const fullStatsRange = this.utils.getSectionRange(updatedContent, dailyStatsHeader) as { start: number; end: number };
            if (fullStatsRange) {
                const beforeStats = updatedContent.substring(0, fullStatsRange.start);
                const afterStats = updatedContent.substring(fullStatsRange.end);
                const newStatsSection = `${dailyStatsHeader}\n\n> (이달의 기록 대기 중)\n`;
                updatedContent = beforeStats + newStatsSection + afterStats;
            }

            // 4. 스케줄 파일 저장
            await this.fileManager.saveIfChanged(dailyFile, originalContent, updatedContent);

            // 5. lastActiveMonth 설정 갱신
            this.settings.lastActiveMonth = currentMonthStr;
            if (onSettingsSave) {
                await onSettingsSave();
            }

            new Notice(t("notice_monthly_reset_success", this.settings.language));
            return true;
        } catch (e) {
            console.error("Monthly Reset Error:", e);
            new Notice(t("reset_archive_fail_error", this.settings.language));
            return false;
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
