import { Editor, MarkdownView, Notice } from "obsidian";

export class DocFormatter {
    /**
     * 언어별 기본 보일러플레이트(실행 필수 뼈대 문법) 템플릿 생성
     */
    public static getDefaultBoilerplate(lang: string): string {
        const l = lang.toLowerCase().trim();
        switch (l) {
            case "java":
                return [
                    "public class Main {",
                    "    public static void main(String[] args) {",
                    "        ",
                    "    }",
                    "}"
                ].join("\n");
            case "c":
                return [
                    "#include <stdio.h>",
                    "",
                    "int main() {",
                    "    ",
                    "    return 0;",
                    "}"
                ].join("\n");
            case "cpp":
            case "c++":
                return [
                    "#include <iostream>",
                    "using namespace std;",
                    "",
                    "int main() {",
                    "    ",
                    "    return 0;",
                    "}"
                ].join("\n");
            case "python":
            case "py":
                return [
                    "def main():",
                    "    ",
                    "",
                    "if __name__ == \"__main__\":",
                    "    main()"
                ].join("\n");
            case "html":
                return [
                    "<!DOCTYPE html>",
                    "<html>",
                    "<head>",
                    "    <meta charset=\"UTF-8\">",
                    "    <title>Title</title>",
                    "</head>",
                    "<body>",
                    "    ",
                    "</body>",
                    "</html>"
                ].join("\n");
            default:
                return "";
        }
    }

    /**
     * 문자열 리터럴 및 주석을 제거한 순수 코드 반환 (중괄호/콜론 안전 검사용)
     */
    private static stripStringsAndComments(line: string): string {
        return line
            .replace(/\/\*[\s\S]*?\*\//g, "") // 블록 주석 제거
            .replace(/\/\/.*$/g, "")           // 한 줄 주석 제거
            .replace(/#.*$/g, "")              // 파이썬 한 줄 주석 제거
            .replace(/"(?:[^"\\]|\\.)*"/g, '""') // 쌍따옴표 문자열 제거
            .replace(/'(?:[^'\\]|\\.)*'/g, "''"); // 홑따옴표 문자열 제거
    }

