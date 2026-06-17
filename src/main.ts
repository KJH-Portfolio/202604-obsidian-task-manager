/* eslint-disable @typescript-eslint/no-unsafe-assignment -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-call -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-return -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Complex type casting needed for markdown AST */
import { Plugin, TFile, Notice, Modal, Setting, App } from "obsidian";
import { ViewPlugin, DecorationSet, Decoration, EditorView, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { PluginSettings, DEFAULT_SETTINGS, MyWorldTaskManagerSettingTab } from "./settings";
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
            const finalContent = `${this.content.trim()} 📅 ${this.selectedDate}`;
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

class TodayButtonWidget extends WidgetType {
    // BUG-02: view를 직접 참조하지 않고, 항상 최신 EditorView를 반환하는 getter 함수를 저장
    constructor(public getView: () => EditorView, public lineStart: number, public plugin: MyWorldTaskManagerPlugin) {
        super();
    }

    eq(other: TodayButtonWidget) {
        return other.lineStart === this.lineStart;
    }

    toDOM() {
        const span = activeDocument.createElement("span");
        span.className = "myworld-today-btn";
        span.textContent = "📆 오늘";
        
        span.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // BUG-02: getter를 통해 항상 최신 view를 사용
            const view = this.getView();
            const todayStr = window.moment().format("YYYY-MM-DD");
            const pos = view.posAtDOM(span);
            if (pos !== null) {
                const line = view.state.doc.lineAt(pos);
                view.dispatch({
                    changes: { from: line.to, insert: ` 📅 ${todayStr}` }
                });
            }
        };
        return span;
    }
}

export function buildTodayButtonExtension(plugin: MyWorldTaskManagerPlugin) {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;
        // BUG-02: 항상 최신 EditorView를 트래킹
        currentView: EditorView;
        constructor(view: EditorView) {
            this.currentView = view;
            this.decorations = this.buildDecorations(view);
        }
        update(update: ViewUpdate) {
            // BUG-02: update 시마다 currentView를 최신으로 갱신
            this.currentView = update.view;
            if (update.docChanged || update.viewportChanged || update.focusChanged || update.geometryChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }
        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const activeFile = plugin.app.workspace.getActiveFile();
            if (!activeFile) return builder.finish();

            const isSchedule = activeFile.path === plugin.settings.mainSchedulePath;
            const isProject = activeFile.path.startsWith(plugin.settings.projectDirectory);
            if (!isSchedule && !isProject) return builder.finish();

            // BUG-02: 클로저로 currentView getter를 위젯에 전달
            const getView = () => this.currentView;

            for (let { from, to } of view.visibleRanges) {
                let pos = from;
                while (pos <= to) {
                    const line = view.state.doc.lineAt(pos);
                    const text = line.text;
                    const isTask = /^(?:\s*>\s*)*\s*[-*+]\s+\[.\]/.test(text);
                    const isCompleted = /^(?:\s*>\s*)*\s*[-*+]\s+\[[xX-]\]/.test(text);

                    if (isTask && !isCompleted) {
                        if (!/\d{4}-\d{2}-\d{2}/.test(text)) {
                            let shouldShow = false;

                            if (isSchedule) {
                                let header = "";
                                for (let i = line.number; i > 0; i--) {
                                    const l = view.state.doc.line(i).text;
                                    const m = l.match(/^#\s+(.*)$/);
                                    if (m) {
                                        header = m[1].trim().toLowerCase();
                                        break;
                                    }
                                }
                                if (header === "todo" || header === "project") {
                                    shouldShow = true;
                                }
                            } else if (isProject) {
                                shouldShow = true;
                            }
                            
                            if (shouldShow) {
                                builder.add(
                                    line.to, 
                                    line.to, 
                                    Decoration.widget({
                                        // BUG-02: view 직접 전달 대신 getter 전달
                                        widget: new TodayButtonWidget(getView, line.from, plugin),
                                        side: 1
                                    })
                                );
                            }
                        }
                    }
                    pos = line.to + 1;
                }
            }
            return builder.finish();
        }
    }, {
        decorations: v => v.decorations
    });
}

export default class MyWorldTaskManagerPlugin extends Plugin {
    settings: PluginSettings;
    dateManager: DateManager;
    fileManager: FileManager;
    utils: TaskUtils;
    synchronizer: Synchronizer;
    resetManager: ResetManager;
    templateHelper: TemplateHelper;
    
