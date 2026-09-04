import { RoutineCategory, RoutineStructure, RoutineDiff } from "./types";

export class RoutineSyncEngine {

    /**
     * 기본 루틴 구조 반환 (초기 설정 또는 파싱 실패 시 fallback)
     */
    static getDefaultRoutineStructure(lang: "en" | "ko" = "ko"): RoutineStructure {
        if (lang === "en") {
            return {
                affirmation: "Well begun is half done.",
                categories: [
                    { id: "step", name: "Step", description: "Execute 1st Priority Task", items: ["Write", "Execute"] },
                    { id: "block", name: "Block", description: "Focus Time Blocks", items: ["1", "2", "3", "4", "5", "6"] },
                    { id: "mental", name: "Mental", description: "5 min meditation", items: ["Read affirmation", "10 min meditation"] },
                    { id: "diet", name: "Diet", description: "Healthy eating", items: ["Breakfast", "Lunch", "Dinner"] },
                    { id: "exercise", name: "Exercise", description: "Stretching & Workout", items: ["Squat 60, Pushup 20"] },
                    { id: "sleep", name: "Sleep", description: "Rest before 12", items: ["Quiet time from 11"] },
                    { id: "detox", name: "Detox", description: "25 min Pomodoro", items: ["1 time", "3 times", "5 times+"] }
                ]
            };
        }
        return {
            affirmation: "시작이 반 이다.",
            categories: [
                { id: "step", name: "Step", description: "핵심 1순위 실행", items: ["작성", "실행"] },
                { id: "block", name: "Block", description: "집중 블록 달성", items: ["1", "2", "3", "4", "5", "6"] },
                { id: "mental", name: "멘탈", description: "5분 확언 및 명상", items: ["확언 읽기", "10분 명상"] },
                { id: "diet", name: "식단", description: "건강한 3끼 식사", items: ["아침", "점심", "저녁"] },
                { id: "exercise", name: "운동", description: "스트레칭 5분 + 운동", items: ["스쿼트 60, 팔굽 20"] },
                { id: "sleep", name: "취침", description: "12시 이전 취침 준비", items: ["11시부터 정적 활동"] },
                { id: "detox", name: "디톡스", description: "25분 타이머 집중", items: ["1회", "3회", "5회+"] }
            ]
        };
    }

