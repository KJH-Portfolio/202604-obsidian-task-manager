/* eslint-disable @typescript-eslint/no-unsafe-assignment -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-call -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-return -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Complex type casting needed for markdown AST */
import { Plugin, TFile, Notice, Modal, Setting, App, MarkdownView } from "obsidian";
import { EditorView } from "@codemirror/view";
import { buildCalendarPopup, buildTodayButtonExtension, buildDateClickablePlugin } from "./ui/CalendarWidget";
import { PluginSettings, DEFAULT_SETTINGS, MyWorldTaskManagerSettingTab, StartupSyncModal } from "./settings";
import { TaskUtils } from "./TaskUtils";
import { Synchronizer } from "./Synchronizer";
import { ResetManager } from "./ResetManager";
import { TemplateHelper } from "./TemplateHelper";
import { DateManager } from "./DateManager";
import { FileManager } from "./FileManager";

// 1. 빠른 할 일 캡처 모달
class QuickCaptureModal extends Modal {
    content: string;
    selectedDate: string;
    onSubmit: (content: string) => Promise<void> | void;

    constructor(app: App, onSubmit: (content: string) => void) {
        super(app);
        this.content = "";
        // window.moment is available in Obsidian
        this.selectedDate = window.moment().format("YYYY-MM-DD");
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        
        // Add padding and spacing to the entire content
        contentEl.addClass("myworld-padding-20-10");
        
        // Header with simple description and date picker
        const headerContainer = contentEl.createDiv({ cls: "myworld-flex-center-between-mb20" });
        
        // Left part: Title and Subtitle
        const leftGroup = headerContainer.createDiv({ cls: "myworld-flex-baseline-gap10" });
        const title = leftGroup.createEl("h3", { text: "✏️ 할 일 등록" });
        title.addClass("myworld-margin-0");
        leftGroup.createEl("span", { text: "메인 스케줄에 즉시 추가됩니다.", cls: "myworld-text-muted-md" });

        // Right part: Date Picker & Tomorrow Button
        const rightGroup = headerContainer.createDiv({ cls: "myworld-flex-center-gap8" });
        
        const dateInput = rightGroup.createEl("input", { type: "date" });
        dateInput.value = this.selectedDate;
        dateInput.addClass("myworld-p-4");
        dateInput.addClass("myworld-border-std");
        dateInput.addClass("myworld-rounded-4");
        dateInput.addClass("myworld-bg-secondary");
        dateInput.addClass("myworld-text-normal");

        const tomorrowBtn = rightGroup.createEl("button", { text: "+" });
        tomorrowBtn.addClass("myworld-p-4-10");
        tomorrowBtn.addClass("myworld-text-10em");
        tomorrowBtn.addClass("myworld-shadow-none");
        
        dateInput.addEventListener("change", (e) => {
            this.selectedDate = (e.target as HTMLInputElement).value;
        });

        tomorrowBtn.addEventListener("click", () => {
            const nextDay = window.moment(this.selectedDate).add(1, 'days').format("YYYY-MM-DD");
            this.selectedDate = nextDay;
            dateInput.value = nextDay;
        });

        // Full width input box
        const inputContainer = contentEl.createDiv({ cls: "myworld-mb-20" });
        const inputEl = inputContainer.createEl("input", { type: "text", placeholder: "예: 물 2L 마시기" });
        inputEl.addClass("myworld-w-100");
        inputEl.addClass("myworld-p-10");
        
        inputEl.addEventListener("input", (e) => {
            this.content = (e.target as HTMLInputElement).value;
        });

        const submitAction = () => {
            if (this.content.trim() === "") {
                new Notice("내용을 입력해주세요.");
                return;
            }
            this.close();
            let finalContent = this.content.trim();
            const idMatch = finalContent.match(/\s+\^[a-zA-Z0-9]+$/);
            if (idMatch) {
                finalContent = finalContent.substring(0, finalContent.length - idMatch[0].length) + ` 📅 ${this.selectedDate}` + idMatch[0];
            } else {
                finalContent = `${finalContent} 📅 ${this.selectedDate}`;
            }
            void this.onSubmit(finalContent);
        };

        // Enter key to submit
        inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                submitAction();
            }
        });

        // Submit button aligned to right
        const btnContainer = contentEl.createDiv({ cls: "myworld-flex-end" });
        const btn = btnContainer.createEl("button", { text: "추가" });
        btn.addClass("mod-cta");
        btn.addEventListener("click", submitAction);

        // Auto-focus the input box
        window.setTimeout(() => inputEl.focus(), 50);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 2. 새 프로젝트 생성 모달
class CreateProjectModal extends Modal {
    projectName: string;
    onSubmit: (projectName: string) => void;