    modifiedFiles: Set<string> = new Set<string>();
    lastActiveFile: TFile | null = null;
    // BUG-01/05: 플러그인이 직접 수정한 파일을 추적하여 vault.on('modify') 필터링
    pluginWritingFiles: Set<string> = new Set<string>();
    
    private debounceTimer: number | null = null;

    private triggerDebouncedSync() {
        if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = window.setTimeout(() => {
            this.debounceTimer = null;
            const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
            if (scheduleFile && scheduleFile instanceof TFile) {
                void (async () => {
                    try {
                        await this.synchronizer.syncDailyTasks(scheduleFile);
                    } catch (e) {
                        console.error("Auto-sync (Debounced) error:", e);
                    }
                })();
            }
        }, 2000); // 2초 디바운스 대기 후 스케줄 갱신
    }

    async onload() {
        console.log("Loading MyWorld Task Manager...");

        // 1. 설정 불러오기
        await this.loadSettings();

        // --- [Tasks 플러그인 특정 경고창 차단 옵저버] ---
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

        noticeObserver.observe(activeDocument.body, { childList: true, subtree: true });
        this.register(() => noticeObserver.disconnect());
        // ------------------------------------------------

        // CM6: 라이브 프리뷰용 오늘 버튼
        this.registerEditorExtension(buildTodayButtonExtension(this));

        // Reading Mode 용 전역 MutationObserver (오늘 버튼)
        const readingViewObserver = new MutationObserver((mutations) => {
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) return;
            const isSchedule = activeFile.path === this.settings.mainSchedulePath;
            const isProject = activeFile.path.startsWith(this.settings.projectDirectory);
            if (!isSchedule && !isProject) return;

            for (const m of mutations) {
                if (m.addedNodes.length) {
                    m.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const el = node as HTMLElement;
                            const tasks = el.classList?.contains("task-list-item") ? [el] : Array.from(el.querySelectorAll(".task-list-item"));
                            
                            tasks.forEach(taskEl => {
                                if (taskEl.getAttribute("data-task") === "x" || taskEl.classList.contains("is-checked")) return;
                                
                                // BUG-26: 비동기 렌더링을 수행하는 Tasks나 Dataview 플러그인과의 Race Condition 방지
                                window.setTimeout(() => {
                                    if (!taskEl.isConnected) return;

                                    const cloned = taskEl.cloneNode(true) as HTMLElement;
                                    cloned.querySelectorAll("ul, ol, .myworld-today-btn").forEach(e => e.remove());
                                    const rawText = cloned.textContent?.trim() || "";
                                    const rawHtml = cloned.innerHTML;
                                    
                                    // 텍스트뿐만 아니라 HTML 내부(속성 등)에 날짜가 있는지 강력하게 검사
                                    const hasDateText = /\d{4}-\d{2}-\d{2}/.test(rawText) || /\d{4}-\d{2}-\d{2}/.test(rawHtml);
                                    const hasDateAttr = Array.from(taskEl.attributes).some(attr => attr.name.startsWith("data-task-") && /\d{4}-\d{2}-\d{2}/.test(attr.value));

                                    const taskTextSpan = taskEl.querySelector(".tasks-list-text");
                                    const hasButton = taskTextSpan ? !!taskTextSpan.querySelector(".myworld-today-btn") : Array.from(taskEl.children).some(c => c.classList.contains("myworld-today-btn"));

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
                                            const btn = activeDocument.createElement("span");
                                            btn.className = "myworld-today-btn";
                                            btn.textContent = "📆 오늘";
                                            btn.onclick = async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                
                                                let cleanText = rawText.replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").trim();
                                                if (!cleanText) return;

                                                const todayStr = window.moment().format("YYYY-MM-DD");
                                                const fileContent = await this.app.vault.read(activeFile);
                                                const lines = fileContent.split("\n");
                                                let modified = false;
                                                
                                                for (let i = 0; i < lines.length; i++) {
                                                    if (lines[i].includes(cleanText) && !/\d{4}-\d{2}-\d{2}/.test(lines[i])) {
                                                        lines[i] = lines[i] + ` 📅 ${todayStr}`;
                                                        modified = true;
                                                        break;
                                                    }
                                                }
                                                
                                                if (modified) {
                                                    await this.app.vault.modify(activeFile, lines.join("\n"));
                                                    btn.remove();
                                                }
                                            };
                                            
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
                                }, 150);
                            });
                        }
                    });
                }
            }
        });
        readingViewObserver.observe(activeDocument.body, { childList: true, subtree: true });
        this.register(() => readingViewObserver.disconnect());

        // 2. 핵심 모듈 인스턴스 생성
        this.dateManager = new DateManager(this.settings);
        // BUG-01/05: pluginWritingFiles Set을 FileManager에 전달
        this.fileManager = new FileManager(this.app, this.pluginWritingFiles);
        this.utils = new TaskUtils(this.app, this.settings, this.dateManager, this.fileManager);
        this.synchronizer = new Synchronizer(this.app, this.settings, this.utils, this.dateManager, this.fileManager);
        this.resetManager = new ResetManager(this.app, this.settings, this.utils, this.dateManager, this.fileManager);
        this.templateHelper = new TemplateHelper(this.app, this.settings, this.utils, this.dateManager, this.fileManager);

        // 3. 설정 탭 등록
        this.addSettingTab(new MyWorldTaskManagerSettingTab(this.app, this));

        // 4. 자동 동기화(Auto-Sync) 이벤트 등록
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    // BUG-01/05: 플러그인이 직접 쓴 파일은 modifiedFiles에 추가하지 않아 무한 재동기화 방지
                    if (this.pluginWritingFiles.has(file.path)) {
                        this.pluginWritingFiles.delete(file.path);
                        return;
                    }
                    this.modifiedFiles.add(file.path);
                }
            })
        );


        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                const activeFile = this.app.workspace.getActiveFile();
                
                // 만약 이전 활성 파일이 있었고, 그것이 현재 활성 파일과 다르고, 수정된 목록에 있다면
                if (this.lastActiveFile && (!activeFile || this.lastActiveFile.path !== activeFile.path)) {
                    if (this.modifiedFiles.has(this.lastActiveFile.path)) {
                        const path = this.lastActiveFile.path;
                        const fileToSync = this.lastActiveFile;
                        // 백그라운드 동기화 실행 (await 하지 않음)
                        void (async () => {
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
                        })();
                    }
                }
                this.lastActiveFile = activeFile;
            })
        );

        // 5. 파일 삭제 및 이동(Rename) 이벤트 감지 (프로젝트 폴더 관련)
        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file.path.startsWith(this.settings.projectDirectory)) {
                    this.triggerDebouncedSync();
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                // 프로젝트 폴더에서 나갔거나, 들어왔거나, 안에서 이름이 바뀐 경우
                if (file.path.startsWith(this.settings.projectDirectory) || oldPath.startsWith(this.settings.projectDirectory)) {
                    this.triggerDebouncedSync();
                }
            })
        );


        // 플러그인 로드 시(초기 1회) 스케줄 기준 전체 동기화
        this.app.workspace.onLayoutReady(() => {
            this.lastActiveFile = this.app.workspace.getActiveFile();
            const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
            if (scheduleFile && scheduleFile instanceof TFile) {
                void (async () => {
                    try {
                        console.log("Running initial sync...");
                        await this.synchronizer.syncDailyTasks(scheduleFile);
                    } catch (e) {
                        console.error("Initial sync error:", e);
                    }
                })();
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
                                const original = await this.app.vault.read(scheduleFile);
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

        // 명령어 F: 현재 창 새로고침 (비활성화 후 재활성화)
        this.addCommand({
            id: "refresh-active-view",
            name: "현재 창 새로고침 (비활성화 후 재활성화)",
            callback: async () => {
                const leaf = this.app.workspace.activeLeaf;
                if (leaf) {
                    const state = leaf.getViewState();
                    const eState = leaf.getEphemeralState();
                    
                    await leaf.setViewState(state);
                    leaf.setEphemeralState(eState);
                    
                    new Notice("🔄 현재 창을 새로고침 했습니다.");
                } else {
                    new Notice("⚠️ 새로고침할 활성 창이 없습니다.");
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

        // 명령어 G: 새 프로젝트 생성 (create-new-project)
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

        // 명령어 H: 오늘의 스케줄 관리 노트 생성 (create-today-schedule)
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

        // 명령어 I: 원클릭 PARA 시스템 폴더 구조 생성 (myworld-setup-para)
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

        // 명령어 J: 원클릭 제텔카스텐 폴더 구조 생성 (myworld-setup-zettelkasten)
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
        // BUG-03: 플러그인 종료 시 debounce 타이머 정리하여 시스템 종료 후 콜백 실행 방지
        if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
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
