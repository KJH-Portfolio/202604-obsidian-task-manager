import { App, Modal, Notice, TFile } from "obsidian";
import MyWorldTaskManagerPlugin from "../main";

export interface TodoItem {
    id: string;
    text: string;
    completed: boolean;
    date: string | null; // YYYY-MM-DD format if exists
    blockId: string | null; // ^id if exists
    rawLine: string;
}

export class TodoManagerModal extends Modal {
    private plugin: MyWorldTaskManagerPlugin;
    private scheduleFile: TFile;
    private items: TodoItem[] = [];
    private newContentText: string = "";
    private newContentDate: string = "";
    private isKo: boolean;

    constructor(app: App, plugin: MyWorldTaskManagerPlugin, scheduleFile: TFile) {
        super(app);
        this.plugin = plugin;
        this.scheduleFile = scheduleFile;
        this.isKo = plugin.settings.language === "ko";
        this.newContentDate = window.moment().format("YYYY-MM-DD");
    }

    async onOpen() {
        this.modalEl.addClass("myworld-todo-modal");
        await this.loadTasks();
        this.render();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async loadTasks() {
        try {
            const fileText = await this.app.vault.read(this.scheduleFile);
            const todoHeader = "# Todo";
            const todoRange = this.plugin.utils.getSectionRange(fileText, todoHeader, 1);

            this.items = [];
            if (!todoRange) return;

            const startIdx = (todoRange as { start: number; end: number }).start;
            const endIdx = (todoRange as { start: number; end: number }).end;
            const sectionText = fileText.substring(startIdx, endIdx);
            const lines = sectionText.split("\n");

            lines.forEach((line, index) => {
                const trimmed = line.trim();
                const taskMatch = trimmed.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
                if (taskMatch) {
                    const completed = taskMatch[1].toLowerCase() === "x";
                    let bodyText = taskMatch[2].trim();

                    // Extract block ID (^id) if present
                    let blockId: string | null = null;
                    const blockIdMatch = bodyText.match(/\s+\^([a-zA-Z0-9]+)$/);
                    if (blockIdMatch) {
                        blockId = blockIdMatch[1];
                        bodyText = bodyText.substring(0, bodyText.length - blockIdMatch[0].length).trim();
                    }

                    // Extract date (📅 YYYY-MM-DD) if present
                    let date: string | null = null;
                    const dateMatch = bodyText.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) {
                        date = dateMatch[1];
                    }

                    this.items.push({
                        id: `task_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
                        text: bodyText,
                        completed,
                        date,
                        blockId,
                        rawLine: line
                    });
                }
            });
        } catch (err) {
            console.error("Error loading tasks for TodoManagerModal:", err);
        }
    }

    private render() {
        const { contentEl } = this;
        contentEl.empty();

        // 1. 헤더 (타이틀)
        const headerDiv = contentEl.createDiv({ cls: "todo-modal-header" });
        headerDiv.createEl("h2", { text: this.isKo ? "⚙️ Todo 관리" : "⚙️ Todo Manager" });
        headerDiv.createEl("p", {
            text: this.isKo
                ? "할 일을 직관적으로 등록하고 정리합니다. 저장 시 스케줄 노트에 자동 반영됩니다."
                : "Manage your tasks easily. Changes will be saved directly to your schedule.",
            cls: "setting-item-description"
        });

        // 2. [최상단] 새 할 일 추가 구역
        const addSection = contentEl.createDiv({ cls: "todo-add-container" });
        addSection.createEl("h4", { text: this.isKo ? "➕ 새 할 일 추가" : "➕ Add New Task", cls: "todo-section-title" });

        const addRow = addSection.createDiv({ cls: "todo-add-row" });

        // 입력 창 (자동 포커스 대상)
        const inputEl = addRow.createEl("input", {
            type: "text",
            placeholder: this.isKo ? "새로 할 일을 입력하세요..." : "Enter a new task...",
            cls: "todo-add-input"
        });
        inputEl.value = this.newContentText;
        inputEl.addEventListener("input", (e) => {
            this.newContentText = (e.target as HTMLInputElement).value;
        });

        // 날짜 선택 피커 (기본 오늘 날짜)
        const dateInput = addRow.createEl("input", {
            type: "date",
            cls: "todo-add-date"
        });
        dateInput.value = this.newContentDate;
        dateInput.addEventListener("change", (e) => {
            this.newContentDate = (e.target as HTMLInputElement).value;
        });

        const submitBtn = addRow.createEl("button", {
            text: this.isKo ? "추가" : "Add",
            cls: "mod-cta todo-add-btn"
        });

        const handleAddTask = () => {
            if (!this.newContentText.trim()) {
                new Notice(this.isKo ? "할 일 내용을 입력해주세요." : "Please enter task content.");
                return;
            }

            const newTask: TodoItem = {
                id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                text: this.newContentText.trim(),
                completed: false,
                date: this.newContentDate ? this.newContentDate : null,
                blockId: null,
                rawLine: ""
            };

            this.items.push(newTask);
            this.newContentText = "";
            this.render();
        };

        submitBtn.addEventListener("click", handleAddTask);
        inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleAddTask();
            }
        });

        // 자동 포커싱
        window.setTimeout(() => inputEl.focus(), 50);

        // 3. 할 일 목록 리스트 컨테이너
        const listContainer = contentEl.createDiv({ cls: "todo-list-container" });

        const todayStr = window.moment().format("YYYY-MM-DD");

        // 항목 분류
        const todayTasks = this.items.filter(item => !item.completed && item.date === todayStr);
        const upcomingAndNoDateTasks = this.items.filter(item => !item.completed && item.date !== todayStr);

        // [예정 할 일 / 기타] 내부 정렬: 미래 날짜 마감 항목(오름차순) -> 날짜 없는 항목 가장 뒤
        upcomingAndNoDateTasks.sort((a, b) => {
            if (a.date && b.date) {
                return a.date.localeCompare(b.date);
            }
            if (a.date && !b.date) return -1; // 날짜 있는 항목 우선
            if (!a.date && b.date) return 1;  // 날짜 없는 항목 뒤로
            return 0;
        });

        const completedTasks = this.items.filter(item => item.completed);

        // --- 구역 1: [ 오늘 할 일 ] ---
        const todaySection = listContainer.createDiv({ cls: "todo-group-section" });
        todaySection.createEl("h4", { text: this.isKo ? "📌 오늘 할 일" : "📌 Today Tasks", cls: "todo-group-title" });
        if (todayTasks.length === 0) {
            todaySection.createDiv({ text: this.isKo ? "오늘 등록된 할 일이 없습니다." : "No tasks for today.", cls: "todo-empty-text" });
        } else {
            todayTasks.forEach(task => this.renderTaskRow(todaySection, task));
        }

        // 구분선 (점선)
        listContainer.createDiv({ cls: "todo-dotted-divider" });

        // --- 구역 2: [ 예정 할 일 / 기타 ] ---
        const upcomingSection = listContainer.createDiv({ cls: "todo-group-section" });
        upcomingSection.createEl("h4", { text: this.isKo ? "📅 예정 할 일 / 기타" : "📅 Upcoming & General Tasks", cls: "todo-group-title" });
        if (upcomingAndNoDateTasks.length === 0) {
            upcomingSection.createDiv({ text: this.isKo ? "예정되거나 일반 할 일이 없습니다." : "No upcoming or general tasks.", cls: "todo-empty-text" });
        } else {
            upcomingAndNoDateTasks.forEach(task => this.renderTaskRow(upcomingSection, task));
        }

        // 구분선 (점선)
        listContainer.createDiv({ cls: "todo-dotted-divider" });

        // --- 구역 3: [ 완료된 항목 ] ---
        const completedSection = listContainer.createDiv({ cls: "todo-group-section" });
        completedSection.createEl("h4", { text: this.isKo ? "✅ 완료된 항목" : "✅ Completed Tasks", cls: "todo-group-title" });
        if (completedTasks.length === 0) {
            completedSection.createDiv({ text: this.isKo ? "완료된 항목이 없습니다." : "No completed tasks.", cls: "todo-empty-text" });
        } else {
            completedTasks.forEach(task => this.renderTaskRow(completedSection, task));
        }

        // 4. 하단 저장 / 취소 버튼
        const footerEl = contentEl.createDiv({ cls: "todo-modal-footer" });

        const cancelBtn = footerEl.createEl("button", { text: this.isKo ? "취소" : "Cancel" });
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = footerEl.createEl("button", {
            text: this.isKo ? "💾 저장 & 동기화" : "💾 Save & Sync",
            cls: "mod-cta"
        });

        saveBtn.addEventListener("click", () => {
            void this.saveChanges().then(() => this.close());
        });
    }

    private renderTaskRow(container: HTMLElement, task: TodoItem) {
        const row = container.createDiv({ cls: `todo-item-row ${task.completed ? "is-completed" : ""}` });

        // 체크박스
        const checkbox = row.createEl("input", { type: "checkbox", cls: "todo-item-checkbox" });
        checkbox.checked = task.completed;
        checkbox.addEventListener("change", (e) => {
            task.completed = (e.target as HTMLInputElement).checked;
            this.render();
        });

        // 할 일 텍스트 input
        const textInput = row.createEl("input", {
            type: "text",
            value: task.text,
            cls: "todo-item-text"
        });
        textInput.addEventListener("input", (e) => {
            task.text = (e.target as HTMLInputElement).value;
        });

        // 날짜 표시/변경 input
        const dateInput = row.createEl("input", {
            type: "date",
            cls: "todo-item-date"
        });
        dateInput.value = task.date || "";
        dateInput.addEventListener("change", (e) => {
            const val = (e.target as HTMLInputElement).value;
            task.date = val ? val : null;
            this.render();
        });

        // 삭제 버튼
        const delBtn = row.createEl("button", {
            text: "✕",
            title: this.isKo ? "삭제" : "Delete",
            cls: "todo-item-del-btn"
        });
        delBtn.addEventListener("click", () => {
            this.items = this.items.filter(item => item.id !== task.id);
            this.render();
        });
    }

    private async saveChanges() {
        try {
            const originalText = await this.app.vault.read(this.scheduleFile);
            let content = this.plugin.utils.preprocessContent(originalText);

            const todoHeader = "# Todo";
            const todoRange = this.plugin.utils.getSectionRange(content, todoHeader, 1);

            // Reconstruct the tasks in markdown format
            const newTasksLines: string[] = [];
            this.items.forEach(item => {
                if (!item.text.trim()) return;
                const checkStr = item.completed ? "[x]" : "[ ]";
                let lineStr = `- ${checkStr} ${item.text.trim()}`;
                if (item.date) {
                    lineStr += ` 📅 ${item.date}`;
                }
                if (item.blockId) {
                    lineStr += ` ^${item.blockId}`;
                }
                newTasksLines.push(lineStr);
            });

            const newTodoSectionStr = `${todoHeader}\n${newTasksLines.join("\n")}\n`;

            if (todoRange) {
                const startIdx = (todoRange as { start: number; end: number }).start;
                const endIdx = (todoRange as { start: number; end: number }).end;
                const before = content.substring(0, startIdx);
                const after = content.substring(endIdx);
                content = before + newTodoSectionStr + after;
            } else {
                content = content.trimEnd() + "\n\n" + newTodoSectionStr;
            }

            // Apply section sorting logic
            const todayObj = this.plugin.dateManager.getTodayStart();
            content = this.plugin.utils.processSectionLogic(content, "# Todo", todayObj, false, true);

            await this.plugin.fileManager.saveIfChanged(this.scheduleFile, originalText, content);
            new Notice(this.isKo ? "✅ Todo 항목이 저장되었습니다." : "✅ Tasks saved successfully.");
        } catch (err) {
            console.error("Error saving tasks in TodoManagerModal:", err);
            new Notice(this.isKo ? "🚨 저장 도중 오류가 발생했습니다." : "🚨 Error occurred while saving tasks.");
        }
    }
}
