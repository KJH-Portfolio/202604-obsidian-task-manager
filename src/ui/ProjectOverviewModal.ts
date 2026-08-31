import { App, Modal, TFile, Notice } from "obsidian";
import { TaskUtils, ProjectOverviewData, ProjectGoalItem } from "../TaskUtils";
import { t } from "../i18n";

export class ProjectOverviewModal extends Modal {
    private file: TFile;
    private utils: TaskUtils;
    private language: string;
    private onSaveCallback: (data: ProjectOverviewData) => Promise<void>;

    private data: ProjectOverviewData = {
        startDate: undefined,
        endDate: undefined,
        goals: []
    };
    private showHelp = false;

    constructor(
        app: App,
        file: TFile,
        utils: TaskUtils,
        language: string,
        onSave: (data: ProjectOverviewData) => Promise<void>
    ) {
        super(app);
        this.file = file;
        this.utils = utils;
        this.language = language;
        this.onSaveCallback = onSave;
    }

    async onOpen() {
        this.modalEl.addClass("myworld-todo-modal-window");
        this.contentEl.addClass("myworld-todo-modal-content-flex");

        // 파일에서 초기 데이터 파싱
        const rawContent = await this.utils.fileManager.getActiveViewOrFileText(this.file);
        this.data = this.utils.parseProjectOverview(rawContent);

        // 기본값 세팅 (없을 경우 오늘 날짜)
        const todayStr = window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().split("T")[0];
        if (!this.data.startDate) this.data.startDate = todayStr;
        if (!this.data.endDate) this.data.endDate = todayStr;

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

    private changeIndent(index: number, direction: -1 | 1) {
        const item = this.data.goals[index];
        if (!item) return;
        const newIndent = Math.max(0, Math.min(3, item.indentLevel + direction));
        item.indentLevel = newIndent;
        this.render(item.id);
    }

    private moveItem(index: number, direction: -1 | 1) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.data.goals.length) return;
        const focusItem = this.data.goals[index];
        const temp = this.data.goals[index];
        this.data.goals[index] = this.data.goals[newIndex];
        this.data.goals[newIndex] = temp;
        this.render(focusItem.id);
    }

    private async submitAndClose(): Promise<void> {
        await this.onSaveCallback(this.data);
        new Notice(t("notice_overview_saved", this.language));
        this.close();
    }

    private render(focusedItemId?: string) {
        const { contentEl } = this;
        contentEl.empty();

        const isKo = this.language === "ko";

        // 1. 헤더 영역
        const headerEl = contentEl.createDiv({ cls: "myworld-todo-modal-header-flex" });
        headerEl.createEl("h2", {
            text: `${t("overview_modal_title", this.language)} - ${this.file.basename}`,
            cls: "myworld-todo-modal-title-flex"
        });

        const helpBtn = headerEl.createEl("button", {
            text: "?",
            title: t("help_overview_title", this.language),
            cls: "myworld-todo-help-btn-flex"
        });

        helpBtn.addEventListener("click", () => {
            this.showHelp = !this.showHelp;
            this.render(focusedItemId);
        });

        // 2. 도움말 가이드 박스
        if (this.showHelp) {
            const helpBox = contentEl.createDiv({ cls: "myworld-todo-help-box" });
            helpBox.createDiv({ text: t("help_overview_title", this.language), cls: "myworld-todo-help-title" });
            helpBox.createDiv({ text: t("help_overview_enter", this.language) });
            helpBox.createDiv({ text: t("help_overview_indent", this.language) });
            helpBox.createDiv({ text: t("help_overview_move", this.language) });
        }

        // 3. 📅 기한 설정 카드
        const periodCard = contentEl.createDiv({ cls: "myworld-project-overview-card" });
        periodCard.createEl("h3", { text: t("overview_period_title", this.language), cls: "myworld-overview-card-title" });

        const periodRow = periodCard.createDiv({ cls: "myworld-overview-period-row" });
        
        // 시작일
        const startGroup = periodRow.createDiv({ cls: "myworld-overview-date-group" });
        startGroup.createSpan({ text: t("overview_start_date", this.language), cls: "myworld-overview-date-label" });
        const startInput = startGroup.createEl("input", {
            type: "date",
            value: this.data.startDate || "",
            cls: "myworld-overview-date-input"
        });
        this.setupDatePickerClick(startInput, (val) => { this.data.startDate = val; });

        periodRow.createSpan({ text: "~", cls: "myworld-overview-date-separator" });

        // 마감일
        const endGroup = periodRow.createDiv({ cls: "myworld-overview-date-group" });
        endGroup.createSpan({ text: t("overview_end_date", this.language), cls: "myworld-overview-date-label" });
        const endInput = endGroup.createEl("input", {
            type: "date",
            value: this.data.endDate || "",
            cls: "myworld-overview-date-input"
        });
        this.setupDatePickerClick(endInput, (val) => { this.data.endDate = val; });

        // D-Day 상태 및 진행 일수 계산 뱃지
        const ddayBadge = periodCard.createDiv({ cls: "myworld-overview-dday-badge" });
        // @ts-ignore
        if (window.moment && this.data.endDate) {
            // @ts-ignore
            const today = window.moment().startOf("day");
            // @ts-ignore
            const end = window.moment(this.data.endDate, "YYYY-MM-DD", true);
            // @ts-ignore
            const start = this.data.startDate ? window.moment(this.data.startDate, "YYYY-MM-DD", true) : today;

            if (end.isValid()) {
                const diffDays = end.diff(today, "days");
                const totalDays = start.isValid() ? end.diff(start, "days") + 1 : 0;
                let statusEmoji = "🟢";
                let statusText = `D-${diffDays}`;
                if (diffDays < 0) {
                    statusEmoji = "🔴";
                    statusText = isKo ? `D+${Math.abs(diffDays)} (기한 경과)` : `D+${Math.abs(diffDays)} (Overdue)`;
                } else if (diffDays === 0) {
                    statusEmoji = "🚨";
                    statusText = isKo ? "D-Day (오늘 마감)" : "D-Day (Today)";
                }

                const totalStr = totalDays > 0 ? (isKo ? ` (총 ${totalDays}일간 진행)` : ` (${totalDays} days total)`) : "";
                ddayBadge.innerHTML = `<span class="myworld-overview-dday-indicator">${statusEmoji} <b>${statusText}</b>${totalStr}</span>`;
            }
        }

        // 4. 🎯 핵심 목표 관리 카드
        const goalsCard = contentEl.createDiv({ cls: "myworld-project-overview-card" });
        goalsCard.createEl("h3", { text: t("overview_goals_title", this.language), cls: "myworld-overview-card-title" });

        // 빠른 추가 입력 바
        const addSection = goalsCard.createDiv({ cls: "myworld-todo-add-section" });
        const inputEl = addSection.createEl("input", {
            type: "text",
            placeholder: t("overview_goal_placeholder", this.language),
            cls: "myworld-todo-add-input"
        });

        const submitNewGoal = () => {
            const textVal = inputEl.value.trim();
            if (!textVal) return;

            const newGoal: ProjectGoalItem = {
                id: `goal-new-${Date.now()}`,
                content: textVal,
                indentLevel: 0
            };

            this.data.goals.push(newGoal);
            this.render("ADD_INPUT_FOCUS");
        };

        const addBtn = addSection.createEl("button", {
            text: isKo ? "추가" : "Add",
            cls: "mod-cta"
        });
        addBtn.addEventListener("click", submitNewGoal);

        inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void this.submitAndClose();
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (!inputEl.value.trim()) {
                    void this.submitAndClose();
                } else {
                    submitNewGoal();
                }
            }
        });

        // 목표 목록 리스트
        const listContainer = goalsCard.createDiv({ cls: "myworld-todo-list-container-flex" });
        if (this.data.goals.length === 0) {
            listContainer.createDiv({
                text: isKo ? "등록된 목표가 없습니다. 상단에서 핵심 목표를 추가하세요." : "No goals added yet.",
                cls: "myworld-todo-empty"
            });
        } else {
            let rootCounter = 1;
            this.data.goals.forEach((goal, idx) => {
                const isChild = goal.indentLevel > 0;
                const row = listContainer.createDiv({
                    cls: `myworld-todo-item-row ${isChild ? "is-child-task" : ""}`
                });

                row.setCssStyles({
                    marginLeft: `${goal.indentLevel * 24}px`
                });

                // 라벨 뱃지 (루트: 1., 2. / 자식: ↳ •)
                const badgeEl = row.createSpan({ cls: "myworld-overview-goal-badge" });
                if (!isChild) {
                    badgeEl.textContent = `${rootCounter}.`;
                    rootCounter++;
                } else {
                    badgeEl.textContent = "↳ •";
                }

                // 텍스트 인풋
                const textInput = row.createEl("input", {
                    type: "text",
                    value: goal.content,
                    cls: "myworld-todo-input"
                });
                textInput.dataset.itemId = goal.id;

                textInput.addEventListener("input", () => {
                    goal.content = textInput.value;
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

                // 삭제 버튼
                const delBtn = row.createEl("button", {
                    text: "🗑️",
                    title: isKo ? "삭제" : "Delete",
                    cls: "myworld-todo-del-btn"
                });
                delBtn.addEventListener("click", () => {
                    this.data.goals.splice(idx, 1);
                    this.render();
                });
            });
        }

        // 5. 푸터 영역
        const footerEl = contentEl.createDiv({ cls: "myworld-todo-modal-footer-flex" });

        const cancelBtn = footerEl.createEl("button", {
            text: isKo ? "취소" : "Cancel",
            cls: "mod-muted"
        });
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = footerEl.createEl("button", {
            text: t("overview_save_btn", this.language),
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
