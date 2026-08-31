/* eslint-disable @typescript-eslint/no-unsafe-assignment -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-call -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-return -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Complex type casting needed for markdown AST */
import { DailyMeta } from "./types";
import { App, TFile, TFolder } from "obsidian";
import { DateManager } from "./DateManager";
import { FileManager } from "./FileManager";
import { PluginSettings } from "./settings";
import { t } from "./i18n";
import { REGEX, MARKER_PRI, EMOJI_MAP } from "./Constants";
export { REGEX, MARKER_PRI, EMOJI_MAP };


export interface TaskNode {
    line: string;
    indent: number;
    metadata: {
        isBlank: boolean;
        marker: string;
        date: string;
        statusGroup: number;
        effectiveMarker?: string;
        effectiveDate?: string;
    };
    children: TaskNode[];
    originalIdx?: number;
}

export class TaskUtils {
    app: App;
    settings: PluginSettings;
    dateManager: DateManager;
    fileManager: FileManager;


    constructor(app: App, settings: PluginSettings, dateManager: DateManager, fileManager: FileManager) {
        this.app = app;
        this.settings = settings;
        this.dateManager = dateManager;
        this.fileManager = fileManager;
    }

    private overlayEl: HTMLElement | null = null;
    private boundWindow: Window | null = null;
    private keydownHandler = (e: KeyboardEvent) => {
        e.stopPropagation();
        e.preventDefault();
    };

    showLoadingOverlay(message: string) {
        if (this.overlayEl) return;
        this.overlayEl = activeDocument.body.createDiv({ cls: "myworld-loading-overlay" });
        this.overlayEl.createDiv({ cls: "myworld-spinner" });
        this.overlayEl.createDiv({ text: message });

        this.boundWindow = activeDocument.defaultView || window;
        this.boundWindow.addEventListener("keydown", this.keydownHandler, { capture: true });
        this.boundWindow.addEventListener("keypress", this.keydownHandler, { capture: true });
        this.boundWindow.addEventListener("keyup", this.keydownHandler, { capture: true });
    }

    hideLoadingOverlay() {
        if (this.overlayEl) {
            this.overlayEl.remove();
            this.overlayEl = null;
        }
        if (this.boundWindow) {
            this.boundWindow.removeEventListener("keydown", this.keydownHandler, { capture: true });
            this.boundWindow.removeEventListener("keypress", this.keydownHandler, { capture: true });
            this.boundWindow.removeEventListener("keyup", this.keydownHandler, { capture: true });
            this.boundWindow = null;
        }
    }


    getRegex() { return REGEX; }
    getMarkerPri() { return MARKER_PRI; }
    getEmojiMap() { return EMOJI_MAP; }

    getAdjustedNow(): moment.Moment {
        return this.dateManager.getAdjustedNow();
    }

    preprocessContent(content: string): string {
        if (!content) return "";
        return content.replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n'); // 3줄 이상 빈 줄은 2줄로(즉 한 줄의 빈 줄) 치환
    }

    getCache(file: TFile): import("obsidian").CachedMetadata | null {
        return this.app.metadataCache.getFileCache(file);
    }

    hasSection(file: TFile, sectionName: string, level = 1): boolean {
        const cache = this.getCache(file);
        if (!cache || !cache.headings) return true;
        return cache.headings.some((h: import("obsidian").HeadingCache) => h.heading === sectionName && h.level === level);
    }

