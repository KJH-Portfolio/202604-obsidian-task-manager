import { App, Modal, TFile } from "obsidian";
import { t } from "../i18n";

export interface TodoItem {
    id: string;
    content: string;
    completed: boolean;
    date?: string; // YYYY-MM-DD
    blockId?: string; // ^id
    rawIndent: string;
    indentLevel: number;
}

export class TodoManagerModal extends Modal {
    private file: TFile;
    private language: string;
    private items: TodoItem[] = [];
    private showHelp: boolean = false;
    private onSaveCallback: (updatedItems: TodoItem[]) => Promise<void>;

    constructor(
        app: App,
        language: string,
        file: TFile,
        initialContent: string,
        onSaveCallback: (updatedItems: TodoItem[]) => Promise<void>
    ) {
        super(app);
        this.language = language;
        this.file = file;
        this.onSaveCallback = onSaveCallback;
        this.parseContent(initialContent);
    }

    private parseContent(content: string) {
        const todoMatch = content.match(/# Todo([\s\S]*?)(?=\n#|$)/);
        if (!todoMatch) return;

        const todoLines = todoMatch[1].split("\n");
        const parsedItems: TodoItem[] = [];

        todoLines.forEach((line, idx) => {
            const taskMatch = line.match(/^(\s*)-\s*\[([ xX\-/])\]\s*(.*)$/);
            if (taskMatch) {
                const rawIndent = taskMatch[1] || "";
                const tabs = (rawIndent.match(/\t/g) || []).length;
                const spaces = rawIndent.replace(/\t/g, "").length;
                const indentLevel = tabs > 0 ? tabs : (spaces >= 4 ? Math.floor(spaces / 4) : Math.floor(spaces / 2));
                const completed = taskMatch[2] === "x" || taskMatch[2] === "X";
                let rest = taskMatch[3];

                let blockId: string | undefined;
                const blockIdMatch = rest.match(/\^([a-zA-Z0-9]+)$/);
                if (blockIdMatch) {
                    blockId = "^" + blockIdMatch[1];
                    rest = rest.replace(/\^([a-zA-Z0-9]+)$/, "").trim();
                }

                let date: string | undefined;
                const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                    date = dateMatch[1];
                    rest = rest.replace(/📅\s*\d{4}-\d{2}-\d{2}/, "").trim();
                }

                parsedItems.push({
                    id: `item-${idx}-${Date.now()}`,
                    content: rest.trim(),
                    completed,
                    date,
                    blockId,
                    rawIndent,
                    indentLevel
                });
            }
        });

        this.items = parsedItems;
    }

