import { App, Modal, Setting, TFile, Notice } from "obsidian";
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
    private onSaveCallback: (updatedItems: TodoItem[]) => Promise<void>;

    constructor(
        app: App,
        language: string,
        file: TFile,
        initialContent: string,
        onSave: (updatedItems: TodoItem[]) => Promise<void>
    ) {
        super(app);
        this.language = language;
        this.file = file;
        this.onSaveCallback = onSave;
        this.parseItems(initialContent);
    }

    private parseItems(content: string): void {
        const lines = content.split("\n");
        let inTodoSection = false;
        let todoLevel = 1;

        for (const line of lines) {
            const trimmed = line.trim();

            // # Todo 헤더 탐색
            if (/^#+\s+Todo$/i.test(trimmed)) {
                inTodoSection = true;
                const match = trimmed.match(/^(#+)/);
                todoLevel = match ? match[1].length : 1;
                continue;
            }

            if (inTodoSection) {
                // 상위/동일 레벨 헤더를 만나면 Todo 섹션 종료 (단, 서브헤더는 계속 진행)
                if (/^#+\s+/.test(trimmed)) {
                    const match = trimmed.match(/^(#+)/);
                    const level = match ? match[1].length : 1;
                    if (level <= todoLevel) {
                        inTodoSection = false;
                        break;
                    }
                }

                // 체크리스트 항목 인지
                const taskMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
                if (taskMatch) {
                    const rawIndent = taskMatch[1] || "";
                    // tab은 공백 4개 취급하여 indentLevel 계산
                    const spaceCount = rawIndent.replace(/\t/g, "    ").length;
                    const indentLevel = Math.floor(spaceCount / 2);

                    const completed = taskMatch[2].toLowerCase() === "x";
                    let rest = taskMatch[3].trim();

                    // blockId extraction (^id)
                    let blockId: string | undefined;
                    const idMatch = rest.match(/\s+\^([a-zA-Z0-9-]+)$/);
                    if (idMatch) {
                        blockId = idMatch[1];
                        rest = rest.substring(0, rest.length - idMatch[0].length).trim();
                    }

                    // date extraction (📅 YYYY-MM-DD)
                    let date: string | undefined;
                    const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) {
                        date = dateMatch[1];
                        rest = rest.replace(/📅\s*\d{4}-\d{2}-\d{2}/, "").trim();
                    }

                    this.items.push({
                        id: "item_" + Math.random().toString(36).substring(2, 9),
                        content: rest,
                        completed,
                        date,
                        blockId,
                        rawIndent,
                        indentLevel
                    });
                }
            }
        }
    }

    onOpen() {
        this.modalEl.addClass("myworld-todo-modal");
        this.render();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private render() {
        const { contentEl } = this;
        contentEl.empty();

        const isKo = this.language === "ko";
        const todayStr = window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().split("T")[0];

        // 1. 모달 타이틀
        contentEl.createEl("h2", { text: isKo ? "⚙️ Todo 항목 관리" : "⚙️ Todo Manager" });

        // 2. [최상단] 새 할 일 추가 영역
        const addSection = contentEl.createDiv({ cls: "myworld-todo-add-section" });

        const inputEl = addSection.createEl("input", {
            type: "text",
            placeholder: isKo ? "새 할 일을 입력하세요... (Enter 키로 추가)" : "Add a new task... (Press Enter)",
            cls: "myworld-todo-add-input"
        });

        let newDate = todayStr;
        const dateEl = addSection.createEl("input", {
            type: "date",
            cls: "myworld-todo-add-date myworld-date-picker-clickable"
        });
        dateEl.value = newDate;
        
        // 박스 전체 클릭 시 달력 팝업 오픈
        this.setupDatePickerClick(dateEl, (val) => {
            newDate = val;
        });

        const addBtn = addSection.createEl("button", {
            text: isKo ? "+ 추가" : "+ Add",
            cls: "mod-cta myworld-todo-add-btn"
        });

        const submitNewTask = () => {
            const trimmed = inputEl.value.trim();
            if (!trimmed) {
                new Notice(isKo ? "할 일 내용을 입력해주세요." : "Please enter task content.");
                return;
            }

            this.items.push({
                id: "item_" + Math.random().toString(36).substring(2, 9),
                content: trimmed,
                completed: false,
                date: newDate || todayStr,
                rawIndent: "",
                indentLevel: 0
            });

            inputEl.value = "";
            this.render();
        };

        addBtn.addEventListener("click", submitNewTask);
        inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                submitNewTask();
            }
        });

        // 3. 그룹별 아이템 분리 및 정렬
        // [오늘 할 일 그룹]
        const todayUncompleted = this.items.filter(i => !i.completed && i.date === todayStr);
        const todayCompleted = this.items.filter(i => i.completed && i.date === todayStr);

        // [예정 할 일 / 기타 그룹]
        // 1) 미완료: 미래 마감일 태스크(날짜 오름차순) -> 날짜 없는 태스크
        const upcomingUncompletedWithDate = this.items.filter(i => !i.completed && i.date && i.date !== todayStr);
        upcomingUncompletedWithDate.sort((a, b) => (a.date! > b.date! ? 1 : -1));
        const upcomingUncompletedNoDate = this.items.filter(i => !i.completed && !i.date);

        // 2) 완료: 미래 마감일 완료 태스크 -> 날짜 없는 완료 태스크
        const upcomingCompletedWithDate = this.items.filter(i => i.completed && i.date && i.date !== todayStr);
        upcomingCompletedWithDate.sort((a, b) => (a.date! > b.date! ? 1 : -1));
        const upcomingCompletedNoDate = this.items.filter(i => i.completed && !i.date);

        const listContainer = contentEl.createDiv({ cls: "myworld-todo-list-container" });

        // --- 섹션 1: [ 오늘 할 일 ] ---
        const todaySection = listContainer.createDiv({ cls: "myworld-todo-group" });
        todaySection.createEl("h3", { text: isKo ? "📌 오늘 할 일" : "📌 Today's Tasks", cls: "myworld-todo-group-title" });
        
        if (todayUncompleted.length === 0 && todayCompleted.length === 0) {
            todaySection.createDiv({ text: isKo ? "오늘 할 일이 없습니다." : "No tasks for today.", cls: "myworld-todo-empty" });
        } else {
            // 오늘 미완료 항목들
            todayUncompleted.forEach(item => this.renderTaskRow(todaySection, item, isKo));
            // 오늘 완료된 항목들 (섹션 최하단)
            if (todayCompleted.length > 0) {
                if (todayUncompleted.length > 0) {
                    todaySection.createDiv({ cls: "myworld-todo-sub-divider" });
                }
                todayCompleted.forEach(item => this.renderTaskRow(todaySection, item, isKo));
            }
        }

        // 구분선 1 (점선)
        listContainer.createDiv({ cls: "myworld-todo-divider" });

        // --- 섹션 2: [ 예정 할 일 / 기타 ] ---
        const upcomingSection = listContainer.createDiv({ cls: "myworld-todo-group" });
        upcomingSection.createEl("h3", { text: isKo ? "📅 예정 할 일 / 기타" : "📅 Upcoming & Other Tasks", cls: "myworld-todo-group-title" });
        
        const totalUpcomingUncompleted = [...upcomingUncompletedWithDate, ...upcomingUncompletedNoDate];
        const totalUpcomingCompleted = [...upcomingCompletedWithDate, ...upcomingCompletedNoDate];

        if (totalUpcomingUncompleted.length === 0 && totalUpcomingCompleted.length === 0) {
            upcomingSection.createDiv({ text: isKo ? "예정되거나 기타 지정된 할 일이 없습니다." : "No upcoming or other tasks.", cls: "myworld-todo-empty" });
        } else {
            // 예정/기타 미완료 항목들 (미래 날짜 오름차순 -> 날짜 없음)
            totalUpcomingUncompleted.forEach(item => this.renderTaskRow(upcomingSection, item, isKo));
            // 예정/기타 완료된 항목들 (섹션 최하단)
            if (totalUpcomingCompleted.length > 0) {
                if (totalUpcomingUncompleted.length > 0) {
                    upcomingSection.createDiv({ cls: "myworld-todo-sub-divider" });
                }
                totalUpcomingCompleted.forEach(item => this.renderTaskRow(upcomingSection, item, isKo));
            }
        }

        // 4. 하단 버튼 영역
        const footerEl = contentEl.createDiv({ cls: "myworld-todo-modal-footer" });

        const cancelBtn = footerEl.createEl("button", { text: isKo ? "취소" : "Cancel" });
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = footerEl.createEl("button", {
            text: isKo ? "💾 저장 및 동기화" : "💾 Save & Sync",
            cls: "mod-cta"
        });
        saveBtn.addEventListener("click", () => {
            void this.onSaveCallback(this.items).then(() => {
                this.close();
            });
        });

        // 자동 포커스 (상단 입력 창)
        window.setTimeout(() => inputEl.focus(), 50);
    }

    private setupDatePickerClick(dateInput: HTMLInputElement, onChange: (val: string) => void) {
        dateInput.addEventListener("change", (e) => {
            onChange((e.target as HTMLInputElement).value);
        });

        dateInput.addEventListener("click", (e) => {
            try {
                if ("showPicker" in dateInput) {
                    (dateInput as any).showPicker();
                }
            } catch (err) {
                // Ignore if showPicker fails
            }
        });
    }

    private renderTaskRow(container: HTMLElement, item: TodoItem, isKo: boolean) {
        const row = container.createDiv({ cls: `myworld-todo-item-row ${item.completed ? "is-completed" : ""}` });

        // 자식 들여쓰기 레벨 적용
        if (item.indentLevel > 0) {
            row.style.marginLeft = `${Math.min(item.indentLevel, 4) * 20}px`;
            const connector = row.createSpan({ text: "└", cls: "myworld-todo-child-connector" });
        }

        // 체크박스
        const checkbox = row.createEl("input", { type: "checkbox", cls: "myworld-todo-checkbox" });
        checkbox.checked = item.completed;
        checkbox.addEventListener("change", (e) => {
            item.completed = (e.target as HTMLInputElement).checked;
            this.render();
        });

        // 텍스트 수정 input
        const textInput = row.createEl("input", {
            type: "text",
            value: item.content,
            cls: "myworld-todo-text-input"
        });
        textInput.addEventListener("input", (e) => {
            item.content = (e.target as HTMLInputElement).value;
        });

        // 날짜 수정/표시 input (전체 클릭 시 showPicker)
        const dateInput = row.createEl("input", {
            type: "date",
            value: item.date || "",
            cls: "myworld-todo-item-date myworld-date-picker-clickable"
        });
        
        this.setupDatePickerClick(dateInput, (val) => {
            item.date = val ? val : undefined;
            this.render();
        });

        // 삭제 버튼
        const deleteBtn = row.createEl("button", {
            text: "✕",
            title: isKo ? "항목 삭제" : "Delete item",
            cls: "myworld-todo-del-btn"
        });
        deleteBtn.addEventListener("click", () => {
            this.items = this.items.filter(i => i.id !== item.id);
            this.render();
        });
    }
}
