import { App, Modal, Setting } from "obsidian";
import { RoutineStructure, RoutineDiff } from "../types";

export class RoutineManagerModal extends Modal {
    private initialStructure: RoutineStructure;
    private currentStructure: RoutineStructure;
    private language: "en" | "ko";
    private onSaveCallback: (newStructure: RoutineStructure, diff: RoutineDiff) => Promise<void>;
    private showHelp: boolean = false;

    // 개명 및 삭제 추적을 위한 맵
    private originalCategoryNamesById: Map<string, string> = new Map();

    constructor(
        app: App,
        language: "en" | "ko",
        initialStructure: RoutineStructure,
        onSave: (newStructure: RoutineStructure, diff: RoutineDiff) => Promise<void>
    ) {
        super(app);
        this.language = language;
        // 깊은 복사
        this.initialStructure = JSON.parse(JSON.stringify(initialStructure)) as RoutineStructure;
        this.currentStructure = JSON.parse(JSON.stringify(initialStructure)) as RoutineStructure;
        this.onSaveCallback = onSave;

        // 기존 ID별 원래 이름 추적
        for (const cat of this.initialStructure.categories) {
            this.originalCategoryNamesById.set(cat.id, cat.name);
        }
    }

    onOpen() {
        this.modalEl.addClass("myworld-routine-modal");
        this.render();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private getCurrentScrollTop(): number {
        const listContainer = this.contentEl.querySelector(".routine-cat-list-container");
        return listContainer ? listContainer.scrollTop : 0;
    }

    private moveCategory(index: number, direction: -1 | 1) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.currentStructure.categories.length) return;
        const scrollTop = this.getCurrentScrollTop();
        const targetCat = this.currentStructure.categories[index];
        this.currentStructure.categories[index] = this.currentStructure.categories[newIndex];
        this.currentStructure.categories[newIndex] = targetCat;
        this.render(`input-cat-name-${targetCat.id}`, scrollTop);
    }

    private moveCategoryItem(catIndex: number, itemIndex: number, direction: -1 | 1) {
        const cat = this.currentStructure.categories[catIndex];
        if (!cat) return;
        const newIndex = itemIndex + direction;
        if (newIndex < 0 || newIndex >= cat.items.length) return;
        const scrollTop = this.getCurrentScrollTop();
        const temp = cat.items[itemIndex];
        cat.items[itemIndex] = cat.items[newIndex];
        cat.items[newIndex] = temp;
        this.render(`input-item-${cat.id}-${newIndex}`, scrollTop);
    }

    private render(focusedTargetId?: string, savedScrollTop?: number) {
        const currentScroll = savedScrollTop !== undefined ? savedScrollTop : this.getCurrentScrollTop();
        const { contentEl } = this;
        contentEl.empty();

        const isKo = this.language === "ko";

        // 1. Title & 도움말 버튼 헤더
        const headerEl = contentEl.createDiv({ cls: "myworld-todo-modal-header-flex" });
        headerEl.createEl("h2", {
            text: isKo ? "⚙️ 루틴 설정 및 관리" : "⚙️ Routine Manager",
            cls: "myworld-todo-modal-title-flex"
        });

        const helpBtn = headerEl.createEl("button", {
            text: "?",
            title: isKo ? "단축키 사용 설명서" : "Keyboard Shortcuts Help",
            cls: "myworld-todo-help-btn-flex"
        });

        helpBtn.addEventListener("click", () => {
            this.showHelp = !this.showHelp;
            this.render(focusedTargetId, currentScroll);
        });

        // 도움말 가이드 박스 (showHelp === true 일 때)
        if (this.showHelp) {
            const helpBox = contentEl.createDiv({ cls: "myworld-todo-help-box" });
            helpBox.createDiv({
                text: isKo ? "💡 루틴 단축키 안내" : "💡 Routine Shortcuts",
                cls: "myworld-todo-help-title"
            });
            helpBox.createDiv({
                text: isKo ? "• Alt + ↑ / ↓ : 루틴 카테고리 및 세부 항목 순서 이동" : "• Alt + ↑ / ↓ : Move routine categories or items up/down"
            });
            helpBox.createDiv({
                text: isKo ? "• 💾 [저장 및 양식 동기화] : 체크리스트 표 및 아카이브 일괄 동기화" : "• 💾 [Save & Sync Structure] : Sync all checklist tables and archives"
            });
        }

        contentEl.createEl("p", {
            text: isKo
                ? "루틴 카테고리와 세부 실행 항목을 수정합니다. 저장 시 체크리스트 및 통계 양식이 자동으로 안전하게 재구성됩니다."
                : "Modify routine categories and checklist items. Saving will safely rebuild your schedule and stats structure.",
            cls: "setting-item-description"
        });

        // 2. 확언 설정 (입력창 폭 대폭 확장)
        new Setting(contentEl)
            .setName(isKo ? "오늘의 확언 / 다짐" : "Daily Affirmation")
            .setDesc(isKo ? "루틴 콜아웃 상단에 표시될 확언 문구를 입력하세요." : "Enter affirmation text displayed at the top of the routine callout.")
            .addText(text => {
                text.inputEl.addClass("myworld-affirmation-input");
                text.setPlaceholder(isKo ? "예: 시작이 반 이다." : "e.g., Well begun is half done.")
                    .setValue(this.currentStructure.affirmation || "")
                    .onChange(val => {
                        this.currentStructure.affirmation = val;
                    });
            });

        // 3. 카테고리 및 세부 항목 리스트 헤더
        const catSectionHeader = contentEl.createDiv({ cls: "routine-modal-section-header" });
        catSectionHeader.createEl("h3", { text: isKo ? "📋 루틴 카테고리 및 실행 항목" : "📋 Routine Categories & Items" });

        const addCatBtn = catSectionHeader.createEl("button", {
            text: isKo ? "+ 새 루틴 카테고리 추가" : "+ Add Routine Category",
            cls: "mod-cta"
        });
        addCatBtn.addEventListener("click", () => {
            const scrollTop = this.getCurrentScrollTop();
            const newId = "cat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5);
            this.currentStructure.categories.push({
                id: newId,
                name: "",
                items: [""]
            });
            this.render(`input-cat-name-${newId}`, scrollTop);
        });

        // 4. 카테고리 목록 카드 렌더링
        const catListContainer = contentEl.createDiv({ cls: "routine-cat-list-container" });

        this.currentStructure.categories.forEach((cat, index) => {
            const catCard = catListContainer.createDiv({ cls: "routine-cat-card" });
            
            // 카테고리 카드 헤더 (▲/▼ 버튼 제거, Alt + ↑/↓ 단축키 전용)
            const cardHeader = catCard.createDiv({ cls: "routine-cat-card-header" });

            // 카테고리 이름 입력 input (Alt + ↑/↓ 단축키 지원)
            const nameInput = cardHeader.createEl("input", {
                type: "text",
                value: cat.name,
                placeholder: isKo ? "카테고리 이름 (예: 디톡스, 운동)" : "Category Name (e.g. Detox, Exercise)",
                cls: "routine-cat-name-input"
            });
            const catFocusId = `input-cat-name-${cat.id}`;
            nameInput.dataset.focusId = catFocusId;

            nameInput.addEventListener("input", (e) => {
                cat.name = (e.target as HTMLInputElement).value;
            });

            nameInput.addEventListener("keydown", (e: KeyboardEvent) => {
                if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                    e.preventDefault();
                    this.moveCategory(index, e.key === "ArrowUp" ? -1 : 1);
                }
            });

            // 카테고리 삭제 버튼
            const delCatBtn = cardHeader.createEl("button", {
                text: isKo ? "삭제" : "Delete",
                cls: "mod-warning"
            });
            delCatBtn.addEventListener("click", () => {
                const scrollTop = this.getCurrentScrollTop();
                this.currentStructure.categories.splice(index, 1);
                this.render(undefined, scrollTop);
            });

            // 세부 계획/가이드 입력란 (표 헤더와 분리된 설명란) + 우측 누적형 모드 인라인 토글
            const descRow = catCard.createDiv({ cls: "routine-cat-desc-row" });
            descRow.createSpan({ text: "💡", cls: "routine-cat-desc-icon" });
            const descInput = descRow.createEl("input", {
                type: "text",
                value: cat.description || "",
                placeholder: isKo ? "세부 계획 / 가이드 (예: 5분 호흡 집중, 25분 타이머)" : "Detailed Plan / Guide (e.g. 5 min breathing, 25 min timer)",
                cls: "routine-cat-desc-input"
            });
            descInput.addEventListener("input", (e) => {
                cat.description = (e.target as HTMLInputElement).value;
            });

            // 우측 인라인 누적형 토글 라벨 및 체크박스
            const cumulativeLabel = descRow.createEl("label", { cls: "routine-cat-cumulative-label" });
            cumulativeLabel.title = isKo ? "특정 항목을 누르면 이전 단계들이 한 번에 자동 체크되는 누적형 모드입니다." : "Cumulative step mode: auto-checks all preceding steps.";
            
            const cumulativeCheckbox = cumulativeLabel.createEl("input", {
                type: "checkbox",
                cls: "routine-cat-cumulative-checkbox"
            });
            cumulativeCheckbox.checked = !!cat.isCumulative;
            cumulativeCheckbox.addEventListener("change", (e) => {
                cat.isCumulative = (e.target as HTMLInputElement).checked;
            });

            cumulativeLabel.createSpan({
                text: isKo ? " 📊 누적형" : " 📊 Step",
                cls: "routine-cat-cumulative-text"
            });

            // 세부 항목(Items) 영역
            const itemsContainer = catCard.createDiv({ cls: "routine-items-container" });

            cat.items.forEach((itemText, itemIdx) => {
                const itemRow = itemsContainer.createDiv({ cls: "routine-item-row" });
                itemRow.createSpan({ text: "• ", cls: "routine-item-bullet" });

                const itemInput = itemRow.createEl("input", {
                    type: "text",
                    value: itemText,
                    placeholder: isKo ? "세부 실행 항목 (예: 1회, 스트레칭)" : "Item description",
                    cls: "routine-item-input"
                });
                const itemFocusId = `input-item-${cat.id}-${itemIdx}`;
                itemInput.dataset.focusId = itemFocusId;

                itemInput.addEventListener("input", (e) => {
                    cat.items[itemIdx] = (e.target as HTMLInputElement).value;
                });

                itemInput.addEventListener("keydown", (e: KeyboardEvent) => {
                    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                        e.preventDefault();
                        this.moveCategoryItem(index, itemIdx, e.key === "ArrowUp" ? -1 : 1);
                    }
                });

                const delItemBtn = itemRow.createEl("button", {
                    text: "✕",
                    title: isKo ? "항목 삭제" : "Delete item",
                    cls: "routine-item-del-btn"
                });
                delItemBtn.addEventListener("click", () => {
                    const scrollTop = this.getCurrentScrollTop();
                    cat.items.splice(itemIdx, 1);
                    this.render(undefined, scrollTop);
                });
            });

            // 항목 추가 버튼
            const addItemBtn = itemsContainer.createEl("button", {
                text: isKo ? "+ 세부 항목 추가" : "+ Add Item",
                cls: "routine-add-item-btn"
            });
            addItemBtn.addEventListener("click", () => {
                const scrollTop = this.getCurrentScrollTop();
                cat.items.push("");
                const newItemIdx = cat.items.length - 1;
                this.render(`input-item-${cat.id}-${newItemIdx}`, scrollTop);
            });
        });

        // 5. 하단 저장 버튼
        const footerEl = contentEl.createDiv({ cls: "routine-modal-footer" });

        const saveBtn = footerEl.createEl("button", {
            text: isKo ? "💾 저장 및 양식 동기화" : "💾 Save & Sync Structure",
            cls: "mod-cta"
        });
        saveBtn.addEventListener("click", () => {
            // 빈 카테고리명 보정 및 빈 실행 항목 정리
            for (let i = 0; i < this.currentStructure.categories.length; i++) {
                const cat = this.currentStructure.categories[i];
                if (!cat.name.trim()) {
                    cat.name = isKo ? `새 루틴 ${i + 1}` : `New Routine ${i + 1}`;
                }
                cat.items = cat.items.map(it => it.trim()).filter(it => it !== "");
                if (cat.items.length === 0) {
                    cat.items.push(isKo ? "실행" : "Execute");
                }
            }

            const diff = this.computeDiff();
            void this.onSaveCallback(this.currentStructure, diff).then(() => {
                this.close();
            });
        });

        // 6. 스크롤 위치 및 포커스 복원 제어
        window.setTimeout(() => {
            if (catListContainer) {
                catListContainer.scrollTop = currentScroll;
            }
            if (focusedTargetId) {
                const targetInput = contentEl.querySelector<HTMLInputElement>(`input[data-focus-id="${focusedTargetId}"]`);
                if (targetInput) {
                    targetInput.focus();
                    const valLen = targetInput.value.length;
                    targetInput.setSelectionRange(valLen, valLen);
                }
            }
        }, 15);
    }

    /**
     * 초기 구조 대비 변경 사항(Rename, Remove, Add) 계산
     */
    private computeDiff(): RoutineDiff {
        const renamedCategories: Record<string, string> = {};
        const removedCategories: string[] = [];
        const addedCategories: string[] = [];

        const currentCatIds = new Set(this.currentStructure.categories.map(c => c.id));

        for (const [id, origName] of this.originalCategoryNamesById.entries()) {
            if (!currentCatIds.has(id)) {
                removedCategories.push(origName);
            }
        }

        for (const cat of this.currentStructure.categories) {
            const origName = this.originalCategoryNamesById.get(cat.id);
            if (!origName) {
                addedCategories.push(cat.name);
            } else if (origName !== cat.name) {
                renamedCategories[origName] = cat.name;
            }
        }

        return {
            renamedCategories,
            removedCategories,
            addedCategories
        };
    }
}
