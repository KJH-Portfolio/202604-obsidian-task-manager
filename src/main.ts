/* eslint-disable @typescript-eslint/no-unsafe-assignment -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-call -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-return -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Complex type casting needed for markdown AST */
import { Plugin, TFile, Notice, Modal, App, MarkdownView, setIcon } from "obsidian";
import { EditorView } from "@codemirror/view";
import { buildCalendarPopup, buildTodayButtonExtension, buildDateClickablePlugin } from "./ui/CalendarWidget";
import { buildDDayBadgePlugin } from "./ui/DDayBadgePlugin";
import { buildCopyToExecutionButtonExtension } from "./ui/CopyToExecutionWidget";
import { buildAddExecutionTaskButtonExtension } from "./ui/AddExecutionTaskWidget";
import { buildScheduleHeaderButtonsExtension, ScheduleHeaderActionType } from "./ui/ScheduleHeaderButtonsWidget";
import { PluginSettings, DEFAULT_SETTINGS, MyWorldTaskManagerSettingTab, StartupSyncModal } from "./settings";
import { TaskUtils } from "./TaskUtils";
import { Synchronizer } from "./Synchronizer";
import { ResetManager } from "./ResetManager";
import { TemplateHelper } from "./TemplateHelper";
import { DateManager } from "./DateManager";
import { FileManager } from "./FileManager";
import { TaskQueue } from "./TaskQueue";
import { EventController } from "./controllers/EventController";
import { RoutineManagerModal } from "./ui/RoutineManagerModal";
import { RoutineSyncEngine } from "./RoutineSyncEngine";
import { TodoManagerModal, TodoItem } from "./ui/TodoManagerModal";

import { t, translations } from "./i18n";

// 1. 빠른 할 일 캡처 모달
class QuickCaptureModal extends Modal {
    content: string;
    selectedDate: string;
    language: string;
    descKey: keyof typeof translations;
    onSubmit: (content: string) => Promise<void> | void;

