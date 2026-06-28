/* eslint-disable @typescript-eslint/no-unsafe-assignment -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-call -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-return -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Complex type casting needed for markdown AST */
import { DailyData, DailyMeta, ProjectResult, ProjectOverrideData, TaskData } from "./types";
import { App, TFile, TFolder } from "obsidian";
import type { moment } from "obsidian";
import { DateManager } from "./DateManager";
import { FileManager } from "./FileManager";
import { PluginSettings } from "./settings";

export const REGEX = {
    EXTRACT_ID: /^(.*?)(?:\s*\^([a-zA-Z0-9]+))?$/,
    TASK_LINE: /^(\s*[-*+])\s+\[(.)\]\s+(.*)$/,
    MATCH_TASK: /^\s*[-*+]\s+\[.\]/,
    MATCH_TASK_COMPLETED: /^[\s]*[-*+]\s+\[[xX-]\]/,
    STATUS_MATCH: /^[\s]*[-*+]\s+\[(.)\]/,
    DATE_LABEL: /📅\s*\d{4}-\d{2}-\d{2}/,
    HEADING_START: /^#+\s+/,
    TOP_HEADING_START: /^#\s+/,
    EXEC_HEADER: /^#\s+실행$/,
    WORK_SUMMARY_HEADER: /^#\s+계획$/,
    NOTE_LINK: /^##\s+(.+)$/,
    SUMMARY_MATCH: /^[\s]*[-*+]\s+\[([xX ])\]/,
    MARKER_REPLACE_2: /(\[[^\]]\])\s*/,
    PROJECT_TODO_SECTION: /(?:^|\n)##\s+프로젝트(?:\n|$)(?:[\s\S]*?)(?=\n#{1,6}\s|$)/g,
    TODO_HEADER: /(?:^|\n)#\s+Todo(?=\n|$)/i,
    INDENT: /^\s*/
};

export const MARKER_PRI: Record<string, number> = { 
    '!': 1, 
    '0': 2, 
    '1': 3, 
    '2': 4, 
    '3': 5, 
    '7': 6, 
    '': 99 
};

