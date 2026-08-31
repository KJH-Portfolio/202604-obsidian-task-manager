import { App, Modal, TFile, Notice } from "obsidian";
import { TaskUtils, ProjectPlanItem } from "../TaskUtils";
import { t } from "../i18n";

export class ProjectPlanModal extends Modal {
    private file: TFile;
    private utils: TaskUtils;
    private language: string;
    private onSaveCallback: (items: ProjectPlanItem[]) => Promise<void>;
    private onCopyToExecCallback: (item: ProjectPlanItem) => Promise<void>;

    private items: ProjectPlanItem[] = [];
    private showHelp = false;

    constructor(
        app: App,
        file: TFile,
        utils: TaskUtils,
        language: string,
        onSave: (items: ProjectPlanItem[]) => Promise<void>,
        onCopyToExec: (item: ProjectPlanItem) => Promise<void>
    ) {
        super(app);
        this.file = file;
        this.utils = utils;
        this.language = language;
        this.onSaveCallback = onSave;
        this.onCopyToExecCallback = onCopyToExec;
    }

    async onOpen() {
        this.modalEl.addClass("myworld-todo-modal-window");
        this.contentEl.addClass("myworld-todo-modal-content-flex");

        // 파일에서 초기 계획 태스크 파싱
        const rawContent = await this.utils.fileManager.getActiveViewOrFileText(this.file);
        const parsed = this.utils.parseProjectPlan(rawContent);
        this.items = parsed.items;

        // 식별자 일관성 보장을 위해 blockId가 없는 항목에 미리 고유 ID 부여
        const allProjectFiles = this.utils.getProjectFiles();
        const filesForId = allProjectFiles.length > 0 ? allProjectFiles : [this.file];
        this.items.forEach(item => {
            if (!item.blockId) {
                const newId = this.utils.generateBlockId(filesForId);
                item.blockId = "^" + newId;
            }
        });

        this.render();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private setupDatePickerClick(dateInput: HTMLInputElement, onChange: (val: string) => void) {
        dateInput.addEventListener("change", (e) => {
            onChange((e.target as HTMLInputElement).value);
            this.render();
        });

        dateInput.addEventListener("click", () => {
            try {
                const inputWithPicker = dateInput as HTMLInputElement & { showPicker?: () => void };
                if (typeof inputWithPicker.showPicker === "function") {
                    inputWithPicker.showPicker();
                }
            } catch {
                // Ignore if showPicker fails
            }
        });
    }

    private getItemBorderColor(item: ProjectPlanItem): string {
        if (!item.date) return "var(--border-color, rgba(128, 128, 128, 0.2))";

        // @ts-ignore
        const today = window.moment ? window.moment().startOf("day") : null;
        // @ts-ignore
        const target = window.moment ? window.moment(item.date, "YYYY-MM-DD", true) : null;
        if (!today || !target || !target.isValid()) return "var(--border-color, rgba(128, 128, 128, 0.2))";

        const diff = target.diff(today, "days");
        if (diff < 0) return "#8c0028";
        if (diff === 0) return "#e93147";
        if (diff === 1) return "#ffd200";
        if (diff === 2) return "#44cf6e";
        if (diff === 3) return "#086ddd";
        return "#969696";
    }

    private changeIndent(index: number, direction: -1 | 1) {
        const item = this.items[index];
        if (!item) return;
        const newIndent = Math.max(0, Math.min(4, item.indentLevel + direction));
        item.indentLevel = newIndent;
        this.render(item.id);
    }

    private moveItem(index: number, direction: -1 | 1) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.items.length) return;
        const focusItem = this.items[index];
        const temp = this.items[index];
        this.items[index] = this.items[newIndex];
        this.items[newIndex] = temp;
        this.render(focusItem.id);
    }

    private async submitAndClose(): Promise<void> {
        await this.onSaveCallback(this.items);
        new Notice(t("notice_plan_saved", this.language));
        this.close();
    }

    private render(focusedItemId?: string) {
        const { contentEl } = this;
        contentEl.empty();

        const isKo = this.language === "ko";

        // 1. 헤더 영역
        const headerEl = contentEl.createDiv({ cls: "myworld-todo-modal-header-flex" });
        headerEl.createEl("h2", {
            text: `${t("plan_modal_title", this.language)} - ${this.file.basename}`,
            cls: "myworld-todo-modal-title-flex"
        });

        const helpBtn = headerEl.createEl("button", {
            text: "?",
            title: isKo ? "단축키 사용 설명서" : "Keyboard Shortcuts Help",
            cls: "myworld-todo-help-btn-flex"
        });

        helpBtn.addEventListener("click", () => {
            this.showHelp = !this.showHelp;
            this.render(focusedItemId);
        });

        // 2. 도움말 가이드 박스
        if (this.showHelp) {
            const helpBox = contentEl.createDiv({ cls: "myworld-todo-help-box" });
            helpBox.createDiv({ text: t("todo_modal_help_title", this.language), cls: "myworld-todo-help-title" });
            helpBox.createDiv({ text: t("todo_modal_help_enter", this.language) });
            helpBox.createDiv({ text: t("todo_modal_help_indent", this.language) });
            helpBox.createDiv({ text: t("todo_modal_help_move", this.language) });
            helpBox.createDiv({ text: isKo ? "• ⬆️ 버튼 : 해당 계획을 최상단 # 실행 구역으로 즉시 복제" : "• ⬆️ Button : Copy plan task directly to # Execution section" });
        }

        // 3. 📊 실시간 진행도 게이지 카드 (계층형 지분 분배 적용)
        const progressCard = contentEl.createDiv({ cls: "myworld-project-overview-card" });
        const { pct, doneCount: done, totalCount: total } = this.utils.calculateTreeProgress(this.items);

        const progressHeader = progressCard.createDiv({ cls: "myworld-plan-progress-header" });
        progressHeader.createSpan({ text: t("plan_progress_label", this.language), cls: "myworld-plan-progress-title" });
        progressHeader.createSpan({
            text: `${pct}% (${done}/${total} ${isKo ? "완료" : "Done"})`,
            cls: "myworld-plan-progress-percent"
        });

        const trackEl = progressCard.createDiv({ cls: "myworld-plan-progress-track" });
        const fillEl = trackEl.createDiv({ cls: "myworld-plan-progress-fill" });
        fillEl.setCssStyles({
            width: `${pct}%`
        });

        // 4. 상단 빠른 추가 입력 바
        const addSection = contentEl.createDiv({ cls: "myworld-todo-add-section" });
        const inputEl = addSection.createEl("input", {
            type: "text",
            placeholder: t("plan_add_placeholder", this.language),
            cls: "myworld-todo-add-input"
        });

        const dateInputEl = addSection.createEl("input", {
            type: "date",
            cls: "myworld-todo-add-date"
        });
        this.setupDatePickerClick(dateInputEl, () => {});

        const submitNewTask = () => {
            const textVal = inputEl.value.trim();
            if (!textVal) return;

            const newItem: ProjectPlanItem = {
                id: `plan-item-new-${Date.now()}`,
                content: textVal,
                completed: false,
                date: dateInputEl.value || undefined,
                indentLevel: 0
            };

            this.items.push(newItem);
            this.render("ADD_INPUT_FOCUS");
        };

        const addBtn = addSection.createEl("button", {
            text: isKo ? "추가" : "Add",
            cls: "mod-cta"
        });
        addBtn.addEventListener("click", submitNewTask);

        inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void this.submitAndClose();
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (!inputEl.value.trim()) {
                    void this.submitAndClose();
                } else {
                    submitNewTask();
                }
            }
        });

        // 5. 계획 태스크 목록 리스트 (단일 체크박스 UI)
        const listContainer = contentEl.createDiv({ cls: "myworld-todo-list-container-flex" });

        if (this.items.length === 0) {
            listContainer.createDiv({
                text: isKo ? "등록된 계획 태스크가 없습니다. 상단에서 추가하세요." : "No plan tasks yet.",
                cls: "myworld-todo-empty"
            });
        } else {
            this.items.forEach((item, idx) => {
                const isChild = item.indentLevel > 0;
                const row = listContainer.createDiv({
                    cls: `myworld-todo-item-row ${item.completed ? "is-completed" : ""} ${isChild ? "is-child-task" : ""}`
                });

                const borderColor = this.getItemBorderColor(item);
                row.setCssStyles({
                    marginLeft: `${item.indentLevel * 24}px`,
                    borderLeft: `5px solid ${borderColor}`
                });

                // 1) HTML 체크박스 딱 1개
                const checkbox = row.createEl("input", {
                    type: "checkbox",
                    cls: "myworld-todo-checkbox"
                });
                checkbox.checked = item.completed;
                checkbox.addEventListener("change", () => {
                    item.completed = checkbox.checked;
                    this.render(item.id);
                });

                // 2) 텍스트 입력창
                const textInput = row.createEl("input", {
                    type: "text",
                    value: item.content,
                    cls: "myworld-todo-input"
                });
                textInput.dataset.itemId = item.id;

                textInput.addEventListener("input", () => {
                    item.content = textInput.value;
                });

                textInput.addEventListener("keydown", (e: KeyboardEvent) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        void this.submitAndClose();
                    } else if (e.key === "Tab") {
                        e.preventDefault();
                        this.changeIndent(idx, e.shiftKey ? -1 : 1);
                    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                        e.preventDefault();
                        this.moveItem(idx, e.key === "ArrowUp" ? -1 : 1);
                    } else if (e.key === "Enter") {
                        e.preventDefault();
                        inputEl.focus();
                    }
                });

                // 3) 📅 날짜 입력 인풋
                const itemDateInput = row.createEl("input", {
                    type: "date",
                    value: item.date || "",
                    cls: "myworld-todo-item-date"
                });
                this.setupDatePickerClick(itemDateInput, (val) => {
                    item.date = val || undefined;
                });

                // 4) ⬆️ 실행 탭 복사 버튼
                const copyBtn = row.createEl("button", {
                    text: "⬆️",
                    title: isKo ? "실행 탭으로 복사" : "Copy to Execution tab",
                    cls: "myworld-todo-copy-exec-btn"
                });
                copyBtn.addEventListener("click", async () => {
                    await this.onCopyToExecCallback(item);
                    new Notice(t("notice_copy_to_exec", this.language));
                });

                // 5) 🗑️ 삭제 버튼
                const delBtn = row.createEl("button", {
                    text: "🗑️",
                    title: isKo ? "삭제" : "Delete",
                    cls: "myworld-todo-del-btn"
                });
                delBtn.addEventListener("click", () => {
                    this.items.splice(idx, 1);
                    this.render();
                });
            });
        }

        // 6. 푸터 영역
        const footerEl = contentEl.createDiv({ cls: "myworld-todo-modal-footer-flex" });

        const cancelBtn = footerEl.createEl("button", {
            text: isKo ? "취소" : "Cancel",
            cls: "mod-muted"
        });
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = footerEl.createEl("button", {
            text: t("plan_save_btn", this.language),
            cls: "mod-cta myworld-todo-save-btn-flex"
        });
        saveBtn.addEventListener("click", () => {
            void this.submitAndClose();
        });

        // 포커스 자동 복원
        if (focusedItemId && focusedItemId !== "ADD_INPUT_FOCUS") {
            window.setTimeout(() => {
                const targetInput = contentEl.querySelector<HTMLInputElement>(`input[data-item-id="${focusedItemId}"]`);
                if (targetInput) {
                    targetInput.focus();
                    const valLen = targetInput.value.length;
                    targetInput.setSelectionRange(valLen, valLen);
                }
            }, 30);
        } else {
            window.setTimeout(() => {
                inputEl.focus();
            }, 50);
        }
    }
}
