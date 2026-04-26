import { TFile, App, moment, HeadingCache } from "obsidian";
import { MyWorldSettings, TableStats } from "./types";

export const CONFIG = {
    PATHS: {
        PROJECT_DIR: "1. project",
        MAIN_SCHEDULE: "1. project/-main/01.스케줄 관리.md",
        ARCHIVE_DIR: "4. archive/98.schedule"
    },
    SETTINGS: {
        PROGRESS_BAR_LENGTH: 10,
        TAB_SIZE: 4
    }
};

export const REGEX = {
    EXTRACT_ID: /^(.*?)(?:\s*\^([a-zA-Z0-9]+))?$/,
    TASK_LINE: /^(\s*[-*+])\s+\[(.)\]\s+(.*)$/,
    MATCH_TASK: /^\s*[-*+]\s+\[.\]/,
    MATCH_TASK_INCOMPLETE: /^[\s]*[-*+]\s+\[ \]/,
    MATCH_TASK_COMPLETED: /^[\s]*[-*+]\s+\[[^ \]]\]/,
    STATUS_MATCH: /^[\s]*[-*+]\s+\[(.)\]/,
    DATE_LABEL: /📅\s*\d{4}-\d{2}-\d{2}/,
    HEADING_START: /^#+\s+/,
    TOP_HEADING_START: /^#\s+/,
    EXEC_HEADER: /^#\s+실행$/,
    WORK_SUMMARY_HEADER: /^#\s+계획$/,
    NOTE_LINK: /^##\s+(.+)$/,
    SUMMARY_MATCH: /^[\s]*[-*+]\s+\[([xX ])\]/,
    CLEAN_PREFIX: /^(?:#D-\d+|#Past)\s*/,
    MARKER_REPLACE_2: /(\[[^\]]\])\s*/,
    BLOCK_MARKER_REPLACE: /(\[[^\]]\])\s*(?:#D-\d+|#Past)\s*/,
    PROJECT_TODO_SECTION: /(?:^|\n)##\s+프로젝트(?:\n|$)(?:[\s\S]*?)(?=\n#{1,6}\s|$)/g,
    TODO_HEADER: /(?:^|\n)#\s+Todo(?=\n|$)/i,
    INDENT: /^\s*/
};

export const MARKER_PRI: Record<string, number> = { '#Past': 1, '#D-0': 2, '#D-1': 3, '#D-2': 4, '#D-3': 5, '#D-7': 6, '': 99 };
export const EMOJI_MAP: Record<string, string> = { "1": "🟦", "2": "🟩", "3": "🟨", "4": "🟥", "5": "🔹", "6": "🔻" };

export class TaskUtils {
    app: App;
    settings: MyWorldSettings;

    constructor(app: App, settings: MyWorldSettings) {
        this.app = app;
        this.settings = settings;
    }

    getAdjustedNow() {
        const now = moment();
        if (now.hour() < 1) now.subtract(1, 'days');
        return now;
    }

    preprocessContent(content: string) {
        if (!content) return "";
        return content.replace(/\r\n/g, '\n')
                      .replace(/\t/g, '    ')
                      .replace(/\n{3,}/g, '\n\n');
    }

    async ensureFolder(path: string) {
        const parts = path.split('/');
        let current = '';
        for (const p of parts) {
            current = current === '' ? p : `${current}/${p}`;
            if (!this.app.vault.getAbstractFileByPath(current)) {
                await this.app.vault.createFolder(current);
            }
        }
    }

    generateBlockId() {
        return Math.random().toString(36).substring(2, 8);
    }

    extractIdAndText(rawText: string) {
        if (!rawText) return { text: "", id: null };
        const m = rawText.match(REGEX.EXTRACT_ID);
        if (!m) return { text: rawText, id: null };
        const text = m[1].replace(REGEX.CLEAN_PREFIX, '').trim();
        return { text, id: m[2] || null };
    }

    renderProgressBar(completed: number, total: number, noteName?: string) {
        const titleLink = noteName ? `[[${noteName}|진행도]]` : "진행도";
        const safeTotal = Math.max(total, 1);
        const pct = Math.round((completed / safeTotal) * 100);
        const barLength = CONFIG.SETTINGS.PROGRESS_BAR_LENGTH;
        const filled = Math.min(barLength, Math.max(0, Math.round((completed / safeTotal) * barLength)));
        return `**${titleLink}**: ${pct}% (${completed}/${total}) ${"■".repeat(filled)}${"□".repeat(barLength - filled)}`;
    }