export const EMOJI_MAP: Record<string, string> = { 
    "1": "🟦", 
    "2": "🟩", 
    "3": "🟨", 
    "4": "🟥" 
};

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
    private keydownHandler = (e: KeyboardEvent) => {
        e.stopPropagation();
        e.preventDefault();
    };

    showLoadingOverlay(message: string) {
        if (this.overlayEl) return;
        this.overlayEl = activeDocument.createElement("div");
        this.overlayEl.classList.add("myworld-loading-overlay");
        
        const spinner = activeDocument.createElement("div");
        spinner.classList.add("myworld-spinner");

        const msgEl = activeDocument.createElement("div");
        msgEl.innerText = message;
        
        this.overlayEl.appendChild(spinner);
        this.overlayEl.appendChild(msgEl);
        activeDocument.body.appendChild(this.overlayEl);

        window.addEventListener("keydown", this.keydownHandler, { capture: true });
        window.addEventListener("keypress", this.keydownHandler, { capture: true });
        window.addEventListener("keyup", this.keydownHandler, { capture: true });
    }

    hideLoadingOverlay() {
        if (this.overlayEl) {
            this.overlayEl.remove();
            this.overlayEl = null;
        }
        window.removeEventListener("keydown", this.keydownHandler, { capture: true });
        window.removeEventListener("keypress", this.keydownHandler, { capture: true });
        window.removeEventListener("keyup", this.keydownHandler, { capture: true });
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
            const escapedSectionName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const safeRegex = new RegExp(`(^|\\n)${escapedSectionName}[ \\t]*(?=\\n|$)`);
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
        if (!range) return content;
        return content.substring(0, range.start) + headerName + "\n" + newBody.trimEnd() + "\n\n" + content.substring(range.end).trimStart();
    }

    renderProgressBar(completed: number, total: number, noteName?: string): string {
        const titleLink = noteName ? `[[${noteName}|진행도]]` : "진행도";
        const safeTotal = Math.max(total, 1);
        const pct = Math.round((completed / safeTotal) * 100);
        return `**${titleLink}**: ${pct}% (${completed}/${total})`;
    }

    getMarker(dateStr: string, today: Date): string {
        if (!dateStr) return "";
        const cleanDate = dateStr.replace('📅', '').trim();
        const parts = cleanDate.split('-');
        if (parts.length < 3) return "";
        const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const diff = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diff < 0) return "!";
        if (diff === 0) return "0";
        if (diff === 1) return "1";
        if (diff === 2) return "2";
        if (diff === 3) return "3";
        if (diff >= 4 && diff <= 7) return "7";
        return "";
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

        // Downward 완료 상태 전파
        for (let i = 0; i < lineInfos.length; i++) {
            if (lineInfos[i].isTask && lineInfos[i].isCompleted) {
                for (let j = i + 1; j < lineInfos.length; j++) {
                    if (lineInfos[j].ind <= lineInfos[i].ind) break;
                    if (lineInfos[j].isTask) {
                        if (!lineInfos[j].isCompleted) {
                            lineInfos[j].isCompleted = true;
                            const pStatus = (lineInfos[i].line.match(REGEX.STATUS_MATCH) || ["", "x"])[1];
                            (lineInfos[j] as { propStatus?: string }).propStatus = pStatus;
                        }
                    }
                }
            }
        }

        return lineInfos.map((d) => {
            if (!d.isTask) return d.line;
            let l = d.line;
            
            // Clean legacy #D- and #Past tags to completely migrate to new markers
            l = l.replace(/\s*#(?:D-\d+|Past)\s*/ig, ' ');
            
            let status = (d as { propStatus?: string }).propStatus || (d.line.match(REGEX.STATUS_MATCH) || ["", " "])[1];
            
            if (!d.isCompleted) {
                if (d.m) {
                    status = d.m.trim();
                } else if (["!", "0", "1", "2", "3", "7"].includes(status)) {
                    // 날짜가 없는데 기존 마커가 날짜 전용 마커라면 초기화 (빈 칸)
                    status = " ";
                }
            }
            
            l = l.replace(/^(\s*[-*+]\s+)\[.\]/, `$1[${status}]`);
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
                let isDeleted = false;
                const match = l.match(REGEX.TASK_LINE);
                if (match) {
                    const textWithId = match[3];
                    isDeleted = /;;(\s*\^[a-zA-Z0-9]+)?$/.test(textWithId.trim());
                }
                if (REGEX.MATCH_TASK_COMPLETED.test(l) || isDeleted) {
                    skipIndent = currentIndent; continue;
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
            if (options.excludeSubSections && sub.header && (options.excludeSubSections as string[]).some((ex: string) => sub.header.includes(ex))) {
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

            return (sub.header ? [sub.header, ...processedLines] : processedLines).join('\n');
        });

        return cContent.substring(0, sIdx) + mainHeader + "\n" + processed.join('\n') + cContent.substring(nIdx);
    }

    parseTableStats(linesStrs: string[], headers: string) {
        let sq: Record<string, number> = { "🟦": 0, "🟩": 0, "🟨": 0, "🟥": 0 };
        if (!headers || !linesStrs || linesStrs.length === 0) return { sq, cs: {} as Record<string, Record<string, number>>, tableHeaders: [] as string[] };

        const tableHeaders = headers.split("|").map(s => s.trim());
        let cs: Record<string, Record<string, number>> = {};

        linesStrs.forEach(l => {
            let cols = l.split("|");
            if (cols.length > 2) {
                for (let c = 2; c < cols.length; c++) {
                    let v = cols[c].trim();
                    if (!v) continue;
                    let emoji = EMOJI_MAP[v] || v;
                    let hw = tableHeaders[c];

                    if (hw && hw !== "" && hw !== "날짜") {
                        if (!cs[hw]) cs[hw] = { "🟦": 0, "🟩": 0, "🟨": 0, "🟥": 0 };
                        if (Object.prototype.hasOwnProperty.call(cs[hw], emoji)) cs[hw][emoji]++;
                    }
                    if (Object.prototype.hasOwnProperty.call(sq, emoji)) sq[emoji]++;
                }
            }
        });
        return { sq, cs, tableHeaders };
    }

    renderStatsDashboard(sq: Record<string, number>, cs: Record<string, Record<string, number>>, title = "체크리스트 통계", type = "info"): string {
        const tSq = Object.values(sq).reduce((a, b) => a + b, 0);
        if (tSq === 0) return `> [!warning] ${title}: 표시할 데이터가 없습니다.\n`;

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

        const TH = '<tr style="border-bottom: 2px solid var(--background-modifier-border);"><th style="padding: 6px 10px; text-align: left; width: 30%;">항목</th><th style="padding: 6px 10px; width: 70%; text-align: left;">세부 누적 그래프</th></tr>';
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
            if (firstCol === "상태" || Object.values(EMOJI_MAP).includes(firstCol)) return line;

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

    syncDailyMap(dailyMap: Record<string, DailyData>) {
        for (const noteName in dailyMap) {
            const data = dailyMap[noteName];
            const textQueues: Record<string, TaskData[]> = {};
            for (const key in (data as DailyData).byText) textQueues[key] = [...(data as DailyData).byText[key]];

            const tasks = data.orderedTasks.map((ot) => {
                if (ot.type === 'id') return data.byId[ot.key];
                if (textQueues[ot.key] && textQueues[ot.key].length > 0) return textQueues[ot.key].shift();
                return null;
            });
            for (let i = 0; i < tasks.length; i++) {
                if (tasks[i] && tasks[i].checked) {
                    const pInd = (tasks[i].indent || "").length;
                    for (let j = i + 1; j < tasks.length; j++) {
                        if (!tasks[j] || (tasks[j].indent || "").length <= pInd) break;
                        tasks[j].checked = true;
                        if (!tasks[j].status || tasks[j].status === ' ') tasks[j].status = tasks[i].status;
                    }
                }
            }
        }
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

    renderProjectCallout(noteName: string, rawTasks: string[], done: number, total: number, todayObj: Date, isReset = false): string {
        const filteredTasks = isReset ? this.filterResetTasks(rawTasks, true) : rawTasks;
        const processedTasks = this.applyMarkersToLines(filteredTasks, todayObj);
        let minDiff = Infinity, hasIncomp = false;

        const taskInfos = processedTasks.map(t => {
            const isTask = REGEX.MATCH_TASK.test(t);
            const isDone = isTask && REGEX.MATCH_TASK_COMPLETED.test(t);
            if (isTask && !isDone) hasIncomp = true;

            const dM = t.match(REGEX.DATE_LABEL);
            if (dM && isTask && !isDone) {
                const pts = dM[0].replace('📅', '').trim().split('-');
                const diff = Math.ceil((new Date(parseInt(pts[0]), parseInt(pts[1]) - 1, parseInt(pts[2])).getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
                if (diff < minDiff) minDiff = diff;
            }
            return { line: t, ind: (t.match(REGEX.INDENT) || [""])[0].length, isDone, isTask };
        });

        let cType = "quote", pStr = (total > 0) ? `(${Math.round((done / total) * 100)}%)` : `(정보없음)`;
        let sTitle = `💭 **[[${noteName}]]** ${pStr}`;
        if (taskInfos.filter(ti => ti.isTask).length === 0 && total === 0) return "";
        else if (!hasIncomp && taskInfos.filter(ti => ti.isTask).length > 0) { cType = "quote"; sTitle = `🏁 **[[${noteName}]]** ${pStr}`; }
        else {
            if (minDiff < 0) { cType = "danger"; sTitle = `🔥 **[[${noteName}]]** ${pStr}`; }
            else if (minDiff === 0) { cType = "danger"; sTitle = `🚨 **[[${noteName}]]** ${pStr}`; }
            else if (minDiff === 1) { cType = "attention"; sTitle = `⚠️ **[[${noteName}]]** ${pStr}`; }
            else if (minDiff === 2) { cType = "check"; sTitle = `✅ **[[${noteName}]]** ${pStr}`; }
            else if (minDiff === 3) { cType = "info"; sTitle = `ℹ️ **[[${noteName}]]** ${pStr}`; }
        }

        let body = "";
        taskInfos.filter(ti => ti.isTask || /^##\s/.test(ti.line.trim())).forEach(ti => {
            let safeLine = ti.line.replace(/\t/g, '    ');
            body += `> ${safeLine}\n`;
        });

        return `> [!${cType}] ${sTitle}\n${body.trimEnd()}`;
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

    sortFullProjectResults(items: ProjectResult[]): ProjectResult[] {
        if (!items || !Array.isArray(items)) return [];
        return items.sort((a, b) => {
            if (a.sortPri !== b.sortPri) return a.sortPri - b.sortPri;
            if (a.minDiff !== b.minDiff) return a.minDiff - b.minDiff;
            let pctA = a.planTasksTotal > 0 ? a.planTasksDone / a.planTasksTotal : 0;
            let pctB = b.planTasksTotal > 0 ? b.planTasksDone / b.planTasksTotal : 0;
            if (pctA !== pctB) return pctB - pctA;
            return a.noteName.localeCompare(b.noteName);
        });
    }

    generateProjectDashboard(projects: ProjectResult[]): string {
        if (!projects || projects.length === 0) return "";
        
        let html = `<div style="padding: 16px; background: var(--background-secondary); border-radius: 12px; border: 1px solid var(--background-modifier-border); margin: 10px 0 25px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">\n`;
        html += `    <div style="font-weight: 800; font-size: 1.1em; margin-bottom: 15px; color: var(--text-accent); display: flex; align-items: center; gap: 8px;">🚀 전체 프로젝트 요약</div>\n`;

        projects.forEach((p, idx) => {
            let pct = p.planTasksTotal > 0 ? Math.round((p.planTasksDone / p.planTasksTotal) * 100) : 0;
            let isLast = idx === projects.length - 1;
            let marginStyle = isLast ? "" : "margin-bottom: 20px;";
            
            let color = "#969696";
            let icon = "📝";
            let titleName = p.noteName;
            
            if (p.sortPri === 0) { color = "#8c0028"; icon = "🔥"; }
            else if (p.sortPri === 1) { color = "#e93147"; icon = "🚨"; }
            else if (p.sortPri === 2) { color = "#ffd200"; icon = "⚠️"; }
            else if (p.sortPri === 3) { color = "#44cf6e"; icon = "✅"; }
            else if (p.sortPri === 4) { color = "#086ddd"; icon = "ℹ️"; }
            else if (p.sortPri === 100) { color = "#10b981"; icon = "🏁"; }
            else if (pct === 0) { color = "#969696"; icon = "💭"; }

            let grid = `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; background: linear-gradient(to right, transparent calc(50% - 1px), rgba(0,0,0,0.7) calc(50% - 1px), rgba(0,0,0,0.7) calc(50% + 1px), transparent calc(50% + 1px));"></div>`;

            html += `    <div style="${marginStyle}">\n`;
            html += `        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 600; font-size: 0.95em;">\n`;
            html += `            <span>${icon} ${titleName}</span>\n`;
            html += `            <span style="color: ${pct > 0 ? color : 'var(--text-muted)'};">${pct}% (${p.planTasksDone}/${p.planTasksTotal})</span>\n`;
            html += `        </div>\n`;
            html += `        <div style="position: relative; width: 100%; height: 10px; border-radius: 5px; background: var(--background-modifier-hover); overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);">\n`;
            html += `            <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, ${color}, ${color}dd); border-radius: 5px;"></div>\n`;
            html += `            ${grid}\n`;
            html += `        </div>\n`;
            html += `    </div>\n`;
        });
        html += `</div>`;
        return html;
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
        const dash1 = "## 1구간 (1일~10일)\n" + (seg1Lines.length > 0 ? this.generateStatsDashboard(tableHeader + "\n" + seg1Lines.join("\n"), "1구간 (1일~10일) 통계", "info") : "> [!info] 1구간 (1일~10일): 데이터 없음\n");

        const seg2Lines = this.filterTableByDayRange(dataRows, 11, 20);
        const dash2 = "## 2구간 (11일~20일)\n" + (seg2Lines.length > 0 ? this.generateStatsDashboard(tableHeader + "\n" + seg2Lines.join("\n"), "2구간 (11일~20일) 통계", "info") : "> [!info] 2구간 (11일~20일): 데이터 없음\n");

        const seg3Lines = this.filterTableByDayRange(dataRows, 21, 31);
        const dash3 = "## 3구간 (21일~말일)\n" + (seg3Lines.length > 0 ? this.generateStatsDashboard(tableHeader + "\n" + seg3Lines.join("\n"), "3구간 (21일~말일) 통계", "info") : "> [!info] 3구간 (21일~말일): 데이터 없음\n");

        const dashTotal = "## 이달의 전체 종합 통계\n" + this.generateStatsDashboard(tableHeader + "\n" + dataRows.join("\n"), "이달의 전체 종합 통계", "info");

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
            else if (/^#+\s*루틴/i.test(l)) { inRoutine = true; routineType = "header"; }
            else if (inRoutine) {
                if (routineType === "header" && l.startsWith('#') && !/^#+\s*루틴/i.test(l)) inRoutine = false;
                else if (routineType === "callout" && !l.startsWith('>') && l.trim() !== '') inRoutine = false;
            }
            
            let m = l.match(/^((?:>\s*)*)##\s+(.*)$/);
            if (inRoutine && m) {
                let prefix = m[1] + "## ";
                let cleanText = m[2].replace(/[*=]+/g, '').trim();
                
                if (deficientItems.has(cleanText)) {
                    l = prefix + `==${cleanText}==`;
                } else {
                    l = prefix + cleanText;
                }
                lines[i] = l;
            }
        }
        return lines.join('\n');
    }

    getChecklistTable(content: string): string {
        const chkRange = this.getSectionRange(content, "# 체크리스트") as { start: number, end: number };
        if (!chkRange) return "";
        
        const tableLines = [];
        const lines = content.substring(chkRange.start, chkRange.end).split('\n');
        for (let line of lines) {
            if (line.trim().startsWith("|")) tableLines.push(line);
            else if (tableLines.length > 0 && line.trim() !== "" && !line.includes("# 체크리스트")) break; 
        }
        return tableLines.join('\n');
    }

    formatChecklistTable(content: string): string {
        const chkRange = this.getSectionRange(content, "# 체크리스트") as { start: number, end: number };
        if (!chkRange) return content;
        
        const chkSection = content.substring(chkRange.start, chkRange.end);
        let lines = chkSection.split('\n');
        let tableStartIndex = -1;
        let tableEndIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith("|")) {
                if (tableStartIndex === -1) tableStartIndex = i;
                tableEndIndex = i;
            } else if (tableStartIndex !== -1 && lines[i].trim() !== "" && !lines[i].includes("# 체크리스트")) {
                break;
            }
        }
        
        if (tableStartIndex === -1) return content;
        
        let tableLines = lines.slice(tableStartIndex, tableEndIndex + 1);
        if (tableLines.length < 3) return content; // Header, Separator, and at least 1 data row
        
        let header = tableLines[0];
        const separator = tableLines[1];
        let dataRows = tableLines.slice(2);
        

        
        let newTableContent = [header, separator, ...dataRows].join('\n');
        newTableContent = this.convertTableMarkers(newTableContent);
        
        lines.splice(tableStartIndex, tableLines.length, newTableContent);
        
        return content.substring(0, chkRange.start) + lines.join('\n') + content.substring(chkRange.end);
    }

    extractDailyMetadata(content: string): DailyMeta {
        let step = "미작성", review = "미작성";
        const stepMatch = content.match(/^((?:>|\s*[-*+])\s*.*?(?:[Ss]tep|도전)\s*:\s*)(.*)$/m);
        if (stepMatch && stepMatch[2].trim()) step = stepMatch[2].trim();

        const reviewMatch = content.match(/^((?:>|\s*[-*+])\s*.*?(?:회고|Review)\s*:\s*)(.*)$/m);
        if (reviewMatch && reviewMatch[2].trim()) review = reviewMatch[2].trim();
        
        return { step, review };
    }

    renderProjectDashboardSection(projectResults: ProjectResult[]): string {
        if (!projectResults || projectResults.length === 0) return "";
        const dashboardHtml = this.generateProjectDashboard(projectResults);
        const calloutsHtml = projectResults.map(i => i.calloutText).filter(t => t.trim() !== "").join("\n\n");
        return dashboardHtml ? dashboardHtml + "\n\n" + calloutsHtml : calloutsHtml;
    }

        getProjectFiles(): TFile[] {
        const dir = this.settings.projectDirectory;
        const folder = this.app.vault.getAbstractFileByPath(dir);
        const files: TFile[] = [];
        
        const traverse = (f: TFolder) => {
            if (!f.children) return;
            for (const child of f.children) {
                if (child instanceof TFile && child.extension === "md") {
                    files.push(child);
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

    pruneTree(nodes: TaskNode[]): { nodes: TaskNode[], hasD0: boolean } {
        let hasD0Any = false;
        const pruned: TaskNode[] = [];
        nodes.forEach(node => {
            const sMatch = node.line.match(REGEX.STATUS_MATCH);
            const statusChar = sMatch ? sMatch[1] : '';
            const isD0Task = (statusChar === '0' || statusChar === '!');
            const childResults = this.pruneTree(node.children);
            
            if (isD0Task || childResults.hasD0) {
                node.children = childResults.nodes;
                pruned.push(node);
                hasD0Any = true;
            }
        });
        return { nodes: pruned, hasD0: hasD0Any };
    }

    renderTodayProjectTasks(projectResults: ProjectResult[], todayObj: Date): string {
        if (!projectResults) return "";
        let finalLines: string[] = [];
        
        projectResults.forEach(p => {
            if (!p.execTasks || p.execTasks.length === 0) return;
            const processed = this.applyMarkersToLines(p.execTasks, todayObj);
            const tree = this.parseTasksToTree(processed);
            const pruned = this.pruneTree(tree);
            
            if (pruned.nodes.length > 0) {
                finalLines.push(`- ${p.noteName}`);
                
                const renderNodes = (nodes: TaskNode[], depth: number) => {
                    nodes.forEach(node => {
                        let cleanText = "";
                        const taskMatch = node.line.match(REGEX.TASK_LINE);
                        if (taskMatch) {
                            cleanText = this.cleanTaskText(this.extractIdAndText(taskMatch[3]).text);
                        } else if (/^##\s/.test(node.line.trim())) {
                            cleanText = node.line.trim().replace(/^##\s+/, "");
                        }
                        
                        if (cleanText) {
                            const indent = "    ".repeat(depth);
                            const isLeaf = node.children.length === 0;
                            const bullet = isLeaf ? "- !" : "-";
                            finalLines.push(`${indent}${bullet} ${cleanText}`);
                        }
                        
                        if (node.children.length > 0) {
                            renderNodes(node.children, depth + 1);
                        }
                    });
                };
                renderNodes(pruned.nodes, 1);
            }
        });
        
        return finalLines.join('\n');
    }

    async getAllFullProjectResults(todayObj: Date, overrideData: Record<string, ProjectOverrideData> = {}, isReset = false): Promise<ProjectResult[]> {
        const projectFiles = this.getProjectFiles();
        
        const projectResults = await Promise.all(projectFiles.map(async (file) => {
            try {
                if (!this.hasSection(file, "실행", 1) && !this.hasSection(file, "계획", 1)) return null;
                
                const pNoteName = file.basename;
                let pExecTasks: string[] = [], pPlanTasksTotal = 0, pPlanTasksDone = 0;

                if (overrideData[pNoteName]) {
                    pExecTasks = overrideData[pNoteName].execTasks || [];
                    pPlanTasksDone = overrideData[pNoteName].planTasksDone || 0;
                    pPlanTasksTotal = overrideData[pNoteName].planTasksTotal || 0;
                } else {
                    // Bug E: vault.read → getActiveViewOrFileText (에디터 미저장 내용 반영)
                    let pContent = await this.fileManager.getActiveViewOrFileText(file);
                    let pLines = pContent.split("\n");
                    let pInEx = false, pInPl = false;
                    
                    for (let l of pLines) {
                        if (REGEX.TOP_HEADING_START.test(l)) {
                            pInEx = REGEX.EXEC_HEADER.test(l.trim());
                            pInPl = REGEX.WORK_SUMMARY_HEADER.test(l.trim());
                        } else if (pInEx) {
                            if (REGEX.MATCH_TASK.test(l) || /^##\s/.test(l.trim())) pExecTasks.push(l);
                        } else if (pInPl && REGEX.MATCH_TASK.test(l)) {
                            pPlanTasksTotal++;
                            if (REGEX.MATCH_TASK_COMPLETED.test(l)) pPlanTasksDone++;
                        }
                    }
                }

                pExecTasks = pExecTasks.filter(t => {
                    if (REGEX.MATCH_TASK.test(t)) {
                        const match = t.match(REGEX.TASK_LINE);
                        if (match) {
                            const textWithId = match[3];
                            if (/;;(\s*\^[a-zA-Z0-9]+)?$/.test(textWithId.trim())) return false;
                        }
                    }
                    return true;
                });

                if (!pExecTasks.some(t => REGEX.MATCH_TASK.test(t))) return null;
                
                let pMinDiff = Infinity, pSortPri = 99;
                const pProcessed = this.applyMarkersToLines(pExecTasks.filter(t => t), todayObj);
                pProcessed.forEach(t => {
                    if (REGEX.MATCH_TASK_COMPLETED.test(t)) return;
                    const dM = t.match(REGEX.DATE_LABEL);
                    if (dM) {
                        const pts = dM[0].replace('📅','').trim().split('-');
                        const diff = Math.ceil((new Date(parseInt(pts[0]), parseInt(pts[1])-1, parseInt(pts[2])).getTime() - todayObj.getTime()) / (1000*60*60*24));
                        if (diff < pMinDiff) pMinDiff = diff;
                    }
                });
                
                if (pPlanTasksTotal > 0 && pPlanTasksDone === pPlanTasksTotal && pExecTasks.length > 0) pSortPri = 100;
                else if (pMinDiff < 0) pSortPri = 0; 
                else if (pMinDiff === 0) pSortPri = 1; 
                else if (pMinDiff === 1) pSortPri = 2; 
                else if (pMinDiff === 2) pSortPri = 3; 
                else if (pMinDiff === 3) pSortPri = 4;
                
                const calloutText = this.renderProjectCallout(pNoteName, pExecTasks, pPlanTasksDone, pPlanTasksTotal, todayObj, isReset);
                
                return { sortPri: pSortPri, minDiff: pMinDiff, noteName: pNoteName, calloutText, planTasksDone: pPlanTasksDone, planTasksTotal: pPlanTasksTotal, execTasks: pExecTasks };
            } catch (err) {
                console.error(`Error in getAllFullProjectResults for ${file.path}:`, err);
                return null;
            }
        }));

        const validResults = projectResults.filter(r => r !== null && r !== undefined);
        this.sortFullProjectResults(validResults);
        return validResults;
    }

    // 1. [포팅] 데일리 노트 내의 프로젝트 맵 파싱
    parseDailyProjectMap(content: string): Record<string, DailyData> | null {
        const range = this.getSectionRange(content, "# Project") as { start: number, end: number };
        if (!range) return null;

        const pLines = content.substring(range.start, range.end).split("\n");
        let currNote: string | null = null;
        const dailyMap: Record<string, DailyData> = {};

        for (let l of pLines) {
            const calloutMatch = l.match(/^>\s*\[![a-zA-Z]+\]-?\s+.*?\*\*([^*]+)\*\*/);
            const m = l.match(REGEX.NOTE_LINK);
            if (calloutMatch || m) {
                currNote = (calloutMatch ? calloutMatch[1] : m![1]).trim().replace(/\[\[|\]\]/g, '').split('|')[0];
                if (!dailyMap[currNote]) {
                    dailyMap[currNote] = { byId: {}, byText: {}, orderedTasks: [] };
                }
                continue;
            }
            if (currNote) {
                const cleanLine = l.replace(/^(?:> ?)+/, '');
                if (REGEX.MATCH_TASK.test(cleanLine)) {
                    const tM = cleanLine.match(REGEX.TASK_LINE);
                    if (tM) {
                        let { text, id } = this.extractIdAndText(tM[3]);
                        const isDeleted = /;;$/.test(text.trim());
                        const cleanText = isDeleted ? text.replace(/;;$/, '').trim() : text;
                        const taskData = { 
                            status: tM[2], 
                            checked: (tM[2].toLowerCase() === 'x' || tM[2] === '-'), 
                            text: cleanText, 
                            indent: tM[1], 
                            deleted: isDeleted 
                        };
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
        // BUG-14: syncDailyMap은 외부 호출부(Synchronizer, ResetManager)에서 이미 한 번 더 호출하므로
        // 여기서 이중으로 실행하면 불필요한 재처리가 발생함 → 제거하여 외부에서만 호출
        return dailyMap;
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

        let existingRowsMap: Record<string, string> = {};
        let wContent = "";

        if (wFile && wFile instanceof TFile) {
            wContent = await this.fileManager.getActiveViewOrFileText(wFile);
            const chkRange = this.getSectionRange(wContent, "# 체크리스트") as { start: number, end: number };
            if (chkRange) {
                const chkSection = wContent.substring(chkRange.start, chkRange.end);
                const lines = chkSection.split('\n');
                lines.forEach(l => {
                    if (l.trim().startsWith("|")) {
                        const cols = l.split("|");
                        if (cols.length > 2) {
                            const d = cols[1].trim();
                            if (!isNaN(parseInt(d)) && weekDaysMap[d]) {
                                existingRowsMap[d] = l;
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
                        existingRowsMap[d] = row;
                    }
                }
            });
        }

        const finalWeekRows = [];
        let sortCurr = start.clone();
        while (sortCurr.isSameOrBefore(end, 'day')) {
            const dStr = sortCurr.date().toString();
            if (existingRowsMap[dStr]) {
                finalWeekRows.push(existingRowsMap[dStr]);
            }
            sortCurr.add(1, 'day');
        }

        let weeklyTableStr = "";
        let weeklyStatsDashboard = "";
        if (finalWeekRows.length > 0) {
            const colCount = Math.max(1, tableHeader.split('|').length - 2);
            const dynamicSeparator = "|" + "---|".repeat(colCount);
            weeklyTableStr = tableHeader + "\n" + dynamicSeparator + "\n" + finalWeekRows.join('\n');
            weeklyStatsDashboard = this.generateStatsDashboard(weeklyTableStr, "주간 체크리스트 통계", "info");
        }

        if (wFile && wFile instanceof TFile) {
            if (dailyRecord) {
                const recRange = this.getSectionRange(wContent, "# 기록") as { start: number, end: number };
                const chkSectionRange = this.getSectionRange(wContent, "# 체크리스트") as { start: number, end: number };
                const statsSectionRange = this.getSectionRange(wContent, "# 통계") as { start: number, end: number };
                let insertPos = wContent.length;
                if (chkSectionRange) insertPos = Math.min(insertPos, chkSectionRange.start);
                if (statsSectionRange) insertPos = Math.min(insertPos, statsSectionRange.start);

                const archiveDayId = targetDate.format("YYYY-MM-DD");
                const daySearchStr = `> [!quote]+ 📅 **${archiveDayId}`;
                const existingIdx = wContent.indexOf(daySearchStr, recRange ? recRange.start : 0);
                if (existingIdx !== -1 && existingIdx < insertPos) {
                    let cStart = wContent.lastIndexOf("> [!quote]", existingIdx);
                    if (cStart === -1 || (recRange && cStart < recRange.start)) cStart = existingIdx;
                    let cEnd = existingIdx;
                    while (cEnd < insertPos) {
                        const nextNewline = wContent.indexOf("\n", cEnd);
                        if (nextNewline === -1 || nextNewline >= insertPos) { cEnd = insertPos; break; }
                        const nextLineStr = wContent.substring(nextNewline + 1, nextNewline + 30);
                        if (!nextLineStr.startsWith(">") || nextLineStr.includes("📅 **")) { cEnd = nextNewline; break; }
                        cEnd = nextNewline + 1;
                    }
                    wContent = wContent.substring(0, cStart).trimEnd() + "\n\n" + dailyRecord + "\n" + wContent.substring(cEnd).trimStart();
                } else {
                    wContent = wContent.substring(0, insertPos).trimEnd() + "\n\n" + dailyRecord + "\n\n" + wContent.substring(insertPos);
                }
            }

            const newChkRange = this.getSectionRange(wContent, "# 체크리스트") as { start: number, end: number };
            const chkSectionText = `# 체크리스트\n\n${weeklyTableStr}\n\n`;
            if (newChkRange) {
                wContent = wContent.substring(0, newChkRange.start) + chkSectionText + wContent.substring(newChkRange.end);
            } else {
                const statsRange = this.getSectionRange(wContent, "# 통계") as { start: number, end: number };
                if (statsRange) {
                    wContent = wContent.substring(0, statsRange.start) + chkSectionText + wContent.substring(statsRange.start);
                } else {
                    wContent = wContent.trimEnd() + `\n\n` + chkSectionText;
                }
            }

            const finalStatsRange = this.getSectionRange(wContent, "# 통계") as { start: number, end: number };
            if (weeklyStatsDashboard) {
                if (finalStatsRange) {
                    wContent = wContent.substring(0, finalStatsRange.start) + `# 통계\n${weeklyStatsDashboard}\n` + wContent.substring(finalStatsRange.end);
                } else {
                    wContent = wContent.trimEnd() + `\n\n# 통계\n${weeklyStatsDashboard}\n`;
                }
            }

            // BUG-09: pluginWrite로 교체하여 vault.on('modify')의 재동기화 트리거 방지
            await this.fileManager.pluginWrite(wFile, wContent.trim() + "\n");
        } else {
            const chkSectionText = `# 체크리스트\n\n${weeklyTableStr}\n\n`;
            const initialContent = `---\n작성일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"\n수정일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"\n---\n# ${weeklyInfo.fileName.replace('.md','')}\n\n# 기록\n\n${dailyRecord ? dailyRecord + '\n\n' : ''}${chkSectionText}# 통계\n${weeklyStatsDashboard}\n`;
            await app.vault.create(weeklyInfo.path, initialContent);
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
            const statsRange = this.getSectionRange(mContent, "# 통계") as { start: number, end: number };
            if (statsRange) {
                mContent = mContent.substring(0, statsRange.start) + `# 통계\n${dashboardStr}\n` + mContent.substring(statsRange.end);
            } else {
                mContent += `\n\n# 통계\n${dashboardStr}\n`;
            }
            // BUG-09: pluginWrite로 교체하여 vault.on('modify')의 재동기화 트리거 방지
            await this.fileManager.pluginWrite(mFile, mContent.trim() + "\n");
        } else {
            await app.vault.create(monthlyInfo.path, `---\n작성일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"\n수정일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"\n---\n# ${mTitle} 월간 기록\n\n# 기록\n\n# 통계\n${dashboardStr}\n`);
        }
        return originalContent;
    }

    // 4. [포팅] 일일 스케줄 변경사항을 개별 프로젝트 파일로 전파 동기화
    async syncDailyToProjects(app: App, dailyMap: Record<string, DailyData>, allFiles: TFile[], collisionFiles: TFile[], isReset = false): Promise<Record<string, ProjectOverrideData>> {
        const overrideData: Record<string, ProjectOverrideData> = {};

        // Bug C: 에러 발생 시 전체 롤백을 위해 대상 파일 사전 백업
        const backups = new Map<string, string>();
        for (const file of allFiles) {
            if (this.hasSection(file, "실행", 1) || this.hasSection(file, "계획", 1)) {
                backups.set(file.path, await this.fileManager.getActiveViewOrFileText(file));
            }
        }
        const syncErrors: Array<{ file: TFile; error: unknown }> = [];

        await Promise.all(allFiles.map(async (file) => {
            try {
                if (!this.hasSection(file, "실행", 1) && !this.hasSection(file, "계획", 1)) return;

                const noteName = file.basename;
                const dailyData = dailyMap[noteName] || { byId: {}, byText: {}, orderedTasks: [] };
                
                // Bug F: vault.read → getActiveViewOrFileText (에디터 미저장 내용 반영)
                let sContent = await this.fileManager.getActiveViewOrFileText(file);
                let sLines = sContent.split("\n"), mod = false, inExSec = false; 
                let finalSLines: string[] = [], skipIndent = -1, skipCheckIndent = -1, skipCheckStatus = " ";
                let handledInFile = new Set<string>();
                let execBuf: string[] = [];

                for (let l of sLines) {
                    if (REGEX.TOP_HEADING_START.test(l)) { 
                        inExSec = REGEX.EXEC_HEADER.test(l.trim()); 
                        skipIndent = -1; 
                        skipCheckIndent = -1; 
                        finalSLines.push(l); 
                        continue; 
                    }
                    let isBlank = l.trim() === ""; 
                    let currentIndent = isBlank ? 999 : (l.match(REGEX.INDENT) || [""])[0].length;
                    
                    if (inExSec && skipIndent !== -1) { 
                        if (isBlank) { mod = true; continue; } 
                        if (currentIndent > skipIndent) { mod = true; continue; } 
                        else skipIndent = -1; 
                    }
                    if (inExSec && skipCheckIndent !== -1) { 
                        if (currentIndent > skipCheckIndent) { 
                            if (REGEX.MATCH_TASK.test(l)) { 
                                const tM = l.match(REGEX.TASK_LINE); 
                                if (tM && tM[2] !== skipCheckStatus) { 
                                    l = l.replace(/^(\s*[-*+]\s+)\[.\]/, `$1[${skipCheckStatus}]`); 
                                    mod = true; 
                                } 
                            } 
                        } else skipCheckIndent = -1; 
                    }
                    if (inExSec && REGEX.MATCH_TASK.test(l)) {
                        let tM = l.match(REGEX.TASK_LINE);
                        if (tM) {
                            let { text, id } = this.extractIdAndText(tM[3]); 

                            let data = (id && dailyData.byId[id]) ? dailyData.byId[id] : (dailyData.byText[text] && dailyData.byText[text].length > 0 ? dailyData.byText[text].shift() : null);
                            if (data) handledInFile.add(id || text);
                            let currentStat = tM[2], newStat = currentStat;
                            if (data) { 

                                if (data.deleted) { skipIndent = currentIndent; mod = true; continue; } 

                                if (data.status && data.status !== ' ') newStat = data.status; 

                                else if (data.checked) newStat = 'x'; 
                                else if (currentStat.toLowerCase() === 'x' || currentStat === '-') newStat = currentStat; 
                            } else if (currentStat.toLowerCase() === 'x' || currentStat === '-') newStat = currentStat;
                            
                            if (newStat.toLowerCase() === 'x' || newStat === '-') { 
                                skipCheckIndent = currentIndent; 
                                skipCheckStatus = newStat; 
                            }
                            if (data && (currentStat !== newStat || text !== data.text)) { 

                                l = `${tM[1]} [${newStat}] ${data.text}${id ? ` ^${id}` : ''}`; 
                                mod = true; 
                            } else if (currentStat !== newStat) { 
                                l = l.replace(/^(\s*[-*+]\s+)\[.\]/, `$1[${newStat}]`); 
                                mod = true; 
                            }
                        }
                    }
                    finalSLines.push(l);
                }

                let execCompletedMap = new Map<string, string>(); 
                let tempInEx = false;
                for (let l of finalSLines) { 
                    if (!l) continue; 
                    if (REGEX.TOP_HEADING_START.test(l)) { tempInEx = REGEX.EXEC_HEADER.test(l.trim()); continue; } 
                    if (tempInEx && REGEX.MATCH_TASK_COMPLETED.test(l)) { 
                        let match = l.match(REGEX.TASK_LINE); 
                        if (match) { 
                            let { text } = this.extractIdAndText(match[3]); 
                            execCompletedMap.set(text.trim(), match[2]); 
                        } 
                    } 
                }
                if (execCompletedMap.size > 0) {
                    let tempInPl = false, plSkipIdx = -1;
                    for (let i = 0; i < finalSLines.length; i++) { 
                        let l = finalSLines[i]; 
                        if (!l) continue; 
                        if (REGEX.TOP_HEADING_START.test(l)) { tempInPl = REGEX.WORK_SUMMARY_HEADER.test(l.trim()); plSkipIdx = -1; continue; } 
                        if (tempInPl) { 
                            let cInd = l.trim() === "" ? 999 : (l.match(REGEX.INDENT) || [""])[0].length; 
                            if (plSkipIdx !== -1) { 
                                if (cInd > plSkipIdx) { 
                                    if (REGEX.MATCH_TASK.test(l) && !REGEX.MATCH_TASK_COMPLETED.test(l)) { 
                                        finalSLines[i] = l.replace(/^(\s*[-*+]\s+)\[.\]/, "$1[x]"); 
                                        mod = true; 
                                    } 
                                    continue; 
                                } else plSkipIdx = -1; 
                            } 
                            if (REGEX.MATCH_TASK.test(l)) { 
                                if (REGEX.MATCH_TASK_COMPLETED.test(l)) plSkipIdx = cInd; 
                                else { 
                                    let match = l.match(REGEX.TASK_LINE); 
                                    if (match) { 
                                        const cleanText = this.extractIdAndText(match[3]).text.trim(); 
                                        if (execCompletedMap.has(cleanText)) { 
                                            const os = execCompletedMap.get(cleanText)!; 
                                            finalSLines[i] = l.replace(/^(\s*[-*+]\s+)\[.\]/, `$1[${os}]`); 
                                            mod = true; 
                                            plSkipIdx = cInd; 
                                        } 
                                    } 
                                } 
                            } 
                        } 
                    }
                }

                if (dailyData) {
                    let lastAnchorId: string | null = null; 
                    const tasksToInsert = [];
                    if (dailyData.orderedTasks) { 
                        for (let ot of dailyData.orderedTasks) { 

                            if (ot.type === 'id') lastAnchorId = ot.key; 

                            else if (dailyData.byText[ot.key] && dailyData.byText[ot.key].length > 0) {

                                tasksToInsert.push({ anchorId: lastAnchorId, task: { ...dailyData.byText[ot.key].shift(), id: this.generateBlockId(collisionFiles) } }); 
                            }
                        } 
                    }
                    for (const [id, d] of Object.entries(dailyData.byId)) { 
                        if (!handledInFile.has(id)) tasksToInsert.push({ anchorId: null, task: { ...(d as TaskData), id } }); 
                    }
                    if (tasksToInsert.length > 0) {
                        let exStart = -1, exEnd = finalSLines.length, inExSec = false;
                        for (let i = 0; i < finalSLines.length; i++) { 
                            let l = finalSLines[i]; 
                            if (!l) continue; 
                            if (REGEX.TOP_HEADING_START.test(l)) { 
                                if (inExSec) { exEnd = i; break; } 
                                inExSec = REGEX.EXEC_HEADER.test(l.trim()); 
                                if (inExSec) exStart = i; 
                            } 
                        }
                        if (exStart !== -1) {
                            const ins = new Map<string, TaskData[]>(); 
                            const fbt: TaskData[] = [];
                            for (let item of tasksToInsert) { 
                                if (item.anchorId) { 
                                    if (!ins.has(item.anchorId)) ins.set(item.anchorId, []); 
                                    ins.get(item.anchorId)!.push(item.task); 
                                } else fbt.push(item.task); 
                            }
                            let lastTIdx = exStart;
                            for (let i = exEnd - 1; i > exStart; i--) { 
                                let l = finalSLines[i]; 
                                if (!l) continue; 
                                if (REGEX.MATCH_TASK.test(l)) { 
                                    if (lastTIdx === exStart) lastTIdx = i; 
                                    const m = l.match(REGEX.TASK_LINE); 
                                    if (m) { 
                                        const { id } = this.extractIdAndText(m[3]); 
                                        if (id && ins.has(id)) { 
                                            const tl = ins.get(id)!; 
                                            let ia = i + 1; 
                                            const ntl = tl.map(nt => {

                                                return `${nt.indent} [${nt.status || (nt.checked ? 'x' : ' ')}] ${nt.text} ^${nt.id}`;
                                            }); 
                                            finalSLines.splice(ia, 0, ...ntl); 
                                            mod = true; 
                                            exEnd += ntl.length; 
                                            if (lastTIdx === i) lastTIdx = ia + ntl.length - 1; 
                                            ins.delete(id); 
                                        } 
                                    } 
                                } 
                            }
                            const rem = []; 
                            for (let list of ins.values()) rem.push(...list); 
                            rem.push(...fbt);
                            if (rem.length > 0) { 
                                const ntl = rem.map(nt => `${nt.indent} [${nt.status || (nt.checked ? 'x' : ' ')}] ${nt.text} ^${nt.id}`); 
                                finalSLines.splice(lastTIdx + 1, 0, ...ntl); 
                                mod = true; 
                            }
                        }
                    }
                }

                if (isReset) {
                    let cleanedLines: string[] = [], inCleanExSec = false;
                    for (let i = 0; i < finalSLines.length; i++) { 
                        const cl = finalSLines[i]; 
                        if (REGEX.TOP_HEADING_START.test(cl)) { 
                            inCleanExSec = REGEX.EXEC_HEADER.test(cl.trim()); 
                            if (!inCleanExSec && execBuf.length > 0) { 
                                cleanedLines.push(...this.filterResetTasks(execBuf, true)); 
                                execBuf = []; 
                            } 
                            cleanedLines.push(cl); 
                            continue; 
                        } 
                        if (inCleanExSec) execBuf.push(cl); 
                        else cleanedLines.push(cl); 
                    }
                    if (execBuf.length > 0) { 
                        cleanedLines.push(...this.filterResetTasks(execBuf, true)); 
                        execBuf = []; 
                    }
                    if (mod || cleanedLines.join("\n") !== finalSLines.join("\n")) { 
                        mod = true; 
                        finalSLines = cleanedLines; 
                    }
                }
                
                // BUG-10: pluginWrite로 교체하여 프로젝트 파일 저장이 modifiedFiles에 쌓이는 것을 방지
                if (mod) await this.fileManager.pluginWrite(file, finalSLines.join("\n"));

                let execTasks: string[] = [], planTasksTotal = 0, planTasksDone = 0;
                let pInEx = false, pInPl = false;
                for (let l of finalSLines) { 
                    if (!l) continue; 
                    if (REGEX.TOP_HEADING_START.test(l)) { 
                        pInEx = REGEX.EXEC_HEADER.test(l.trim()); 
                        pInPl = REGEX.WORK_SUMMARY_HEADER.test(l.trim()); 
                    } else if (pInEx) { 
                        if (REGEX.MATCH_TASK.test(l) || /^##\s/.test(l.trim())) execTasks.push(l); 
                    } else if (pInPl && REGEX.MATCH_TASK.test(l)) { 
                        planTasksTotal++; 
                        if (REGEX.MATCH_TASK_COMPLETED.test(l)) planTasksDone++; 
                    } 
                }
                overrideData[noteName] = { execTasks, planTasksDone, planTasksTotal };

            } catch (e) { 
                console.error(`Sync error on [${file.path}]:`, e);
                syncErrors.push({ file, error: e });
            }
        }));

        // Bug C: 하나라도 실패하면 백업에서 전체 롤백
        if (syncErrors.length > 0) {
            console.warn(`[syncDailyToProjects] ${syncErrors.length}개 파일 동기화 실패, 전체 롤백 시작`);
            for (const [path, backup] of backups.entries()) {
                const f = app.vault.getAbstractFileByPath(path);
                if (f instanceof TFile) {
                    try { await this.fileManager.pluginWrite(f, backup); }
                    catch (re) { console.error(`롤백 실패: ${path}`, re); }
                }
            }
            throw new Error(`${syncErrors.length}개 파일 동기화 실패, 전체 롤백 완료`);
        }

        return overrideData;
    }

    // BUG-13: moment의 .date(n) setter는 체이닝으로 받아야 안전함
    getActualDate(now: moment.Moment, day: number): moment.Moment {
        return now.clone().date(day);
    }

    cleanTaskText(text: string): string {
        return text.trim();
    }

}


/* eslint-enable @typescript-eslint/no-unsafe-assignment -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-member-access -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-call -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-argument -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-return -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unnecessary-type-assertion -- Re-enable strict rules */