    constructor(app: App, onSubmit: (projectName: string) => void) {
        super(app);
        this.projectName = "";
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: "🚀 새 프로젝트 생성" });

        new Setting(contentEl)
            .setName("프로젝트명")
            .setDesc("생성할 프로젝트 노트의 제목을 입력하세요.")
            .addText(text => text
                .setPlaceholder("예: 파이썬 웹 크롤러 개발")
                .onChange(value => this.projectName = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText("프로젝트 생성")
                .setCta()
                .onClick(() => {
                    if (this.projectName.trim() === "") {
                        new Notice("프로젝트명을 입력해주세요.");
                        return;
                    }
                    this.close();
                    this.onSubmit(this.projectName.trim());
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}



export default class MyWorldTaskManagerPlugin extends Plugin {
    settings!: PluginSettings;
    dateManager!: DateManager;
    fileManager!: FileManager;
    utils!: TaskUtils;
    synchronizer!: Synchronizer;
    resetManager!: ResetManager;
    templateHelper!: TemplateHelper;
    
    modifiedFiles: Set<string> = new Set<string>();
    lastActiveFile: TFile | null = null;
    // BUG-02: Race Condition 방지를 위한 파일별 직렬화 쓰기 큐
    // 타임스탬프 방식(1초 임계값)은 클라우드 동기화 환경에서 이벤트 지연으로 무력화될 수 있어 콘텐츠 해시 비교로 전환
    pluginWritingFiles: Map<string, string> = new Map<string, string>();
    // BUG-02: Race Condition 방지를 위한 파일별 직렬화 쓰기 큐
    private fileWriteQueue: Map<string, Promise<void>> = new Map();

    /**
     * BUG-02: 동일 파일에 대한 read→modify 작업을 직렬화하여 Race Condition 방지.
     * 연속 클릭 시 이전 작업이 완료된 후 다음 작업이 실행됨을 보장한다.
     * 작업 완료 후 자신이 마지막 Promise이면 Map에서 해당 키를 삭제하여 메모리 누수 방지.
     */
    private enqueueFileWrite(filePath: string, task: () => Promise<void>): void {
        const current = this.fileWriteQueue.get(filePath) ?? Promise.resolve();
        const next = current.then(task).catch((e: unknown) => {
            console.error('enqueueFileWrite error:', e);
        }).finally(() => {
            // 자신이 큐의 마지막 작업인 경우에만 키를 삭제 (후속 작업이 이미 등록된 경우는 유지)
            if (this.fileWriteQueue.get(filePath) === next) {
                this.fileWriteQueue.delete(filePath);
            }
        });
        this.fileWriteQueue.set(filePath, next);
    }

    private async triggerAutoSyncForFile(fileToSync: TFile, force: boolean = false) {
        if (!force && !this.modifiedFiles.has(fileToSync.path)) return;
        
        const path = fileToSync.path;
        try {
            if (path === this.settings.mainSchedulePath) {
                await this.synchronizer.syncDailyTasks(fileToSync);
            } else if (path.startsWith(this.settings.projectDirectory)) {
                await this.synchronizer.pushProjectToSchedule(fileToSync);
            }
        } catch (e) {
            console.error("Auto-sync error:", e);
        } finally {
            this.modifiedFiles.delete(path);
        }
    }

    async onload() {
        console.log("Loading MyWorld Task Manager...");

        // 1. 설정 불러오기
        await this.loadSettings();

        // 2. 핵심 모듈 인스턴스 생성
        this.dateManager = new DateManager(this.settings);
        // BUG-01/05: pluginWritingFiles Set을 FileManager에 전달
        this.fileManager = new FileManager(this.app, this.pluginWritingFiles);
        this.utils = new TaskUtils(this.app, this.settings, this.dateManager, this.fileManager);
        this.synchronizer = new Synchronizer(this.app, this.settings, this.utils, this.dateManager, this.fileManager);
        this.resetManager = new ResetManager(this.app, this.settings, this.utils, this.dateManager, this.fileManager);
        this.templateHelper = new TemplateHelper(this.app, this.settings, this.utils, this.dateManager, this.fileManager);

        // --- [Tasks 플러그인 특정 경고창 차단 옵저버] ---
        const attachNoticeObserver = (doc: Document) => {
            const noticeObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const el = node as HTMLElement;
                            if (el.classList.contains("notice")) {
                                const text = el.innerText || "";
                                if (text.includes("obsidian-tasks-plugin warning") && text.includes("inside a callout")) {
                                    el.addClass("myworld-d-none");
                                }
                            }
                        }
                    });
                });
            });
            noticeObserver.observe(doc.body, { childList: true, subtree: true });
            this.register(() => noticeObserver.disconnect());
        };

        // 메인 창에 부착
        attachNoticeObserver(window.document);
        // ------------------------------------------------

        const checkboxCaptureHandler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target || target.tagName !== "INPUT" || (target as HTMLInputElement).type !== "checkbox") return;

            // 라이브 프리뷰(CM6) 안의 체크박스인지 확인 (읽기 모드는 개입 금지)
            const cmEditorEl = target.closest(".cm-editor");
            if (!cmEditorEl) return;

            // 마우스 클릭 시 포커스가 이동하기 전에 getActiveFile()을 호출하면 이전 파일이 반환될 수 있으므로,
            // 현재 클릭한 엘리먼트가 속한 Leaf를 직접 찾아내어 정확한 파일을 식별합니다.
            const leaf = this.app.workspace.getLeavesOfType("markdown").find(l => l.view.containerEl.contains(target));
            const targetFile = leaf ? (leaf.view as MarkdownView).file : null;
            if (!targetFile) return;

            const isSchedule = targetFile.path === this.settings.mainSchedulePath;
            const isProject = targetFile.path.startsWith(this.settings.projectDirectory);
            if (!isSchedule && !isProject) return;

            // 옵시디언 코어 및 타 플러그인 개입 원천 차단
            e.preventDefault();
            e.stopImmediatePropagation();

            const view = EditorView.findFromDOM(cmEditorEl as HTMLElement);
            if (!view) return;

            let pos: number | null = null;
            const cmLineEl = target.closest(".cm-line");
            if (cmLineEl) {
                pos = view.posAtDOM(cmLineEl);
            }
            if (pos === null || pos < 0) {
                pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false) ?? view.posAtDOM(target);
            }
            if (pos === null || pos < 0) return;

            const line = view.state.doc.lineAt(pos);
            const markerMatch = line.text.match(/^(\s*(?:>\s*)*[-*+]\s+\[)(.)(\])/);
            if (!markerMatch) return;

            const nextMarker = /^[xX]$/.test(markerMatch[2]) ? " " : "x";
            const markerStart = line.from + markerMatch[1].length;
            
            view.dispatch({ changes: { from: markerStart, to: markerStart + 1, insert: nextMarker } });

            // Tasks 플러그인의 Dirty Workaround 방식: 
            // 옵시디언이 강제로 상태를 되돌리는 것을 막기 위해 명시적으로 상태 재지정
            const desiredChecked = nextMarker !== " ";
            window.setTimeout(() => {
                (target as HTMLInputElement).checked = desiredChecked;
            }, 1);
        };

        // mousedown 등은 텍스트 포커싱을 위해 살려두고, 오직 click 이벤트만 최우선(capture)으로 차단합니다.
        this.registerDomEvent(window, "click", checkboxCaptureHandler, { capture: true });

        // 팝아웃(새 창) 열릴 때마다 부착
        this.registerEvent(this.app.workspace.on("window-open", (win) => {
            attachNoticeObserver(win.doc);
            // 새 창의 window 객체에도 click 이벤트 캡처 핸들러 부착
            win.win.addEventListener("click", checkboxCaptureHandler, { capture: true });
        }));

        // window-close 리스너는 window-open 바깥에서 단일 등록하여 중복 누적 방지
        // (window-open 내부에 중첩 등록하면 창이 N번 열릴 때 리스너가 N개 쌓임)
        this.registerEvent(this.app.workspace.on("window-close", (closedWin) => {
            closedWin.win.removeEventListener("click", checkboxCaptureHandler, { capture: true });
        }));

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 2. 읽기 모드(Reading Mode): 마크다운 렌더링 파이프라인 개입
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.registerMarkdownPostProcessor((element, context) => {
            const isSchedule = context.sourcePath === this.settings.mainSchedulePath;
            const isProject = context.sourcePath.startsWith(this.settings.projectDirectory);
            if (!isSchedule && !isProject) return;

            const checkboxes = element.querySelectorAll("input[type='checkbox']");
            checkboxes.forEach((cb) => {
                // 옵시디언의 읽기 모드 체크박스 핸들러는 주로 click 이벤트를 위임(delegation)하여 처리하므로,
                // 체크박스 자체에 click 이벤트를 달고 stopPropagation()을 호출하면 완벽히 차단됨
                cb.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const target = e.target as HTMLElement;
                    const taskEl = target.closest(".task-list-item") as HTMLElement | null;
                    if (!taskEl) return;

                    const currentMarker = taskEl.getAttribute("data-task") ?? " ";
                    const nextMarker = /^[xX]$/.test(currentMarker) ? " " : "x";

                    const clonedForMatch = taskEl.cloneNode(true) as HTMLElement;
                    clonedForMatch.querySelectorAll("ul, ol, .myworld-today-btn, .myworld-date-clickable").forEach(el => el.remove());
                    const rawText = clonedForMatch.textContent?.trim() || "";
                    const cleanText = rawText.replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/📅.*/, "").trim();

                    if (!cleanText) return;

                    const container = taskEl.closest(".markdown-reading-view") || taskEl.ownerDocument.body;
                    const allTasks = Array.from(container.querySelectorAll(".task-list-item")) as HTMLElement[];
                    let occurrenceIndex = 0;
                    for (const t of allTasks) {
                        const tCloned = t.cloneNode(true) as HTMLElement;
                        tCloned.querySelectorAll("ul, ol, .myworld-today-btn, .myworld-date-clickable").forEach(el => el.remove());
                        const tClean = (tCloned.textContent?.trim() || "").replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/📅.*/, "").trim();
                        if (tClean === cleanText) {
                            if (t === taskEl) break;
                            occurrenceIndex++;
                        }
                    }

                    const targetFile = this.app.vault.getAbstractFileByPath(context.sourcePath);
                    if (!targetFile || !(targetFile instanceof TFile)) return;

                    // BUG-02: Race Condition 방지 - read→modify 전 과정을 직렬화 큐로 순서 보장
                    // pluginWrite 사용으로 vault.on('modify') 해시 필터도 함께 적용
                    this.enqueueFileWrite(targetFile.path, async () => {
                        const fileContent = await this.fileManager.getActiveViewOrFileText(targetFile);
                        const lines = fileContent.split("\n");
                        let modified = false;
                        let matchCount = 0;
                        for (let i = 0; i < lines.length; i++) {
                            if (/^\s*(?:>\s*)*[-*+]\s+\[.\]/.test(lines[i])) {
                                let lineClean = lines[i].replace(/^\s*(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/📅\s*\d{4}-\d{2}-\d{2}/, "").replace(/\s+\^[a-zA-Z0-9]+$/, "").trim();
                                if (lineClean === cleanText) {
                                    if (matchCount === occurrenceIndex) {
                                        lines[i] = lines[i].replace(
                                            /^(\s*(?:>\s*)*[-*+]\s+\[)(.)(\])/,
                                            `$1${nextMarker}$3`
                                        );
                                        modified = true;
                                        break;
                                    }
                                    matchCount++;
                                }
                            }
                        }
                        if (modified) {
                            await this.fileManager.pluginWrite(targetFile, lines.join("\n"));
                        }
                    });
                });
            });
        });

        // CM6: 라이브 프리뷰용 오늘 버튼 (이모지 + 달력 팝업)
        this.registerEditorExtension(buildTodayButtonExtension(this.app, () => this));

        // CM6: 라이브 프리뷰용 날짜 텍스트 → 클릭 가능한 달력 팝업
        this.registerEditorExtension(buildDateClickablePlugin(this.app, () => this));

        // Reading Mode 용 MarkdownPostProcessor (오늘 버튼 및 달력 날짜)
        this.registerMarkdownPostProcessor((element, context) => {
            const isSchedule = context.sourcePath === this.settings.mainSchedulePath;
            const isProject = context.sourcePath.startsWith(this.settings.projectDirectory);
            if (!isSchedule && !isProject) return;

            const tasks = Array.from(element.querySelectorAll(".task-list-item")) as HTMLElement[];
            if (!tasks.length) return;

            const clickFile = this.app.vault.getAbstractFileByPath(context.sourcePath);
            if (!clickFile || !(clickFile instanceof TFile)) return;

            tasks.forEach(taskEl => {
                // [x] / [X] 만 스킵 — [1],[0],[!] 등 커스텀 마커는 처리 대상
                if (/^[xX]$/.test(taskEl.getAttribute("data-task") ?? "")) return;

                const cloned = taskEl.cloneNode(true) as HTMLElement;
                cloned.querySelectorAll("ul, ol, .myworld-today-btn").forEach(e => e.remove());
                const rawText = cloned.textContent?.trim() || "";
                const rawHtml = cloned.innerHTML;
                
                const hasDateText = /\d{4}-\d{2}-\d{2}/.test(rawText) || /\d{4}-\d{2}-\d{2}/.test(rawHtml);
                const hasDateAttr = Array.from(taskEl.attributes).some(attr => attr.name.startsWith("data-task-") && /\d{4}-\d{2}-\d{2}/.test(attr.value));

                const taskTextSpan = taskEl.querySelector(".tasks-list-text");
                const hasButton = taskTextSpan ? !!taskTextSpan.querySelector(".myworld-today-btn") : Array.from(taskEl.children).some(c => c.classList.contains("myworld-today-btn"));

                const doc = element.ownerDocument;

                if (hasDateText && !taskEl.querySelector(".myworld-date-clickable")) {
                    const walker = doc.createTreeWalker(taskEl, NodeFilter.SHOW_TEXT, {
                        acceptNode: (node) => {
                            let p = node.parentElement;
                            while (p && p !== taskEl) {
                                if (p.classList.contains("task-list-item")) return NodeFilter.FILTER_REJECT;
                                p = p.parentElement;
                            }
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    });
                    const nodesToProcess: Text[] = [];
                    let n: Text | null;
                    while ((n = walker.nextNode() as Text | null)) {
                        if (/📅\s*\d{4}-\d{2}-\d{2}/.test(n.textContent || "")) {
                            nodesToProcess.push(n);
                        }
                    }
                    nodesToProcess.forEach(textNode => {
                        const text = textNode.textContent || "";
                        const match = text.match(/(📅\s*)(\d{4}-\d{2}-\d{2})/);
                        if (!match || match.index === undefined) return;

                        const dateStr = match[2];
                        const before = text.slice(0, match.index);
                        const after = text.slice(match.index + match[0].length);

                        const frag = doc.createDocumentFragment();
                        if (before) frag.appendChild(doc.createTextNode(before));

                        const dateSpan = doc.createElement("span");
                        dateSpan.className = "myworld-date-clickable";
                        dateSpan.textContent = match[0];

                        const todayStr = this.dateManager?.getAdjustedNow().format("YYYY-MM-DD") || window.moment().format("YYYY-MM-DD");
                        if (dateStr < todayStr) dateSpan.classList.add("myworld-overdue");

                        dateSpan.addEventListener("mousedown", (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            const rect = dateSpan.getBoundingClientRect();

                            const cleanTextForMatch = rawText.replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/📅.*/, "").trim();
                            const container = taskEl.closest(".markdown-reading-view") || doc.body;
                            const allTasks = Array.from(container.querySelectorAll(".task-list-item"));
                            let occurrenceIndex = 0;
                            for (const t of allTasks) {
                                const tCloned = t.cloneNode(true) as HTMLElement;
                                tCloned.querySelectorAll("ul, ol, .myworld-today-btn, .myworld-date-clickable").forEach(e => e.remove());
                                const tClean = (tCloned.textContent?.trim() || "").replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/📅.*/, "").trim();
                                if (tClean === cleanTextForMatch) {
                                    if (t === taskEl) break;
                                    occurrenceIndex++;
                                }
                            }

                            buildCalendarPopup(dateStr, rect.left, rect.bottom + 5, (newDate) => {
                                this.enqueueFileWrite(clickFile.path, async () => {
                                    const rawContent = await this.fileManager.getActiveViewOrFileText(clickFile);
                                    const fileContent = this.utils.preprocessContent(rawContent);
                                    const lines = fileContent.split("\n");
                                    let matchCount = 0;
                                    for (let i = 0; i < lines.length; i++) {
                                        if (/^\s*(?:>\s*)*[-*+]\s+\[.\]/.test(lines[i]) && lines[i].includes(dateStr)) {
                                            let lineClean = lines[i].replace(/^\s*(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/📅\s*\d{4}-\d{2}-\d{2}/, "").replace(/\s+\^[a-zA-Z0-9]+$/, "").trim();
                                            if (lineClean === cleanTextForMatch) {
                                                if (matchCount === occurrenceIndex) {
                                                    if (newDate === null) {
                                                        lines[i] = lines[i].replace(/\s*📅\s*\d{4}-\d{2}-\d{2}/, "");
                                                    } else {
                                                        lines[i] = lines[i].replace(/📅\s*\d{4}-\d{2}-\d{2}/, `📅 ${newDate}`);
                                                    }
                                                    await this.fileManager.pluginWrite(clickFile, lines.join("\n"));
                                                    break;
                                                }
                                                matchCount++;
                                            }
                                        }
                                    }
                                });
                            }, doc);
                        });

                        frag.appendChild(dateSpan);
                        if (after) frag.appendChild(doc.createTextNode(after));
                        textNode.parentNode?.replaceChild(frag, textNode);
                    });
                }

                if (!hasDateText && !hasDateAttr && !hasButton) {
                    let shouldShow = false;
                    if (isSchedule) {
                        const leafContainer = taskEl.closest('.workspace-leaf');
                        if (!leafContainer) return;
                        const allHeaders = Array.from(leafContainer.querySelectorAll("h1, .HyperMD-header-1"));
                        const precedingHeaders = allHeaders.filter(h => {
                            return (h.compareDocumentPosition(taskEl) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
                        });
                        if (precedingHeaders.length > 0) {
                            const targetH = precedingHeaders[precedingHeaders.length - 1];
                            let headerText = targetH.textContent?.trim().toLowerCase() || "";
                            headerText = headerText.replace(/^#\s*/, "").trim();
                            if (headerText === "todo" || headerText === "project") shouldShow = true;
                        }
                    } else if (isProject) {
                        shouldShow = true;
                    }

                    if (shouldShow) {
                        const btn = doc.createElement("span");
                        btn.className = "myworld-today-btn";
                        btn.textContent = "📅";
                        btn.title = "날짜 지정";
                        btn.addEventListener("mousedown", (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            let cleanText = rawText.replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").trim();
                            if (!cleanText) return;

                            const container = taskEl.closest(".markdown-reading-view") || doc.body;
                            const allTasks = Array.from(container.querySelectorAll(".task-list-item"));
                            let occurrenceIndex = 0;
                            for (const t of allTasks) {
                                const tCloned = t.cloneNode(true) as HTMLElement;
                                tCloned.querySelectorAll("ul, ol, .myworld-today-btn, .myworld-date-clickable").forEach(el => el.remove());
                                const tClean = (tCloned.textContent?.trim() || "").replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").trim();
                                if (tClean === cleanText) {
                                    if (t === taskEl) break;
                                    occurrenceIndex++;
                                }
                            }

                            const todayStr = window.moment().format("YYYY-MM-DD");
                            const rect = btn.getBoundingClientRect();

                            buildCalendarPopup(todayStr, rect.left, rect.bottom + 5, (newDate) => {
                                if (!newDate) return;
                                this.enqueueFileWrite(clickFile.path, async () => {
                                    const rawContent = await this.fileManager.getActiveViewOrFileText(clickFile);
                                    const fileContent = this.utils.preprocessContent(rawContent);
                                    const lines = fileContent.split("\n");
                                    let modified = false;
                                    let matchCount = 0;

                                    for (let i = 0; i < lines.length; i++) {
                                        if (/^\s*(?:>\s*)*[-*+]\s+\[.\]/.test(lines[i]) && !/\d{4}-\d{2}-\d{2}/.test(lines[i])) {
                                            let lineClean = lines[i].replace(/^\s*(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/\s+\^[a-zA-Z0-9]+$/, "").trim();
                                            if (lineClean === cleanText) {
                                                if (matchCount === occurrenceIndex) {
                                                    const text = lines[i];
                                                    const idMatch = text.match(/\s+\^[a-zA-Z0-9]+$/);
                                                    if (idMatch) {
                                                        lines[i] = text.substring(0, text.length - idMatch[0].length) + ` 📅 ${newDate}` + idMatch[0];
                                                    } else {
                                                        lines[i] = text + ` 📅 ${newDate}`;
                                                    }
                                                    modified = true;
                                                    break;
                                                }
                                                matchCount++;
                                            }
                                        }
                                    }

                                    if (modified) {
                                        await this.fileManager.pluginWrite(clickFile, lines.join("\n"));
                                        btn.remove();
                                    }
                                });
                            }, doc);
                        });
                        
                        if (taskTextSpan) {
                            taskTextSpan.appendChild(btn);
                        } else {
                            const checkbox = taskEl.querySelector("input[type='checkbox']");
                            if (checkbox && checkbox.nextSibling) {
                                taskEl.insertBefore(btn, checkbox.nextSibling.nextSibling);
                            } else {
                                const childList = Array.from(taskEl.children).find(c => c.tagName === "UL" || c.tagName === "OL");
                                if (childList) {
                                    taskEl.insertBefore(btn, childList);
                                } else {
                                    taskEl.appendChild(btn);
                                }
                            }
                        }
                    }
                }
            });
        });

        // 3. 설정 탭 등록
        this.addSettingTab(new MyWorldTaskManagerSettingTab(this.app, this));

        // 4. 자동 동기화(Auto-Sync) 이벤트 등록
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (!(file instanceof TFile) || file.extension !== 'md') return;

                // BUG-01/05/04: 플러그인이 쓴 파일인지 콘텐츠 해시로 판단 (타임스탬프 저기의 1초 방식 개선)
                // cachedHash가 있는 경우에만 vault.read()를 호출하므로 플러그인이 안 쓴 파일은 I/O 추가 없음
                const cachedHash = this.pluginWritingFiles.get(file.path);
                if (cachedHash !== undefined) {
                    void (async () => {
                        try {
                            const currentContent = await this.app.vault.read(file);
                            const currentHash = this.fileManager.simpleHash(currentContent);
                            if (currentHash === cachedHash) {
                                // 콘텐츠가 플러그인이 마지막으로 저장한 것과 동일 → 자신의 저장임, 무시
                                return;
                            }
                            // 콘텐츠가 다르다 → 외부(사용자 또는 클라우드)에서 변경된 것 → 캐시 제거 후 동기화 허용
                            this.pluginWritingFiles.delete(file.path);
                            this.modifiedFiles.add(file.path);
                        } catch (e) {
                            console.error('pluginWritingFiles hash check error:', e);
                        }
                    })();
                    return;
                }
                this.modifiedFiles.add(file.path);
            })
        );


        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                const activeFile = this.app.workspace.getActiveFile();
                
                // 만약 이전 활성 파일이 있었고, 그것이 현재 활성 파일과 다르고, 수정된 목록에 있다면
                if (this.lastActiveFile && (!activeFile || this.lastActiveFile.path !== activeFile.path)) {
                    if (this.modifiedFiles.has(this.lastActiveFile.path)) {
                        void this.triggerAutoSyncForFile(this.lastActiveFile);
                    }
                }
                this.lastActiveFile = activeFile;
            })
        );

        // 플러그인 로드 시(초기 1회) 스케줄 기준 전체 동기화 확인 팝업 (설정에서 켜진 경우에만)
        this.app.workspace.onLayoutReady(() => {
            this.lastActiveFile = this.app.workspace.getActiveFile();
            if (!this.settings.syncOnStartup) {
                console.log("Startup sync popup disabled in settings. Skipping.");
                return;
            }

            const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
            if (scheduleFile && scheduleFile instanceof TFile) {
                // 자동 실행 대신 사용자 확인 팝업을 띄움
                new StartupSyncModal(this.app, async () => {
                    try {
                        console.log("Running initial sync (user confirmed)...");
                        await this.synchronizer.syncDailyTasks(scheduleFile);
                    } catch (e) {
                        console.error("Initial sync error:", e);
                    }
                }).open();
            }
        });

        // 5. 명령어(Command) 등록

        // 명령어 A: 양방향 프로젝트 및 스케줄 동기화 (task-manage)
        this.addCommand({
            id: "task-manage",
            name: "양방향 프로젝트 및 스케줄 동기화",
            callback: async () => {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    await this.synchronizer.syncDailyTasks(scheduleFile);
                } else {
                    new Notice(`🚨 스케줄 관리 노트를 찾을 수 없습니다. 경로를 확인하세요: ${this.settings.mainSchedulePath}`);
                }
            }
        });

        // 명령어 B: 일간 루틴 리셋 및 회고 기록 (daily-task-reset)
        this.addCommand({
            id: "daily-task-reset",
            name: "일간 루틴 리셋 및 회고 기록",
            callback: async () => {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    await this.resetManager.runDailyReset(scheduleFile);
                } else {
                    new Notice(`🚨 스케줄 관리 노트를 찾을 수 없습니다. 경로를 확인하세요: ${this.settings.mainSchedulePath}`);
                }
            }
        });

        // 명령어 C: 현재 프로젝트 정보를 스케줄에 반영 (push-project-to-schedule)
        this.addCommand({
            id: "push-project-to-schedule",
            name: "현재 프로젝트 정보를 스케줄에 반영",
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.path.startsWith(this.settings.projectDirectory)) {
                    await this.synchronizer.pushProjectToSchedule(activeFile);
                } else {
                    new Notice("⚠️ 현재 열려 있는 노트가 프로젝트 폴더에 속해 있지 않습니다.");
                }
            }
        });

        // 명령어 D: 월간 통계 수동 아카이빙 (monthly-stats-archive)
        this.addCommand({
            id: "monthly-stats-archive",
            name: "월간 통계 수동 아카이빙 및 대시보드 갱신",
            callback: async () => {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    await this.resetManager.runManualArchive(scheduleFile);
                } else {
                    new Notice(`🚨 스케줄 관리 노트를 찾을 수 없습니다. 경로를 확인하세요: ${this.settings.mainSchedulePath}`);
                }
            }
        });


        // 명령어 E: 빠른 할 일 등록 (quick-capture)
        this.addCommand({
            id: "quick-capture",
            name: "빠른 할 일 등록",
            callback: () => {
                new QuickCaptureModal(this.app, (content) => {
                    void (async () => {
                        const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                        if (scheduleFile && scheduleFile instanceof TFile) {
                            try {
                                const original = await this.fileManager.getActiveViewOrFileText(scheduleFile);
                                let text = this.utils.preprocessContent(original);

                                // # Todo 섹션 하단의 #### 할 일 아래에 추가 시도
                                const todoHeader = "#### 할 일";
                                const todoRange = this.utils.getSectionRange(text, todoHeader, 4);
                                
                                const newTaskLine = `- [ ] ${content}`;
                                
                                if (todoRange) {
                                    // #### 할 일 바로 아랫줄에 추가
                                    const startIdx = (todoRange as { start: number; end: number }).start;
                                    
                                    const before = text.substring(0, startIdx + todoHeader.length);
                                    const after = text.substring(startIdx + todoHeader.length);
                                    
                                    text = before + "\n" + newTaskLine + after;
                                } else {
                                    // # Todo 섹션 아래에 추가
                                    const mainTodoHeader = "# Todo";
                                    const mainTodoRange = this.utils.getSectionRange(text, mainTodoHeader, 1);
                                    if (mainTodoRange) {
                                        const startIdx = (mainTodoRange as { start: number; end: number }).start;
                                        const before = text.substring(0, startIdx + mainTodoHeader.length);
                                        const after = text.substring(startIdx + mainTodoHeader.length);
                                        
                                        text = before + "\n" + newTaskLine + after;
                                    } else {
                                        // 섹션이 전혀 없으면 파일 끝에 추가
                                        text = text.trimEnd() + "\n\n" + newTaskLine;
                                    }
                                }
                                
                                // 추가 후 자동 정렬 및 디데이 마킹 프로세스 수행

                                const todayObj = this.dateManager.getTodayStart();
                                text = this.utils.processSectionLogic(text, "# Todo", todayObj, false, true);
                                
                                await this.fileManager.saveIfChanged(scheduleFile, original, text);
                                new Notice(`✅ 할 일이 메인 스케줄에 추가되었습니다: "${content}"`);
                            } catch (err) {
                                console.error(err instanceof Error ? err.message : String(err));
                                new Notice("🚨 할 일 추가 도중 에러가 발생했습니다.");
                            }
                        } else {
                            new Notice(`🚨 스케줄 관리 노트를 찾을 수 없습니다: ${this.settings.mainSchedulePath}`);
                        }
                    })();
                }).open();
            }
        });

        // 명령어 F: 현재 창 강제 수동 동기화 (새로고침)
        this.addCommand({
            id: "refresh-active-view",
            name: "현재 창 수동 동기화 수행",
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    await this.triggerAutoSyncForFile(activeFile, true);
                    new Notice("🔄 스케줄 및 프로젝트 동기화가 완료되었습니다.");
                } else {
                    new Notice("⚠️ 동기화할 활성 문서가 없습니다.");
                }
            }
        });

        // 명령어 G: 임시 메모 파일 열기 및 생성 (open-memo)
        this.addCommand({
            id: "open-memo",
            name: "임시 메모 파일 열기 및 생성",
            callback: async () => {
                await this.openOrCreateFleetingMemoFile();
            }
        });

        // 명령어 H: 새 프로젝트 생성 (create-new-project)
        this.addCommand({
            id: "create-new-project",
            name: "새 프로젝트 노트 생성",
            callback: () => {
                new CreateProjectModal(this.app, (projectName) => {
                    void (async () => {
                        const file = await this.createNewProjectFile(projectName);
                        if (file) {
                            const leaf = this.app.workspace.getLeaf(false);
                            await leaf.openFile(file);
                        }
                    })();
                }).open();
            }
        });

        // 명령어 I: 오늘의 스케줄 관리 노트 생성 (create-today-schedule)
        this.addCommand({
            id: "create-today-schedule",
            name: "오늘의 스케줄 관리 노트 생성",
            callback: async () => {
                const file = await this.createTodayScheduleFile();
                if (file) {
                    const leaf = this.app.workspace.getLeaf(false);
                    await leaf.openFile(file);
                }
            }
        });

        // 명령어 J: 원클릭 PARA 시스템 폴더 구조 생성 (myworld-setup-para)
        this.addCommand({
            id: "myworld-setup-para",
            name: "원클릭 PARA 시스템 폴더 구조 생성",
            callback: async () => {
                try {
                    await this.templateHelper.setupParaStructure();
                    new Notice("✅ PARA 시스템 폴더 구조 및 가이드 문서가 생성되었습니다.");
                } catch (err) {
                    console.error(err instanceof Error ? err.message : String(err));
                    new Notice("🚨 PARA 시스템 구조 생성 중 에러가 발생했습니다.");
                }
            }
        });

        // 명령어 K: 원클릭 제텔카스텐 폴더 구조 생성 (myworld-setup-zettelkasten)
        this.addCommand({
            id: "myworld-setup-zettelkasten",
            name: "원클릭 제텔카스텐 폴더 구조 생성",
            callback: async () => {
                try {
                    await this.templateHelper.setupZettelkastenStructure();
                    new Notice("✅ 제텔카스텐 폴더 구조 및 가이드 문서가 생성되었습니다.");
                } catch (err) {
                    console.error(err instanceof Error ? err.message : String(err));
                    new Notice("🚨 제텔카스텐 구조 생성 중 에러가 발생했습니다.");
                }
            }
        });
    }

    onunload() {
        console.log("Unloading MyWorld Task Manager...");
    }

    // 1. 공용 새 프로젝트 노트 생성 메서드
    async createNewProjectFile(projectName: string): Promise<TFile | null> {
        try {
            const projectDir = this.settings.projectDirectory;
            await this.utils.ensureFolder(projectDir);
            
            const projectFilePath = `${projectDir}/${projectName}.md`;
            const existing = this.app.vault.getAbstractFileByPath(projectFilePath);
            if (existing) {
                new Notice("⚠️ 동일한 이름의 프로젝트가 이미 존재합니다.");
                return existing instanceof TFile ? existing : null;
            }

            // 템플릿 텍스트 가져오기
            let templateText = this.settings.customTemplates.projectNote;
            if (!templateText) {
                const defaultPath = `${this.settings.templatesDirectory}/프로젝트 계획서 템플릿.md`;
                const defaultFile = this.app.vault.getAbstractFileByPath(defaultPath);
                if (defaultFile && defaultFile instanceof TFile) {
                    templateText = await this.app.vault.read(defaultFile);
                } else {
                    templateText = `---
작성일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
수정일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
---
# 실행
- 
# 개요
- 기한 : 
- 목표 : 
# 계획
> **진행도**: **🚨 작성 필요!**
- 
# 세부 사항
`;
                }
            }

            const now = this.dateManager.getAdjustedNow();
            const replacements = {
                projectName: projectName,

                date: now.format("YYYY-MM-DD"),

                time: now.format("HH:mm")
            };

            const content = this.templateHelper.replacePlaceholder(templateText, replacements);
            const newFile = await this.app.vault.create(projectFilePath, content);
            new Notice(`✅ 새 프로젝트 노트가 생성되었습니다: ${projectName}`);
            return newFile;
        } catch (err) {
            console.error(err instanceof Error ? err.message : String(err));
            new Notice("🚨 프로젝트 생성 중 에러가 발생했습니다.");
            return null;
        }
    }

    // 2. 공용 오늘의 스케줄 노트 생성 메서드
    async createTodayScheduleFile(): Promise<TFile | null> {
        try {
            const schedulePath = this.settings.mainSchedulePath;
            const parts = schedulePath.split("/");
            parts.pop();
            const folderPath = parts.join("/");
            
            await this.utils.ensureFolder(folderPath);

            const existingFile = this.app.vault.getAbstractFileByPath(schedulePath);
            if (existingFile && existingFile instanceof TFile) {
                new Notice("ℹ️ 스케줄 관리 노트가 이미 존재합니다.");
                return existingFile;
            }

            // 템플릿 가져오기
            let templateText = this.settings.customTemplates.dailySchedule;
            if (!templateText) {
                const defaultPath = `${this.settings.templatesDirectory}/데일리 스케줄 템플릿.md`;
                const defaultFile = this.app.vault.getAbstractFileByPath(defaultPath);
                if (defaultFile && defaultFile instanceof TFile) {
                    templateText = await this.app.vault.read(defaultFile);
                } else {
                    let checklistTable = "";
                    for (let i = 1; i <= 31; i++) {
                        checklistTable += `|  ${i.toString().padEnd(2, ' ')}  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |\n`;
                    }
                    
                    templateText = `---
작성일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
수정일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
cssclasses:
  - inline-routine
---
- 
<div style="display: flex; gap: 20px; margin-bottom: 20px; align-items: center; justify-content: center;">
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:quick-capture" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #a29bfe;">✏️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:daily-task-reset" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #ff7675;">🌤️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:monthly-stats-archive" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #fdcb6e;">🗂️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:open-memo" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #74b9ff;">📋</div>
  </a>
</div>
# 루틴
>Step : {{defaultStep}}

> [!routine]
> 확언 : {{defaultAffirmation}}
> ## ==Step==
> - [ ] 작성
> - [ ] 실행
> ## ==Block==
> - [ ] 1
> - [ ] 2
> - [ ] 3
> - [ ] 4
> - [ ] 5
> - [ ] 6
> ## ==멘탈==
> - [ ] 확언 읽기
> - [ ] 10분 명상
> ## ==식단==
> - [ ] 아침
> - [ ] 점심
> - [ ] 저녁
> ## ==운동==
> - [ ] 스쿼트 60, 팔굽 20
> ## ==취침==
> - [ ] 11시부터 정적 활동
> ## ==디톡스==
> - [ ] 1회
> - [ ] 3회
> - [ ] 5회+
---

| 날짜  | Step | Block | 멘탈  | 식단  | 운동  | 취침  | 디톡스 |
| :-: | :--: | :---: | :-: | :-: | :-: | :-: | :-: |
| {{currentDay}}  |      |      |      |      |      |      |      |
# Todo
#### 프로젝트
> (오늘 할 일 없음)

#### 할 일
- [ ] 오늘 마감인 작업 📅 {{date}}
# Project
> 🚀 전체 프로젝트 요약 대시보드 및 콜아웃 목록이 여기에 실시간으로 갱신됩니다.

# 체크리스트

| 날짜  | Step | Block | 멘탈  | 식단  | 운동  | 취침  | 디톡스 |
| :-: | :--: | :---: | :-: | :-: | :-: | :-: | :-: |
${checklistTable}
# 통계
> 📈 루틴 집계 및 아카이브 통계가 10일 구간별로 렌더링됩니다.
`;
                }
            }

            const now = this.dateManager.getAdjustedNow();
            const replacements = {

                date: now.format("YYYY-MM-DD"),

                time: now.format("HH:mm"),

                currentDay: now.date().toString(),
                defaultStep: "계획 따라 움직이기. 1:30 취침하기.",
                defaultAffirmation: "시작이 반 이다."
            };

            const content = this.templateHelper.replacePlaceholder(templateText, replacements);
            const newFile = await this.app.vault.create(schedulePath, content);
            new Notice("✅ 오늘의 스케줄 관리 노트가 성공적으로 생성되었습니다!");
            return newFile;
        } catch (err) {
            console.error(err instanceof Error ? err.message : String(err));
            new Notice("🚨 스케줄 관리 노트 생성 중 에러가 발생했습니다.");
            return null;
        }
    }

    // 3. 공용 임시 메모 파일 생성 및 열기 메서드
    async openOrCreateFleetingMemoFile(): Promise<TFile | null> {
        try {
            const memoPath = this.settings.fleetingMemoPath;
            const parts = memoPath.split("/");
            parts.pop();
            const folderPath = parts.join("/");
            
            // 폴더가 존재하지 않는다면 자동 생성
            await this.utils.ensureFolder(folderPath);

            let memoFile = this.app.vault.getAbstractFileByPath(memoPath);
            if (!memoFile) {
                // BUG-07: 미사용 now 변수 제거
                const defaultContent = `---
작성일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
수정일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
---

`;
                memoFile = await this.app.vault.create(memoPath, defaultContent);
                new Notice("📝 새 임시 메모 파일이 생성되었습니다.");
            }

            if (memoFile && memoFile instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(memoFile);
                return memoFile;
            }
            return null;
        } catch (err) {
            console.error(err instanceof Error ? err.message : String(err));
            new Notice("🚨 임시 메모를 생성하거나 여는 도중 에러가 발생했습니다.");
            return null;
        }
    }

    async loadSettings() {

        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
        // 의존성 모듈의 설정 객체 갱신
        if (this.utils) this.utils.settings = this.settings;
        if (this.synchronizer) this.synchronizer.settings = this.settings;
        if (this.resetManager) this.resetManager.settings = this.settings;
        if (this.templateHelper) this.templateHelper.settings = this.settings;
        // BUG-20: dateManager.settings도 갱신 (midnightOffsetHour 변경이 재시작 없이 즉시 반영)
        if (this.dateManager) this.dateManager.settings = this.settings;
    }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-member-access -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-call -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-argument -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-return -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unnecessary-type-assertion -- Re-enable strict rules */
