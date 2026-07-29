import { App, Modal, Setting, TFile, Notice } from "obsidian";
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
    private language: string;
    private projectSections: ProjectSectionData[] = [];
    private showHelp: boolean = false;
    private taskUtils: TaskUtils;
    private synchronizer: Synchronizer;
    private onSaveCallback: () => Promise<void>;

    constructor(
        app: App,
        language: string,
        taskUtils: TaskUtils,
        synchronizer: Synchronizer,
        onSave: () => Promise<void>
    ) {
        super(app);
        this.language = language;
        this.taskUtils = taskUtils;
        this.synchronizer = synchronizer;
        this.onSaveCallback = onSave;
    }

    private async loadAllProjectSections(): Promise<void> {
        this.projectSections = [];
        const projectFiles = this.taskUtils.getProjectFiles();
        // @ts-ignore
        const today = window.moment ? window.moment().startOf('day') : null;

        for (const file of projectFiles) {
            const content = await this.app.vault.read(file);

            // 1. 기한 범위 (Start Date ~ End Date) 검사
            let isWithinDate = true;
            const periodMatch = content.match(/기한\s*:\s*(.*)/i);
            if (periodMatch && today) {
                const dates = periodMatch[1].match(/📅\s*(\d{4}-\d{2}-\d{2})/g);
                if (dates && dates.length >= 2) {
                    const startStr = dates[0].replace(/📅\s*/, "").trim();
                    const endStr = dates[1].replace(/📅\s*/, "").trim();
                    // @ts-ignore
                    const startDate = window.moment(startStr, "YYYY-MM-DD", true).startOf('day');
                    // @ts-ignore
                    const endDate = window.moment(endStr, "YYYY-MM-DD", true).endOf('day');
                    if (startDate.isValid() && endDate.isValid()) {
                        if (today.isBefore(startDate) || today.isAfter(endDate)) {
                            isWithinDate = false;
                        }
                    }
                }
            }

            if (!isWithinDate) continue; // 기한 범위를 벗어난 프로젝트 제외

            const items = this.parseExecutionItems(content);

            // 2. 실행 태스크가 0개인 프로젝트는 목록에서 제외
            if (items.length === 0) continue;

            // 3. 계획 태스크 추출 및 진행도(pct) 계산
            const { planTotal, planDone, pct } = this.parsePlanProgress(content);

            // 4. 실행 태스크 미완료 최소 마감일 diff (pMinDiff) 계산
            let minDiff = Infinity;
            items.forEach((item, idx) => {
                const effDate = this.getEffectiveDate(items, idx);
                if (effDate && today && !item.completed) {
                    // @ts-ignore
                    const target = window.moment(effDate, "YYYY-MM-DD", true).startOf('day');
                    if (target.isValid()) {
                        const diff = target.diff(today, 'days');
                        if (diff < minDiff) {
                            minDiff = diff;
                        }
                    }
                }
            });

            // 5. Dataview 100% 동일 정렬 우선순위 (sortPri) 및 동적 아이콘 산정
            let sortPri = 99;
            if (planTotal > 0 && planDone === planTotal && items.length > 0) sortPri = 100;
            else if (minDiff < 0) sortPri = 0;
            else if (minDiff === 0) sortPri = 1;
            else if (minDiff === 1) sortPri = 2;
            else if (minDiff === 2) sortPri = 3;
            else if (minDiff === 3) sortPri = 4;

            let icon = "📝";
            if (sortPri === 0) icon = "🔥";
            else if (sortPri === 1) icon = "🚨";
            else if (sortPri === 2) icon = "⚠️";
            else if (sortPri === 3) icon = "✅";
            else if (sortPri === 4) icon = "ℹ️";
            else if (sortPri === 100) icon = "🏁";
            else if (pct === 0) icon = "💭";

            this.projectSections.push({
                file,
                title: file.basename,
                items,
                sortPri,
                pct,
                icon,
                minDiff
            });
        }

        // 6. Dataview 100% 동일 정렬 알고리즘 적용: sortPri 오름차순 -> pct 내림차순 -> 제목 오름차순
        this.projectSections.sort((a, b) => {
            if (a.sortPri !== b.sortPri) return a.sortPri - b.sortPri;
            if (a.pct !== b.pct) return b.pct - a.pct;
            return a.title.localeCompare(b.title);
        });
    }

    private parsePlanProgress(content: string): { planTotal: number; planDone: number; pct: number } {
        const lines = content.split("\n");
        let inPlanSection = false;
        let planLevel = 2;
        let planTotal = 0;
        let planDone = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (/^#+\s+(?:📅\s*)?(?:계획|Plan)/i.test(trimmed)) {
                inPlanSection = true;
                const match = trimmed.match(/^(#+)/);
                planLevel = match ? match[1].length : 2;
                continue;
            }

            if (inPlanSection) {
                if (/^#+\s+/.test(trimmed)) {
                    const match = trimmed.match(/^(#+)/);
                    const level = match ? match[1].length : 2;
                    if (level <= planLevel) {
                        inPlanSection = false;
                        break;
                    }
                }

                const taskMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
                if (taskMatch) {
                    planTotal++;
                    if (taskMatch[2].toLowerCase() === "x") {
                        planDone++;
                    }
                }
            }
        }

        const pct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;
        return { planTotal, planDone, pct };
    }

    private parseExecutionItems(content: string): ProjectTaskItem[] {
        const items: ProjectTaskItem[] = [];
        const lines = content.split("\n");

        let inExecutionSection = false;
        let execLevel = 2;

        for (const line of lines) {
            const trimmed = line.trim();

            if (/^#+\s+(?:🚀\s*|🏃‍♂️\s*)?(?:실행|Execution)/i.test(trimmed)) {
                inExecutionSection = true;
                const match = trimmed.match(/^(#+)/);
                execLevel = match ? match[1].length : 2;
                continue;
            }

            if (inExecutionSection) {
                if (/^#+\s+/.test(trimmed)) {
                    const match = trimmed.match(/^(#+)/);
                    const level = match ? match[1].length : 2;
                    if (level <= execLevel) {
                        inExecutionSection = false;
                        break;
                    }
                }

                const taskMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
                if (taskMatch) {
                    const rawIndent = taskMatch[1] || "";
                    const spaceCount = rawIndent.replace(/\t/g, "    ").length;
                    const indentLevel = Math.floor(spaceCount / 2);

                    const completed = taskMatch[2].toLowerCase() === "x";
                    let rest = taskMatch[3].trim();

                    let blockId: string | undefined;
                    const idMatch = rest.match(/\s+\^([a-zA-Z0-9-]+)$/);
                    if (idMatch) {
                        blockId = idMatch[1];
                        rest = rest.substring(0, rest.length - idMatch[0].length).trim();
                    }

                    let date: string | undefined;
                    const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) {
                        date = dateMatch[1];
                        rest = rest.replace(/📅\s*\d{4}-\d{2}-\d{2}/, "").trim();
                    }

                    items.push({
                        id: "proj_item_" + Math.random().toString(36).substring(2, 9),
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
        return items;
    }

    async onOpen() {
        this.modalEl.addClass("myworld-todo-modal-window");
        this.contentEl.addClass("myworld-todo-modal-content");

        this.contentEl.style.display = "flex";
        this.contentEl.style.flexDirection = "column";
        this.contentEl.style.maxHeight = "85vh";
        this.contentEl.style.minHeight = "480px";
        this.contentEl.style.boxSizing = "border-box";

        await this.loadAllProjectSections();
        this.render();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private getEffectiveDate(items: ProjectTaskItem[], index: number): string | undefined {
        const item = items[index];
        if (!item) return undefined;
        if (item.date) return item.date;

        let currentIndent = item.indentLevel;
        for (let i = index - 1; i >= 0; i--) {
            const parentCandidate = items[i];
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

    private getItemBorderColor(items: ProjectTaskItem[], index: number): string {
        const effectiveDate = this.getEffectiveDate(items, index);
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

    private moveItem(section: ProjectSectionData, index: number, direction: -1 | 1) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= section.items.length) return;
        const item = section.items[index];
        const temp = section.items[index];
        section.items[index] = section.items[newIndex];
        section.items[newIndex] = temp;
        this.render(item.id);
    }

    private changeIndent(section: ProjectSectionData, index: number, direction: -1 | 1) {
        const item = section.items[index];
        if (!item) return;
        const newIndent = Math.max(0, Math.min(4, item.indentLevel + direction));
        item.indentLevel = newIndent;
        item.rawIndent = "  ".repeat(newIndent);
        this.render(item.id);
    }

    private render(focusedItemId?: string) {
        const { contentEl } = this;
        contentEl.empty();

        const isKo = this.language === "ko";
        const todayStr = window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().split("T")[0];

        // 1. 헤더 영역 (독립된 h2 제목 + 우측 ? 버튼)
        const headerEl = contentEl.createDiv({ cls: "myworld-todo-modal-header" });
        headerEl.style.display = "flex";
        headerEl.style.alignItems = "center";
        headerEl.style.gap = "10px";
        headerEl.style.marginBottom = "14px";
        headerEl.style.width = "100%";

        const titleEl = headerEl.createEl("h2", {
            text: isKo ? "⚙️ 프로젝트 실행 항목 관리" : "⚙️ Manage Project Tasks",
            cls: "myworld-todo-modal-title"
        });
        titleEl.style.margin = "0";
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
        helpBtn.style.flexShrink = "0";
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

        helpBtn.addEventListener("click", () => {
            this.showHelp = !this.showHelp;
            this.render(focusedItemId);
        });

        // 2. 도움말 박스
        if (this.showHelp) {
            const helpBox = contentEl.createDiv({ cls: "myworld-todo-help-box" });
            helpBox.createEl("div", { text: t("todo_modal_help_title", this.language), cls: "myworld-todo-help-title" });
            helpBox.createEl("div", { text: t("todo_modal_help_move", this.language) });
            helpBox.createEl("div", { text: t("todo_modal_help_indent", this.language) });
            helpBox.createEl("div", { text: t("todo_modal_help_enter", this.language) });
            helpBox.createEl("div", { text: t("todo_modal_help_date", this.language) });
        }

        // 3. 메인 스크롤 목록 영역 (Dataview 100% 동일 정렬)
        const listContainer = contentEl.createDiv({ cls: "myworld-todo-list-container" });
        listContainer.style.flex = "1 1 auto";
        listContainer.style.overflowY = "auto";
        listContainer.style.display = "flex";
        listContainer.style.flexDirection = "column";
        listContainer.style.gap = "16px";
        listContainer.style.marginBottom = "14px";
        listContainer.style.paddingRight = "4px";

        if (this.projectSections.length === 0) {
            listContainer.createDiv({
                text: isKo ? "현재 실행할 항목이 남아있는 프로젝트가 없습니다." : "No active project execution tasks found.",
                cls: "myworld-todo-empty"
            });
        } else {
            this.projectSections.forEach((section, sIdx) => {
                const projCard = listContainer.createDiv({ cls: "myworld-project-card" });
                projCard.style.display = "flex";
                projCard.style.flexDirection = "column";
                projCard.style.gap = "8px";

                // Dataview 100% 동일 긴급도 아이콘(🔥, 🚨, ⚠️, ✅, ℹ️, 💭, 🏁) 매핑
                const projTitle = projCard.createEl("h3", {
                    text: `${section.icon} ${sIdx + 1}. ${section.title}`,
                    cls: "myworld-project-card-title"
                });
                projTitle.style.margin = "0 0 4px 0";
                projTitle.style.fontSize = "1.05em";
                projTitle.style.color = "var(--text-accent)";

                // 프로젝트별 신규 실행 태스크 추가 영역
                const addSection = projCard.createDiv({ cls: "myworld-todo-add-section" });

                const inputEl = addSection.createEl("input", {
                    type: "text",
                    placeholder: isKo ? `[${section.title}] 새 실행 항목 입력... (Enter)` : `Add task for ${section.title}...`,
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
                        new Notice(isKo ? "항목 내용을 입력해주세요." : "Please enter task content.");
                        return;
                    }

                    const newItemId = "proj_item_" + Math.random().toString(36).substring(2, 9);
                    section.items.push({
                        id: newItemId,
                        content: trimmed,
                        completed: false,
                        date: newDate || todayStr,
                        rawIndent: "",
                        indentLevel: 0
                    });

                    inputEl.value = "";
                    this.render(newItemId);
                };

                addBtn.addEventListener("click", submitNewTask);
                inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        submitNewTask();
                    }
                });

                // 프로젝트별 항목 목록
                const itemsContainer = projCard.createDiv({ cls: "myworld-project-items-container" });
                itemsContainer.style.display = "flex";
                itemsContainer.style.flexDirection = "column";
                itemsContainer.style.gap = "6px";

                const uncompleted = section.items.filter(i => !i.completed);
                const completed = section.items.filter(i => i.completed);

                uncompleted.forEach(item => {
                    const idx = section.items.findIndex(i => i.id === item.id);
                    this.renderTaskRow(itemsContainer, section, item, idx, isKo);
                });

                if (completed.length > 0) {
                    if (uncompleted.length > 0) {
                        itemsContainer.createDiv({ cls: "myworld-todo-sub-divider" });
                    }
                    completed.forEach(item => {
                        const idx = section.items.findIndex(i => i.id === item.id);
                        this.renderTaskRow(itemsContainer, section, item, idx, isKo);
                    });
                }

                // 프로젝트 간 구분선 (마지막 카드가 아니면 표시)
                if (sIdx < this.projectSections.length - 1) {
                    listContainer.createDiv({ cls: "myworld-todo-divider" });
                }
            });
        }

        // 4. [독립 영역] 모달 최하단 고정 푸터 (일괄 저장 및 동기화)
        const footerEl = contentEl.createDiv({ cls: "myworld-todo-modal-footer" });
        footerEl.style.marginTop = "auto";
        footerEl.style.paddingTop = "16px";
        footerEl.style.borderTop = "1px solid var(--border-color, rgba(128, 128, 128, 0.25))";
        footerEl.style.display = "flex";
        footerEl.style.justifyContent = "center";
        footerEl.style.alignItems = "center";
        footerEl.style.width = "100%";

        const saveBtn = footerEl.createEl("button", {
            text: isKo ? "💾 프로젝트 저장 및 동기화" : "💾 Save & Sync All Projects",
            cls: "mod-cta myworld-todo-save-btn"
        });
        saveBtn.style.minWidth = "200px";
        saveBtn.style.fontWeight = "600";
        saveBtn.style.padding = "8px 24px";
        saveBtn.style.fontSize = "0.95em";

        saveBtn.addEventListener("click", async () => {
            await this.saveAllProjectSections();
            this.close();
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
                if ("showPicker" in dateInput) {
                    (dateInput as any).showPicker();
                }
            } catch (err) {
                // Ignore if showPicker fails
            }
        });
    }

    private renderTaskRow(container: HTMLElement, section: ProjectSectionData, item: ProjectTaskItem, itemIdx: number, isKo: boolean) {
        const row = container.createDiv({ cls: `myworld-todo-item-row ${item.completed ? "is-completed" : ""}` });

        if (item.indentLevel > 0) {
            row.style.marginLeft = `${Math.min(item.indentLevel, 4) * 20}px`;
        }

        const checkbox = row.createEl("input", { type: "checkbox", cls: "myworld-todo-checkbox" });
        checkbox.checked = item.completed;
        checkbox.addEventListener("change", (e) => {
            item.completed = (e.target as HTMLInputElement).checked;
            this.render(item.id);
        });

        const textInput = row.createEl("input", {
            type: "text",
            value: item.content,
            cls: "myworld-todo-text-input"
        });
        textInput.setAttribute("data-item-id", item.id);
        const borderColor = this.getItemBorderColor(section.items, itemIdx);
        textInput.style.border = `2px solid ${borderColor}`;

        textInput.addEventListener("input", (e) => {
            item.content = (e.target as HTMLInputElement).value;
        });

        textInput.addEventListener("keydown", (e) => {
            if (e.altKey && e.key === "ArrowUp") {
                e.preventDefault();
                this.moveItem(section, itemIdx, -1);
            } else if (e.altKey && e.key === "ArrowDown") {
                e.preventDefault();
                this.moveItem(section, itemIdx, 1);
            } else if (e.key === "Tab" || (e.altKey && e.key === "ArrowRight")) {
                e.preventDefault();
                this.changeIndent(section, itemIdx, e.shiftKey ? -1 : 1);
            } else if (e.altKey && e.key === "ArrowLeft") {
                e.preventDefault();
                this.changeIndent(section, itemIdx, -1);
            }
        });

        const dateInput = row.createEl("input", {
            type: "date",
            value: item.date || "",
            cls: "myworld-todo-item-date myworld-date-picker-clickable"
        });

        this.setupDatePickerClick(dateInput, (val) => {
            item.date = val ? val : undefined;
            this.render(item.id);
        });

        const deleteBtn = row.createEl("button", {
            text: "✕",
            title: isKo ? "항목 삭제" : "Delete item",
            cls: "myworld-todo-del-btn"
        });
        deleteBtn.addEventListener("click", () => {
            section.items = section.items.filter(i => i.id !== item.id);
            this.render();
        });
    }

    private async saveAllProjectSections(): Promise<void> {
        for (const section of this.projectSections) {
            const content = await this.app.vault.read(section.file);
            const lines = content.split("\n");

            let execStartIdx = -1;
            let execEndIdx = lines.length;
            let execLevel = 2;

            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (/^#+\s+(?:🚀\s*|🏃‍♂️\s*)?(?:실행|Execution)/i.test(trimmed)) {
                    execStartIdx = i;
                    const match = trimmed.match(/^(#+)/);
                    execLevel = match ? match[1].length : 2;
                    break;
                }
            }

            if (execStartIdx !== -1) {
                for (let i = execStartIdx + 1; i < lines.length; i++) {
                    const trimmed = lines[i].trim();
                    if (/^#+\s+/.test(trimmed)) {
                        const match = trimmed.match(/^(#+)/);
                        const level = match ? match[1].length : 2;
                        if (level <= execLevel) {
                            execEndIdx = i;
                            break;
                        }
                    }
                }
            }

            const newExecLines: string[] = [];
            section.items.forEach(item => {
                const checkSymbol = item.completed ? "x" : " ";
                const indentStr = "  ".repeat(item.indentLevel);
                let lineText = `${indentStr}- [${checkSymbol}] ${item.content}`;

                if (item.date) {
                    lineText += ` 📅 ${item.date}`;
                }

                if (item.blockId) {
                    lineText += ` ^${item.blockId}`;
                } else {
                    const newId = Math.random().toString(36).substring(2, 8);
                    lineText += ` ^${newId}`;
                }

                newExecLines.push(lineText);
            });

            let updatedFullContent = "";
            if (execStartIdx !== -1) {
                const beforeLines = lines.slice(0, execStartIdx + 1);
                const afterLines = lines.slice(execEndIdx);
                updatedFullContent = [...beforeLines, ...newExecLines, ...afterLines].join("\n");
            } else {
                const headerTitle = this.language === "ko" ? "## 🚀 실행" : "## 🚀 Execution";
                updatedFullContent = content + `\n\n${headerTitle}\n` + newExecLines.join("\n");
            }

            await this.app.vault.modify(section.file, updatedFullContent);
        }

        new Notice(
            this.language === "ko"
                ? "✅ 모든 프로젝트 실행 항목이 저장되었습니다."
                : "✅ All project tasks saved."
        );

        await this.onSaveCallback();
    }
}
