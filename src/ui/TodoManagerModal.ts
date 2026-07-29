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
    private showHelp: boolean = false;
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
        this.modalEl.addClass("myworld-todo-modal-window");
        this.contentEl.addClass("myworld-todo-modal-content");

        // 인라인 스타일로 반응형 안전 높이 및 flex 수직 레이아웃 강제 주입
        this.contentEl.style.display = "flex";
        this.contentEl.style.flexDirection = "column";
        this.contentEl.style.maxHeight = "85vh";
        this.contentEl.style.minHeight = "420px";
        this.contentEl.style.boxSizing = "border-box";

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

        // 위쪽으로 직계 부모(indentLevel이 더 작은 항목)를 탐색하여 날짜 상속 (Inherited Date)
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
        if (diff < 0) return "#8c0028"; // 지연: 짙은 버건디/레드
        if (diff === 0) return "#e93147"; // 오늘: 밝은 레드
        if (diff === 1) return "#ffd200"; // D-1: 노란색
        if (diff === 2) return "#44cf6e"; // D-2: 초록색
        if (diff === 3) return "#086ddd"; // D-3: 파란색
        return "#969696"; // D-4 이상: 회색
    }

    private moveItem(index: number, direction: -1 | 1) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.items.length) return;
        const item = this.items[index];
        const temp = this.items[index];
        this.items[index] = this.items[newIndex];
        this.items[newIndex] = temp;
        this.render(item.id); // 방금 이동한 항목 ID를 전달하여 포커스 복원!
    }

    private changeIndent(index: number, direction: -1 | 1) {
        const item = this.items[index];
        if (!item) return;
        const newIndent = Math.max(0, Math.min(4, item.indentLevel + direction));
        item.indentLevel = newIndent;
        item.rawIndent = "  ".repeat(newIndent);
        this.render(item.id); // 방금 들여쓴/내어쓴 항목 ID를 전달하여 포커스 복원!
    }

    private render(focusedItemId?: string) {
        const { contentEl } = this;
        contentEl.empty();

        const isKo = this.language === "ko";
        const todayStr = window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().split("T")[0];

        // 1. 헤더 영역 (독립된 h2 제목 + 바로 옆 독립된 원형 ? 버튼)
        const headerEl = contentEl.createDiv({ cls: "myworld-todo-modal-header" });
        headerEl.style.display = "flex";
        headerEl.style.alignItems = "center";
        headerEl.style.gap = "10px";
        headerEl.style.marginBottom = "14px";
        headerEl.style.width = "100%";

        const titleEl = headerEl.createEl("h2", { text: t("todo_modal_title", this.language), cls: "myworld-todo-modal-title" });
        titleEl.style.margin = "0";
        titleEl.style.padding = "0";
        titleEl.style.lineHeight = "1.2";

        const helpBtn = headerEl.createEl("button", {
            text: "?",
            title: isKo ? "단축키 사용 설명서" : "Keyboard Shortcuts Help",
            cls: "myworld-todo-help-btn"
        });
        helpBtn.style.width = "22px";
        helpBtn.style.height = "22px";
        helpBtn.style.minWidth = "22px";
        helpBtn.style.minHeight = "22px";
        helpBtn.style.flexShrink = "0"; // 찌그러짐 철통 방지
        helpBtn.style.borderRadius = "50%";
        helpBtn.style.fontSize = "12px";
        helpBtn.style.fontWeight = "bold";
        helpBtn.style.color = "var(--text-muted)";
        helpBtn.style.backgroundColor = "var(--background-secondary-alt, var(--background-secondary))";
        helpBtn.style.border = "1px solid var(--border-color, rgba(128, 128, 128, 0.3))";
        helpBtn.style.cursor = "pointer";
        helpBtn.style.display = "inline-flex";
        helpBtn.style.alignItems = "center";
        helpBtn.style.justifyContent = "center";
        helpBtn.style.padding = "0";
        helpBtn.style.lineHeight = "1";
        helpBtn.style.userSelect = "none";

        helpBtn.addEventListener("click", () => {
            this.showHelp = !this.showHelp;
            this.render(focusedItemId);
        });

        // 2. 도움말 가이드 박스 ( showHelp === true 일 때만 펼쳐짐 )
        if (this.showHelp) {
            const helpBox = contentEl.createDiv({ cls: "myworld-todo-help-box" });
            helpBox.createEl("div", { text: t("todo_modal_help_title", this.language), cls: "myworld-todo-help-title" });
            helpBox.createEl("div", { text: t("todo_modal_help_move", this.language) });
            helpBox.createEl("div", { text: t("todo_modal_help_indent", this.language) });
            helpBox.createEl("div", { text: t("todo_modal_help_enter", this.language) });
            helpBox.createEl("div", { text: t("todo_modal_help_date", this.language) });
        }

        // 3. [최상단] 새 할 일 추가 영역
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

            const newItemId = "item_" + Math.random().toString(36).substring(2, 9);
            this.items.push({
                id: newItemId,
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

        // 4. 부모-자식 트리 청크(Tree Groups) 구성
        interface TreeGroup {
            items: TodoItem[];
            isToday: boolean;
        }

        const groups: TreeGroup[] = [];
        let currentGroup: TodoItem[] = [];

        for (let idx = 0; idx < this.items.length; idx++) {
            const item = this.items[idx];
            if (item.indentLevel === 0) {
                if (currentGroup.length > 0) {
                    const hasToday = currentGroup.some((gItem) => {
                        const gIdx = this.items.findIndex(i => i.id === gItem.id);
                        return this.getEffectiveDate(gIdx) === todayStr;
                    });
                    groups.push({ items: currentGroup, isToday: hasToday });
                }
                currentGroup = [item];
            } else {
                currentGroup.push(item);
            }
        }
        if (currentGroup.length > 0) {
            const hasToday = currentGroup.some((gItem) => {
                const gIdx = this.items.findIndex(i => i.id === gItem.id);
                return this.getEffectiveDate(gIdx) === todayStr;
            });
            groups.push({ items: currentGroup, isToday: hasToday });
        }

        const todayGroups = groups.filter(g => g.isToday);
        const upcomingGroups = groups.filter(g => !g.isToday);

        // 독립된 스크롤 목록 바디 컨테이너 (남은 빈 높이 모두 확장 차지)
        const listContainer = contentEl.createDiv({ cls: "myworld-todo-list-container" });
        listContainer.style.flex = "1 1 auto";
        listContainer.style.overflowY = "auto";
        listContainer.style.display = "flex";
        listContainer.style.flexDirection = "column";
        listContainer.style.gap = "10px";
        listContainer.style.marginBottom = "14px";
        listContainer.style.paddingRight = "4px";

        // --- 섹션 1: [ 오늘 할 일 ] ---
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

        // 구분선 1 (점선)
        listContainer.createDiv({ cls: "myworld-todo-divider" });

        // --- 섹션 2: [ 예정 할 일 / 기타 ] ---
        const upcomingSection = listContainer.createDiv({ cls: "myworld-todo-group" });
        upcomingSection.createEl("h3", { text: isKo ? "📅 예정 할 일 / 기타" : "📅 Upcoming & Other Tasks", cls: "myworld-todo-group-title" });

        if (upcomingGroups.length === 0) {
            upcomingSection.createDiv({ text: isKo ? "예정되거나 기타 지정된 할 일이 없습니다." : "No upcoming or other tasks.", cls: "myworld-todo-empty" });
        } else {
            upcomingGroups.forEach(g => renderGroupItems(upcomingSection, g.items));
        }

        // 5. [독립 영역] 모달 최하단 고정 푸터 (저장 및 동기화 단일 버튼)
        const footerEl = contentEl.createDiv({ cls: "myworld-todo-modal-footer" });
        footerEl.style.marginTop = "auto"; // 모달 바닥으로 강제 밀착 고정
        footerEl.style.paddingTop = "16px";
        footerEl.style.borderTop = "1px solid var(--border-color, rgba(128, 128, 128, 0.25))";
        footerEl.style.display = "flex";
        footerEl.style.justifyContent = "center";
        footerEl.style.alignItems = "center";
        footerEl.style.width = "100%";

        const saveBtn = footerEl.createEl("button", {
            text: isKo ? "💾 저장 및 동기화" : "💾 Save & Sync",
            cls: "mod-cta myworld-todo-save-btn"
        });
        saveBtn.style.minWidth = "180px";
        saveBtn.style.fontWeight = "600";
        saveBtn.style.padding = "8px 24px";
        saveBtn.style.fontSize = "0.95em";

        saveBtn.addEventListener("click", () => {
            void this.onSaveCallback(this.items).then(() => {
                this.close();
            });
        });

        // 6. 포커스 제어: focusedItemId가 존재하면 해당 항목의 입력창으로 포커스 복원, 없으면 상단 입력창으로 포커스!
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

        dateInput.addEventListener("click", () => {
            try {
                if ("showPicker" in dateInput) {
                    (dateInput as any).showPicker();
                }
            } catch (err) {
                // Ignore if showPicker fails
            }
        });
    }

    private renderTaskRow(container: HTMLElement, item: TodoItem, itemIdx: number, isKo: boolean) {
        const row = container.createDiv({ cls: `myworld-todo-item-row ${item.completed ? "is-completed" : ""}` });

        // 들여쓰기 여백 적용
        if (item.indentLevel > 0) {
            row.style.marginLeft = `${Math.min(item.indentLevel, 4) * 20}px`;
        }

        // 체크박스
        const checkbox = row.createEl("input", { type: "checkbox", cls: "myworld-todo-checkbox" });
        checkbox.checked = item.completed;
        checkbox.addEventListener("change", (e) => {
            item.completed = (e.target as HTMLInputElement).checked;
            this.render(item.id);
        });

        // 텍스트 수정 input + 긴급도(부모 날짜 상속 포함) 테두리 스타일 + 포커스 추적용 data 속성
        const textInput = row.createEl("input", {
            type: "text",
            value: item.content,
            cls: "myworld-todo-text-input"
        });
        textInput.setAttribute("data-item-id", item.id);
        const borderColor = this.getItemBorderColor(itemIdx);
        textInput.style.border = `2px solid ${borderColor}`;

        textInput.addEventListener("input", (e) => {
            item.content = (e.target as HTMLInputElement).value;
        });

        // 단축키 핸들러 (Alt + Up/Down, Tab / Shift+Tab)
        textInput.addEventListener("keydown", (e) => {
            if (e.altKey && e.key === "ArrowUp") {
                e.preventDefault();
                this.moveItem(itemIdx, -1);
            } else if (e.altKey && e.key === "ArrowDown") {
                e.preventDefault();
                this.moveItem(itemIdx, 1);
            } else if (e.key === "Tab" || (e.altKey && e.key === "ArrowRight")) {
                e.preventDefault();
                this.changeIndent(itemIdx, e.shiftKey ? -1 : 1);
            } else if (e.altKey && e.key === "ArrowLeft") {
                e.preventDefault();
                this.changeIndent(itemIdx, -1);
            }
        });

        // 날짜 수정/표시 input (전체 클릭 시 showPicker)
        const dateInput = row.createEl("input", {
            type: "date",
            value: item.date || "",
            cls: "myworld-todo-item-date myworld-date-picker-clickable"
        });

        this.setupDatePickerClick(dateInput, (val) => {
            item.date = val ? val : undefined;
            this.render(item.id);
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
