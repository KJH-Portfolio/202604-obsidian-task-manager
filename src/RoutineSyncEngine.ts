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
                    { id: "step", name: "Step", items: ["Write", "Execute"] },
                    { id: "block", name: "Block", items: ["1", "2", "3", "4", "5", "6"] },
                    { id: "mental", name: "Mental", items: ["Read affirmation", "10 min meditation"] },
                    { id: "diet", name: "Diet", items: ["Breakfast", "Lunch", "Dinner"] },
                    { id: "exercise", name: "Exercise", items: ["Squat 60, Pushup 20"] },
                    { id: "sleep", name: "Sleep", items: ["Quiet time from 11"] },
                    { id: "detox", name: "Detox", items: ["1 time", "3 times", "5 times+"] }
                ]
            };
        }
        return {
            affirmation: "시작이 반 이다.",
            categories: [
                { id: "step", name: "Step", items: ["작성", "실행"] },
                { id: "block", name: "Block", items: ["1", "2", "3", "4", "5", "6"] },
                { id: "mental", name: "멘탈", items: ["확언 읽기", "10분 명상"] },
                { id: "diet", name: "식단", items: ["아침", "점심", "저녁"] },
                { id: "exercise", name: "운동", items: ["스쿼트 60, 팔굽 20"] },
                { id: "sleep", name: "취침", items: ["11시부터 정적 활동"] },
                { id: "detox", name: "디톡스", items: ["1회", "3회", "5회+"] }
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

                // 카테고리 헤더 (예: > ## ==멘탈== 또는 > ## 멘탈)
                const catMatch = l.match(/^>\s*##\s+(?:==)?(.*?)(?:==)?$/);
                if (catMatch) {
                    if (currentCat) {
                        categories.push(currentCat);
                    }
                    const catName = catMatch[1].trim();
                    currentCat = {
                        id: catName.toLowerCase().replace(/\s+/g, "-") + "_" + Math.random().toString(36).substring(2, 7),
                        name: catName,
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
     * RoutineStructure 데이터를 마크다운 Callout 텍스트로 생성
     * (기본 생성 시 하이라이트 == 없이 생성, 달성률 50% 미만 부족 항목만 TaskUtils가 하이라이트 적용)
     */
    static generateRoutineCalloutMarkdown(structure: RoutineStructure, lang: "en" | "ko" = "ko"): string {
        const affLabel = lang === "en" ? "Affirmation" : "확언";
        const lines: string[] = [];

        lines.push("> [!routine]");
        lines.push(`> ${affLabel} : ${structure.affirmation || ""}`);

        for (const cat of structure.categories) {
            lines.push(`> ## ${cat.name}`);
            for (const item of cat.items) {
                lines.push(`> - [ ] ${item}`);
            }
        }

        return lines.join("\n");
    }

    /**
     * 메인 스케줄 문서 텍스트 전체에서 루틴 Callout 및 체크리스트 테이블 컬럼 동기화
     */
    static syncRoutineToMarkdown(content: string, newStructure: RoutineStructure, diff: RoutineDiff, lang: "en" | "ko" = "ko"): string {
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

        const newCalloutStr = this.generateRoutineCalloutMarkdown(newStructure, lang);

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
        updatedContent = this.syncChecklistTableColumns(updatedContent, newStructure, diff);

        return updatedContent;
    }

    /**
     * 체크리스트 테이블의 컬럼 및 데이터 행(Data Rows) 무결성 재배열 (Align)
     * 1. 활성 루틴 컬럼을 앞쪽에 배치, 비활성(삭제) 루틴 컬럼은 가장 뒤로 이동
     * 2. 비활성 루틴의 빈 셀에는 '-' 표기
     * 3. 신규 활성 루틴의 과거 날짜 빈 셀에는 '-' 표기, 오늘/미래는 빈칸
     */
    static syncChecklistTableColumns(content: string, newStructure: RoutineStructure, diff: RoutineDiff): string {
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

                    // 4) 데이터 행(Data Rows) 컬럼 재배열 및 셀 채우기
                    const momentFn = (window as { moment?: () => { date: () => number } }).moment;
                    const nowDay = momentFn ? momentFn().date() : new Date().getDate();

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