    getMarker(dateStr: string, today: Date) {
        if (!dateStr) return "";
        const cleanDate = dateStr.replace('📅', '').trim();
        const parts = cleanDate.split('-');
        if (parts.length < 3) return "";
        const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const diff = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diff < 0) return "#Past ";
        if (diff === 0) return "#D-0 ";
        if (diff === 1) return "#D-1 ";
        if (diff === 2) return "#D-2 ";
        if (diff === 3) return "#D-3 ";
        if (diff >= 4 && diff <= 7) return "#D-7 ";
        return "";
    }

    applyMarkersToLines(linesArray: string[], todayObj: Date) {
        if (!linesArray || !Array.isArray(linesArray)) return [];
        const markerCache: Record<string, string> = {};

        const lineInfos = linesArray.map((l) => {
            const ind = l.trim() === "" ? 999 : (l.match(REGEX.INDENT) || [""])[0].length;
            if (!REGEX.MATCH_TASK.test(l)) return { line: l, ind, isTask: false, isCompleted: false, m: '', hasDate: false, ownM: '', propStatus: '' };
            const isCompleted = REGEX.MATCH_TASK_COMPLETED.test(l);
            const dM = l.match(REGEX.DATE_LABEL);
            let m = '';
            if (!isCompleted && dM) {
                if (!markerCache[dM[0]]) markerCache[dM[0]] = this.getMarker(dM[0], todayObj);
                m = markerCache[dM[0]];
            }
            return { line: l, ind, isTask: true, isCompleted, m, ownM: m, hasDate: !!dM, propStatus: '' };
        });


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

        for (let i = 0; i < lineInfos.length; i++) {
            if (lineInfos[i].isTask && lineInfos[i].isCompleted) {
                for (let j = i + 1; j < lineInfos.length; j++) {
                    if (lineInfos[j].ind <= lineInfos[i].ind) break;
                    if (lineInfos[j].isTask) {
                        if (!lineInfos[j].isCompleted) {
                            lineInfos[j].isCompleted = true;
                            const pStatus = (lineInfos[i].line.match(REGEX.STATUS_MATCH) || ["", "x"])[1];
                            lineInfos[j].propStatus = pStatus;
                        }
                    }
                }
            }
        }

        return lineInfos.map((d) => {
            if (!d.isTask) return d.line;
            let l = d.line.replace(REGEX.BLOCK_MARKER_REPLACE, '$1 ').replace(REGEX.MARKER_REPLACE_2, `$1 ${d.m}`);
            if (d.isCompleted) {
                const s = d.propStatus || (d.line.match(REGEX.STATUS_MATCH) || ["", "x"])[1];
                l = l.replace(/\[.\]/, `[${s}]`);
            }
            return l;
        });
    }

    filterResetTasks(lines: string[], isReset: boolean) {
        if (!isReset) return lines;
        let filtered: string[] = [], skipIndent = -1;
        for (const l of lines) {
            let isBlank = l.trim() === "";
            let actualIndent = (l.match(REGEX.INDENT) || [""])[0].length;
            let currentIndent = isBlank ? 999 : actualIndent;
            
            if (skipIndent !== -1) {
                if (isBlank) continue;
                else if (currentIndent > skipIndent) continue;
                else skipIndent = -1;
            }

            if (REGEX.MATCH_TASK.test(l)) {
                if (REGEX.MATCH_TASK_COMPLETED.test(l)) {
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
                    if (REGEX.MATCH_TASK.test(next)) { hasContent = true; break; }
                }
                if (hasContent) finalFiltered.push(cur);
            } else {
                finalFiltered.push(cur);
            }
        }
        return finalFiltered;
    }

    getCache(file: TFile) {
        return this.app.metadataCache.getFileCache(file);
    }

    getSectionRange(file: TFile, sectionName: string, level = 1, fallbackLines: string[] | null = null) {
        const cache = this.getCache(file);
        if (cache && cache.headings) {
            const hIdx = cache.headings.findIndex((h: HeadingCache) => h.heading === sectionName && h.level === level);
            if (hIdx !== -1) {
                const startLine = cache.headings[hIdx].position.start.line;
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
        
        if (fallbackLines) {
            const prefix = "#".repeat(level) + " " + sectionName;
            let startLine = fallbackLines.findIndex(l => l.startsWith(prefix));
            if (startLine === -1) return null;
            let endLine = -1;
            for (let i = startLine + 1; i < fallbackLines.length; i++) {
                if (/^#{1,6}\s/.test(fallbackLines[i])) { endLine = i; break; }
            }
            return { startLine, endLine };
        }
        return null; 
    }

    renderProjectCallout(noteName: string, rawTasks: string[], done: number, total: number, todayObj: Date, statBar: string, isReset = false) {
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
        let sTitle = `💭 **${noteName}** ${pStr}`;
        if (taskInfos.filter(ti => ti.isTask).length === 0 && total === 0) return "";
        else if (!hasIncomp && taskInfos.filter(ti => ti.isTask).length > 0) { cType = "quote"; sTitle = `🏁 **${noteName}** ${pStr}`; }
        else {
            if (minDiff < 0) { cType = "danger"; sTitle = `🔥 **${noteName}** ${pStr}`; }
            else if (minDiff === 0) { cType = "danger"; sTitle = `🚨 **${noteName}** ${pStr}`; }
            else if (minDiff === 1) { cType = "attention"; sTitle = `⚠️ **${noteName}** ${pStr}`; }
            else if (minDiff === 2) { cType = "check"; sTitle = `✅ **${noteName}** ${pStr}`; }
            else if (minDiff === 3) { cType = "info"; sTitle = `ℹ️ **${noteName}** ${pStr}`; }
        }

        let body = (total > 0 ? `> ${statBar}\n` : "") + (total > 0 && taskInfos.length > 0 ? `> ---\n` : "");
        taskInfos.filter(ti => ti.isTask || /^##\s/.test(ti.line.trim())).forEach(ti => {
            body += `> ${ti.line}\n`;
        });

        return `> [!${cType}] ${sTitle}\n${body.trimEnd()}`;
    }

    parseTableStats(linesStrs: string[], headers: string): TableStats {
        const sq: Record<string, number> = { "🟦": 0, "🟩": 0, "🟨": 0, "🟥": 0 };
        const ar: Record<string, number> = { "🔹": 0, "🔻": 0 };
        if (!headers || !linesStrs || linesStrs.length === 0) return { sq, ar, cs: {}, tableHeaders: [] };

        const tableHeaders = headers.split("|").map(s => s.trim());
        const cs: Record<string, Record<string, number>> = {};

        linesStrs.forEach(l => {
            const cols = l.split("|");
            if (cols.length > 2) {
                for (let c = 2; c < cols.length; c++) {
                    const v = cols[c].trim();
                    if (!v) continue;
                    const emoji = EMOJI_MAP[v] || v;
                    const hw = tableHeaders[c];

                    if (hw && hw !== "" && hw !== "날짜") {
                        if (!cs[hw]) cs[hw] = { "🟦": 0, "🟩": 0, "🟨": 0, "🟥": 0, "🔹": 0, "🔻": 0 };
                        if (Object.prototype.hasOwnProperty.call(cs[hw], emoji)) cs[hw][emoji]++;
                    }

                    if (Object.prototype.hasOwnProperty.call(sq, emoji)) sq[emoji]++;
                    if (Object.prototype.hasOwnProperty.call(ar, emoji)) ar[emoji]++;
                }
            }
        });
        return { sq, ar, cs, tableHeaders };
    }

    getCombinedBar(countsObj: Record<string, number>, total: number, keys: string[], len = 10) {
        if (total === 0) return "⬜".repeat(len);
        let bar = "", acc = 0, accFrac = 0;
        for (const k of keys) {
            const exact = (countsObj[k] / total) * len;
            accFrac += exact;
            const c = Math.round(accFrac) - acc;
            bar += k.repeat(c);
            acc += c;
        }
        return bar;
    }

    renderStatsDashboard(sq: Record<string, number>, ar: Record<string, number>, cs: Record<string, Record<string, number>>, title = "체크리스트 통계", type = "info") {
        const tSq = Object.values(sq).reduce((a: number, b: number) => a + b, 0);
        const tAr = Object.values(ar).reduce((a: number, b: number) => a + b, 0);
        if (tSq === 0 && tAr === 0) return `> [!warning] ${title}: 표시할 데이터가 없습니다.\n`;

        let res = `> [!${type}]+ 📈 **${title}**\n`;
        res += `> ⚖️ **난이도 조절 분기점**: 🔹 ${ar["🔹"] || 0}회 / 🔻 ${ar["🔻"] || 0}회\n`;
        res += `> \n`;
        res += `> | 상태 | 횟수 | 비율 | 진행도 |\n`;
        res += `> | :--: | :--: | :--: | :-- |\n`;

        const colors = ["🟦", "🟩", "🟨", "🟥"];
        colors.forEach(c => {
            const count = sq[c] || 0;
            const percent = tSq > 0 ? (count / tSq * 100).toFixed(1) : "0.0";
            const barCount = Math.round(tSq > 0 ? (count / tSq * 10) : 0);
            const bar = c.repeat(barCount) + "⬜".repeat(10 - barCount);
            res += `> | ${c} | ${count} | ${percent}% | ${bar} |\n`;
        });

        res += `> \n`;
        res += `> | 항목 | 세부 그래프 | 조절 지표 |\n`;
        res += `> | :-- | :-- | :--: |\n`;

        for (const [name, counts] of Object.entries(cs)) {
            const detailColors = ["🟦", "🟩", "🟨", "🟥"];
            const total = detailColors.reduce((sum, c) => sum + (counts[c] || 0), 0);
            
            if (total > 0) {
                const detailBar = this.getCombinedBar(counts, total, detailColors, 10);
                const indicator = (counts["🔹"] > 0 ? `🔹 ${counts["🔹"]}` : "") + (counts["🔻"] > 0 ? ` 🔻 ${counts["🔻"]}` : "");
                res += `> | ${name} | ${detailBar} | ${indicator || "-"} |\n`;
            }
        }
        return res;
    }

    convertTableMarkers(tableContent: string) {
        if (!tableContent) return "";
        let lines = tableContent.trim().split("\n");
        let headers: string[] = [];

        return lines.map(line => {
            if (!line.includes("|") || line.startsWith("#")) return line;
            let parts = line.split("|");
            if (line.includes("---")) return line;
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
                parts[i] = colText.replace(/^\s*([1-6])\s*$/, (match, p1) => {
                    return EMOJI_MAP[p1] ? match.replace(p1, EMOJI_MAP[p1]) : match;
                });
            }
            return parts.join("|");
        }).join("\n");
    }
}