    /**
     * Java / C / C++ / JS / TS C-스타일 포매터
     * - 중괄호 { } 계층 구조 기반 4칸 들여쓰기 자동 정렬
     * - 키워드 및 중괄호 주변 공백 표준화 (if (...) {, } else {, } else if (...) {)
     * - 문자열/주석 내부의 중괄호는 오작동 없이 안전하게 무시
     */
    private static formatCStyleCode(lines: string[]): string {
        const formatted: string[] = [];
        let indentLevel = 0;
        const indentStr = "    "; // 4칸 스페이스

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // 빈 줄 보존
            if (line.length === 0) {
                formatted.push("");
                continue;
            }

            // 키워드 주변 공백 표준화
            line = line
                .replace(/^(\s*)\}else\s+if\s*\(/g, "} else if (")
                .replace(/^(\s*)\}else\s*\{/g, "} else {")
                .replace(/^(\s*)\}else\b/g, "} else")
                .replace(/^(\s*)if\s*\(/g, "if (")
                .replace(/^(\s*)else\s+if\s*\(/g, "else if (")
                .replace(/^(\s*)for\s*\(/g, "for (")
                .replace(/^(\s*)while\s*\(/g, "while (")
                .replace(/^(\s*)switch\s*\(/g, "switch (")
                .replace(/\)\s*\{/g, ") {")
                .trim();

            const cleanCode = this.stripStringsAndComments(line);

            // 닫는 중괄호로 시작하면 현재 줄 들여쓰기 1단계 감소
            let closingBracesAtStart = 0;
            const closeMatch = cleanCode.match(/^(\}+)/);
            if (closeMatch) {
                closingBracesAtStart = closeMatch[1].length;
            }

            const currentIndent = Math.max(0, indentLevel - closingBracesAtStart);
            formatted.push(indentStr.repeat(currentIndent) + line);

            // 줄 안의 여는 중괄호와 닫는 중괄호 개수 차이 계산 (문자열 밖 순수 코드 기준)
            const openCount = (cleanCode.match(/\{/g) || []).length;
            const closeCount = (cleanCode.match(/\}/g) || []).length;
            indentLevel = Math.max(0, indentLevel + openCount - closeCount);
        }

        return formatted.join("\n");
    }

    /**
     * Python PEP 8 표준 포매터
     * - match-case, if-elif-else, for, while, def, class 콜론(:) 기반 스택 들여쓰기
     * - match 내부 case와 실행문(8칸) 계단식 정렬 완벽 보정
     * - 문자열 내부의 콜론은 오작동 없이 안전하게 무시
     */
    private static formatPythonCode(lines: string[]): string {
        const formatted: string[] = [];
        let indentLevel = 0;
        const indentStr = "    "; // 4칸 스페이스
        const blockStack: { type: string; baseIndent: number }[] = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            if (line.length === 0) {
                formatted.push("");
                continue;
            }

            line = line.trim();
            const cleanCode = this.stripStringsAndComments(line);

            // 1. elif, else, except, finally 는 상위 블록에 맞춰 들여쓰기 1단계 감소
            if (/^(?:elif|else|except|finally)\b/.test(cleanCode)) {
                if (blockStack.length > 0) {
                    const top = blockStack[blockStack.length - 1];
                    indentLevel = top.baseIndent;
                } else {
                    indentLevel = Math.max(0, indentLevel - 1);
                }
            }
            // 2. case 는 match 내부의 기준 들여쓰기(baseIndent + 1)로 정렬
            else if (/^case\b/.test(cleanCode)) {
                // 직전 match 블록 찾기
                const matchBlock = [...blockStack].reverse().find(b => b.type === "match");
                if (matchBlock) {
                    indentLevel = matchBlock.baseIndent + 1;
                } else {
                    indentLevel = 1;
                }
            }

            formatted.push(indentStr.repeat(indentLevel) + line);

            // 3. 현재 줄이 콜론(:)으로 끝나면 다음 줄부터 들여쓰기 1단계 증가
            if (/:\s*$/.test(cleanCode)) {
                const isMatch = /^match\b/.test(cleanCode);
                blockStack.push({ type: isMatch ? "match" : "block", baseIndent: indentLevel });
                indentLevel++;
            }
        }

        return formatted.join("\n");
    }

    /**
     * 종합 코드 블록 포맷팅
     */
    public static formatCodeBlock(code: string, lang: string): string {
        const rawLines = code.split("\n");
        const lines: string[] = [];
        let wasPrevEmpty = false;

        // 앞뒤 트림 및 2줄 이상 연속 빈 줄을 1줄로 압축 (IDE 표준)
        for (const line of rawLines) {
            const trimmed = line.trim();
            if (trimmed.length === 0) {
                if (!wasPrevEmpty && lines.length > 0) {
                    lines.push("");
                    wasPrevEmpty = true;
                }
            } else {
                lines.push(trimmed);
                wasPrevEmpty = false;
            }
        }

        while (lines.length > 0 && lines[lines.length - 1] === "") {
            lines.pop();
        }

        // 빈 코드 블록인 경우 ➔ 언어별 기본 보일러플레이트 자동 생성!
        if (lines.length === 0) {
            return this.getDefaultBoilerplate(lang);
        }

        const normalizedLang = lang.toLowerCase().trim();
        const isCStyle = ["java", "c", "cpp", "javascript", "js", "typescript", "ts", "cs", "css"].includes(normalizedLang);

        if (isCStyle) {
            return this.formatCStyleCode(lines);
        }

        if (normalizedLang === "python" || normalizedLang === "py") {
            return this.formatPythonCode(lines);
        }

        return lines.join("\n");
    }

    /**
     * 문서 전체 또는 선택 영역 종합 스마트 포맷팅
     * 1. 프론트매터(YAML) 영역 안전 보호
     * 2. * 리스트 ➔ - 리스트 자동 변환
     * 3. 구분선(---) 앞뒤로 1줄 공백 보장 (가독성 & 마크다운 문법 보호)
     * 4. 리스트 사이 / 헤더 아래 / 연속된 빈 줄 완전 제거 (콤팩트 정돈)
     * 5. 모든 코드 블록(Java, C, Python 등) 표준 IDE 포맷팅 적용
     */
    public static formatText(text: string): string {
        const lines = text.split("\n");
        const result: string[] = [];
        let inCodeBlock = false;
        let codeBlockLang = "";
        let codeBuffer: string[] = [];
        let inFrontmatter = false;
        let frontmatterCount = 0;
        let prevLineType: "header" | "list" | "empty" | "code" | "text" | "frontmatter" | "hr" = "empty";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // ── 1. Frontmatter (YAML 메타데이터) 보호 ──
            if (trimmed === "---" && (i === 0 || inFrontmatter || frontmatterCount < 2)) {
                frontmatterCount++;
                if (frontmatterCount === 1 && i === 0) {
                    inFrontmatter = true;
                    result.push(line);
                    prevLineType = "frontmatter";
                    continue;
                } else if (frontmatterCount === 2 && inFrontmatter) {
                    inFrontmatter = false;
                    result.push(line);
                    prevLineType = "frontmatter";
                    continue;
                }
            }

            if (inFrontmatter) {
                result.push(line);
                continue;
            }

            // ── 2. 코드 블록 시작/종료 감지 ──
            if (trimmed.startsWith("```")) {
                if (!inCodeBlock) {
                    if (result.length > 0 && result[result.length - 1] !== "" && prevLineType !== "empty" && prevLineType !== "frontmatter" && prevLineType !== "header") {
                        result.push("");
                    }
                    inCodeBlock = true;
                    codeBlockLang = trimmed.replace(/^```/, "").trim();
                    codeBuffer = [];
                    result.push(line);
                    prevLineType = "code";
                } else {
                    inCodeBlock = false;
                    const formattedCode = this.formatCodeBlock(codeBuffer.join("\n"), codeBlockLang);
                    if (formattedCode.length > 0) {
                        result.push(formattedCode);
                    }
                    result.push(line);
                    prevLineType = "code";
                }
                continue;
            }

            if (inCodeBlock) {
                codeBuffer.push(line);
                continue;
            }

            // ── 3. 일반 본문 빈 줄 및 불필요한 공백 제거 ──
            if (trimmed.length === 0) {
                if (prevLineType === "list" || prevLineType === "header" || prevLineType === "empty" || prevLineType === "frontmatter") {
                    continue;
                }
                result.push("");
                prevLineType = "empty";
                continue;
            }

            // ── 4. 구분선 (---, ***, ___) 앞뒤 1줄 공백 보장 ──
            const isHr = /^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed);
            if (isHr) {
                if (result.length > 0 && result[result.length - 1] !== "" && prevLineType !== "empty" && prevLineType !== "frontmatter") {
                    result.push("");
                }
                result.push(trimmed);
                prevLineType = "hr";
                continue;
            }

            if (prevLineType === "hr") {
                result.push("");
            }

            // ── 5. * 리스트 ➔ - 리스트 변환 (공백 들여쓰기 보존) ──
            let processedLine = line;
            const listMatch = line.match(/^(\s*)\*\s+(.*)$/);
            if (listMatch) {
                processedLine = `${listMatch[1]}- ${listMatch[2]}`;
            }

            // ── 6. 표(Table) 내부의 지저분한 역슬래시 파이프(\|) 자동 정돈 ──
            const isTableLine = trimmed.startsWith("|") && trimmed.endsWith("|") && !/^\|(?:\s*:?-+:?\s*\|)+$/.test(trimmed);
            if (isTableLine) {
                const cells = processedLine.split("|");
                for (let c = 1; c < cells.length - 1; c++) {
                    const rawCell = cells[c];
                    const trimmedCell = rawCell.trim();
                    if (trimmedCell === "\\|\\|" || trimmedCell === "||" || trimmedCell === "`\\|\\|`" || trimmedCell === "`||`") {
                        cells[c] = ` <code>&#124;&#124;</code> `;
                    } else if (trimmedCell === "\\|" || trimmedCell === "|" || trimmedCell === "`\\|`" || trimmedCell === "`|`") {
                        cells[c] = ` <code>&#124;</code> `;
                    } else if (rawCell.includes("\\|") || rawCell.includes("`|")) {
                        cells[c] = rawCell
                            .replace(/`\\?\|\\?\|`/g, "<code>&#124;&#124;</code>")
                            .replace(/`\\?\|`/g, "<code>&#124;</code>")
                            .replace(/\\\|\\\|/g, "<code>&#124;&#124;</code>")
                            .replace(/\\\|/g, "<code>&#124;</code>");
                    }
                }
                processedLine = cells.join("|");
            }

            const isList = /^\s*[-*+]\s+/.test(processedLine);
            const isHeader = /^#+\s+/.test(processedLine);

            result.push(processedLine.trimEnd());

            if (isList) {
                prevLineType = "list";
            } else if (isHeader) {
                prevLineType = "header";
            } else {
                prevLineType = "text";
            }
        }

        if (inCodeBlock && codeBuffer.length > 0) {
            result.push(this.formatCodeBlock(codeBuffer.join("\n"), codeBlockLang));
        }

        while (result.length > 0 && result[result.length - 1] === "") {
            result.pop();
        }

        return result.join("\n");
    }