    getSectionRange(fileOrContent: TFile | string, sectionName: string, level = 1, fallbackLines: string[] | null = null): { start: number, end: number } | { startLine: number, endLine: number } | null {
        if (typeof fileOrContent === "string") {
            let escapedSectionName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Bilingual header support
            if (sectionName === "# 통계" || sectionName === "# Stats") escapedSectionName = "# (통계|Stats)";
            else if (sectionName === "# 체크리스트" || sectionName === "# Checklist") escapedSectionName = "# (체크리스트|Checklist)";
            else if (sectionName === "# 계획" || sectionName === "# Plan") escapedSectionName = "# (계획|Plan)";
            else if (sectionName === "# 실행" || sectionName === "# Execution") escapedSectionName = "# (실행|Execution)";
            else if (sectionName === "# 개요" || sectionName === "# Overview") escapedSectionName = "# (개요|Overview)";

            const safeRegex = new RegExp(`(^|\\n)${escapedSectionName}[ \\t]*(?=\\n|$)`, 'i');
            const sMatch = safeRegex.exec(fileOrContent);
            if (!sMatch) return null;

            const sIdx = sMatch.index + (sMatch[1] === '\n' ? 1 : 0);
            const hLevel = (sectionName.match(/^#+/) || ["#"])[0].length;
            const nextHRegex = new RegExp(`\\n(?!>)#{1,${hLevel}}\\s`, 'g');
            nextHRegex.lastIndex = sIdx + sectionName.length;
            const m = nextHRegex.exec(fileOrContent);
            const eIdx = m ? m.index : fileOrContent.length;

            return { start: sIdx, end: eIdx };
        }

        if (!(fileOrContent instanceof TFile)) return null;
        const file = fileOrContent;
        let useFallback = false;
        const cache = this.getCache(file);
        if (cache && cache.headings) {
            const hIdx = cache.headings.findIndex((h: import("obsidian").HeadingCache) => h.heading === sectionName && h.level === level);
            if (hIdx !== -1) {
                const startLine = cache.headings[hIdx].position.start.line;

                if (fallbackLines) {
                    const prefix = "#".repeat(level) + " " + sectionName;
                    if (!fallbackLines[startLine] || !fallbackLines[startLine].startsWith(prefix)) {
                        useFallback = true;
                    }
                }

                if (!useFallback) {
                    let endLine = -1;
                    for (let i = hIdx + 1; i < cache.headings.length; i++) {
                        if (cache.headings[i].level <= level) {
                            endLine = cache.headings[i].position.start.line;
                            break;
                        }
                    }
                    return { startLine, endLine };
                }
            }
        }

        // BUG-11: fallbackLines가 null인데 useFallback이 true인 경우 TypeError 방지
        if ((fallbackLines || useFallback) && fallbackLines !== null) {
            const prefix = "#".repeat(level) + " " + sectionName;
            let startLine = fallbackLines.findIndex(l => l.startsWith(prefix));
            if (startLine === -1) return null;
            let endLine = -1;
            const stopRegex = new RegExp(`^#{1,${level}}\\s`);
            for (let i = startLine + 1; i < fallbackLines.length; i++) {
                if (stopRegex.test(fallbackLines[i])) { endLine = i; break; }
            }
            return { startLine, endLine };
        }
        return null;
    }

    getMonthlyArchivePath(dateMoment: moment.Moment) {
        const root = this.settings.archiveDirectory;
        const yyyy = dateMoment.format("YYYY");
        const quarter = `Q${dateMoment.quarter()}`;
        const mm = dateMoment.format("MM");
        const yyyy_mm = dateMoment.format("YYYY-MM");

        return {
            folder: `${root}/${yyyy}/${quarter}/${mm}`,
            path: `${root}/${yyyy}/${quarter}/${mm}/${yyyy_mm}.md`,
            fileName: `${yyyy_mm}.md`
        };
    }

    getWeeklyArchivePath(dateMoment: moment.Moment) {
        const root = this.settings.archiveDirectory;
        const gggg = dateMoment.format("gggg");
        const weekStr = dateMoment.format("gggg-[W]ww");
        return {
            folder: `${root}/${gggg}/Weekly`,
            path: `${root}/${gggg}/Weekly/${weekStr}.md`,
            fileName: `${weekStr}.md`
        };
    }

    private issuedIds: Set<string> = new Set();

    generateBlockId(filesToCheck: TFile[] = []): string {
        let id: string;
        let isDuplicate: boolean;
        // BUG-16: 무한 루프 방지를 위한 최대 시도 횟수 제한
        let maxAttempts = 100;
        do {
            id = Math.random().toString(36).substring(2, 8).padEnd(6, '0');
            isDuplicate = false;
            for (const file of filesToCheck) {
                const cache = this.getCache(file);
                if (cache && cache.blocks && cache.blocks[id]) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate && this.issuedIds.has(id)) {
                isDuplicate = true;
            }
            maxAttempts--;
        } while (isDuplicate && maxAttempts > 0);

        // 100회 시도해도 중복이면 경고 로그 (실제 발생 확률 극히 낮음)
        if (isDuplicate) {
            console.warn('[generateBlockId] 100회 시도에도 고유 ID 생성 실패, 중복 가능성 있음:', id);
        }

        // issuedIds 크기 제한: 1000개 초과 시 가장 오래된 것 삭제
        if (this.issuedIds.size >= 1000) {
            const firstKey = this.issuedIds.values().next().value;
            if (firstKey !== undefined) this.issuedIds.delete(firstKey);
        }
        this.issuedIds.add(id);
        return id;
    }

    extractIdAndText(rawText: string): { text: string, id: string | null } {
        if (!rawText) return { text: "", id: null };
        const m = rawText.match(REGEX.EXTRACT_ID);
        if (!m) return { text: rawText, id: null };
        const text = m[1].trim();
        return { text, id: m[2] || null };
    }

    replaceSection(content: string, headerName: string, newBody: string): string {
        const range = this.getSectionRange(content, headerName) as { start: number, end: number };
        if (!range) {
            // BUG FIX: 필수 섹션 누락 시 데이터 증발을 막기 위해 맨 밑에 강제 복구
            return content.trimEnd() + "\n\n" + headerName + "\n" + newBody.trimEnd() + "\n";
        }
        return content.substring(0, range.start) + headerName + "\n" + newBody.trimEnd() + "\n\n" + content.substring(range.end).trimStart();
    }


    getMarker(dateStr: string, today: Date): string {
        if (!dateStr) return "";
        const match = dateStr.match(REGEX.DATE_LABEL);
        if (!match) return "";
        const cleanDateStr = match[0].replace('📅', '').trim();
        const momentFn = (window as { moment?: (d?: string | Date) => moment.Moment }).moment;
        if (momentFn) {
            const targetM = momentFn(cleanDateStr).startOf('day');
            const todayM = momentFn(today).startOf('day');
            const diffDays = targetM.diff(todayM, 'days');
            if (diffDays < 0) return "[!] ";
            return "[D] ";
        }
        const parts = cleanDateStr.split('-');
        const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diff = Math.floor((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) return "[!] ";
        return "[D] ";
    }

    applyMarkersToLines(linesArray: string[], todayObj: Date): string[] {
        if (!linesArray || !Array.isArray(linesArray)) return [];
        const markerCache: Record<string, string> = {};

        const lineInfos = linesArray.map((l) => {
            const ind = l.trim() === "" ? 999 : (l.match(REGEX.INDENT) || [""])[0].length;
            if (!REGEX.MATCH_TASK.test(l)) return { line: l, ind, isTask: false, isCompleted: false, m: '', hasDate: false, ownM: '' };
            const isCompleted = REGEX.MATCH_TASK_COMPLETED.test(l);
            const dM = l.match(REGEX.DATE_LABEL);
            let m = '';
            if (!isCompleted && dM) {
                if (!markerCache[dM[0]]) markerCache[dM[0]] = this.getMarker(dM[0], todayObj);
                m = markerCache[dM[0]];
            }
            return { line: l, ind, isTask: true, isCompleted, m, ownM: m, hasDate: !!dM };
        });

        // Downward 날짜 마커 전파
        for (let i = 0; i < lineInfos.length; i++) {
            if (lineInfos[i].isTask && !lineInfos[i].isCompleted && lineInfos[i].hasDate) {
                const sourceM = lineInfos[i].ownM;
                for (let j = i + 1; j < lineInfos.length; j++) {
                    if (lineInfos[j].ind <= lineInfos[i].ind) break;
                    if (lineInfos[j].isTask && !lineInfos[j].isCompleted) {
                        const pSource = MARKER_PRI[sourceM.trim()] || 99;
                        const pChild = MARKER_PRI[lineInfos[j].m.trim()] || 99;
                        if (pSource < pChild) lineInfos[j].m = sourceM;
                    }
                }
            }
        }

        return lineInfos.map((d) => {
            if (!d.isTask) return d.line;
            let l = d.line;

            let status = (d.line.match(REGEX.STATUS_MATCH) || ["", " "])[1];
            if (!d.isCompleted) {
                // 미완료 태스크의 체크박스 상태는 언제나 표준 공백(" ") 유지
                status = " ";
            }

            l = l.replace(/^(\s*(?:>\s*)*[-*+]\s+)\[[^\]]*\]/, `$1[${status}]`);
            return l;
        });
    }

    filterResetTasks(lines: string[], isReset: boolean): string[] {
        if (!isReset) return lines;
        let filtered: string[] = [], skipIndent = -1;
        for (const l of lines) {
            let isBlank = l.trim() === "";
            let actualIndent = (l.match(REGEX.INDENT) || [""])[0].length;
            let currentIndent = isBlank ? 999 : actualIndent;

            if (skipIndent !== -1) {
                // BUG-15: 완료된 태스크 블록 내부의 빈 줄은 소실됨 (의도적 동작 - 완료 항목 제거 시 시각적 공백 방지)
                if (isBlank) continue;
                if (currentIndent > skipIndent) continue;
                else skipIndent = -1;
            }

            if (REGEX.MATCH_TASK.test(l)) {
                if (REGEX.MATCH_TASK_COMPLETED.test(l)) {
                    skipIndent = currentIndent;
                    continue;
                }
                filtered.push(l);
            } else {
                filtered.push(l);
            }
        }

        let finalFiltered: string[] = [];
        for (let i = 0; i < filtered.length; i++) {
            const cur = filtered[i];
            if (/^##\s/.test(cur.trim())) {
                let hasContent = false;
                for (let j = i + 1; j < filtered.length; j++) {
                    const next = filtered[j];
                    if (/^##\s/.test(next.trim()) || REGEX.TOP_HEADING_START.test(next)) break;
                    if (next.trim() !== "") { hasContent = true; break; }
                }
                if (hasContent) finalFiltered.push(cur);
            } else {
                finalFiltered.push(cur);
            }
        }
        return finalFiltered;
    }

    parseTasksToTree(lines: string[]): TaskNode[] {
        const nodes: TaskNode[] = [];
        const stack: { indent: number, children: TaskNode[] }[] = [{ indent: -1, children: nodes }];

        lines.forEach(line => {
            const isBlank = line.trim() === "";
            const indent = isBlank ? 999 : (line.match(REGEX.INDENT) || [""])[0].length;
            const dMatch = line.match(REGEX.DATE_LABEL);
            const s = (line.match(REGEX.STATUS_MATCH) || ["", " "])[1];

            const metadata = {
                isBlank,
                marker: s,
                date: dMatch ? dMatch[0].replace('📅', '').trim() : "9999-99-99",
                statusGroup: (s === ">" || s === "/") ? 0 : (s === " " ? 1 : 2)
            };

            const node: TaskNode = { line, indent, metadata, children: [] };
            while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
            stack[stack.length - 1].children.push(node);
            stack.push(node);
        });
        return nodes;
    }

    calculateEffectivePriority(node: TaskNode): { marker: string, date: string } {
        let bestMarker = node.metadata.marker;
        let bestDate = node.metadata.date;
        let bestPri = MARKER_PRI[bestMarker.trim()] || 99;

        for (const child of node.children) {
            const childEff = this.calculateEffectivePriority(child);
            const childPri = MARKER_PRI[childEff.marker.trim()] || 99;

            if (childPri < bestPri) {
                bestPri = childPri;
                bestMarker = childEff.marker;
                bestDate = childEff.date;
            } else if (childPri === bestPri) {
                if (childEff.date.localeCompare(bestDate) < 0) {
                    bestDate = childEff.date;
                }
            }
        }

        node.metadata.effectiveMarker = bestMarker;
        node.metadata.effectiveDate = bestDate;

        return { marker: bestMarker, date: bestDate };
    }

    sortTaskTree(nodes: TaskNode[], shouldSort = true) {
        if (!shouldSort) return;

        nodes.forEach((n, i) => n.originalIdx = i);
        nodes.sort((a, b) => {
            if (a.metadata.isBlank && !b.metadata.isBlank) return 1;
            if (!a.metadata.isBlank && b.metadata.isBlank) return -1;
            if (a.metadata.isBlank && b.metadata.isBlank) return (a.originalIdx || 0) - (b.originalIdx || 0);

            const ma = a.metadata, mb = b.metadata;
            const pa = MARKER_PRI[ma.effectiveMarker?.trim() || ma.marker.trim()] || 99;
            const pb = MARKER_PRI[mb.effectiveMarker?.trim() || mb.marker.trim()] || 99;
            if (pa !== pb) return pa - pb;
            return (ma.effectiveDate || ma.date).localeCompare(mb.effectiveDate || mb.date);
        });
        nodes.forEach(n => { if (n.children.length > 0) this.sortTaskTree(n.children, shouldSort); });
    }

    flattenTreeToMarkdown(nodes: TaskNode[]): string[] {
        return nodes.flatMap(n => [n.line, ...this.flattenTreeToMarkdown(n.children)]);
    }

    processSectionLogic(cContent: string, hName: string, todayObj: Date, isReset = false, shouldSort = true, options: Record<string, unknown> = {}): string {
        const escapedHName = hName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const safeRegex = new RegExp(`(^|\\n)${escapedHName}[ \\t]*(?=\\n|$)`);
        const sMatch = safeRegex.exec(cContent);
        if (!sMatch) return cContent;
        const sIdx = sMatch.index + (sMatch[1] === '\n' ? 1 : 0);
        const hLevel = (hName.match(/^#+/) || ["#"])[0].length;
        const nextHRegex = new RegExp(`\\n(?!>)#{1,${hLevel}}\\s`, 'g');
        nextHRegex.lastIndex = sIdx + hName.length;
        const m = nextHRegex.exec(cContent);
        const nIdx = m ? m.index : cContent.length;
        const sectionLines = cContent.substring(sIdx, nIdx).split('\n');
        const mainHeader = sectionLines.shift();

        let subSections: { header: string | null, content: string[] }[] = [], currentSub: { header: string | null, content: string[] } = { header: null, content: [] };
        for (let l of sectionLines) {
            if (/^##\s/.test(l)) {
                if (currentSub.header || currentSub.content.length > 0) subSections.push(currentSub);
                currentSub = { header: l, content: [] };
            } else currentSub.content.push(l);
        }
        subSections.push(currentSub);

        const processed = subSections.map(sub => {
            if (options.excludeSubSections && sub.header && (options.excludeSubSections as string[]).some((ex: string) => sub.header!.includes(ex))) {
                return (sub.header ? [sub.header, ...sub.content] : sub.content).join('\n');
            }

            let chunks: { isTask: boolean, lines: string[] }[] = [], currentChunk: { isTask: boolean, lines: string[] } = { isTask: false, lines: [] };
            let currentRootIndent = 0;
            for (let l of sub.content) {
                let isT = REGEX.MATCH_TASK.test(l);
                let ind = l.trim() === "" ? 999 : (l.match(REGEX.INDENT) || [""])[0].length;

                if (isT) {
                    if (!currentChunk.isTask) {
                        if (currentChunk.lines.length > 0) chunks.push(currentChunk);
                        currentChunk = { isTask: true, lines: [l] };
                        currentRootIndent = ind;
                    } else {
                        if (ind <= currentRootIndent) currentRootIndent = ind;
                        currentChunk.lines.push(l);
                    }
                } else {
                    if (currentChunk.isTask && ind > currentRootIndent) {
                        currentChunk.lines.push(l);
                    } else {
                        if (currentChunk.isTask) {
                            chunks.push(currentChunk);
                            currentChunk = { isTask: false, lines: [l] };
                        } else {
                            currentChunk.lines.push(l);
                        }
                    }
                }
            }
            if (currentChunk.lines.length > 0) chunks.push(currentChunk);

            let processedLines = chunks.flatMap(chunk => {
                if (!chunk.isTask) return chunk.lines;

                let finalTasks = this.filterResetTasks(chunk.lines, isReset);
                finalTasks = this.applyMarkersToLines(finalTasks, todayObj);

                const tree = this.parseTasksToTree(finalTasks);
                if (shouldSort) {
                    tree.forEach(n => this.calculateEffectivePriority(n));
                }
                this.sortTaskTree(tree, shouldSort);
                return this.flattenTreeToMarkdown(tree);
            });

            return (sub.header ? [sub.header, ...processedLines] : processedLines).filter(l => l !== undefined).join('\n');
        });

        const cleanedProcessed = processed.join('\n').trim();
        const nextPart = cContent.substring(nIdx).replace(/^\r?\n+/, "");
        return cContent.substring(0, sIdx) + mainHeader + "\n" + (cleanedProcessed ? cleanedProcessed + "\n" : "") + nextPart;
    }

    parseTableStats(linesStrs: string[], headers: string) {
        let sq: Record<string, number> = { "🟦": 0, "🟩": 0, "🟨": 0, "🟥": 0 };
        if (!headers || !linesStrs || linesStrs.length === 0) return { sq, cs: {} as Record<string, Record<string, number>>, tableHeaders: [] as string[] };

        // 파이프 양 끝의 빈 요소를 제거하여 순수 컬럼 배열 획득 [0: "날짜", 1: "Step", 2: "Block", ...]
        const cleanHeaders = headers.split("|").map(s => s.trim()).filter(s => s !== "");
        let cs: Record<string, Record<string, number>> = {};

        linesStrs.forEach(l => {
            const cleanCols = l.split("|").map(s => s.trim()).filter(s => s !== "");
            if (cleanCols.length > 1) {
                // 0번(날짜) 이후의 루틴 컬럼 순회
                for (let c = 1; c < cleanCols.length; c++) {
                    const v = cleanCols[c];
                    if (!v || v === "-") continue;
                    const emoji = EMOJI_MAP[v] || v;
                    const hw = cleanHeaders[c];

                    if (hw && hw !== "" && hw !== "날짜" && hw !== "Date") {
                        if (!cs[hw]) cs[hw] = { "🟦": 0, "🟩": 0, "🟨": 0, "🟥": 0 };
                        if (Object.prototype.hasOwnProperty.call(cs[hw], emoji)) cs[hw][emoji]++;
                    }
                    if (Object.prototype.hasOwnProperty.call(sq, emoji)) sq[emoji]++;
                }
            }
        });
        return { sq, cs, tableHeaders: cleanHeaders };
    }

    renderStatsDashboard(sq: Record<string, number>, cs: Record<string, Record<string, number>>, title = "", type = "info"): string {
        title = title || t("stats_title", this.settings.language);
        const tSq = Object.values(sq).reduce((a, b) => a + b, 0);
        if (tSq === 0) return `> [!warning] ${title}: ${t("no_data", this.settings.language)}\n`;

        const EC: Record<string, string> = { "🟦": "#3b82f6", "🟩": "#10b981", "🟨": "#f59e0b", "🟥": "#ef4444" };

        let res = `> [!${type}]+ 📈 **${title}**\n`;
        res += `> \n`;

        const GRID = '<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; background: linear-gradient(to right, transparent calc(50% - 1px), rgba(0,0,0,0.7) calc(50% - 1px), rgba(0,0,0,0.7) calc(50% + 1px), transparent calc(50% + 1px));"></div>';

        const colors = ["🟦", "🟩", "🟨", "🟥"];
        let bars = "", legends: string[] = [];
        colors.forEach(c => {
            let count = sq[c] || 0;
            if (count > 0) {
                let pct = (count / tSq * 100).toFixed(1);
                bars += `<div style="width: ${pct}%; background-color: ${EC[c]};" title="${c} ${count}회 (${pct}%)"></div>`;
                legends.push(`<span style="color: ${EC[c]}; margin-right: 8px;">${c} ${pct}% (${count})</span>`);
            }
        });
        const summaryBar = `<div style="position: relative; width: 100%; height: 14px; border-radius: 7px; overflow: hidden; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.2); background-color: var(--background-modifier-hover);"><div style="display: flex; width: 100%; height: 100%;">${bars}</div>${GRID}</div>`;
        const legendRow = `<div style="font-size: 0.85em; font-weight: 600;">${legends.join("")}</div>`;
        res += `> <div style="padding: 12px; background: var(--background-secondary); border-radius: 8px; border: 1px solid var(--background-modifier-border); margin: 0 0 8px 0;">${summaryBar}${legendRow}</div>\n`;
        res += `> \n`;

        const thItem = t("table_header_item", this.settings.language);
        const thChart = t("table_header_chart", this.settings.language);
        const TH = `<tr style="border-bottom: 2px solid var(--background-modifier-border);"><th style="padding: 6px 10px; text-align: left; width: 30%;">${thItem}</th><th style="padding: 6px 10px; width: 70%; text-align: left;">${thChart}</th></tr>`;
        let rows = "";

        for (let [name, counts] of Object.entries(cs)) {
            const dc = ["🟦", "🟩", "🟨", "🟥"];
            const total = dc.reduce((s, c) => s + (counts[c] || 0), 0);
            if (total > 0) {
                let innerBars = "";
                dc.forEach(c => {
                    let cnt = counts[c] || 0;
                    if (cnt > 0) {
                        let p = (cnt / total * 100).toFixed(1);
                        innerBars += `<div style="width: ${p}%; background: ${EC[c]};" title="${c} ${cnt}회"></div>`;
                    }
                });
                const goodCount = (counts["🟦"] || 0) + (counts["🟩"] || 0);
                const isBelowGoal = (goodCount / total) < 0.5;
                const displayName = isBelowGoal ? `${name} ⚠️` : name;

                const bar = `<div style="position: relative; width: 100%; background: var(--background-modifier-hover); height: 7px; border-radius: 4px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);"><div style="display: flex; width: 100%; height: 100%;">${innerBars}</div>${GRID}</div>`;
                rows += `<tr style="border-bottom: 1px solid var(--background-modifier-border-hover);"><td style="padding: 6px 10px; text-align: left; font-weight: bold;">${displayName}</td><td style="padding: 6px 15px 6px 0; vertical-align: middle;">${bar}</td></tr>`;
            }
        }
        res += `> <table style="width: 100%; border-collapse: collapse; margin: 0; font-size: 0.9em;"><thead style="background-color: var(--background-secondary);">${TH}</thead><tbody>${rows}</tbody></table>\n`;
        return res;
    }

    convertTableMarkers(tableContent: string): string {
        if (!tableContent) return "";
        let lines = tableContent.trim().split("\n");
        let headers: string[] = [];

        return lines.map(line => {
            if (!line.includes("|") || line.startsWith("#")) return line;

            let parts = line.split("|");
            if (line.includes("---")) {
                return line;
            }

            if (headers.length === 0) {
                headers = parts.map(h => h.trim());
                return line;
            }

            if (parts.length <= 2) return line;

            const firstCol = parts[1].trim();
            if (firstCol === "상태" || firstCol === "Status" || Object.values(EMOJI_MAP).includes(firstCol)) return line;

            for (let i = 2; i < parts.length; i++) {
                let colHeader = headers[i] || "";
                if (/(횟수|비율|점수|%|Count|Ratio)/i.test(colHeader)) continue;

                let colText = parts[i];
                parts[i] = colText.replace(/^\s*([1-4])\s*$/, (match, p1) => {
                    return EMOJI_MAP[p1] ? match.replace(p1, EMOJI_MAP[p1]) : match;
                });
            }
            return parts.join("|");
        }).join("\n");
    }


    generateStatsDashboard(tableStr: string, title: string, type = "info"): string {
        if (!tableStr) return "";
        let tLines = tableStr.trim().split("\n").filter(l => l.includes("|"));
        if (tLines.length < 2) return "";

        let dataLines = tLines.filter(l => {
            let cols = l.split("|");
            return cols.length > 2 && !isNaN(parseInt(cols[1]));
        });

        const { sq, cs } = this.parseTableStats(dataLines, tLines[0]);
        return this.renderStatsDashboard(sq, cs, title, type);
    }


    async ensureFolder(path: string): Promise<void> {
        if (!path) return;
        const parts = path.split('/');
        let current = '';
        for (const p of parts) {
            if (!p) continue;
            current = current === '' ? p : `${current}/${p}`;
            if (!this.app.vault.getAbstractFileByPath(current)) {
                try {
                    await this.app.vault.createFolder(current);
                } catch { /* ignore */ }
            }
        }
    }


    filterTableByDayRange(tableLines: string[], startDay: number, endDay: number): string[] {
        if (!tableLines || tableLines.length === 0) return [];
        return tableLines.filter(l => {
            let cols = l.split("|");
            if (cols.length > 2) {
                let d = parseInt(cols[1]);
                return !isNaN(d) && d >= startDay && d <= endDay;
            }
            return false;
        });
    }

    generateSegmentedDashboards(tableHeader: string, dataRows: string[]): string {
        const seg1Lines = this.filterTableByDayRange(dataRows, 1, 10);
        const dash1 = `## ${t("segment_1", this.settings.language)}\n` + (seg1Lines.length > 0 ? this.generateStatsDashboard(tableHeader + "\n" + seg1Lines.join("\n"), t("segment_1", this.settings.language), "info") : t("msg_no_data", this.settings.language, { num: 1 }) + "\n");

        const seg2Lines = this.filterTableByDayRange(dataRows, 11, 20);
        const dash2 = `## ${t("segment_2", this.settings.language)}\n` + (seg2Lines.length > 0 ? this.generateStatsDashboard(tableHeader + "\n" + seg2Lines.join("\n"), t("segment_2", this.settings.language), "info") : t("msg_no_data", this.settings.language, { num: 2 }) + "\n");

        const seg3Lines = this.filterTableByDayRange(dataRows, 21, 31);
        const dash3 = `## ${t("segment_3", this.settings.language)}\n` + (seg3Lines.length > 0 ? this.generateStatsDashboard(tableHeader + "\n" + seg3Lines.join("\n"), t("segment_3", this.settings.language), "info") : t("msg_no_data", this.settings.language, { num: 3 }) + "\n");

        const dashTotal = `## ${t("monthly_total", this.settings.language)}\n` + this.generateStatsDashboard(tableHeader + "\n" + dataRows.join("\n"), t("monthly_total", this.settings.language), "info");

        return `${dash1}\n\n${dash2}\n\n${dash3}\n\n${dashTotal}`;
    }

    getDeficientItems(tableHeader: string, dataRows: string[]): Set<string> {
        let deficientItems = new Set<string>();
        if (!tableHeader || !dataRows || dataRows.length === 0) return deficientItems;
        const { cs } = this.parseTableStats(dataRows, tableHeader);
        for (let [name, counts] of Object.entries(cs)) {
            const dc = ["🟦", "🟩", "🟨", "🟥"];
            const total = dc.reduce((s, c) => s + (counts[c] || 0), 0);
            if (total > 0) {
                const goodCount = (counts["🟦"] || 0) + (counts["🟩"] || 0);
                if ((goodCount / total) < 0.5) deficientItems.add(name);
            }
        }
        return deficientItems;
    }

    updateRoutineSectionBold(content: string, deficientItems: Set<string>): string {
        if (!content) return content;
        let lines = content.split('\n');
        let inRoutine = false, routineType = "";

        for (let i = 0; i < lines.length; i++) {
            let l = lines[i];
            if (/^>\s*\[!routine\]/i.test(l)) { inRoutine = true; routineType = "callout"; }
            else if (/^#+\s*(루틴|Routine)/i.test(l)) { inRoutine = true; routineType = "header"; }
            else if (inRoutine) {
                if (routineType === "header" && l.startsWith('#') && !/^#+\s*(루틴|Routine)/i.test(l)) inRoutine = false;
                else if (routineType === "callout" && !l.startsWith('>') && l.trim() !== '') inRoutine = false;
            }

            let m = l.match(/^((?:>\s*)*)##\s+(.*)$/);
            if (inRoutine && m) {
                let prefix = m[1] + "## ";
                let rawText = m[2].trim();

                // aria-label 또는 title 툴팁 속성 추출
                let desc = "";
                const descMatch = rawText.match(/(?:aria-label|title)="([^"]+)"/i);
                if (descMatch) {
                    desc = descMatch[1].trim();
                }

                // 순수 카테고리 이름 추출
                let pureCatName = rawText
                    .replace(/<[^>]+>/g, '')
                    .replace(/[*=]+/g, '')
                    .trim();

                const isDeficient = deficientItems.has(pureCatName);

                if (desc) {
                    const safeDesc = desc.replace(/"/g, '&quot;');
                    if (isDeficient) {
                        l = prefix + `<span aria-label="${safeDesc}" class="routine-deficient-name">${pureCatName}</span>`;
                    } else {
                        l = prefix + `<span aria-label="${safeDesc}">${pureCatName}</span>`;
                    }
                } else {
                    if (isDeficient) {
                        l = prefix + `<span class="routine-deficient-name">${pureCatName}</span>`;
                    } else {
                        l = prefix + pureCatName;
                    }
                }
                lines[i] = l;
            }
        }
        return lines.join('\n');
    }

    getChecklistTable(content: string): string {
        const chkRange = this.getSectionRange(content, t("header_checklist", this.settings.language)) as { start: number, end: number };
        if (!chkRange) return "";

        const tableLines = [];
        const lines = content.substring(chkRange.start, chkRange.end).split('\n');
        for (let line of lines) {
            if (line.trim().startsWith("|")) tableLines.push(line);
            else if (tableLines.length > 0 && line.trim() !== "" && !line.trim().startsWith('#')) break;
        }
        return tableLines.join('\n');
    }

    formatChecklistTable(content: string): string {
        const chkRange = this.getSectionRange(content, t("header_checklist", this.settings.language)) as { start: number, end: number };
        if (!chkRange) return content;

        const chkSection = content.substring(chkRange.start, chkRange.end);
        let lines = chkSection.split('\n');
        let tableStartIndex = -1;
        let tableEndIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith("|")) {
                if (tableStartIndex === -1) tableStartIndex = i;
                tableEndIndex = i;
            } else if (tableStartIndex !== -1 && lines[i].trim() !== "" && !lines[i].trim().startsWith('#')) {
                break;
            }
        }

        if (tableStartIndex === -1) return content;

        let tableLines = lines.slice(tableStartIndex, tableEndIndex + 1);
        if (tableLines.length < 3) return content; // Header, Separator, and at least 1 data row

        let header = tableLines[0];
        let separator = tableLines[1];
        let dataRows = tableLines.slice(2);

        // 데이터가 없는 컬럼 자동 삭제 (루틴에서 제거된 항목 정리)
        // 단, 헤더에 있는 모든 컬럼 중 적어도 날짜 외 1개 이상은 유지
        const headerCols = header.split('|').map(s => s.trim()).filter(s => s !== '');
        const keepIndices: number[] = [];
        headerCols.forEach((_, i) => {
            if (i === 0) { keepIndices.push(i); return; } // 날짜 컬럼 항상 유지
            const hasData = dataRows.some(row => {
                const rawCols = row.split('|');
                const val = (rawCols[i + 1] || '').trim();
                return val !== '' && val !== '-';
            });
            // 데이터가 있거나 헤더 컬럼수가 적은 경우 보존
            if (hasData || headerCols.length <= 2) keepIndices.push(i);
        });

        // 만약 모든 데이터 컬럼이 비어있어 keepIndices가 [0]만 남은 경우, 헤더의 모든 컬럼을 강제 유지 (표 파괴 방지)
        if (keepIndices.length === 1 && headerCols.length > 1) {
            headerCols.forEach((_, i) => {
                if (i !== 0) keepIndices.push(i);
            });
        }

        if (keepIndices.length < headerCols.length) {
            const keptCols = keepIndices.map(i => headerCols[i]);
            header = `| ${keptCols.join(' | ')} |`;
            separator = `| :-: | ${keptCols.slice(1).map(() => ':--:').join(' | ')} |`;
            dataRows = dataRows.map(row => {
                const rawCols = row.split('|');
                const keptVals = keepIndices.map(i => (rawCols[i + 1] || '').trim());
                return `| ${keptVals.join(' | ')} |`;
            });
        }

        let newTableContent = [header, separator, ...dataRows].join('\n');
        newTableContent = this.convertTableMarkers(newTableContent);

        lines.splice(tableStartIndex, tableLines.length, newTableContent);

        return content.substring(0, chkRange.start) + lines.join('\n') + content.substring(chkRange.end);
    }

    parseProjectTimeline(content: string): { startDate: string | null, endDate: string | null } {
        const timelineMatch = content.match(/^-\s*기한\s*:\s*(.*)$/m);
        if (!timelineMatch) return { startDate: null, endDate: null };

        const timelineText = timelineMatch[1].trim();
        const dates = timelineText.match(/\d{4}-\d{2}-\d{2}/g);

        if (!dates || dates.length === 0) {
            return { startDate: null, endDate: null };
        }

        return {
            startDate: dates[0],
            endDate: dates.length > 1 ? dates[1] : null
        };
    }

    extractDailyMetadata(content: string): DailyMeta {
        let step = "미작성", review = "미작성";
        if (!content) return { step, review };

        const lines = content.split("\n");
        let capturingReview = false;
        const reviewLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 1. Step 추출
            if (step === "미작성") {
                const stepMatch = line.match(/^(?:>|\s*[-*+]|\s*)*.*?(?:[Ss]tep|도전)\s*:\s*(.*)$/i);
                if (stepMatch && stepMatch[1].trim()) {
                    step = stepMatch[1].trim();
                }
            }

            // 2. 회고 추출 (멀티라인 지원)
            if (!capturingReview) {
                const reviewMatch = line.match(/^(?:>|\s*[-*+]|\s*)*.*?(?:회고|Review)\s*:\s*(.*)$/i);
                if (reviewMatch) {
                    capturingReview = true;
                    if (reviewMatch[1].trim()) {
                        reviewLines.push(reviewMatch[1].trim());
                    }
                }
            } else {
                // 회고 종료 조건: 다음 헤더(#), 다른 메타데이터 콜아웃(>[!quote]), 체크박스, 구분선 등
                if (/^(?:#|> ?\[!|[-*+]\s+\[|---|___)/.test(line.trim()) || (line.trim() === "" && i + 1 < lines.length && /^[#>|-]/.test(lines[i+1].trim()))) {
                    capturingReview = false;
                } else if (line.trim() !== "") {
                    const cleanLine = line.replace(/^>\s*/, "").trim();
                    if (cleanLine) reviewLines.push(cleanLine);
                }
            }
        }

        if (reviewLines.length > 0) {
            review = reviewLines.join("\n");
        }

        return { step, review };
    }



    isScheduleFile(fileOrPath: TFile | string | null): boolean {
        if (!fileOrPath) return false;
        const p = (typeof fileOrPath === "string" ? fileOrPath : fileOrPath.path).replace(/\\/g, "/");
        const schedulePath = (this.settings.mainSchedulePath || "").replace(/\\/g, "/");
        return p === schedulePath;
    }

    isProjectFile(fileOrPath: TFile | string | null): boolean {
        if (!fileOrPath) return false;
        const p = (typeof fileOrPath === "string" ? fileOrPath : fileOrPath.path).replace(/\\/g, "/");
        const projectDir = (this.settings.projectDirectory || "").replace(/\\/g, "/");
        const dirPrefix = projectDir.endsWith("/") ? projectDir : projectDir + "/";
        return p.startsWith(dirPrefix) && !this.isScheduleFile(p);
    }

    getProjectFiles(): TFile[] {
        const dir = this.settings.projectDirectory;
        const folder = this.app.vault.getAbstractFileByPath(dir);
        const files: TFile[] = [];
        const schedulePath = (this.settings.mainSchedulePath || "").replace(/\\/g, "/");

        const traverse = (f: TFolder) => {
            if (!f.children) return;
            for (const child of f.children) {
                if (child instanceof TFile && child.extension === "md") {
                    const childPath = child.path.replace(/\\/g, "/");
                    if (childPath !== schedulePath) {
                        files.push(child);
                    }
                } else if (child instanceof TFolder) {
                    traverse(child);
                }
            }
        };

        if (folder instanceof TFolder) {
            traverse(folder);
        }

        return files;
    }



    // 2. [포팅] 주간 아카이브 요약 표 및 기록 갱신
    async updateWeeklyNoteStats(app: App, targetDate: moment.Moment, tableHeader: string, weekRows: string[], dailyRecord = ""): Promise<void> {
        const weeklyInfo = this.getWeeklyArchivePath(targetDate);
        await this.ensureFolder(weeklyInfo.folder);
        let wFile = app.vault.getAbstractFileByPath(weeklyInfo.path);

        const start = targetDate.clone().startOf('week');
        const end = targetDate.clone().endOf('week');
        const weekDaysMap: Record<string, boolean> = {};
        let curr = start.clone();
        while (curr.isSameOrBefore(end, 'day')) {
            weekDaysMap[curr.date().toString()] = true;
            curr.add(1, 'day');
        }

        // 출처(archive/new)를 태깅하여 두 종류 행 구분
        let existingRowsMap: Record<string, { row: string; source: 'archive' | 'new' }> = {};
        let wContent = "";

        // 기존 아카이브 헤더 컬럼 저장 (이름 기반 매핑에 사용)
        let existingArchiveCols: string[] = [];

        if (wFile && wFile instanceof TFile) {
            wContent = await this.fileManager.getActiveViewOrFileText(wFile);
            const chkRange = this.getSectionRange(wContent, t("header_checklist", this.settings.language)) as { start: number, end: number };
            if (chkRange) {
                const chkSection = wContent.substring(chkRange.start, chkRange.end);
                const lines = chkSection.split('\n');

                // 기존 아카이브 헤더 추출
                const archiveHeaderLine = lines.find(l =>
                    l.trim().startsWith('|') && !l.includes('---') &&
                    (l.includes('날짜') || l.includes('Date'))
                );
                if (archiveHeaderLine) {
                    existingArchiveCols = archiveHeaderLine
                        .replace(/^\||\|$/g, '').split('|')
                        .map(s => s.trim()).filter(s => s !== '');
                }

                lines.forEach(l => {
                    if (l.trim().startsWith("|")) {
                        const cols = l.split("|");
                        if (cols.length > 2) {
                            const d = cols[1].trim();
                            if (!isNaN(parseInt(d)) && weekDaysMap[d]) {
                                existingRowsMap[d] = { row: l, source: 'archive' };
                            }
                        }
                    }
                });
            }
        }

        if (weekRows && weekRows.length > 0) {
            weekRows.forEach(row => {
                const cols = row.split("|");
                if (cols.length > 2) {
                    const d = cols[1].trim();
                    if (!isNaN(parseInt(d)) && weekDaysMap[d]) {
                        existingRowsMap[d] = { row: row, source: 'new' };
                    }
                }
            });
        }

        // 현재 스케줄 헤더 컬럼
        const currentScheduleCols = tableHeader.split("|").map(c => c.trim()).filter(c => c !== "");

        // 합집합 헤더: 기존 아카이브 컬럼 우선, 신규 스케줄 전용 컬럼 추가
        const seenCols = new Set<string>();
        const mergedCols: string[] = [];
        const baseCols = existingArchiveCols.length > 0 ? existingArchiveCols : currentScheduleCols;
        for (const col of [...baseCols, ...currentScheduleCols]) {
            if (!seenCols.has(col)) { mergedCols.push(col); seenCols.add(col); }
        }

        const rawFinalWeekRows: { dateVal: string; rowValMap: Record<string, string> }[] = [];
        let sortCurr = start.clone();
        while (sortCurr.isSameOrBefore(end, 'day')) {
            const dStr = sortCurr.date().toString();
            const entry = existingRowsMap[dStr];
            if (entry) {
                const { row: origRowStr, source } = entry;
                const rawCols = origRowStr.split("|").map(c => c.trim());
                if (rawCols.length >= 3) {
                    const dateVal = rawCols[1];
                    const rowCatVals = rawCols.slice(2, rawCols.length - 1);

                    // 출처에 따라 참조 헤더 선택 → 이름 기반 매핑
                    const refCols = source === 'archive' ? existingArchiveCols : currentScheduleCols;
                    const rowValMap: Record<string, string> = {};
                    refCols.slice(1).forEach((colName, idx) => {
                        rowValMap[colName] = rowCatVals[idx] || "";
                    });
                    rawFinalWeekRows.push({ dateVal, rowValMap });
                }
            }
            sortCurr.add(1, 'day');
        }

        // 주간 아카이브 표에서 7일간 모든 셀이 - 또는 공백인 의미없는 컬럼 필터링
        const activeCatCols = mergedCols.slice(1).filter(colName => {
            return rawFinalWeekRows.some(item => {
                const val = (item.rowValMap[colName] || "").trim();
                return val !== "" && val !== "-";
            });
        });

        // 7일간 모든 루틴이 비어있다면 최소한 currentScheduleCols 활성 루틴은 표시
        const dateColLabel = this.settings.language === 'ko' ? "날짜" : "Date";
        const finalHeaderCols = [dateColLabel, ...(activeCatCols.length > 0 ? activeCatCols : currentScheduleCols.slice(1))];
        const targetHeaderLine = `| ${finalHeaderCols.join(" | ")} |`;
        const targetSeparatorLine = `| :-: | ${finalHeaderCols.slice(1).map(() => ":--:").join(" | ")} |`;

        const finalWeekRows: string[] = rawFinalWeekRows.map(item => {
            const alignedCatVals = finalHeaderCols.slice(1).map(colName => {
                const val = item.rowValMap[colName];
                return (val && val.trim() !== "") ? val : "-";
            });
            return `| ${item.dateVal} | ${alignedCatVals.join(" | ")} |`;
        });

        let weeklyTableStr = "";
        let weeklyStatsDashboard = "";
        if (finalWeekRows.length > 0) {
            weeklyTableStr = targetHeaderLine + "\n" + targetSeparatorLine + "\n" + finalWeekRows.join('\n');
            weeklyStatsDashboard = this.generateStatsDashboard(weeklyTableStr, t("stats_title", this.settings.language), "info");
        }

        if (wFile && wFile instanceof TFile) {
            let updatedWContent = wContent;
            if (dailyRecord) {
                const recRange = this.getSectionRange(updatedWContent, t("header_record", this.settings.language)) as { start: number, end: number };
                const chkSectionRange = this.getSectionRange(updatedWContent, t("header_checklist", this.settings.language)) as { start: number, end: number };
                const statsSectionRange = this.getSectionRange(updatedWContent, t("header_stats", this.settings.language)) as { start: number, end: number };
                let insertPos = updatedWContent.length;
                if (chkSectionRange) insertPos = Math.min(insertPos, chkSectionRange.start);
                if (statsSectionRange) insertPos = Math.min(insertPos, statsSectionRange.start);

                const archiveDayId = targetDate.format("YYYY-MM-DD");
                const daySearchStr = `> [!quote]+ 📅 **${archiveDayId}`;
                const existingIdx = updatedWContent.indexOf(daySearchStr, recRange ? recRange.start : 0);
                if (existingIdx !== -1 && existingIdx < insertPos) {
                    let cStart = updatedWContent.lastIndexOf("> [!quote]", existingIdx);
                    if (cStart === -1 || (recRange && cStart < recRange.start)) cStart = existingIdx;
                    let cEnd = existingIdx;
                    while (cEnd < insertPos) {
                        const nextNewline = updatedWContent.indexOf("\n", cEnd);
                        if (nextNewline === -1 || nextNewline >= insertPos) { cEnd = insertPos; break; }
                        const nextLineStr = updatedWContent.substring(nextNewline + 1, nextNewline + 30);
                        if (!nextLineStr.startsWith(">") || nextLineStr.includes("📅 **")) { cEnd = nextNewline; break; }
                        cEnd = nextNewline + 1;
                    }
                    updatedWContent = updatedWContent.substring(0, cStart).trimEnd() + "\n\n" + dailyRecord + "\n" + updatedWContent.substring(cEnd).trimStart();
                } else {
                    updatedWContent = updatedWContent.substring(0, insertPos).trimEnd() + "\n\n" + dailyRecord + "\n\n" + updatedWContent.substring(insertPos);
                }
            }

            if (weeklyTableStr) {
                const chkRange = this.getSectionRange(updatedWContent, t("header_checklist", this.settings.language)) as { start: number, end: number };
                if (chkRange) {
                    const beforeChk = updatedWContent.substring(0, chkRange.start);
                    const afterChk = updatedWContent.substring(chkRange.end).trimStart();
                    updatedWContent = beforeChk + t("header_checklist", this.settings.language) + "\n\n" + weeklyTableStr.trim() + "\n\n" + afterChk;
                }
            }
            if (weeklyStatsDashboard) {
                const statsRange = this.getSectionRange(updatedWContent, t("header_stats", this.settings.language)) as { start: number, end: number };
                if (statsRange) {
                    const beforeStats = updatedWContent.substring(0, statsRange.start);
                    const afterStats = updatedWContent.substring(statsRange.end);
                    updatedWContent = beforeStats + t("header_stats", this.settings.language) + "\n\n" + weeklyStatsDashboard.trim() + "\n\n" + afterStats.trimStart();
                }
            }

            await this.fileManager.saveIfChanged(wFile, wContent, updatedWContent);
        } else {
            const nowStr = this.dateManager.getAdjustedNow().format("YYYY-MM-DDTHH:mm");
            const chkSectionText = `${t("header_checklist", this.settings.language)}\n\n${weeklyTableStr.trim()}\n\n`;
            const initialContent = this.settings.language === 'en'
                ? `---
Created: "${nowStr}"
Modified: "${nowStr}"
---
# ${weeklyInfo.fileName.replace('.md','')}

${t("header_record", this.settings.language)}

${dailyRecord ? dailyRecord.trim() + '\n\n' : ''}${chkSectionText}${t("header_stats", this.settings.language)}
${weeklyStatsDashboard.trim()}
`
                : `---
작성일: "${nowStr}"
수정일: "${nowStr}"
---
# ${weeklyInfo.fileName.replace('.md','')}

${t("header_record", this.settings.language)}

${dailyRecord ? dailyRecord.trim() + '\n\n' : ''}${chkSectionText}${t("header_stats", this.settings.language)}
${weeklyStatsDashboard.trim()}
`;
            try {
                await app.vault.create(weeklyInfo.path, initialContent);
            } catch (err: unknown) {
                const existing = app.vault.getAbstractFileByPath(weeklyInfo.path) || app.vault.getFiles().find(f => f.path === weeklyInfo.path);
                if (existing instanceof TFile) {
                    await this.fileManager.pluginWrite(existing, initialContent);
                } else {
                    throw err;
                }
            }
        }
    }

    // 3. [포팅] 월간 아카이브 통계 수치 및 HTML 갱신
    async updateMonthlyArchiveStats(app: App, targetMonthMoment: moment.Moment, dashboardStr: string): Promise<string | null> {
        const monthlyInfo = this.getMonthlyArchivePath(targetMonthMoment);
        await this.ensureFolder(monthlyInfo.folder);
        let mFile = app.vault.getAbstractFileByPath(monthlyInfo.path);
        const mTitle = targetMonthMoment.format("YYYY-MM");
        let originalContent: string | null = null;

        if (mFile && mFile instanceof TFile) {
            // Bug G: vault.read → getActiveViewOrFileText (에디터 미저장 내용 반영)
            let mContent = await this.fileManager.getActiveViewOrFileText(mFile);
            originalContent = mContent;
            const statsRange = this.getSectionRange(mContent, t("header_stats", this.settings.language)) as { start: number, end: number };
            if (statsRange) {
                mContent = mContent.substring(0, statsRange.start) + `${t("header_stats", this.settings.language)}\n${dashboardStr}\n` + mContent.substring(statsRange.end);
            } else {
                mContent += `\n\n${t("header_stats", this.settings.language)}\n${dashboardStr}\n`;
            }
            // BUG-09: pluginWrite로 교체하여 vault.on('modify')의 재동기화 트리거 방지
            try {
                await this.fileManager.pluginWrite(mFile, mContent.trim() + "\n");
            } catch (err) {
                console.error("[TaskUtils] Failed to write monthly stats file:", err);
            }
        } else {
            const nowStr = this.dateManager.getAdjustedNow().format("YYYY-MM-DDTHH:mm");
            const initialMonthlyText = this.settings.language === 'en'
                ? `---
Created: "${nowStr}"
Modified: "${nowStr}"
---
# ${mTitle}

${t("header_record", this.settings.language)}

${t("header_stats", this.settings.language)}\n${dashboardStr}\n`
                : `---
작성일: "${nowStr}"
수정일: "${nowStr}"
---
# ${mTitle}

${t("header_record", this.settings.language)}

${t("header_stats", this.settings.language)}\n${dashboardStr}\n`;

            try {
                await app.vault.create(monthlyInfo.path, initialMonthlyText);
            } catch (err: unknown) {
                const existing = app.vault.getAbstractFileByPath(monthlyInfo.path) || app.vault.getFiles().find(f => f.path === monthlyInfo.path);
                if (existing instanceof TFile) {
                    await this.fileManager.pluginWrite(existing, initialMonthlyText);
                } else {
                    throw err;
                }
            }
        }
        return originalContent;
    }

    // BUG-13: moment의 .date(n) setter는 체이닝으로 받아야 안전함
    getActualDate(now: moment.Moment, day: number): moment.Moment {
        return now.clone().date(day);
    }

    // =========================================================================
    // 4. 프로젝트 개요(Overview) 및 계획(Plan) 관리 모달 전용 헬퍼 엔진
    // =========================================================================

    /**
     * 프로젝트 파일 본문에서 기한(시작일, 마감일) 및 계층형 목표 목록 파싱
     */
    parseProjectOverview(content: string): ProjectOverviewData {
        const result: ProjectOverviewData = {
            startDate: undefined,
            endDate: undefined,
            goals: []
        };

        const range = this.getSectionRange(content, "# 개요") || this.getSectionRange(content, "# Overview");
        if (!range) return result;

        const overviewText = content.substring((range as { start: number; end: number }).start, (range as { start: number; end: number }).end);
        const lines = overviewText.split("\n");

        // 1. 기한 파싱 (- 기한 : 📅 2026-07-21 ~ 📅 2026-10-29)
        const deadlineMatch = overviewText.match(/기한\s*:\s*📅\s*(\d{4}-\d{2}-\d{2})\s*~\s*📅\s*(\d{4}-\d{2}-\d{2})/);
        if (deadlineMatch) {
            result.startDate = deadlineMatch[1];
            result.endDate = deadlineMatch[2];
        }

        // 2. 목표 파싱
        let inGoalSection = false;
        lines.forEach((line, idx) => {
            const goalHeaderMatch = line.match(/^(\s*)-\s*목표\s*(?::\s*(.*))?$/i) || line.match(/^(\s*)-\s*Goal\s*(?::\s*(.*))?$/i);
            if (goalHeaderMatch) {
                inGoalSection = true;
                const inlineGoal = goalHeaderMatch[2] ? goalHeaderMatch[2].trim() : "";
                if (inlineGoal) {
                    // 단일 인라인 목표 (- 목표 : 필기, 실기 합격)
                    result.goals.push({
                        id: `goal-${idx}-${Date.now()}`,
                        content: inlineGoal,
                        indentLevel: 0
                    });
                }
                return;
            }

            if (inGoalSection) {
                // 다른 최상위 항목(- 기한 등) 또는 새 헤더를 만나면 목표 섹션 종료
                if (/^-\s*(기한|Period|세부|Details)/i.test(line.trim()) || /^#+/.test(line.trim())) {
                    inGoalSection = false;
                    return;
                }

                const trimmed = line.trim();
                if (!trimmed) return;

                // 들여쓰기 계산 (탭 = 1단계, 공백 4칸 = 1단계)
                const rawIndentMatch = line.match(/^(\s*)/);
                const rawIndent = rawIndentMatch ? rawIndentMatch[1] : "";
                const tabs = (rawIndent.match(/\t/g) || []).length;
                const spaces = rawIndent.replace(/\t/g, "").length;
                let indentLevel = tabs > 0 ? tabs : Math.floor(spaces / 4);

                // 목표 하위 항목들은 기본적으로 최소 4칸 들여쓰기 되어 있으므로 베이스 1레벨 보정
                // 1. 대목표 (번호 목록 또는 들여쓰기 1레벨 미만) -> indentLevel 0
                //    - 하위 불릿 (들여쓰기 2레벨 이상) -> indentLevel 1
                let cleanText = trimmed;
                const numberedMatch = cleanText.match(/^\d+\.\s*(.*)$/);
                if (numberedMatch) {
                    cleanText = numberedMatch[1];
                    indentLevel = 0;
                } else if (cleanText.startsWith("- ") || cleanText.startsWith("* ") || cleanText.startsWith("+ ")) {
                    cleanText = cleanText.replace(/^[-*+]\s*/, "");
                    // 인라인이 아닌 하위 불릿 목록인데 indentLevel이 1 이하이면 0 or 1로 조정
                    indentLevel = Math.max(0, indentLevel - 1);
                }

                result.goals.push({
                    id: `goal-${idx}-${Date.now()}`,
                    content: cleanText.trim(),
                    indentLevel: indentLevel
                });
            }
        });

        return result;
    }

    /**
     * 프로젝트 파일 본문의 `# 개요` 섹션을 스마트 포맷팅 양식으로 교체/생성
     */
    updateProjectOverviewSection(content: string, data: ProjectOverviewData, lang: string): string {
        const isKo = lang === "ko";
        const headerName = isKo ? "# 개요" : "# Overview";
        const periodLabel = isKo ? "기한" : "Period";
        const goalLabel = isKo ? "목표" : "Goal";

        const startStr = data.startDate ? `📅 ${data.startDate}` : "📅 2099-12-31";
        const endStr = data.endDate ? `📅 ${data.endDate}` : "📅 2099-12-31";
        const periodLine = `- ${periodLabel} : ${startStr} ~ ${endStr}`;

        let goalLines = "";
        const validGoals = data.goals.filter(g => g.content.trim() !== "");
        if (validGoals.length === 0) {
            goalLines = `- ${goalLabel} : `;
        } else if (validGoals.length === 1 && validGoals[0].indentLevel === 0) {
            goalLines = `- ${goalLabel} : ${validGoals[0].content.trim()}`;
        } else {
            goalLines = `- ${goalLabel} :\n`;
            let rootGoalCount = 1;
            validGoals.forEach(g => {
                if (g.indentLevel === 0) {
                    goalLines += `    ${rootGoalCount}. ${g.content.trim()}\n`;
                    rootGoalCount++;
                } else {
                    const indentStr = "    ".repeat(g.indentLevel + 1);
                    goalLines += `${indentStr}- ${g.content.trim()}\n`;
                }
            });
            goalLines = goalLines.trimEnd();
        }

        const newOverviewSection = `${headerName}\n${periodLine}\n${goalLines}\n`;

        const range = this.getSectionRange(content, "# 개요") || this.getSectionRange(content, "# Overview");
        if (range) {
            const startIdx = (range as { start: number; end: number }).start;
            const endIdx = (range as { start: number; end: number }).end;
            return content.substring(0, startIdx).trimEnd() + "\n" + newOverviewSection + content.substring(endIdx).trimStart();
        }

        // 섹션이 없으면 # 실행 뒤나 파일 상단에 삽입
        const execRange = this.getSectionRange(content, "# 실행") || this.getSectionRange(content, "# Execution");
        if (execRange) {
            const endIdx = (execRange as { start: number; end: number }).end;
            return content.substring(0, endIdx).trimEnd() + "\n" + newOverviewSection + content.substring(endIdx).trimStart();
        }

        return newOverviewSection + content.trimStart();
    }

    /**
     * 프로젝트 파일 본문에서 `# 계획` 섹션 태스크 및 진행도 라인 파싱
     */
    parseProjectPlan(content: string): { progressLine?: string; items: ProjectPlanItem[] } {
        const items: ProjectPlanItem[] = [];
        let progressLine: string | undefined = undefined;

        const range = this.getSectionRange(content, "# 계획") || this.getSectionRange(content, "# Plan");
        if (!range) return { items };

        const planText = content.substring((range as { start: number; end: number }).start, (range as { start: number; end: number }).end);
        const lines = planText.split("\n");

        lines.forEach((line, idx) => {
            // 진행도 라인 감지 (> **[[...|진행도]]**: 17% (3/18) 또는 > **진행도**: ...)
            if (/^>\s*\*\*.*?(?:진행도|Progress).*?\*\*:/i.test(line.trim())) {
                progressLine = line.trim();
                return;
            }

            const taskMatch = line.match(/^(\s*)-\s*\[([ xX\-/])\]\s*(.*)$/);
            if (taskMatch) {
                const rawIndent = taskMatch[1] || "";
                const tabs = (rawIndent.match(/\t/g) || []).length;
                const spaces = rawIndent.replace(/\t/g, "").length;
                const indentLevel = tabs > 0 ? tabs : Math.floor(spaces / 4);
                const completed = taskMatch[2] === "x" || taskMatch[2] === "X";
                let rest = taskMatch[3];

                let blockId: string | undefined;
                const blockIdMatch = rest.match(/\^([a-zA-Z0-9]+)$/);
                if (blockIdMatch) {
                    blockId = "^" + blockIdMatch[1];
                    rest = rest.replace(/\s*\^([a-zA-Z0-9]+)$/, "").trim();
                }

                let date: string | undefined;
                const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                    date = dateMatch[1];
                    rest = rest.replace(/📅\s*\d{4}-\d{2}-\d{2}/, "").trim();
                }

                items.push({
                    id: `plan-item-${idx}-${Date.now()}`,
                    content: rest.trim(),
                    completed,
                    date,
                    blockId,
                    rawIndent,
                    indentLevel
                });
            }
        });

        return { progressLine, items };
    }

    /**
     * 계층형 지분 분배(Tree-based Weighted Progress) 방식으로 진행도(% 및 완료수/전체수)를 계산합니다.
     * - 최상위 항목들을 1/N로 균등 분배
     * - 각 항목의 하위 태스크들은 부모의 지분을 1/N로 균등 분배
     */
    calculateTreeProgress(items: ProjectPlanItem[]): { pct: number; doneCount: number; totalCount: number } {
        const totalCount = items.length;
        const doneCount = items.filter(i => i.completed).length;

        if (totalCount === 0) {
            return { pct: 0, doneCount: 0, totalCount: 0 };
        }

        interface TreeNode {
            item: ProjectPlanItem;
            children: TreeNode[];
        }

        const rootNodes: TreeNode[] = [];
        const stack: { node: TreeNode; indent: number }[] = [];

        for (const item of items) {
            const node: TreeNode = { item, children: [] };
            const indent = item.indentLevel;

            while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
                stack.pop();
            }

            if (stack.length === 0) {
                rootNodes.push(node);
            } else {
                stack[stack.length - 1].node.children.push(node);
            }

            stack.push({ node, indent });
        }

        if (rootNodes.length === 0) {
            return { pct: 0, doneCount, totalCount };
        }

        const computeNodeScore = (node: TreeNode): number => {
            if (node.item.completed) {
                return 1.0;
            }
            if (node.children.length === 0) {
                return 0.0;
            }
            const childrenSum = node.children.reduce((sum, child) => sum + computeNodeScore(child), 0);
            return childrenSum / node.children.length;
        };

        const rootSum = rootNodes.reduce((sum, root) => sum + computeNodeScore(root), 0);
        const progressRatio = rootSum / rootNodes.length;
        const pct = Math.round(progressRatio * 100);

        return { pct, doneCount, totalCount };
    }

    /**
     * 프로젝트 파일 본문의 `# 계획` 섹션을 업데이트하고,
     * 진행도(% 및 카운트)를 100% 자동 재계산하며,
     * 동일 `^blockId`를 가진 `# 실행` 탭 항목들과 양방향 원자적 동기화(수정/체크/삭제)를 수행합니다.
     */
    updateProjectPlanWithSync(content: string, planItems: ProjectPlanItem[], file: TFile, lang: string): string {
        const isKo = lang === "ko";
        const planHeader = isKo ? "# 계획" : "# Plan";
        const progressLabel = isKo ? "진행도" : "Progress";

        // 1. 🌟 계층형 지분 분배(Tree Weighted) 진행도 계산
        const { pct, doneCount: done, totalCount: total } = this.calculateTreeProgress(planItems);

        // 2. 블록 ID가 없는 계획 항목에 유니크 ID 자동 부여
        const allProjectFiles = this.getProjectFiles();
        const filesForId = allProjectFiles.length > 0 ? allProjectFiles : [file];
        planItems.forEach(item => {
            if (!item.blockId) {
                const newId = this.generateBlockId(filesForId);
                item.blockId = "^" + newId;
            }
        });

        // 3. 진행도 링크 포맷 구성
        const linkPath = file.path.replace(/\.md$/, "");
        const newProgressLine = `> **[[${linkPath}|${progressLabel}]]**: ${pct}% (${done}/${total})`;

        // 4. `# 계획` 마크다운 라인들 조립
        const planLines: string[] = [];
        planLines.push(newProgressLine);

        planItems.forEach(item => {
            const indentStr = "\t".repeat(item.indentLevel);
            const checkChar = item.completed ? "x" : " ";
            let line = `${indentStr}- [${checkChar}] ${item.content}`;
            if (item.date) {
                line += ` 📅 ${item.date}`;
            }
            if (item.blockId) {
                line += ` ${item.blockId}`;
            }
            planLines.push(line);
        });

        const newPlanSection = `${planHeader}\n${planLines.join("\n")}\n`;

        // 5. 본문 내 `# 계획` 섹션 치환
        let updatedContent = content;
        const planRange = this.getSectionRange(content, "# 계획") || this.getSectionRange(content, "# Plan");
        if (planRange) {
            const startIdx = (planRange as { start: number; end: number }).start;
            const endIdx = (planRange as { start: number; end: number }).end;
            updatedContent = content.substring(0, startIdx).trimEnd() + "\n" + newPlanSection + content.substring(endIdx).trimStart();
        } else {
            updatedContent = updatedContent.trimEnd() + "\n" + newPlanSection;
        }

        // 6. 🔄 `# 실행` 섹션과의 양방향 태스크 동기화 (수정/체크/삭제 정밀 동기 연동)
        const execRange = this.getSectionRange(updatedContent, "# 실행") || this.getSectionRange(updatedContent, "# Execution");
        if (execRange) {
            // 변경 전 원본 마크다운의 # 계획 섹션에 존재하던 blockId 목록 추출
            const originalPlanParsed = this.parseProjectPlan(content);
            const originalPlanIds = new Set<string>();
            originalPlanParsed.items.forEach(item => {
                if (item.blockId) originalPlanIds.add(item.blockId.replace(/^\^/, ""));
            });

            // 현재 저장될 계획 탭의 태스크 맵 (blockId -> planItem)
            const currentPlanMap = new Map<string, ProjectPlanItem>();
            planItems.forEach(item => {
                if (item.blockId) {
                    currentPlanMap.set(item.blockId.replace(/^\^/, ""), item);
                }
            });

            const startIdx = (execRange as { start: number; end: number }).start;
            const endIdx = (execRange as { start: number; end: number }).end;
            const execSectionText = updatedContent.substring(startIdx, endIdx);
            const execLines = execSectionText.split("\n");

            const newExecLines: string[] = [];
            execLines.forEach(line => {
                const headerMatch = line.match(/^#+\s+(실행|Execution)/i);
                if (headerMatch) {
                    newExecLines.push(line);
                    return;
                }

                const taskMatch = line.match(/^(\s*)-\s*\[([ xX\-/])\]\s*(.*)$/);
                if (taskMatch) {
                    const blockIdMatch = taskMatch[3].match(/\^([a-zA-Z0-9]+)$/);
                    if (blockIdMatch) {
                        const rawId = blockIdMatch[1];

                        // 경우 A: 현재 계획 탭에 남아있는 경우 ➔ 텍스트/완료체크/날짜 동기화
                        if (currentPlanMap.has(rawId)) {
                            const planItem = currentPlanMap.get(rawId)!;
                            const indentStr = taskMatch[1] || "";
                            const checkChar = planItem.completed ? "x" : " ";
                            let syncedLine = `${indentStr}- [${checkChar}] ${planItem.content}`;
                            if (planItem.date) {
                                syncedLine += ` 📅 ${planItem.date}`;
                            } else {
                                // 실행 탭에 기존 날짜가 있었다면 보존
                                const existingDateMatch = taskMatch[3].match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                                if (existingDateMatch) syncedLine += ` 📅 ${existingDateMatch[1]}`;
                            }
                            syncedLine += ` ^${rawId}`;
                            newExecLines.push(syncedLine);
                            return;
                        }

                        // 경우 B: 원래 계획 탭에 있었는데 이번에 계획 탭에서 삭제된 경우 ➔ 실행 탭에서도 함께 삭제 (스킵)
                        if (originalPlanIds.has(rawId) && !currentPlanMap.has(rawId)) {
                            return;
                        }
                    }
                }

                // 경우 C: 계획 탭과 무관한 일반 실행 태스크는 100% 안전하게 보존
                newExecLines.push(line);
            });

            const newExecSection = newExecLines.join("\n").trimEnd() + "\n";
            updatedContent = updatedContent.substring(0, startIdx).trimEnd() + "\n" + newExecSection + updatedContent.substring(endIdx).trimStart();
        }

        return updatedContent;
    }

    /**
     * 계획 태스크를 `# 실행` 구역으로 복제 삽입 (`⬆️` 버튼 전용)
     * - 최상위 레벨(들여쓰기 없는 - [ ] ...)로 삽입되어 하위로 종속되지 않습니다.
     */
    copyPlanTaskToExecution(content: string, targetPlanItem: ProjectPlanItem, file: TFile, lang: string): { updatedContent: string; success: boolean } {
        const isKo = lang === "ko";
        const execHeader = isKo ? "# 실행" : "# Execution";

        // 블록 ID 보장
        if (!targetPlanItem.blockId) {
            const allProjectFiles = this.getProjectFiles();
            const filesForId = allProjectFiles.length > 0 ? allProjectFiles : [file];
            targetPlanItem.blockId = "^" + this.generateBlockId(filesForId);
        }

        // 항상 최상위 레벨(들여쓰기 없음)로 생성
        const checkChar = targetPlanItem.completed ? "x" : " ";
        let taskLine = `- [${checkChar}] ${targetPlanItem.content}`;
        if (targetPlanItem.date) {
            taskLine += ` 📅 ${targetPlanItem.date}`;
        }
        taskLine += ` ${targetPlanItem.blockId}`;

        const execRange = this.getSectionRange(content, "# 실행") || this.getSectionRange(content, "# Execution");
        if (execRange) {
            const startIdx = (execRange as { start: number; end: number }).start;
            const endIdx = (execRange as { start: number; end: number }).end;
            const execSectionText = content.substring(startIdx, endIdx);

            // 이미 동일 blockId가 존재하면 중복 추가 방지
            if (targetPlanItem.blockId && execSectionText.includes(targetPlanItem.blockId)) {
                return { updatedContent: content, success: true };
            }

            const updatedExecSection = execSectionText.trimEnd() + "\n" + taskLine + "\n";
            const updatedContent = content.substring(0, startIdx).trimEnd() + "\n" + updatedExecSection + content.substring(endIdx).trimStart();
            return { updatedContent, success: true };
        } else {
            // # 실행 섹션이 없으면 파일 상단에 신규 생성
            const newExecSection = `${execHeader}\n${taskLine}\n`;
            return { updatedContent: newExecSection + content.trimStart(), success: true };
        }
    }

    /**
     * 실행(# 실행) 섹션의 변경 사항(체크, 내용 수정 등)을 계획(# 계획) 섹션으로 역방향 동기화하고,
     * 계획 탭의 진행도(% 및 카운트)를 100% 자동 재계산합니다.
     */
    syncExecutionToPlan(content: string, file: TFile, lang: string): string {
        const execRange = this.getSectionRange(content, "# 실행") || this.getSectionRange(content, "# Execution");
        const planRange = this.getSectionRange(content, "# 계획") || this.getSectionRange(content, "# Plan");
        if (!execRange || !planRange) return content;

        // 1. # 실행 구역의 태스크 파싱하여 blockId -> { completed, content, date } 맵 생성
        const execText = content.substring((execRange as { start: number; end: number }).start, (execRange as { start: number; end: number }).end);
        const execLines = execText.split("\n");
        const execMap = new Map<string, { completed: boolean; content: string; date?: string }>();

        execLines.forEach(line => {
            const taskMatch = line.match(/^(\s*)-\s*\[([ xX\-/])\]\s*(.*)$/);
            if (taskMatch) {
                const completed = taskMatch[2] === "x" || taskMatch[2] === "X";
                let rest = taskMatch[3];
                const blockIdMatch = rest.match(/\^([a-zA-Z0-9]+)$/);
                if (blockIdMatch) {
                    const rawId = blockIdMatch[1];
                    let cleanContent = rest.replace(/\s*\^([a-zA-Z0-9]+)$/, "").trim();
                    let date: string | undefined;
                    const dateMatch = cleanContent.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) {
                        date = dateMatch[1];
                        cleanContent = cleanContent.replace(/📅\s*\d{4}-\d{2}-\d{2}/, "").trim();
                    }
                    execMap.set(rawId, { completed, content: cleanContent, date });
                }
            }
        });

        if (execMap.size === 0) return content;

        // 2. # 계획 구역의 태스크 파싱 및 동기화
        const parsedPlan = this.parseProjectPlan(content);
        if (parsedPlan.items.length === 0) return content;

        parsedPlan.items.forEach(item => {
            if (item.blockId) {
                const rawId = item.blockId.replace(/^\^/, "");
                if (execMap.has(rawId)) {
                    const execItem = execMap.get(rawId)!;
                    item.completed = execItem.completed;
                    item.content = execItem.content;
                    if (execItem.date) {
                        item.date = execItem.date;
                    }
                }
            }
        });

        // 3. 동기화된 계획 탭 및 실시간 진행도 일괄 치환 저장
        return this.updateProjectPlanWithSync(content, parsedPlan.items, file, lang);
    }
}

export interface ProjectGoalItem {
    id: string;
    content: string;
    indentLevel: number;
}

export interface ProjectOverviewData {
    startDate?: string;
    endDate?: string;
    goals: ProjectGoalItem[];
}

export interface ProjectPlanItem {
    id: string;
    content: string;
    completed: boolean;
    date?: string;
    blockId?: string;
    rawIndent?: string;
    indentLevel: number;
}


/* eslint-enable @typescript-eslint/no-unsafe-assignment -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-member-access -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-call -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-argument -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-return -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unnecessary-type-assertion -- Re-enable strict rules */
