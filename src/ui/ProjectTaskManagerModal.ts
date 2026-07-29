import { App, Modal, TFile, Notice } from "obsidian";
import { t } from "../i18n";
import { TaskUtils } from "../TaskUtils";
import { Synchronizer } from "../Synchronizer";

export interface ProjectTaskItem {
    id: string;
    content: string;
    completed: boolean;
    date?: string; // YYYY-MM-DD
    blockId?: string; // ^id
    rawIndent: string;
    indentLevel: number;
}

export interface ProjectSectionData {
    file: TFile;
    title: string;
    items: ProjectTaskItem[];
    sortPri: number;
    pct: number;
    icon: string;
    minDiff: number;
}

export class ProjectTaskManagerModal extends Modal {
    private utils: TaskUtils;
    private synchronizer: Synchronizer;
    private language: string;
    private projectSections: ProjectSectionData[] = [];
    private showHelp: boolean = false;
    private targetFile?: TFile;

    constructor(app: App, language: string, utils: TaskUtils, synchronizer: Synchronizer, onSave: () => Promise<void>, targetFile?: TFile) {
        super(app);
        this.utils = utils;
        this.synchronizer = synchronizer;
        this.language = language;
        this.targetFile = targetFile;
    }

    private async loadAllProjectSections() {
        const files = this.app.vault.getMarkdownFiles();
        const projectFiles = files.filter(f => f.path.startsWith("1. Project/01.List") && !f.name.includes("스케줄"));
        
        // @ts-ignore
        const todayMoment = window.moment ? window.moment().startOf('day') : null;
        // @ts-ignore
        const todayObj = new Date();
        todayObj.setHours(0, 0, 0, 0);

        const loadedSections: ProjectSectionData[] = [];

        for (const file of projectFiles) {
            const content = await this.app.vault.read(file);
            
            // 1. 기한 필터링 (Dataview JS와 100% 동일 원리)
            let isWithinDate = true;
            if (todayMoment) {
                const deadlineMatch = content.match(/기한\s*:\s*📅\s*(\d{4}-\d{2}-\d{2})\s*~\s*📅\s*(\d{4}-\d{2}-\d{2})/);
                if (deadlineMatch) {
                    // @ts-ignore
                    const startDate = window.moment(deadlineMatch[1]).startOf('day');
                    // @ts-ignore
                    const endDate = window.moment(deadlineMatch[2]).endOf('day');
                    if (todayMoment.isBefore(startDate) || todayMoment.isAfter(endDate)) {
                        isWithinDate = false;
                    }
                }
            }
            if (!isWithinDate) continue;

            // 2. `# 계획` 태스크 진행도 산정
            const planSectionMatch = content.match(/#(?: 계획| 📅 계획)([\s\S]*?)(?=\n#|$)/);
            let planTotal = 0;
            let planDone = 0;
            if (planSectionMatch) {
                const planLines = planSectionMatch[1].split("\n");
                for (const line of planLines) {
                    const taskMatch = line.match(/^(\s*)-\s*\[([ xX\-/])\]/);
                    if (taskMatch) {
                        planTotal++;
                        if (taskMatch[2] === "x" || taskMatch[2] === "X") {
                            planDone++;
                        }
                    }
                }
            }
            const pct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

            // 3. `# 실행` 탭 태스크 파싱 및 Dataview 동일 우선순위(sortPri) 산정
            const execSectionMatch = content.match(/#(?: 실행| 🏃‍♂️ 실행)([\s\S]*?)(?=\n#|$)/);
            if (!execSectionMatch) continue;

            const execLines = execSectionMatch[1].split("\n");
            const items: ProjectTaskItem[] = [];
            let pMinDiff = Infinity;

            execLines.forEach((line, idx) => {
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

                        if (!completed && todayObj) {
                            const pts = date.split('-');
                            const targetDate = new Date(parseInt(pts[0]), parseInt(pts[1]) - 1, parseInt(pts[2]));
                            const diff = Math.ceil((targetDate.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
                            if (diff < pMinDiff) {
                                pMinDiff = diff;
                            }
                        }
                    }

                    items.push({
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

            // 실행 태스크가 전혀 없는 프로젝트는 스케줄 노출 제외 규칙 반영
            if (items.length === 0) continue;

            let pSortPri = 99;
            if (planTotal > 0 && planDone === planTotal && items.length > 0) pSortPri = 100;
            else if (pMinDiff < 0) pSortPri = 0;
            else if (pMinDiff === 0) pSortPri = 1;
            else if (pMinDiff === 1) pSortPri = 2;
            else if (pMinDiff === 2) pSortPri = 3;
            else if (pMinDiff === 3) pSortPri = 4;

            let icon = "📝";
            if (pSortPri === 0) icon = "🔥";
            else if (pSortPri === 1) icon = "🚨";
            else if (pSortPri === 2) icon = "⚠️";
            else if (pSortPri === 3) icon = "✅";
            else if (pSortPri === 4) icon = "ℹ️";
            else if (pSortPri === 100) icon = "🏁";
            else if (pct === 0) icon = "💭";

            loadedSections.push({
                file,
                title: file.basename,
                items,
                sortPri: pSortPri,
                pct,
                icon,
                minDiff: pMinDiff
            });
        }

        // Dataview 100% 동일 정렬: targetFile 최우선 -> sortPri 오름차순 -> pct 내림차순 -> 제목 오름차순
        loadedSections.sort((a, b) => {
            if (this.targetFile) {
                if (a.file.path === this.targetFile.path) return -1;
                if (b.file.path === this.targetFile.path) return 1;
            }
            if (a.sortPri !== b.sortPri) return a.sortPri - b.sortPri;
            if (a.pct !== b.pct) return b.pct - a.pct;
            return a.title.localeCompare(b.title);
        });

        this.projectSections = loadedSections;
    }

    private getEffectiveDate(section: ProjectSectionData, index: number): string | undefined {
        const item = section.items[index];
        if (!item) return undefined;
        if (item.date) return item.date;

        let currentIndent = item.indentLevel;
        for (let i = index - 1; i >= 0; i--) {
            const parentCandidate = section.items[i];
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

    private getItemBorderColor(section: ProjectSectionData, index: number): string {
        const effectiveDate = this.getEffectiveDate(section, index);
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

    private moveItem(sectionIndex: number, itemIndex: number, direction: -1 | 1) {
        const section = this.projectSections[sectionIndex];
        if (!section) return;
        const newIndex = itemIndex + direction;
        if (newIndex < 0 || newIndex >= section.items.length) return;

        const targetItem = section.items[itemIndex];
        const temp = section.items[itemIndex];
        section.items[itemIndex] = section.items[newIndex];
        section.items[newIndex] = temp;
        this.render(targetItem.id);
    }

    private changeIndent(sectionIndex: number, itemIndex: number, direction: -1 | 1) {
        const section = this.projectSections[sectionIndex];
        if (!section) return;
        const item = section.items[itemIndex];
        if (!item) return;

        const newIndent = Math.max(0, Math.min(4, item.indentLevel + direction));
        item.indentLevel = newIndent;
        item.rawIndent = "\t".repeat(newIndent);
        this.render(item.id);
    }

    async onOpen() {
        this.modalEl.addClass("myworld-todo-modal-window");
        this.contentEl.addClass("myworld-todo-modal-content-flex");

        await this.loadAllProjectSections();
        this.render();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private render(focusedItemId?: string) {
        const { contentEl } = this;
        contentEl.empty();

        const isKo = this.language === "ko";

        // 1. 헤더 영역
        const headerEl = contentEl.createDiv({ cls: "myworld-todo-modal-header-flex" });
        headerEl.createEl("h2", {
            text: isKo ? "⚙️ 프로젝트 실행 항목 관리" : "⚙️ Manage Project Tasks",
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

        // 2. 도움말 박스
        if (this.showHelp) {
            const helpBox = contentEl.createDiv({ cls: "myworld-todo-help-box" });
            helpBox.createDiv({ text: t("todo_modal_help_title", this.language), cls: "myworld-todo-help-title" });
            helpBox.createDiv({ text: t("todo_modal_help_move", this.language) });
            helpBox.createDiv({ text: t("todo_modal_help_indent", this.language) });
            helpBox.createDiv({ text: t("todo_modal_help_enter", this.language) });
            helpBox.createDiv({ text: t("todo_modal_help_date", this.language) });
        }

        // 3. 메인 스크롤 목록 영역
        const listContainer = contentEl.createDiv({ cls: "myworld-todo-list-container-flex" });

        if (this.projectSections.length === 0) {
            listContainer.createDiv({
                text: isKo ? "현재 실행할 항목이 남아있는 프로젝트가 없습니다." : "No active project execution tasks found.",
                cls: "myworld-todo-empty"
            });
        } else {
            this.projectSections.forEach((section, sIdx) => {
                const projCard = listContainer.createDiv({ cls: "myworld-project-card-flex" });

                projCard.createEl("h3", {
                    text: `${section.icon} ${sIdx + 1}. ${section.title} (${section.pct}%)`,
                    cls: "myworld-project-card-title-flex"
                });

                // 빠른 추가 바
                const addBar = projCard.createDiv({ cls: "myworld-todo-add-section" });
                const inputEl = addBar.createEl("input", {
                    type: "text",
                    placeholder: isKo ? "새 실행 태스크 추가... (Enter)" : "Add new execution task... (Enter)",
                    cls: "myworld-todo-add-input"
                });

                const dateInputEl = addBar.createEl("input", {
                    type: "date",
                    cls: "myworld-todo-add-date"
                });
                this.setupDatePickerClick(dateInputEl, () => {});

                const submitNewTask = () => {
                    const textVal = inputEl.value.trim();
                    if (!textVal) return;

                    section.items.push({
                        id: `item-new-${Date.now()}`,
                        content: textVal,
                        completed: false,
                        date: dateInputEl.value || undefined,
                        rawIndent: "",
                        indentLevel: 0
                    });
                    this.render();
                };

                const addBtn = addBar.createEl("button", {
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

                // 프로젝트별 항목 목록
                const itemsContainer = projCard.createDiv({ cls: "myworld-project-items-container-flex" });

                const uncompleted = section.items.filter(i => !i.completed);
                const completed = section.items.filter(i => i.completed);

                uncompleted.forEach(item => {
                    const idx = section.items.findIndex(i => i.id === item.id);
                    this.renderTaskRow(itemsContainer, section, item, idx, isKo, sIdx);
                });

                if (completed.length > 0) {
                    if (uncompleted.length > 0) {
                        itemsContainer.createDiv({ cls: "myworld-todo-sub-divider" });
                    }
                    completed.forEach(item => {
                        const idx = section.items.findIndex(i => i.id === item.id);
                        this.renderTaskRow(itemsContainer, section, item, idx, isKo, sIdx);
                    });
                }

                if (sIdx < this.projectSections.length - 1) {
                    listContainer.createDiv({ cls: "myworld-todo-divider" });
                }
            });
        }

        // 4. 고정 푸터
        const footerEl = contentEl.createDiv({ cls: "myworld-todo-modal-footer-flex" });

        const saveBtn = footerEl.createEl("button", {
            text: isKo ? "💾 프로젝트 저장 및 동기화" : "💾 Save & Sync All Projects",
            cls: "mod-cta myworld-todo-save-btn-flex"
        });

        saveBtn.addEventListener("click", () => {
            void this.saveAllProjectSections().then(() => {
                this.close();
            });
        });

        // 5. 포커스 복원 제어
        if (focusedItemId) {
            window.setTimeout(() => {
                const targetInput = contentEl.querySelector<HTMLInputElement>(`input[data-item-id="${focusedItemId}"]`);
                if (targetInput) {
                    targetInput.focus();
                    const valLen = targetInput.value.length;
                    targetInput.setSelectionRange(valLen, valLen);
                }
            }, 30);
        }
    }

    private setupDatePickerClick(dateInput: HTMLInputElement, onChange: (val: string) => void) {
        dateInput.addEventListener("change", (e) => {
            onChange((e.target as HTMLInputElement).value);
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

    private renderTaskRow(
        container: HTMLElement,
        section: ProjectSectionData,
        item: ProjectTaskItem,
        itemIdx: number,
        isKo: boolean,
        sIdx: number
    ) {
        const isChild = item.indentLevel > 0;
        const row = container.createDiv({
            cls: `myworld-todo-item-row ${item.completed ? "is-completed" : ""} ${isChild ? "is-child-task" : ""}`
        });

        const borderColor = this.getItemBorderColor(section, itemIdx);
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
                this.moveItem(sIdx, itemIdx, e.key === "ArrowUp" ? -1 : 1);
            } else if ((e.altKey && e.key === "ArrowRight") || (e.key === "Tab" && !e.shiftKey)) {
                e.preventDefault();
                this.changeIndent(sIdx, itemIdx, 1);
            } else if ((e.altKey && e.key === "ArrowLeft") || (e.key === "Tab" && e.shiftKey)) {
                e.preventDefault();
                this.changeIndent(sIdx, itemIdx, -1);
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
            section.items.splice(itemIdx, 1);
            this.render();
        });
    }

    private async saveAllProjectSections() {
        for (const section of this.projectSections) {
            let fileContent = await this.app.vault.read(section.file);
            const execMatch = fileContent.match(/#(?: 실행| 🏃‍♂️ 실행)([\s\S]*?)(?=\n#|$)/);
            if (!execMatch) continue;

            const newExecLines: string[] = [];
            for (const item of section.items) {
                const checkChar = item.completed ? "x" : " ";
                const indentStr = item.rawIndent !== undefined && item.rawIndent !== "" ? item.rawIndent : "\t".repeat(item.indentLevel);
                let lineText = `${indentStr}- [${checkChar}] ${item.content}`;
                if (item.date) {
                    lineText += ` 📅 ${item.date}`;
                }
                if (item.blockId) {
                    lineText += ` ${item.blockId}`;
                }
                newExecLines.push(lineText);
            }

            const newExecSection = `# 실행\n${newExecLines.join("\n")}\n`;
            fileContent = fileContent.replace(/#(?: 실행| 🏃‍♂️ 실행)[\s\S]*?(?=\n#|$)/, newExecSection);
            await this.app.vault.modify(section.file, fileContent);
        }

        new Notice(this.language === "ko" ? "✅ جميع 프로젝트 실행 항목 동기화 완료!" : "✅ All Project Tasks Synced Successfully!");
    }
}