    onOpen() {
        this.modalEl.addClass("myworld-todo-modal-window");
        this.contentEl.addClass("myworld-todo-modal-content-flex");

        this.render();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private getEffectiveDate(index: number): string | undefined {
        const item = this.items[index];
        if (!item) return undefined;
        if (item.date) return item.date;

        let currentIndent = item.indentLevel;
        for (let i = index - 1; i >= 0; i--) {
            const parentCandidate = this.items[i];
            if (parentCandidate.indentLevel < currentIndent) {
                if (parentCandidate.date) {
                    return parentCandidate.date;
                }
                currentIndent = parentCandidate.indentLevel;
                if (currentIndent === 0) break;
            }
        }
        return undefined;
    }

    private getItemBorderColor(index: number): string {
        const effectiveDate = this.getEffectiveDate(index);
        if (!effectiveDate) return "var(--border-color, rgba(128, 128, 128, 0.2))";

        // @ts-ignore
        const today = window.moment ? window.moment().startOf('day') : null;
        // @ts-ignore
        const target = window.moment ? window.moment(effectiveDate, "YYYY-MM-DD", true) : null;
        if (!today || !target || !target.isValid()) return "var(--border-color, rgba(128, 128, 128, 0.2))";

        const diff = target.diff(today, 'days');
        if (diff < 0) return "#8c0028";
        if (diff === 0) return "#e93147";
        if (diff === 1) return "#ffd200";
        if (diff === 2) return "#44cf6e";
        if (diff === 3) return "#086ddd";
        return "#969696";
    }

    private moveItem(index: number, direction: -1 | 1) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.items.length) return;
        const item = this.items[index];
        const temp = this.items[index];
        this.items[index] = this.items[newIndex];
        this.items[newIndex] = temp;
        this.render(item.id);
    }

    private changeIndent(index: number, direction: -1 | 1) {
        const item = this.items[index];
        if (!item) return;
        const newIndent = Math.max(0, Math.min(4, item.indentLevel + direction));
        item.indentLevel = newIndent;
        item.rawIndent = "\t".repeat(newIndent);
        this.render(item.id);
    }

    private render(focusedItemId?: string) {
        const { contentEl } = this;
        contentEl.empty();

        const isKo = this.language === "ko";
        // @ts-ignore
        const todayStr = window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().split("T")[0];

        // 1. 헤더 영역
        const headerEl = contentEl.createDiv({ cls: "myworld-todo-modal-header-flex" });

        headerEl.createEl("h2", { text: t("todo_modal_title", this.language), cls: "myworld-todo-modal-title-flex" });

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
            helpBox.createDiv({ text: t("todo_modal_help_move", this.language) });
            helpBox.createDiv({ text: t("todo_modal_help_indent", this.language) });
            helpBox.createDiv({ text: t("todo_modal_help_enter", this.language) });
            helpBox.createDiv({ text: t("todo_modal_help_date", this.language) });
        }

        // 3. 상단 빠른 추가 입력 바
        const addSection = contentEl.createDiv({ cls: "myworld-todo-add-section" });
        const inputEl = addSection.createEl("input", {
            type: "text",
            placeholder: t("todo_modal_input_placeholder", this.language),
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

            const newItem: TodoItem = {
                id: `item-new-${Date.now()}`,
                content: textVal,
                completed: false,
                date: dateInputEl.value || undefined,
                rawIndent: "",
                indentLevel: 0
            };

            this.items.push(newItem);
            this.render(newItem.id);
        };

        const addBtn = addSection.createEl("button", {
            text: isKo ? "추가" : "Add",
            cls: "mod-cta"
        });
        addBtn.addEventListener("click", submitNewTask);

        inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                submitNewTask();
            }
        });

        // 4. 메인 목록 영역
        const listContainer = contentEl.createDiv({ cls: "myworld-todo-list-container-flex" });

        const todayGroups: { dateKey: string; items: TodoItem[] }[] = [];
        const upcomingGroups: { dateKey: string; items: TodoItem[] }[] = [];

        this.items.forEach((item, idx) => {
            const effDate = this.getEffectiveDate(idx);
            if (effDate === todayStr || !effDate) {
                todayGroups.push({ dateKey: effDate || "no-date", items: [item] });
            } else {
                upcomingGroups.push({ dateKey: effDate, items: [item] });
            }
        });

        const todaySection = listContainer.createDiv({ cls: "myworld-todo-group" });
        todaySection.createEl("h3", { text: isKo ? "📌 오늘 할 일" : "📌 Today's Tasks", cls: "myworld-todo-group-title" });

        const renderGroupItems = (parentContainer: HTMLElement, groupItems: TodoItem[]) => {
            const uncompleted = groupItems.filter(i => !i.completed);
            const completed = groupItems.filter(i => i.completed);

            uncompleted.forEach(item => {
                const idx = this.items.findIndex(i => i.id === item.id);
                this.renderTaskRow(parentContainer, item, idx, isKo);
            });

            if (completed.length > 0) {
                if (uncompleted.length > 0) {
                    parentContainer.createDiv({ cls: "myworld-todo-sub-divider" });
                }
                completed.forEach(item => {
                    const idx = this.items.findIndex(i => i.id === item.id);
                    this.renderTaskRow(parentContainer, item, idx, isKo);
                });
            }
        };

        if (todayGroups.length === 0) {
            todaySection.createDiv({ text: isKo ? "오늘 할 일이 없습니다." : "No tasks for today.", cls: "myworld-todo-empty" });
        } else {
            todayGroups.forEach(g => renderGroupItems(todaySection, g.items));
        }

        listContainer.createDiv({ cls: "myworld-todo-divider" });

        const upcomingSection = listContainer.createDiv({ cls: "myworld-todo-group" });
        upcomingSection.createEl("h3", { text: isKo ? "📅 예정 할 일 / 기타" : "📅 Upcoming & Other Tasks", cls: "myworld-todo-group-title" });

        if (upcomingGroups.length === 0) {
            upcomingSection.createDiv({ text: isKo ? "예정되거나 기타 지정된 할 일이 없습니다." : "No upcoming or other tasks.", cls: "myworld-todo-empty" });
        } else {
            upcomingGroups.forEach(g => renderGroupItems(upcomingSection, g.items));
        }

        // 5. 푸터 영역
        const footerEl = contentEl.createDiv({ cls: "myworld-todo-modal-footer-flex" });

        const saveBtn = footerEl.createEl("button", {
            text: isKo ? "💾 저장 및 동기화" : "💾 Save & Sync",
            cls: "mod-cta myworld-todo-save-btn-flex"
        });

        saveBtn.addEventListener("click", () => {
            void this.onSaveCallback(this.items).then(() => {
                this.close();
            });
        });

        if (focusedItemId) {
            window.setTimeout(() => {
                const targetInput = contentEl.querySelector<HTMLInputElement>(`input[data-item-id="${focusedItemId}"]`);
                if (targetInput) {
                    targetInput.focus();
                    const valLen = targetInput.value.length;
                    targetInput.setSelectionRange(valLen, valLen);
                }
            }, 30);
        } else {
            window.setTimeout(() => inputEl.focus(), 50);
        }
    }

    private setupDatePickerClick(dateInput: HTMLInputElement, onChange: (val: string) => void) {
        dateInput.addEventListener("change", (e) => {
            onChange((e.target as HTMLInputElement).value);
        });

        dateInput.addEventListener("mousedown", (e) => {
            if (!dateInput.value) {
                e.preventDefault();
            }
        });

        dateInput.addEventListener("click", (e) => {
            if (!dateInput.value) {
                e.preventDefault();
                e.stopPropagation();
                const todayStr = window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().split("T")[0];
                dateInput.value = todayStr;
                onChange(todayStr);
            } else {
                try {
                    const inputWithPicker = dateInput as HTMLInputElement & { showPicker?: () => void };
                    if (typeof inputWithPicker.showPicker === "function") {
                        inputWithPicker.showPicker();
                    }
                } catch {
                    // Ignore if showPicker fails
                }
            }
        });
    }

    private renderTaskRow(container: HTMLElement, item: TodoItem, idx: number, isKo: boolean) {
        const isChild = item.indentLevel > 0;
        const row = container.createDiv({
            cls: `myworld-todo-item-row ${item.completed ? "is-completed" : ""} ${isChild ? "is-child-task" : ""}`
        });

        const borderColor = this.getItemBorderColor(idx);
        row.setCssStyles({
            marginLeft: `${item.indentLevel * 24}px`,
            borderLeft: `5px solid ${borderColor}`
        });

        const checkbox = row.createEl("input", {
            type: "checkbox",
            cls: "myworld-todo-checkbox"
        });
        checkbox.checked = item.completed;
        checkbox.addEventListener("change", () => {
            item.completed = checkbox.checked;
            this.render(item.id);
        });

        const textInput = row.createEl("input", {
            type: "text",
            value: item.content,
            cls: "myworld-todo-text-input"
        });
        textInput.dataset.itemId = item.id;

        textInput.addEventListener("input", () => {
            item.content = textInput.value;
        });

        textInput.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                e.preventDefault();
                this.moveItem(idx, e.key === "ArrowUp" ? -1 : 1);
            } else if ((e.altKey && e.key === "ArrowRight") || (e.key === "Tab" && !e.shiftKey)) {
                e.preventDefault();
                this.changeIndent(idx, 1);
            } else if ((e.altKey && e.key === "ArrowLeft") || (e.key === "Tab" && e.shiftKey)) {
                e.preventDefault();
                this.changeIndent(idx, -1);
            }
        });

        const dateInput = row.createEl("input", {
            type: "date",
            value: item.date || "",
            cls: "myworld-todo-item-date"
        });

        this.setupDatePickerClick(dateInput, (val) => {
            item.date = val || undefined;
            this.render(item.id);
        });

        const deleteBtn = row.createEl("button", {
            text: "🗑️",
            title: isKo ? "삭제" : "Delete",
            cls: "myworld-todo-del-btn"
        });

        deleteBtn.addEventListener("click", () => {
            this.items.splice(idx, 1);
            this.render();
        });
    }
}