    constructor(app: App, language: string, onSubmit: (content: string) => void, descKey: keyof typeof translations = "modal_add_task_desc") {
        super(app);
        this.content = "";
        this.language = language;
        this.descKey = descKey;
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
        const title = leftGroup.createEl("h3", { text: t("modal_add_task_title", this.language) });
        title.addClass("myworld-margin-0");
        leftGroup.createSpan({ text: t(this.descKey, this.language), cls: "myworld-text-muted-md" });

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
        const inputEl = inputContainer.createEl("input", { type: "text", placeholder: t("modal_add_task_placeholder", this.language) });
        inputEl.addClass("myworld-w-100");
        inputEl.addClass("myworld-p-10");

        inputEl.addEventListener("input", (e) => {
            this.content = (e.target as HTMLInputElement).value;
        });

        const submitAction = () => {
            if (this.content.trim() === "") {
                new Notice(t("modal_empty_warning", this.language));
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
        const btn = btnContainer.createEl("button", { text: t("modal_add_task_btn", this.language) });
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

export default class MyWorldTaskManagerPlugin extends Plugin {
    declare settings: PluginSettings;
    dateManager!: DateManager;
    fileManager!: FileManager;
    utils!: TaskUtils;
    synchronizer!: Synchronizer;
    resetManager!: ResetManager;
    templateHelper!: TemplateHelper;
    taskQueue: TaskQueue = new TaskQueue();

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
    public enqueueFileWrite(filePath: string, task: () => Promise<void>): void {
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

    private syncLock: Set<string> = new Set<string>();

    public async triggerAutoSyncForFile(fileToSync: TFile, force = false, silent = false) {
        if (!force && !this.modifiedFiles.has(fileToSync.path)) return;

        const path = fileToSync.path;

        // 300ms 디바운스 및 순차 실행 큐(TaskQueue) 적용
        this.taskQueue.enqueue(path, async () => {
            // 동기화 중복 실행 방지 (Race Condition Lock)
            if (this.syncLock.has(path)) {
                console.warn(`Sync already in progress for ${path}. Skipping overlapping sync.`);
                return;
            }
            this.syncLock.add(path);

            try {
                if (path === this.settings.mainSchedulePath) {
                    await this.synchronizer.syncDailyTasks(fileToSync, silent);
                } else if (path.startsWith(this.settings.projectDirectory)) {
                    await this.synchronizer.syncProjectNoteIdentifiers(fileToSync, silent);
                }
            } catch (e) {
                console.error("Auto-sync error:", e);
            } finally {
                this.modifiedFiles.delete(path);
                this.syncLock.delete(path);
            }
        }, 300);
    }

    async onload() {
        // console.log("Loading MyWorld Task Manager...");

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

        // 3. 컨트롤러 인스턴스 생성 및 이벤트/명령어 등록
        const eventController = new EventController(this.app, this);
        eventController.registerEvents();

        // 강제로 scRender.js 업데이트 (데이터뷰 로직 최신화)
        this.app.workspace.onLayoutReady(async () => {
            try {
                const folderPath = this.settings.projectDirectory + "/01.List";
                const scRenderPath = `${folderPath}/scRender.js`;
                const existingScRender = this.app.vault.getAbstractFileByPath(scRenderPath);
                if (existingScRender instanceof TFile) {
                    await this.app.vault.modify(existingScRender, this.templateHelper.scRenderJsContent);
                } else if (!existingScRender) {
                    // 상위 폴더가 존재하는지 확인 후 생성
                    const folder = this.app.vault.getAbstractFileByPath(folderPath);
                    if (folder) await this.app.vault.create(scRenderPath, this.templateHelper.scRenderJsContent);
                }
            } catch (e) {
                console.error("Failed to update scRender.js on load:", e);
            }
        });

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
            if (!isSchedule) return;

            const view = EditorView.findFromDOM(cmEditorEl as HTMLElement);
            if (!view) return;

            // posAtDOM(cmLineEl)은 콜아웃 컨텍스트에서 잘못된 위치를 반환하므로
            // 마우스 좌표 기반을 primary로, target DOM 기반을 fallback으로 사용
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false)
                     ?? view.posAtDOM(target);
            if (pos === null || pos < 0) return;

            let line = view.state.doc.lineAt(pos);
            let markerMatch = line.text.match(/^(\s*(?:>\s*)*[-*+]\s+\[)(.)(\])/);

            // 콜아웃(Live Preview Widget) 내부 클릭 시 pos가 콜아웃 시작점으로 잡혀서 매칭 실패하는 경우 대비 폴백
            if (!markerMatch) {
                const taskEl = target.closest(".task-list-item") as HTMLElement | null;
                if (taskEl) {
                    const clonedForMatch = taskEl.cloneNode(true) as HTMLElement;
                    clonedForMatch.querySelectorAll("ul, ol, .myworld-today-btn, .myworld-date-clickable").forEach(el => el.remove());
                    const cleanText = (clonedForMatch.textContent?.trim() || "").replace(/📅.*/, "").trim();

                    if (cleanText) {
                        for (let i = line.number; i <= Math.min(line.number + 50, view.state.doc.lines); i++) {
                            const l = view.state.doc.line(i);
                            const m = l.text.match(/^(\s*(?:>\s*)*[-*+]\s+\[)(.)(\])/);
                            if (m && l.text.includes(cleanText)) {
                                line = l;
                                markerMatch = m;
                                break;
                            }
                        }
                    }
                }
            }

            if (!markerMatch) return;

            // 옵시디언 코어 및 타 플러그인 개입 원천 차단 (우리가 직접 처리할 수 있는 경우에만 차단)
            e.preventDefault();
            e.stopImmediatePropagation();

            const nextMarker = /^[xX]$/.test(markerMatch[2]) ? " " : "x";
            const markerStart = line.from + markerMatch[1].length;

            view.dispatch({ changes: { from: markerStart, to: markerStart + 1, insert: nextMarker } });

            // Tasks 플러그인의 Dirty Workaround 방식:
            // 옵시디언이 강제로 상태를 되돌리는 것을 막기 위해 명시적으로 상태 재지정
            const desiredChecked = nextMarker !== " ";
            window.setTimeout(() => {
                (target as HTMLInputElement).checked = desiredChecked;
            }, 1);

            // BUG-FIX: active-leaf-change 의존 제거
            // view.dispatch()는 CM6 메모리 상태만 변경하고 파일 저장은 비동기로 발생하므로,
            // 탭 전환 없이 같은 파일에 머물거나 팝아웃 창에서 클릭하는 경우 동기화가
            // 영원히 트리거되지 않는 버그를 방지하기 위해 클릭 직후 강제 동기화한다.
            // getActiveViewOrFileText()가 editor.getValue()(메모리)를 사용하므로
            // CM6 디스크 저장 완료 여부와 무관하게 최신 내용을 읽을 수 있다.
            window.setTimeout(() => {
                if (targetFile) {
                    this.modifiedFiles.add(targetFile.path);
                    void this.triggerAutoSyncForFile(targetFile, true, true); // silent=true: 로딩창/노티스 숨김
                }
            }, 50);
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

            // BUG-FIX: 팝아웃(팝아웃) 창이 닫힐 때, 해당 창에서 수정된 파일을 동기화한다.
            // getActiveFile()은 메인 창 기준이므로 팝아웃 파일은 active-leaf-change로
            // 동기화가 트리거되지 않는 버그를 방지한다.
            const leaves = this.app.workspace.getLeavesOfType("markdown");
            for (const leaf of leaves) {
                const view = leaf.view as MarkdownView;
                if (view?.containerEl?.ownerDocument === closedWin.doc) {
                    const f = view.file;
                    if (f && this.modifiedFiles.has(f.path)) {
                        void this.triggerAutoSyncForFile(f);
                    }
                }
            }
        }));

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 2. 읽기 모드(Reading Mode): 마크다운 렌더링 파이프라인 개입
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.registerMarkdownPostProcessor((element, context) => {
            const isSchedule = context.sourcePath === this.settings.mainSchedulePath;
            if (!isSchedule) return;

            const items = element.querySelectorAll(".task-list-item, input[type='checkbox']");
            items.forEach((item) => {
                const handler = (e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    const target = e.target as HTMLElement;
                    const taskEl = (target.closest(".task-list-item") || item.closest(".task-list-item")) as HTMLElement | null;
                    if (!taskEl) return;

                    const currentMarker = taskEl.getAttribute("data-task") ?? " ";
                    const nextMarker = /^[xX]$/.test(currentMarker) ? " " : "x";

                    const clonedForMatch = taskEl.cloneNode(true) as HTMLElement;
                    clonedForMatch.querySelectorAll("ul, ol, .myworld-today-btn, .myworld-date-clickable, .dday-virtual-badge, .myworld-copy-btn, input").forEach(el => el.remove());
                    const rawText = clonedForMatch.textContent?.trim() || "";
                    const cleanText = rawText.replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/📅.*/, "").trim();

                    if (!cleanText) return;

                    const targetFile = this.app.vault.getAbstractFileByPath(context.sourcePath);
                    if (!targetFile || !(targetFile instanceof TFile)) return;

                    this.enqueueFileWrite(targetFile.path, async () => {
                        const fileContent = await this.fileManager.getActiveViewOrFileText(targetFile);
                        const lines = fileContent.split("\n");
                        let targetLineIndex = -1;

                        // 1. exact 핀포인트 매칭 정규식: 태스크 텍스트와 정확히 일치하는 파일 라인 탐색
                        const escapedText = cleanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const exactRegex = new RegExp(`^\\s*(?:>\\s*)*[-*+]\\s+\\[.\\]\\s*${escapedText}(?:\\s+.*)?$`);

                        for (let i = 0; i < lines.length; i++) {
                            if (exactRegex.test(lines[i])) {
                                targetLineIndex = i;
                                break;
                            }
                        }

                        // 2. 부분 일치 fallback
                        if (targetLineIndex === -1) {
                            for (let i = 0; i < lines.length; i++) {
                                if (/^\s*(?:>\s*)*[-*+]\s+\[.\]/.test(lines[i]) && lines[i].includes(cleanText)) {
                                    targetLineIndex = i;
                                    break;
                                }
                            }
                        }

                        if (targetLineIndex !== -1) {
                            lines[targetLineIndex] = lines[targetLineIndex].replace(
                                /^(\s*(?:>\s*)*[-*+]\s+\[)(.)(\])/,
                                `$1${nextMarker}$3`
                            );
                            await this.fileManager.saveIfChanged(targetFile, fileContent, lines.join("\n"));
                            void this.triggerAutoSyncForFile(targetFile, true, true);
                        }
                    });
                };

                item.addEventListener("click", handler, { capture: true });
            });
        });

        // CM6: 라이브 프리뷰용 오늘 버튼 (이모지 + 달력 팝업)
        this.registerEditorExtension(buildTodayButtonExtension(this.app, () => this));

        // CM6: 라이브 프리뷰용 날짜 텍스트 → 클릭 가능한 달력 팝업
        this.registerEditorExtension(buildDateClickablePlugin(this.app, () => this));

        // CM6: 라이브 프리뷰용 계획->실행 복사 버튼
        this.registerEditorExtension(buildCopyToExecutionButtonExtension(this.app, () => this));

        // CM6: 라이브 프리뷰용 # 실행 헤더 ✏️ 빠른 Task 추가 버튼
        this.registerEditorExtension(buildAddExecutionTaskButtonExtension(this.app, () => this, (file) => this.openAddExecutionTaskModal(file)));

        // CM6: 라이브 프리뷰용 스케줄 헤더 버튼들 (루틴->일간마감, Todo->빠른추가+임시메모, 통계->월간아카이브)
        this.registerEditorExtension(buildScheduleHeaderButtonsExtension(this.app, () => this, (file, action) => this.handleScheduleHeaderAction(file, action)));

        // CM6: 라이브 프리뷰용 D-Day 가상 뱃지 ([!], [D])
        this.registerEditorExtension(buildDDayBadgePlugin(this.app));

        // Reading Mode: 스케줄 노트 헤더 전용 버튼들 (루틴, Todo, 통계)
        this.registerMarkdownPostProcessor((element, context) => {
            const isSchedule = context.sourcePath === this.settings.mainSchedulePath;
            if (!isSchedule) return;

            const headings = Array.from(element.querySelectorAll("h1, h2, h3, h4, h5, h6")) as HTMLElement[];
            headings.forEach(h => {
                const text = h.textContent?.trim().toLowerCase() || "";
                const isKo = this.settings.language === "ko";

                const addBtn = (actionType: ScheduleHeaderActionType, iconName: string, tooltip: string) => {
                    const btn = createSpan();
                    btn.className = `myworld-header-action-btn myworld-btn-${actionType}`;
                    setIcon(btn, iconName);
                    btn.title = tooltip;
                    btn.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
                        if (file && file instanceof TFile) {
                            this.handleScheduleHeaderAction(file, actionType);
                        }
                    });
                    h.appendChild(btn);
                    h.addClass("myworld-header-with-btn");
                };

                if (text === "루틴" || text === "routine") {
                    if (!h.querySelector(".myworld-btn-routine-manager")) {
                        addBtn("routine-manager", "settings", isKo ? "루틴 편집 및 설정" : "Edit Routine Manager");
                    }
                    if (!h.querySelector(".myworld-btn-daily-reset")) {
                        addBtn("daily-reset", "sun", isKo ? "일간 마감 실행" : "Run Daily Reset");
                    }
                } else if (text === "todo") {
                    if (!h.querySelector(".myworld-btn-todo-manager")) {
                        addBtn("todo-manager", "settings", isKo ? "Todo 항목 관리" : "Manage Todo Items");
                    }
                } else if (text === "체크리스트" || text === "checklist") {
                    if (!h.querySelector(".myworld-btn-monthly-archive")) {
                        addBtn("monthly-archive", "archive", isKo ? "월간 아카이브 생성" : "Create Monthly Archive");
                    }
                }
            });
        });

        // Reading Mode: 프로젝트 노트 # 실행 헤더 ➕ 빠른 Task 추가 버튼
        this.registerMarkdownPostProcessor((element, context) => {
            const isProject = context.sourcePath.startsWith(this.settings.projectDirectory);
            if (!isProject) return;

            const headings = Array.from(element.querySelectorAll("h1, h2, h3, h4, h5, h6")) as HTMLElement[];
            headings.forEach(h => {
                const text = h.textContent?.trim().toLowerCase() || "";
                if (text === "실행" || text === "execution") {
                    if (!h.querySelector(".myworld-add-execution-btn")) {
                        const btn = createSpan();
                        btn.className = "myworld-add-execution-btn";
                        setIcon(btn, "pencil");
                        btn.title = this.settings.language === 'ko' ? "실행 할 일 추가" : "Add Task to Execution";
                        btn.addEventListener("click", (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
                            if (file && file instanceof TFile) {
                                this.openAddExecutionTaskModal(file);
                            }
                        });
                        h.appendChild(btn);
                    }
                }
            });
        });

        // Reading Mode 용 MarkdownPostProcessor (오늘 버튼 및 달력 날짜)
        this.registerMarkdownPostProcessor((element, context) => {
            const isSchedule = context.sourcePath === this.settings.mainSchedulePath;
            const isProject = context.sourcePath.startsWith(this.settings.projectDirectory);
            if (!isSchedule && !isProject) return;

            const listItems = Array.from(element.querySelectorAll("li")) as HTMLElement[];
            if (!listItems.length) return;

            const clickFile = this.app.vault.getAbstractFileByPath(context.sourcePath);
            if (!clickFile || !(clickFile instanceof TFile)) return;

            listItems.forEach(taskEl => {
                try {
                const isTaskItem = taskEl.classList.contains("task-list-item");
                // [x] / [X] 만 스킵 — [1],[0],[!] 등 커스텀 마커는 처리 대상
                if (isTaskItem && /^[xX]$/.test(taskEl.getAttribute("data-task") ?? "")) return;

                const cloned = taskEl.cloneNode(true) as HTMLElement;
                cloned.querySelectorAll("ul, ol, .myworld-today-btn").forEach(e => e.remove());
                const rawText = cloned.textContent?.trim() || "";
                const rawHtml = cloned.innerHTML;

                const hasDateText = /\d{4}-\d{2}-\d{2}/.test(rawText) || /\d{4}-\d{2}-\d{2}/.test(rawHtml);
                const hasDateAttr = isTaskItem ? Array.from(taskEl.attributes).some(attr => attr.name.startsWith("data-task-") && /\d{4}-\d{2}-\d{2}/.test(attr.value)) : false;

                const taskTextSpan = taskEl.querySelector(".tasks-list-text");
                const hasButton = taskTextSpan ? !!taskTextSpan.querySelector(".myworld-today-btn") : Array.from(taskEl.children).some(c => c.classList.contains("myworld-today-btn"));

                const doc = element.ownerDocument;

                // ── D-Day 가상 뱃지 주입 (Reading Mode) ─────────────────────────
                if (isTaskItem && !taskEl.querySelector(".dday-virtual-badge-rm")) {
                    const clonedForDate = taskEl.cloneNode(true) as HTMLElement;
                    clonedForDate.querySelectorAll("ul, ol, .myworld-today-btn").forEach(e => e.remove());
                    const rawTextForBadge = clonedForDate.textContent?.trim() || "";
                    const dateMatchForBadge = rawTextForBadge.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                    let dateStr = dateMatchForBadge ? dateMatchForBadge[1] : null;

                    if (!dateStr) {
                        // Check ancestors
                        let parentEl = taskEl.parentElement?.closest("li.task-list-item");
                        while (parentEl) {
                            const pCloned = parentEl.cloneNode(true) as HTMLElement;
                            pCloned.querySelectorAll("ul, ol, .myworld-today-btn").forEach(e => e.remove());
                            const pMatch = pCloned.textContent?.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                            if (pMatch) {
                                dateStr = pMatch[1];
                                break;
                            }
                            parentEl = parentEl.parentElement?.closest("li.task-list-item");
                        }
                    }

                    const dataTask = taskEl.getAttribute("data-task") ?? "";
                    // 완료 체크박스는 스킵
                    if (dateStr && !/^[xX]$/.test(dataTask)) {
                        // @ts-ignore
                        const targetDate = window.moment(dateStr, "YYYY-MM-DD", true);
                        // @ts-ignore
                        const today = window.moment().startOf('day');
                        if (targetDate.isValid()) {
                            const diff = targetDate.diff(today, 'days');
                            let badge = "";
                            let color = "";
                            if (diff < 0) { badge = "[!]"; color = "#8c0028"; }
                            else if (diff === 0) { badge = "[D]"; color = "#e93147"; }
                            else if (diff === 1) { badge = "[D]"; color = "#ffd200"; }
                            else if (diff === 2) { badge = "[D]"; color = "#44cf6e"; }
                            else if (diff === 3) { badge = "[D]"; color = "#086ddd"; }
                            else { badge = "[D]"; color = "#969696"; }

                            const badgeSpan = createSpan({ cls: "dday-virtual-badge dday-virtual-badge-rm" });
                            badgeSpan.textContent = badge;
                            badgeSpan.style.color = color;

                            const checkbox = taskEl.querySelector("input[type='checkbox']");
                            if (checkbox && checkbox.nextSibling && checkbox.parentNode) {
                                checkbox.parentNode.insertBefore(badgeSpan, checkbox.nextSibling);
                            } else if (checkbox && checkbox.parentNode) {
                                checkbox.parentNode.appendChild(badgeSpan);
                            } else {
                                taskEl.appendChild(badgeSpan);
                            }
                        }
                    }
                }
                // ──────────────────────────────────────────────────────────────────

                if (hasDateText && !taskEl.querySelector(".myworld-date-clickable")) {
                    const walker = doc.createTreeWalker(taskEl, NodeFilter.SHOW_TEXT, {
                        acceptNode: (node) => {
                            let p = node.parentElement;
                            while (p && p !== taskEl) {
                                if (p.classList.contains("task-list-item") || p.tagName === "LI") {
                                    if (p !== taskEl) return NodeFilter.FILTER_REJECT;
                                }
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
                                        let globalDateIndex = 0;

                    const processTextNode = (textNode) => {
                        const text = textNode.textContent || "";
                        const match = text.match(/(\uD83D\uDCC5\s*)(\d{4}-\d{2}-\d{2})/);
                        if (!match || match.index === undefined) return;

                        const currentTargetIndex = globalDateIndex++;
                        const dateStr = match[2];
                        const before = text.slice(0, match.index);
                        const after = text.slice(match.index + match[0].length);

                        const frag = createFragment();
                        if (before) frag.appendChild(doc.createTextNode(before));

                                                const dateSpan = createSpan();
                        dateSpan.className = "myworld-date-clickable";
                        dateSpan.textContent = "\uD83D\uDCC5 " + dateStr;

                        const todayStr = this.dateManager?.getAdjustedNow().format("YYYY-MM-DD") || window.moment().format("YYYY-MM-DD");
                        if (dateStr < todayStr) dateSpan.classList.add("myworld-overdue");

                        dateSpan.addEventListener("mousedown", (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            const rect = dateSpan.getBoundingClientRect();

                            const taskClone = taskEl.cloneNode(true) as HTMLElement;
                            taskClone.querySelectorAll("ul, ol, .myworld-today-btn, .dday-virtual-badge, .myworld-copy-btn").forEach(e => e.remove());
                            const cleanTextForMatch = (taskClone.textContent?.trim() || "").replace(/^(?:>\s*)*[-*+]\s*(?:\[.\]\s*)?/, "").replace(/\uD83D\uDCC5.*/, "").trim();
                            const container = taskEl.closest(".markdown-reading-view") || doc.body;
                            const allTasks = Array.from((container as HTMLElement).querySelectorAll(isTaskItem ? ".task-list-item" : "li:not(.task-list-item)"));
                            let occurrenceIndex = 0;
                            for (const t of allTasks) {
                                const tCloned = t.cloneNode(true);
                                (tCloned as HTMLElement).querySelectorAll("ul, ol, .myworld-today-btn, .dday-virtual-badge, .myworld-copy-btn").forEach(e => e.remove());
                                const tClean = (tCloned.textContent?.trim() || "").replace(/^(?:>\s*)*[-*+]\s*(?:\[.\]\s*)?/, "").replace(/\uD83D\uDCC5.*/, "").trim();
                                if (tClean === cleanTextForMatch) {
                                    if (t === taskEl) break;
                                    occurrenceIndex++;
                                }
                            }

                            buildCalendarPopup(dateStr, rect.left, rect.bottom + 5, (newDate) => {
                                this.enqueueFileWrite(clickFile.path, async () => {
                                    const rawContent = await this.fileManager.getActiveViewOrFileText(clickFile);
                                    const lines = rawContent.split("\n");
                                    let targetLineIndex = -1;
                                    const dataLineNode = taskEl.dataset.line ? taskEl : taskEl.closest("[data-line]");
                                    if (dataLineNode && (dataLineNode as HTMLElement).dataset.line) {
                                        const lineNum = parseInt((dataLineNode as HTMLElement).dataset.line!, 10);
                                        if (lineNum >= 0 && lineNum < lines.length && /^\s*(?:>\s*)*[-*+]\s+/.test(lines[lineNum])) {
                                            targetLineIndex = lineNum;
                                        }
                                    }
                                    
                                    if (targetLineIndex === -1) {
                                        let matchCount = 0;
                                        for (let i = 0; i < lines.length; i++) {
                                            const isLineTask = /^\s*(?:>\s*)*[-*+]\s+\[.\]/.test(lines[i]);
                                            const isLineList = /^\s*(?:>\s*)*[-*+]\s+/.test(lines[i]);

                                            if ((isTaskItem && isLineTask) || (!isTaskItem && isLineList && !isLineTask)) {
                                                let lineClean = lines[i].replace(/^\s*(?:>\s*)*[-*+]\s*(?:\[.\]\s*)?/, "").replace(/\uD83D\uDCC5.*/, "").trim();
                                                if (lineClean === cleanTextForMatch) {
                                                    if (matchCount === occurrenceIndex) {
                                                        targetLineIndex = i;
                                                        break;
                                                    }
                                                    matchCount++;
                                                }
                                            }
                                        }
                                    }
                                    
                                    if (targetLineIndex !== -1) {
                                        let dateOccurrence = 0;
                                        lines[targetLineIndex] = lines[targetLineIndex].replace(/\s*\uD83D\uDCC5\s*\d{4}-\d{2}-\d{2}/g, (m) => {
                                            if (dateOccurrence === currentTargetIndex) {
                                                dateOccurrence++;
                                                if (newDate === null) return "";
                                                return m.replace(/\uD83D\uDCC5\s*\d{4}-\d{2}-\d{2}/, `\uD83D\uDCC5 ${newDate}`);
                                            }
                                            dateOccurrence++;
                                            return m;
                                        });
                                        await this.fileManager.saveIfChanged(clickFile, rawContent, lines.join("\n"));
                                    }
                                });
                            }, activeDocument, this.settings.language);
                        });

                        frag.appendChild(dateSpan);

                        const afterNode = doc.createTextNode(after);
                        frag.appendChild(afterNode);

                        if (textNode.parentNode) {
                            textNode.parentNode.replaceChild(frag, textNode);
                        }

                        processTextNode(afterNode);
                    };

                    nodesToProcess.forEach(processTextNode);
                }

                const taskStatus = taskEl.getAttribute("data-task") ?? "";

                const isUnchecked = taskStatus === " " || taskStatus === "";

                if (isTaskItem && !taskEl.querySelector(".myworld-copy-btn") && isUnchecked) {
                    let shouldShowCopy = false;
                    let foundHeader = "";
                    if (isProject || isSchedule) {
                        const cache = this.app.metadataCache.getCache(context.sourcePath);
                        let lineNum = -1;
                        if (taskEl.dataset.line) {
                            lineNum = parseInt(taskEl.dataset.line, 10);
                        } else {
                            const parent = taskEl.closest("[data-line]");
                            if (parent) lineNum = parseInt((parent as HTMLElement).dataset.line!, 10);
                        }

                        if (lineNum !== -1 && cache && cache.headings) {
                            let nearestHeading = null;
                            for (const h of cache.headings) {
                                if (h.position.start.line <= lineNum) {
                                    if (h.level === 1) {
                                        nearestHeading = h;
                                    }
                                } else {
                                    break;
                                }
                            }
                            if (nearestHeading) foundHeader = nearestHeading.heading.trim().toLowerCase();
                        } else {
                            const sectionInfo = context.getSectionInfo(element);
                            if (sectionInfo) {
                                const sourceLines = sectionInfo.text.split('\n');
                                for (let i = sectionInfo.lineStart; i >= 0; i--) {
                                    const m = sourceLines[i]?.match(/^#\s+(.+)$/);
                                    if (m) {
                                        foundHeader = m[1].trim().toLowerCase();
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if (isProject && (foundHeader === '계획' || foundHeader === 'plan')) shouldShowCopy = true;
                    }

                    if (shouldShowCopy) {
                        const btn = createSpan();
                        btn.className = "myworld-copy-btn";
                        btn.textContent = "⬆️";
                        btn.title = this.settings.language === 'ko' ? "실행 탭으로 복사" : "Copy to Execution";
                        
                        btn.addEventListener("mousedown", (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const taskClone = taskEl.cloneNode(true) as HTMLElement;
                            taskClone.querySelectorAll("ul, ol, .myworld-today-btn, .dday-virtual-badge, .myworld-copy-btn").forEach(e => e.remove());
                            let cleanText = (taskClone.textContent?.trim() || "").replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/\uD83D\uDCC5.*/, "").trim();
                            if (!cleanText) return;

                            const container = taskEl.closest(".markdown-reading-view") || doc.body;
                            const allTasks = Array.from((container as HTMLElement).querySelectorAll(".task-list-item"));
                            let occurrenceIndex = 0;
                            for (const t of allTasks) {
                                const tCloned = t.cloneNode(true) as HTMLElement;
                                (tCloned as HTMLElement).querySelectorAll("ul, ol, .myworld-today-btn, .dday-virtual-badge, .myworld-copy-btn").forEach(el => el.remove());
                                const tClean = (tCloned.textContent?.trim() || "").replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/\uD83D\uDCC5.*/, "").trim();
                                if (tClean === cleanText) {
                                    if (t === taskEl) break;
                                    occurrenceIndex++;
                                }
                            }

                            this.enqueueFileWrite(clickFile.path, async () => {
                                const rawContent = await this.fileManager.getActiveViewOrFileText(clickFile);
                                const lines = rawContent.split("\n");
                                
                                let taskText = "";
                                let taskLineNum = -1;
                                
                                const dataLineNode = taskEl.dataset.line ? taskEl : taskEl.closest("[data-line]");
                                if (dataLineNode && (dataLineNode as HTMLElement).dataset.line) {
                                    const lineNum = parseInt((dataLineNode as HTMLElement).dataset.line!, 10);
                                    if (lineNum >= 0 && lineNum < lines.length && /^\s*(?:>\s*)*[-*+]\s+\[.\]/.test(lines[lineNum])) {
                                        taskLineNum = lineNum;
                                        taskText = lines[lineNum];
                                    }
                                }

                                if (taskLineNum === -1) {
                                    let matchCount = 0;
                                    for (let i = 0; i < lines.length; i++) {
                                        if (/^\s*(?:>\s*)*[-*+]\s+\[.\]/.test(lines[i])) {
                                            const lineClean = lines[i].replace(/^\s*(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/\uD83D\uDCC5.*/, "").trim();
                                            if (lineClean === cleanText) {
                                                if (matchCount === occurrenceIndex) {
                                                    taskText = lines[i];
                                                    taskLineNum = i;
                                                    break;
                                                }
                                                matchCount++;
                                            }
                                        }
                                    }
                                }
                                
                                if (!taskText) return;

                                const getIndent = (s: string) => {
                                    const m = s.match(/^([\s\t]*)/);
                                    if (!m) return 0;
                                    return m[1].replace(/\t/g, "    ").length;
                                }
                                const baseIndent = getIndent(taskText);
                                let nextLine = taskLineNum + 1;
                                while (nextLine < lines.length) {
                                    const nextText = lines[nextLine];
                                    if (nextText.trim() === "") {
                                        nextLine++;
                                        continue;
                                    }
                                    if (getIndent(nextText) <= baseIndent) {
                                        break;
                                    }
                                    taskText += "\n" + nextText;
                                    nextLine++;
                                }

                                let targetIndex = -1;
                                for (let i = 0; i < lines.length; i++) {
                                    const h = lines[i].trim().toLowerCase();
                                    if (h === "# 실행" || h === "# execution") {
                                        targetIndex = i + 1;
                                        while (targetIndex < lines.length) {
                                            if (lines[targetIndex].startsWith("#")) {
                                                while(targetIndex > i + 1 && lines[targetIndex - 1].trim() === "") {
                                                    targetIndex--;
                                                }
                                                break;
                                            }
                                            targetIndex++;
                                        }
                                        break;
                                    }
                                }
                                
                                if (targetIndex !== -1) {
                                    lines.splice(targetIndex, 0, taskText);
                                    await this.fileManager.saveIfChanged(clickFile, rawContent, lines.join("\n"));
                                    new Notice(this.settings.language === 'ko' ? "실행 탭으로 복사 완료!" : "Copied to Execution tab!");
                                }
                            });
                        });

                        const targetContainer = taskEl.querySelector(".list-item-content") || taskEl;
                        const childList = Array.from(targetContainer.children).find(c => c.tagName === "UL" || c.tagName === "OL");
                        
                        if (childList) {
                            targetContainer.insertBefore(btn, childList);
                        } else {
                            targetContainer.appendChild(btn);
                        }
                    }
                }

                if (isTaskItem && !hasDateText && !hasDateAttr && !hasButton) {
                    let shouldShow = false;
                    let foundHeader = "";
                    if (isSchedule || isProject) {
                        const cache = this.app.metadataCache.getCache(context.sourcePath);
                        const sectionInfo = context.getSectionInfo(element);
                        const lineNum = sectionInfo ? sectionInfo.lineStart : -1;

                        if (lineNum !== -1 && cache && cache.headings) {
                            let nearestHeading = null;
                            for (const h of cache.headings) {
                                if (h.position.start.line <= lineNum) {
                                    if (h.level === 1) {
                                        nearestHeading = h;
                                    }
                                } else {
                                    break;
                                }
                            }
                            if (nearestHeading) foundHeader = nearestHeading.heading.trim().toLowerCase();
                        } else if (sectionInfo) {
                            const sourceLines = sectionInfo.text.split('\n');
                            for (let i = sectionInfo.lineStart; i >= 0; i--) {
                                const m = sourceLines[i]?.match(/^#\s+(.+)$/);
                                if (m) {
                                    foundHeader = m[1].trim().toLowerCase();
                                    break;
                                }
                            }
                        }
                    }

                    if (isSchedule) {
                        if (foundHeader === 'todo' || foundHeader === 'project') shouldShow = true;
                    } else if (isProject) {
                        shouldShow = true;
                    }

                    if (shouldShow) {
                        const btn = createSpan();
                        btn.className = "myworld-today-btn";
                        btn.textContent = "📅";
                        btn.title = "날짜 지정";
                        btn.addEventListener("mousedown", (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const taskClone = taskEl.cloneNode(true) as HTMLElement;
                            taskClone.querySelectorAll("ul, ol, .myworld-today-btn, .dday-virtual-badge, .myworld-copy-btn").forEach(e => e.remove());
                            let cleanText = (taskClone.textContent?.trim() || "").replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/\uD83D\uDCC5.*/, "").trim();
                            if (!cleanText) return;

                            const container = taskEl.closest(".markdown-reading-view") || doc.body;
                            const allTasks = Array.from((container as HTMLElement).querySelectorAll(".task-list-item"));
                            let occurrenceIndex = 0;
                            for (const t of allTasks) {
                                const tCloned = t.cloneNode(true) as HTMLElement;
                                (tCloned as HTMLElement).querySelectorAll("ul, ol, .myworld-today-btn, .dday-virtual-badge, .myworld-copy-btn").forEach(el => el.remove());
                                const tClean = (tCloned.textContent?.trim() || "").replace(/^(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/\uD83D\uDCC5.*/, "").trim();
                                if (tClean === cleanText) {
                                    if (t === taskEl) break;
                                    occurrenceIndex++;
                                }
                            }

                            // 팝업 없이 오늘 날짜 즉시 삽입 (Live Preview의 TodayEmojiWidget과 동일한 동작)
                            const todayStr = window.moment().format("YYYY-MM-DD");
                            this.enqueueFileWrite(clickFile.path, async () => {
                                const rawContent = await this.fileManager.getActiveViewOrFileText(clickFile);
                                const lines = rawContent.split("\n");
                                let modified = false;

                                let targetLineIndex = -1;
                                const dataLineNode = taskEl.dataset.line ? taskEl : taskEl.closest("[data-line]");
                                if (dataLineNode && (dataLineNode as HTMLElement).dataset.line) {
                                    const lineNum = parseInt((dataLineNode as HTMLElement).dataset.line!, 10);
                                    if (lineNum >= 0 && lineNum < lines.length && /^\s*(?:>\s*)*[-*+]\s+/.test(lines[lineNum])) {
                                        targetLineIndex = lineNum;
                                    }
                                }

                                if (targetLineIndex === -1) {
                                    let matchCount = 0;
                                    for (let i = 0; i < lines.length; i++) {
                                        if (/^\s*(?:>\s*)*[-*+]\s+\[.\]/.test(lines[i]) && !/\d{4}-\d{2}-\d{2}/.test(lines[i])) {
                                            let lineClean = lines[i].replace(/^\s*(?:>\s*)*[-*+]\s+\[.\]\s*/, "").replace(/\uD83D\uDCC5.*/, "").trim();
                                            if (lineClean === cleanText) {
                                                if (matchCount === occurrenceIndex) {
                                                    targetLineIndex = i;
                                                    break;
                                                }
                                                matchCount++;
                                            }
                                        }
                                    }
                                }

                                if (targetLineIndex !== -1) {
                                    const text = lines[targetLineIndex];
                                    const idMatch = text.match(/\s+\^[a-zA-Z0-9]+$/);
                                    if (idMatch) {
                                        lines[targetLineIndex] = text.substring(0, text.length - idMatch[0].length) + ` 📅 ${todayStr}` + idMatch[0];
                                    } else {
                                        lines[targetLineIndex] = text + ` 📅 ${todayStr}`;
                                    }
                                    modified = true;
                                }

                                if (modified) {
                                    await this.fileManager.saveIfChanged(clickFile, rawContent, lines.join("\n"));
                                    btn.remove();
                                }
                            });
                        });

                        const targetContainer = taskEl.querySelector(".list-item-content") || taskEl;
                        const childList = Array.from(targetContainer.children).find(c => c.tagName === "UL" || c.tagName === "OL");
                        
                        if (childList) {
                            targetContainer.insertBefore(btn, childList);
                        } else {
                            targetContainer.appendChild(btn);
                        }
                    }
                }
                } catch (e) {
                    console.warn("MyWorld 플러그인: 특정 Task 렌더링 실패 (스킵함)", e, taskEl);
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

        // 플러그인 로드 시(초기 1회) 스케줄 기준 전체 동기화 확인 팝업 (설정에서 켜진 경우에만)
        // active-leaf-change는 EventController에서 단일 관리
        this.app.workspace.onLayoutReady(() => {
            this.lastActiveFile = this.app.workspace.getActiveFile();
            if (!this.settings.syncOnStartup) {
                // console.log("Startup sync popup disabled in settings. Skipping.");
                return;
            }

            const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
            if (scheduleFile && scheduleFile instanceof TFile) {
                // 자동 실행 대신 사용자 확인 팝업을 띄움
                new StartupSyncModal(this.app, this.settings.language, async () => {
                    try {
                        // console.log("Running initial sync (user confirmed)...");
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
            name: t("cmd_sync_main", this.settings.language),
            callback: async () => {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    await this.synchronizer.syncDailyTasks(scheduleFile);
                } else {
                    new Notice(t("notice_no_schedule_path", this.settings.language, { path: this.settings.mainSchedulePath }));
                }
            }
        });

        // 명령어 B: 일간 루틴 리셋 및 회고 기록 (daily-task-reset)
        this.addCommand({
            id: "daily-task-reset",
            name: t("cmd_daily_reset", this.settings.language),
            callback: async () => {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    await this.resetManager.runDailyReset(scheduleFile);
                } else {
                    new Notice(t("notice_no_schedule_path", this.settings.language, { path: this.settings.mainSchedulePath }));
                }
            }
        });


        // 명령어 D: 월간 통계 수동 아카이빙 (monthly-stats-archive)
        this.addCommand({
            id: "monthly-stats-archive",
            name: t("cmd_monthly_stats", this.settings.language),
            callback: async () => {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    await this.resetManager.runManualArchive(scheduleFile);
                } else {
                    new Notice(t("notice_no_schedule_path", this.settings.language, { path: this.settings.mainSchedulePath }));
                }
            }
        });


        // 명령어 E: Todo 항목 관리 모달 (quick-capture)
        this.addCommand({
            id: "quick-capture",
            name: t("cmd_quick_capture", this.settings.language),
            callback: () => {
                void this.openTodoManagerModal();
            }
        });

        // 명령어 F: 현재 창 강제 수동 동기화 (새로고침)
        this.addCommand({
            id: "refresh-active-view",
            name: t("cmd_refresh_view", this.settings.language),
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    await this.triggerAutoSyncForFile(activeFile, true);
                    new Notice(t("notice_sync_project_complete", this.settings.language));
                } else {
                    new Notice(t("notice_no_active_sync", this.settings.language));
                }
            }
        });

        // 명령어 G: 임시 메모 파일 열기 및 생성 (open-memo)
        this.addCommand({
            id: "open-memo",
            name: t("cmd_quick_memo", this.settings.language),
            callback: async () => {
                await this.openOrCreateFleetingMemoFile();
            }
        });


        // 명령어 I: 오늘의 스케줄 관리 노트 생성 (create-today-schedule)
        this.addCommand({
            id: "create-today-schedule",
            name: t("cmd_create_schedule", this.settings.language),
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
            name: t("cmd_setup_para", this.settings.language),
            callback: async () => {
                try {
                    await this.templateHelper.setupParaStructure();
                    new Notice(t("notice_para_created2", this.settings.language));
                } catch (err) {
                    console.error(err instanceof Error ? err.message : String(err));
                    new Notice(t("notice_para_error2", this.settings.language));
                }
            }
        });

        // 명령어 K: 원클릭 제텔카스텐 폴더 구조 생성 (myworld-setup-zettelkasten)
        this.addCommand({
            id: "myworld-setup-zettelkasten",
            name: t("cmd_setup_zettel", this.settings.language),
            callback: async () => {
                try {
                    await this.templateHelper.setupZettelkastenStructure();
                    new Notice(t("notice_zettel_created2", this.settings.language));
                } catch (err) {
                    console.error(err instanceof Error ? err.message : String(err));
                    new Notice(t("notice_zettel_error2", this.settings.language));
                }
            }
        });
    }

    onunload() {
        this.taskQueue.clear();
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
                new Notice(t("notice_schedule_exists", this.settings.language));
                return existingFile;
            }

            // 템플릿 가져오기
            let templateText = this.settings.customTemplates.dailySchedule;
            if (!templateText) {
                const defaultPath = this.settings.language === 'en' 
                    ? `${this.settings.templatesDirectory}/01.Daily Schedule Template.md`
                    : `${this.settings.templatesDirectory}/01.데일리 스케줄 템플릿.md`;
                const defaultFile = this.app.vault.getAbstractFileByPath(defaultPath);
                if (defaultFile && defaultFile instanceof TFile) {
                    templateText = await this.app.vault.read(defaultFile);
                } else {
                    let checklistTable = "";
                    for (let i = 1; i <= 31; i++) {
                        checklistTable += `|  ${i.toString().padEnd(2, ' ')}  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
`;
                    }

                    if (this.settings.language === 'en') {
                        templateText = `---
Created: "2000-01-01T00:00"
Modified: "2000-01-01T00:00"
---

# Routine
>Step : Follow the plan. Sleep at 1:30.

> [!routine]
> Affirmation : Well begun is half done.
> ## ==Step==
> - [ ] Write
> - [ ] Execute
> ## ==Block==
> - [ ] 1
> - [ ] 2
> - [ ] 3
> - [ ] 4
> - [ ] 5
> - [ ] 6
> ## ==Mental==
> - [ ] Read affirmation
> - [ ] 10 min meditation
> ## ==Diet==
> - [ ] Breakfast
> - [ ] Lunch
> - [ ] Dinner
> ## ==Exercise==
> - [ ] Squat 60, Pushup 20
> ## ==Sleep==
> - [ ] Quiet time from 11
> ## ==Detox==
> - [ ] 1 time
> - [ ] 3 times
> - [ ] 5 times+
---

| Date  | Step | Block | Mental  | Diet  | Exercise  | Sleep  | Detox |
| :-: | :--: | :---: | :-: | :-: | :-: | :-: | :-: |
| {{currentDay}}  |      |      |      |      |      |      |      |
# Todo
#### Todo
- [ ] Task due today 📅 {{date}}
# Project
\`\`\`dataviewjs
dv.view("1. Project/01.List/스케줄렌더링");
\`\`\`

# Checklist

| Date  | Step | Block | Mental  | Diet  | Exercise  | Sleep  | Detox |
| :-: | :--: | :---: | :-: | :-: | :-: | :-: | :-: |
${checklistTable}
# Stats
> 📈 Routine aggregation and archive statistics are rendered per 10-day intervals.
`;
                    } else {
                        templateText = `---
작성일: "2000-01-01T00:00"
수정일: "2000-01-01T00:00"
---

# 루틴
>Step : 계획 따라 움직이기. 1:30 취침하기.

> [!routine]
> 확언 : 시작이 반 이다.
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
#### 할 일
- [ ] 오늘 마감인 작업 📅 {{date}}
# Project
\`\`\`dataviewjs
dv.view("1. Project/01.List/스케줄렌더링");
\`\`\`

# 체크리스트

| 날짜  | Step | Block | 멘탈  | 식단  | 운동  | 취침  | 디톡스 |
| :-: | :--: | :---: | :-: | :-: | :-: | :-: | :-: |
${checklistTable}
# 통계
> 📈 루틴 집계 및 아카이브 통계가 10일 구간별로 렌더링됩니다.
`;
                    }
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

            let content = this.templateHelper.replacePlaceholder(templateText, replacements);
            content = content.replace(/dv\.view\(['"]1\.\s*Project\/01\.List\/스케줄렌더링['"]\)/g, `dv.view("${folderPath}/scRender")`);
            content = content.replace(/dv\.view\(['"]\$\{this\.settings\.templatesDirectory\}\/02\.scRender['"]\)/g, `dv.view("${folderPath}/scRender")`);
            content = content.replace(/dv\.view\(['"]\$\{folderPath\}\/scRender['"]\)/g, `dv.view("${folderPath}/scRender")`);

            const newFile = await this.app.vault.create(schedulePath, content);

            const scRenderPath = `${folderPath}/scRender.js`;
            const existingScRender = this.app.vault.getAbstractFileByPath(scRenderPath);
            if (existingScRender instanceof TFile) {
                await this.app.vault.modify(existingScRender, this.templateHelper.scRenderJsContent);
            } else if (!existingScRender) {
                await this.app.vault.create(scRenderPath, this.templateHelper.scRenderJsContent);
            }

            new Notice(t("notice_schedule_created", this.settings.language));
            return newFile;
        } catch (err) {
            console.error(err instanceof Error ? err.message : String(err));
            new Notice(t("notice_schedule_error", this.settings.language));
            return null;
        }
    }

    // 3. Todo 항목 UI 관리 모달 호출 메서드
    async openTodoManagerModal(file?: TFile) {
        const scheduleFile = file || this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
        if (!scheduleFile || !(scheduleFile instanceof TFile)) {
            new Notice(t("notice_no_schedule_path", this.settings.language, { path: this.settings.mainSchedulePath }));
            return;
        }

        const original = await this.fileManager.getActiveViewOrFileText(scheduleFile);

        new TodoManagerModal(this.app, this.settings.language, scheduleFile, original, async (updatedItems: TodoItem[]) => {
            let text = this.utils.preprocessContent(original);

            const taskLines = updatedItems.map(item => {
                const check = item.completed ? "x" : " ";
                let line = `${item.rawIndent || ""}- [${check}] ${item.content}`;
                if (item.date) {
                    line += ` 📅 ${item.date}`;
                }
                if (item.blockId) {
                    line += ` ^${item.blockId}`;
                }
                return line;
            });

            const newTodoBlock = taskLines.join("\n");
            const todoHeader = "# Todo";
            const todoRange = this.utils.getSectionRange(text, todoHeader, 1);

            if (todoRange) {
                const startIdx = (todoRange as { start: number; end: number }).start;
                const endIdx = (todoRange as { start: number; end: number }).end;
                const beforeHeader = text.substring(0, startIdx);
                const afterHeader = text.substring(endIdx);
                text = beforeHeader + "# Todo\n" + newTodoBlock + "\n" + afterHeader;
            } else {
                text = text.trimEnd() + "\n\n# Todo\n" + newTodoBlock + "\n";
            }

            const todayObj = this.dateManager.getTodayStart();
            text = this.utils.processSectionLogic(text, "# Todo", todayObj, false, true);

            await this.fileManager.saveIfChanged(scheduleFile, original, text);
            new Notice(t("notice_task_added", this.settings.language));
        }).open();
    }

    // 4. 공용 프로젝트 노트 # 실행 섹션 태스크 빠른 추가 모달 메서드
    openAddExecutionTaskModal(projectFile: TFile): void {
        new QuickCaptureModal(this.app, this.settings.language, (content) => {
            void (async () => {
                try {
                    const original = await this.fileManager.getActiveViewOrFileText(projectFile);
                    let text = this.utils.preprocessContent(original);

                    // 식별자(^id) 자동 생성하여 메인 스케줄 노트 동기화 대비
                    const newId = this.utils.generateBlockId([projectFile]);
                    const newTaskLine = `- [ ] ${content} ^${newId}`;

                    // # 실행 또는 # Execution 섹션 범위 탐색
                    const execRange = this.utils.getSectionRange(text, "# 실행") || this.utils.getSectionRange(text, "# Execution");

                    if (execRange) {
                        const startIdx = (execRange as { start: number; end: number }).start;
                        const headerMatch = text.substring(startIdx).match(/^#+\s+(실행|Execution)/i);
                        const headerLen = headerMatch ? headerMatch[0].length : 4;

                        const before = text.substring(0, startIdx + headerLen);
                        const after = text.substring(startIdx + headerLen);

                        text = before + "\n" + newTaskLine + after;
                    } else {
                        // 섹션이 존재하지 않을 경우 파일 상단에 신규 생성
                        text = `# 실행\n${newTaskLine}\n\n` + text;
                    }

                    await this.fileManager.saveIfChanged(projectFile, original, text);
                    this.modifiedFiles.add(projectFile.path);
                    void this.triggerAutoSyncForFile(projectFile, true, true);
                    new Notice(`${t("notice_task_added", this.settings.language)}: "${content}"`);
                } catch (err) {
                    console.error(err instanceof Error ? err.message : String(err));
                    new Notice(t("notice_add_task_error", this.settings.language));
                }
            })();
        }, "modal_add_task_desc_project").open();
    }

    // 5. 스케줄 노트 헤더 전용 액션 처리 핸들러 (루틴->일간마감, Todo->UI 관리 모달, 통계->월간아카이브)
    handleScheduleHeaderAction(file: TFile, action: ScheduleHeaderActionType): void {
        switch (action) {
            case "todo-manager":
                void this.openTodoManagerModal(file);
                break;
            case "daily-reset":
                void this.resetManager.runDailyReset(file);
                break;
            case "monthly-archive":
                void this.resetManager.runManualArchive(file);
                break;
            case "routine-manager":
                void this.openRoutineManagerModal();
                break;
        }
    }

    async openRoutineManagerModal() {
        const schedulePath = this.settings.mainSchedulePath;
        const scheduleFile = this.app.vault.getAbstractFileByPath(schedulePath);
        let scheduleContent = "";
        if (scheduleFile && scheduleFile instanceof TFile) {
            scheduleContent = await this.app.vault.read(scheduleFile);
        }

        const currentStructure = scheduleContent
            ? RoutineSyncEngine.parseRoutineStructureFromMarkdown(scheduleContent, this.settings.language)
            : (this.settings.routineStructure || RoutineSyncEngine.getDefaultRoutineStructure(this.settings.language));

        new RoutineManagerModal(
            this.app,
            this.settings.language,
            currentStructure,
            async (newStructure, diff) => {
                this.settings.routineStructure = newStructure;
                await this.saveSettings();

                if (scheduleFile && scheduleFile instanceof TFile) {
                    const latestContent = await this.app.vault.read(scheduleFile);
                    const updatedScheduleContent = RoutineSyncEngine.syncRoutineToMarkdown(
                        latestContent,
                        newStructure,
                        diff,
                        this.settings.language
                    );
                    if (latestContent !== updatedScheduleContent) {
                        await this.fileManager.pluginWrite(scheduleFile, updatedScheduleContent);
                    }
                }

                // 3. 아카이브 폴더 내의 모든 주간/월간 아카이브 마크다운 문서 일괄 동기화 전파
                const archiveDir = this.settings.archiveDirectory;
                if (archiveDir) {
                    const allFiles = this.app.vault.getMarkdownFiles();
                    for (const file of allFiles) {
                        if (file.path.startsWith(archiveDir)) {
                            const archiveContent = await this.app.vault.read(file);
                            const updatedArchiveContent = RoutineSyncEngine.syncChecklistTableColumns(
                                archiveContent,
                                newStructure,
                                diff
                            );
                            if (archiveContent !== updatedArchiveContent) {
                                await this.fileManager.pluginWrite(file, updatedArchiveContent);
                            }
                        }
                    }
                }

                new Notice(this.settings.language === "ko" ? "✅ 루틴 양식 및 아카이브 문서가 동기화되었습니다." : "✅ Routine structure and archive notes safely synced.");
            }
        ).open();
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