    /**
     * 에디터에서 F5 포맷터 실행 진입점
     * @param target MarkdownView 또는 Editor 인스턴스
     * @param view 선택적 MarkdownView
     */
    public static execute(target: MarkdownView | Editor, view?: MarkdownView): void {
        const editor = (target instanceof MarkdownView ? target.editor : target) || view?.editor;
        if (!editor) return;

        const selection = editor.getSelection();

        // 1. 드래그 선택 영역이 있는 경우 ➔ 선택 영역만 포맷팅
        if (selection && selection.length > 0) {
            const formatted = this.formatText(selection);
            editor.replaceSelection(formatted);
            new Notice("선택 영역 포맷팅 완료! ✨");
            return;
        }

        // 2. 상태 머신을 활용한 정확한 코드 블록 감지 (문서 처음부터 순차 파싱)
        const cursor = editor.getCursor();
        const docText = editor.getValue();
        const lines = docText.split("\n");

        let targetCodeBlock: { startLine: number; endLine: number; lang: string } | null = null;
        let currentBlockStart = -1;
        let currentBlockLang = "";

        for (let i = 0; i < lines.length; i++) {
            const t = lines[i].trim();
            if (t.startsWith("```")) {
                if (currentBlockStart === -1) {
                    // 코드 블록 시작 백틱 발견
                    currentBlockStart = i;
                    currentBlockLang = t.replace(/^```/, "").trim();
                } else {
                    // 코드 블록 닫는 백틱 발견
                    const start = currentBlockStart;
                    const end = i;
                    const lang = currentBlockLang;
                    currentBlockStart = -1;
                    currentBlockLang = "";

                    // 커서가 이 코드 블록 범위 안에 있는지 판정
                    if (cursor.line >= start && cursor.line <= end) {
                        targetCodeBlock = { startLine: start, endLine: end, lang };
                        break;
                    }
                }
            }
        }

        // 커서가 유효한 코드 블록 내부에 위치한 경우
        if (targetCodeBlock) {
            const { startLine, endLine, lang } = targetCodeBlock;
            const insideLines = lines.slice(startLine + 1, endLine);
            const isInitiallyEmpty = insideLines.join("").trim().length === 0;
            const formattedInside = this.formatCodeBlock(insideLines.join("\n"), lang);
            
            const from = { line: startLine + 1, ch: 0 };
            const to = { line: endLine, ch: 0 };
            
            const replacement = formattedInside.length > 0 ? formattedInside + "\n" : "";
            editor.replaceRange(replacement, from, to);

            if (isInitiallyEmpty && formattedInside.length > 0) {
                const norm = lang.toLowerCase().trim();
                if (norm === "java") {
                    editor.setCursor({ line: startLine + 3, ch: 8 });
                } else if (norm === "c" || norm === "cpp" || norm === "c++") {
                    editor.setCursor({ line: startLine + 4, ch: 4 });
                } else if (norm === "python" || norm === "py") {
                    editor.setCursor({ line: startLine + 2, ch: 4 });
                }
                new Notice(`✨ ${lang.toUpperCase()} 기본 실행 뼈대 문법 자동 생성!`);
            } else {
                new Notice(`${lang ? lang.toUpperCase() + " " : ""}코드 블록 포맷팅 완료! ☕`);
            }
            return;
        }

        // 3. 일반 본문인 경우 ➔ 문서 전체 스마트 정돈
        const formattedDoc = this.formatText(docText);
        if (formattedDoc !== docText) {
            editor.setValue(formattedDoc);
            editor.setCursor(cursor);
            new Notice("문서 전체 스마트 정돈 완료! 🧹✨");
        } else {
            new Notice("이미 깔끔하게 정돈된 문서입니다. 👍");
        }
    }
}