    /**
     * 메인 스케줄 마크다운 내용에서 루틴 구조 파싱
     */
    static parseRoutineStructureFromMarkdown(content: string, defaultLang: "en" | "ko" = "ko"): RoutineStructure {
        if (!content) return this.getDefaultRoutineStructure(defaultLang);

        const lines = content.split("\n");
        let inRoutineCallout = false;
        let affirmation = "";
        const categories: RoutineCategory[] = [];
        let currentCat: RoutineCategory | null = null;

        for (let l of lines) {
            const trimmed = l.trim();

            if (/^>\s*\[!routine\]/i.test(trimmed)) {
                inRoutineCallout = true;
                continue;
            }

            if (inRoutineCallout) {
                // Callout 영역 종료 조건
                if (!trimmed.startsWith(">") && trimmed !== "") {
                    inRoutineCallout = false;
                    if (currentCat) {
                        categories.push(currentCat);
                        currentCat = null;
                    }
                    break;
                }

                // 확언 추출
                const affMatch = l.match(/^>\s*(?:확언|Affirmation)\s*:\s*(.*)$/i);
                if (affMatch) {
                    affirmation = affMatch[1].trim();
                    continue;
                }

                // 카테고리 헤더 (예: > ## <span aria-label="설명">==멘탈==</span> 또는 > ## ==멘탈== 또는 > ## 멘탈)
                const catMatch = l.match(/^>\s*##\s+(.*)$/);
                if (catMatch) {
                    if (currentCat) {
                        categories.push(currentCat);
                    }
                    const rawHeader = catMatch[1].trim();
                    let desc = "";
                    const descMatch = rawHeader.match(/(?:aria-label|title)="([^"]+)"/i);
                    if (descMatch) {
                        desc = descMatch[1].trim();
                    }

                    // HTML 태그 및 == 하이라이트 제거하여 순수 이름 추출
                    let catName = rawHeader
                        .replace(/<[^>]+>/g, "")
                        .replace(/==/g, "")
                        .trim();

                    const isCumulative = /data-mode=["']step["']|data-cumulative=["']true["']/i.test(rawHeader) || catName.includes("(누적형)");
                    if (isCumulative) {
                        catName = catName.replace(/\s*\(누적형\)/g, "").trim();
                    }

                    currentCat = {
                        id: catName.toLowerCase().replace(/\s+/g, "-") + "_" + Math.random().toString(36).substring(2, 7),
                        name: catName,
                        description: desc,
                        isCumulative: isCumulative,
                        items: []
                    };
                    continue;
                }


                // 체크리스트 항목 (예: > - [ ] 항목)
                const itemMatch = l.match(/^>\s*[-*+]\s+\[.\]\s+(.*)$/);
                if (itemMatch && currentCat) {
                    currentCat.items.push(itemMatch[1].trim());
                }
            }
        }

        if (currentCat) {
            categories.push(currentCat);
        }

        if (categories.length === 0) {
            return this.getDefaultRoutineStructure(defaultLang);
        }

        return {
            affirmation: affirmation || (defaultLang === "ko" ? "시작이 반 이다." : "Well begun is half done."),
            categories
        };
    }

    /**
     * 기존 마크다운 본문의 루틴 콜아웃 내 체크 상태(체크 여부) 추출
     */
    static parseExistingCheckStates(content: string): Map<string, boolean> {
        const checkedMap = new Map<string, boolean>();
        if (!content) return checkedMap;

        const lines = content.split("\n");
        let inRoutine = false;
        let currentCatName = "";
        let currentItemIdx = 0;

        for (let l of lines) {
            const trimmed = l.trim();

            if (/^>\s*\[!routine\]/i.test(trimmed)) {
                inRoutine = true;
                continue;
            }

            if (inRoutine) {
                if (!trimmed.startsWith(">") && trimmed !== "") {
                    inRoutine = false;
                    break;
                }

                // 카테고리 헤더 감지
                const catMatch = l.match(/^>\s*##\s+(.*)$/);
                if (catMatch) {
                    const rawHeader = catMatch[1].trim();
                    currentCatName = rawHeader
                        .replace(/<[^>]+>/g, "")
                        .replace(/==/g, "")
                        .trim();
                    currentItemIdx = 0;
                    continue;
                }

                // 체크리스트 항목 감지
                const itemMatch = l.match(/^>\s*[-*+]\s+\[(.)\]\s*(.*)$/);
                if (itemMatch && currentCatName) {
                    const checkChar = itemMatch[1].trim();
                    const isChecked = checkChar.toLowerCase() === "x";
                    const itemText = (itemMatch[2] || "").trim();

                    // 1. 이름 기반 키
                    checkedMap.set(`${currentCatName.toLowerCase()}:::${itemText.toLowerCase()}`, isChecked);
                    // 2. 순번(Index) 기반 키
                    checkedMap.set(`${currentCatName.toLowerCase()}:::__idx_${currentItemIdx}`, isChecked);
                    currentItemIdx++;
                }
            }
        }

        return checkedMap;
    }

    /**
     * RoutineStructure 데이터를 마크다운 Callout 텍스트로 생성
     * (기존에 체크되어 있던 [x] 상태를 완벽히 계승 보존)
     */
    static generateRoutineCalloutMarkdown(
        structure: RoutineStructure,
        lang: "en" | "ko" = "ko",
        existingCheckedMap?: Map<string, boolean>,
        diff?: RoutineDiff
    ): string {
        const affLabel = lang === "en" ? "Affirmation" : "확언";
        const lines: string[] = [];

        lines.push("> [!routine]");
        lines.push(`> ${affLabel} : ${structure.affirmation || ""}`);

        // rename 역방향 맵 생성: currentName -> originalName
        const reverseRenamed: Record<string, string> = {};
        if (diff && diff.renamedCategories) {
            for (const [orig, curr] of Object.entries(diff.renamedCategories)) {
                reverseRenamed[curr.toLowerCase()] = orig.toLowerCase();
            }
        }

        for (const cat of structure.categories) {
            const cleanDesc = cat.description ? cat.description.replace(/^(?:💡|\uD83D\uDCA1|\uFFFD|\?|\s)+/u, "").trim() : "";
            const stepAttr = cat.isCumulative ? ' data-mode="step"' : "";
            const badge = `<span class="routine-cumulative-badge" style="font-size: 0.72em; opacity: 0.55; font-weight: normal; margin-left: 4px;">(누적형)</span>`;
            const displayName = cat.isCumulative ? `${cat.name} ${badge}` : cat.name;
            if (cleanDesc) {
                // 옵시디언 네이티브 툴팁 속성 적용
                const safeDesc = cleanDesc.replace(/"/g, "&quot;");
                lines.push(`> ## <span aria-label="${safeDesc}"${stepAttr}>${displayName}</span>`);
            } else if (cat.isCumulative) {
                lines.push(`> ## <span${stepAttr}>${displayName}</span>`);
            } else {
                lines.push(`> ## ${displayName}`);
            }

            const catKey = cat.name.toLowerCase();
            const origCatKey = reverseRenamed[catKey] || catKey;

            for (let idx = 0; idx < cat.items.length; idx++) {
                const item = cat.items[idx];
                if (!item || !item.trim()) continue; // 빈 항목은 건너뜀

                const itemKey = item.trim().toLowerCase();

                let isChecked = false;
                if (existingCheckedMap) {
                    // 1순위: 이전 카테고리명 또는 현재 카테고리명 + 항목명 일치
                    if (existingCheckedMap.has(`${origCatKey}:::${itemKey}`)) {
                        isChecked = existingCheckedMap.get(`${origCatKey}:::${itemKey}`)!;
                    } else if (existingCheckedMap.has(`${catKey}:::${itemKey}`)) {
                        isChecked = existingCheckedMap.get(`${catKey}:::${itemKey}`)!;
                    }
                }

                const checkMarker = isChecked ? "x" : " ";
                lines.push(`> - [${checkMarker}] ${item.trim()}`);
            }
        }

        return lines.join("\n");
    }

    /**
     * 루틴 콜아웃 내부의 체크박스 상태를 분석하여 각 카테고리별 이모지 매핑 맵 생성
     * - 80% 이상 완료: 🟦
     * - 50% 이상 완료: 🟩
     * - 1개 이상 완료: 🟨
     * - 0% 미달성: 🟥
     */
    static calculateRoutineEmojiMap(content: string): Map<string, string> {
        const emojiMap = new Map<string, string>();
        if (!content) return emojiMap;

        const lines = content.split('\n');
        let inRoutine = false;
        let currentCatName = "";
        let totalCount = 0;
        let checkedCount = 0;

        const flushCategory = () => {
            if (currentCatName) {
                let emoji = "🟥";
                if (totalCount > 0) {
                    const ratio = checkedCount / totalCount;
                    if (ratio >= 0.8) {
                        emoji = "🟦";
                    } else if (ratio >= 0.5) {
                        emoji = "🟩";
                    } else if (checkedCount > 0) {
                        emoji = "🟨";
                    } else {
                        emoji = "🟥";
                    }
                }
                emojiMap.set(currentCatName, emoji);
            }
            currentCatName = "";
            totalCount = 0;
            checkedCount = 0;
        };

        for (const line of lines) {
            if (/^>\s*\[!routine\]/i.test(line)) {
                inRoutine = true;
                continue;
            }

            if (inRoutine) {
                if (!line.startsWith('>') && line.trim() !== '') {
                    inRoutine = false;
                    flushCategory();
                    break;
                }

                // 카테고리 헤더 감지
                const catMatch = line.match(/^>\s*##\s+(.*)$/);
                if (catMatch) {
                    flushCategory();
                    const rawHeader = catMatch[1].trim();
                    currentCatName = rawHeader
                        .replace(/<[^>]+>/g, "")
                        .replace(/==/g, "")
                        .replace(/\s*\(누적형\)/g, "")
                        .trim();
                    continue;
                }

                // 체크리스트 항목 감지
                const itemMatch = line.match(/^>\s*[-*+]\s+\[(.)\]/);
                if (itemMatch && currentCatName) {
                    totalCount++;
                    const checkChar = itemMatch[1].trim();
                    if (checkChar.toLowerCase() === 'x') {
                        checkedCount++;
                    }
                }
            }
        }

        flushCategory();
        return emojiMap;
    }

    /**
     * 상단 루틴 콜아웃 내부의 모든 체크박스를 [ ] (미체크)로 초기화
     */
    static resetRoutineCalloutCheckboxes(content: string): string {
        if (!content) return content;
        const lines = content.split('\n');
        let inRoutine = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^>\s*\[!routine\]/i.test(line)) {
                inRoutine = true;
                continue;
            }

            if (inRoutine) {
                if (!line.startsWith('>') && line.trim() !== '') {
                    inRoutine = false;
                    continue;
                }

                // 체크박스 항목을 [ ] 로 초기화
                if (/^>\s*[-*+]\s+\[.\]/.test(line)) {
                    lines[i] = line.replace(/^((?:>\s*)*[-*+]\s+\[).(\])/, '$1 $2');
                }
            }
        }

        return lines.join('\n');
    }

    /**
     * 메인 스케줄 문서 텍스트 전체에서 루틴 Callout 및 체크리스트 테이블 컬럼 동기화
     */
    static syncRoutineToMarkdown(content: string, newStructure: RoutineStructure, diff: RoutineDiff, lang: "en" | "ko" = "ko", adjustedNowDay?: number): string {
        if (!content) return content;

        // 1. Callout 영역 교체
        let lines = content.split("\n");
        let calloutStart = -1;
        let calloutEnd = -1;

        for (let i = 0; i < lines.length; i++) {
            if (/^>\s*\[!routine\]/i.test(lines[i])) {
                calloutStart = i;
                calloutEnd = i;
                for (let j = i + 1; j < lines.length; j++) {
                    const l = lines[j].trim();
                    if (l.startsWith(">") || l === "") {
                        calloutEnd = j;
                    } else {
                        break;
                    }
                }
                break;
            }
        }

        const existingCheckedMap = this.parseExistingCheckStates(content);
        const newCalloutStr = this.generateRoutineCalloutMarkdown(newStructure, lang, existingCheckedMap, diff);

        if (calloutStart !== -1) {
            lines.splice(calloutStart, calloutEnd - calloutStart + 1, newCalloutStr);
        } else {
            // 루틴 콜아웃이 없을 경우 `# 루틴` 또는 문서 상단에 삽입
            let insertIdx = 0;
            for (let i = 0; i < lines.length; i++) {
                if (/^#+\s*(루틴|Routine)/i.test(lines[i])) {
                    insertIdx = i + 1;
                    break;
                }
            }
            lines.splice(insertIdx, 0, newCalloutStr);
        }

        let updatedContent = lines.join("\n");

        // 2. 체크리스트 테이블 컬럼 동기화
        updatedContent = this.syncChecklistTableColumns(updatedContent, newStructure, diff, adjustedNowDay);

        return updatedContent;
    }

    /**
     * 체크리스트 테이블의 컬럼 및 데이터 행(Data Rows) 무결성 재배열 (Align)
     * 1. 활성 루틴 컬럼을 앞쪽에 배치, 비활성(삭제) 루틴 컬럼은 가장 뒤로 이동
     * 2. 비활성 루틴의 빈 셀에는 '-' 표기
     * 3. 신규 활성 루틴의 과거 날짜 빈 셀에는 '-' 표기, 오늘/미래는 빈칸
     */
    static syncChecklistTableColumns(content: string, newStructure: RoutineStructure, diff: RoutineDiff, adjustedNowDay?: number): string {
        let lines = content.split("\n");
        let idx = 0;

        while (idx < lines.length) {
            let tableStart = -1;
            let tableEnd = -1;

            for (let i = idx; i < lines.length; i++) {
                if (lines[i].trim().startsWith("|") && (lines[i].includes("날짜") || lines[i].includes("Date"))) {
                    tableStart = i;
                    tableEnd = i;
                    for (let j = i; j < lines.length; j++) {
                        if (lines[j].trim().startsWith("|")) {
                            tableEnd = j;
                        } else if (lines[j].trim() !== "") {
                            break;
                        }
                    }
                    break;
                }
            }

            if (tableStart === -1) break;

            const tableLines = lines.slice(tableStart, tableEnd + 1).filter(l => l.trim().startsWith("|"));
            if (tableLines.length > 0) {
                const originalHeaderCols = tableLines[0].split("|").map(c => c.trim()).filter(c => c !== "");
                if (originalHeaderCols.length > 1) {
                    const dateColName = originalHeaderCols[0];
                    const existingCatCols = originalHeaderCols.slice(1);

                    // 1) 개명(Rename) 매핑 적용
                    const updatedExistingCatCols = existingCatCols.map(col => diff.renamedCategories[col] || col);

                    // 2) 활성 루틴과 비활성 루틴 구분
                    const targetActiveCatNames = newStructure.categories.map(c => c.name);
                    const activeSet = new Set(targetActiveCatNames);

                    // 비활성 루틴 (기존 컬럼 중 현재 활성화되어 있지 않은 컬럼들)
                    const inactiveCatNames: string[] = [];
                    for (const col of updatedExistingCatCols) {
                        if (!activeSet.has(col) && !inactiveCatNames.includes(col)) {
                            inactiveCatNames.push(col);
                        }
                    }

                    // 3) 컬럼 배치 순서: [활성 루틴들 ...] + [비활성 루틴들 ...]
                    const finalCatCols = [...targetActiveCatNames, ...inactiveCatNames];

                    // 새 테이블 헤더 및 구획선 생성
                    const newHeaderLine = `| ${dateColName} | ${finalCatCols.join(" | ")} |`;
                    const newSeparatorLine = `| :-: | ${finalCatCols.map(() => ":--:").join(" | ")} |`;
                    const newTableLines: string[] = [newHeaderLine, newSeparatorLine];

                    // 4) 데이터 행(Data Rows) 컬럼 재배열 및 셀 채우기 (자정 보정 날짜 적용)
                    const momentFn = (window as { moment?: () => { date: () => number } }).moment;
                    const nowDay = adjustedNowDay !== undefined ? adjustedNowDay : (momentFn ? momentFn().date() : new Date().getDate());

                    for (let r = 2; r < tableLines.length; r++) {
                        const rowStr = tableLines[r];
                        const cols = rowStr.split("|").map(c => c.trim());
                        if (cols.length < 3) continue;

                        const dateVal = cols[1];
                        const rowDay = parseInt(dateVal, 10);
                        const isTodayOrFuture = !isNaN(rowDay) && rowDay >= nowDay;

                        const oldRowCatValues = cols.slice(2, cols.length - 1);

                        // 기존 컬럼별 값 맵 생성
                        const valMap: Record<string, string> = {};
                        for (let cIdx = 0; cIdx < existingCatCols.length; cIdx++) {
                            const oldCatName = existingCatCols[cIdx];
                            const mappedName = diff.renamedCategories[oldCatName] || oldCatName;
                            valMap[mappedName] = oldRowCatValues[cIdx] || "";
                        }

                        // finalCatCols 순서대로 값 채우기
                        const newRowCatValues = finalCatCols.map(cat => {
                            const existingVal = valMap[cat];
                            if (existingVal && existingVal.trim() !== "") {
                                return existingVal;
                            }
                            // 값이 비어있는 경우
                            if (activeSet.has(cat)) {
                                // 활성 루틴: 오늘 + 미래 날짜는 빈칸(" "), 과거 날짜는 "-"
                                return isTodayOrFuture ? " " : "-";
                            } else {
                                // 비활성 루틴: 빈 칸은 모두 "-"
                                return "-";
                            }
                        });

                        const newRowLine = `| ${dateVal} | ${newRowCatValues.join(" | ")} |`;
                        newTableLines.push(newRowLine);
                    }

                    lines.splice(tableStart, tableEnd - tableStart + 1, ...newTableLines);
                    idx = tableStart + newTableLines.length;
                } else {
                    idx = tableEnd + 1;
                }
            } else {
                idx = tableEnd + 1;
            }
        }

        return lines.join("\n");
    }
}
