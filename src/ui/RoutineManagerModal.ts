import { App, Modal, Setting } from "obsidian";
import { RoutineStructure, RoutineDiff } from "../types";


export class RoutineManagerModal extends Modal {
    private initialStructure: RoutineStructure;
    private currentStructure: RoutineStructure;
    private language: "en" | "ko";
    private onSaveCallback: (newStructure: RoutineStructure, diff: RoutineDiff) => Promise<void>;

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

    private render() {
        const { contentEl } = this;
        contentEl.empty();

        const isKo = this.language === "ko";

        // Title
        contentEl.createEl("h2", { text: isKo ? "⚙️ 루틴 설정 및 관리" : "⚙️ Routine Manager" });
        contentEl.createEl("p", {
            text: isKo
                ? "루틴 카테고리와 세부 실행 항목을 수정합니다. 저장 시 체크리스트 및 통계 양식이 자동으로 안전하게 재구성됩니다."
                : "Modify routine categories and checklist items. Saving will safely rebuild your schedule and stats structure.",
            cls: "setting-item-description"
        });

        // 1. 확언 설정
        new Setting(contentEl)
            .setName(isKo ? "오늘의 확언 / 다짐" : "Daily Affirmation")
            .setDesc(isKo ? "루틴 콜아웃 상단에 표시될 확언 문구를 입력하세요." : "Enter affirmation text displayed at the top of the routine callout.")
            .addText(text => {
                text.setPlaceholder(isKo ? "예: 시작이 반 이다." : "e.g., Well begun is half done.")
                    .setValue(this.currentStructure.affirmation || "")
                    .onChange(val => {
                        this.currentStructure.affirmation = val;
                    });
            });

        // 2. 카테고리 및 세부 항목 리스트 헤더
        const catSectionHeader = contentEl.createDiv({ cls: "routine-modal-section-header" });
        catSectionHeader.createEl("h3", { text: isKo ? "📋 루틴 카테고리 및 실행 항목" : "📋 Routine Categories & Items" });

        const addCatBtn = catSectionHeader.createEl("button", {
            text: isKo ? "+ 새 루틴 카테고리 추가" : "+ Add Routine Category",
            cls: "mod-cta"
        });
        addCatBtn.addEventListener("click", () => {
            const newId = "cat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5);
            const defaultName = isKo ? `새 루틴 ${this.currentStructure.categories.length + 1}` : `New Routine ${this.currentStructure.categories.length + 1}`;
            this.currentStructure.categories.push({
                id: newId,
                name: defaultName,
                items: [isKo ? "실행 항목 1" : "Item 1"]
            });
            this.render();
        });

        // 3. 카테고리 목록 카드 렌더링
        const catListContainer = contentEl.createDiv({ cls: "routine-cat-list-container" });

        this.currentStructure.categories.forEach((cat, index) => {
            const catCard = catListContainer.createDiv({ cls: "routine-cat-card" });
            
            // 카테고리 카드 헤더
            const cardHeader = catCard.createDiv({ cls: "routine-cat-card-header" });

            // 순서 이동 버튼
            const moveUpBtn = cardHeader.createEl("button", { text: "▲", title: isKo ? "위로 이동" : "Move Up" });
            moveUpBtn.disabled = index === 0;
            moveUpBtn.addEventListener("click", () => {
                const temp = this.currentStructure.categories[index - 1];
                this.currentStructure.categories[index - 1] = this.currentStructure.categories[index];
                this.currentStructure.categories[index] = temp;
                this.render();
            });

            const moveDownBtn = cardHeader.createEl("button", { text: "▼", title: isKo ? "아래로 이동" : "Move Down" });
            moveDownBtn.disabled = index === this.currentStructure.categories.length - 1;
            moveDownBtn.addEventListener("click", () => {
                const temp = this.currentStructure.categories[index + 1];
                this.currentStructure.categories[index + 1] = this.currentStructure.categories[index];
                this.currentStructure.categories[index] = temp;
                this.render();
            });

            // 카테고리 이름 입력 input
            const nameInput = cardHeader.createEl("input", {
                type: "text",
                value: cat.name,
                placeholder: isKo ? "카테고리 이름" : "Category Name",
                cls: "routine-cat-name-input"
            });
            nameInput.addEventListener("input", (e) => {
                cat.name = (e.target as HTMLInputElement).value;
            });

            // 카테고리 삭제 버튼
            const delCatBtn = cardHeader.createEl("button", {
                text: isKo ? "삭제" : "Delete",
                cls: "mod-warning"
            });
            delCatBtn.addEventListener("click", () => {
                this.currentStructure.categories.splice(index, 1);
                this.render();
            });

            // 세부 항목(Items) 영역
            const itemsContainer = catCard.createDiv({ cls: "routine-items-container" });

            cat.items.forEach((itemText, itemIdx) => {
                const itemRow = itemsContainer.createDiv({ cls: "routine-item-row" });
                itemRow.createSpan({ text: "• ", cls: "routine-item-bullet" });

                const itemInput = itemRow.createEl("input", {
                    type: "text",
                    value: itemText,
                    placeholder: isKo ? "세부 실행 항목" : "Item description",
                    cls: "routine-item-input"
                });
                itemInput.addEventListener("input", (e) => {
                    cat.items[itemIdx] = (e.target as HTMLInputElement).value;
                });

                const delItemBtn = itemRow.createEl("button", {
                    text: "✕",
                    title: isKo ? "항목 삭제" : "Delete item",
                    cls: "routine-item-del-btn"
                });
                delItemBtn.addEventListener("click", () => {
                    cat.items.splice(itemIdx, 1);
                    this.render();
                });
            });

            // 항목 추가 버튼
            const addItemBtn = itemsContainer.createEl("button", {
                text: isKo ? "+ 세부 항목 추가" : "+ Add Item",
                cls: "routine-add-item-btn"
            });
            addItemBtn.addEventListener("click", () => {
                cat.items.push(isKo ? "새 실행 항목" : "New Item");
                this.render();
            });
        });

        // 4. 하단 저장 버튼
        const footerEl = contentEl.createDiv({ cls: "routine-modal-footer" });

        const saveBtn = footerEl.createEl("button", {
            text: isKo ? "💾 저장 및 양식 동기화" : "💾 Save & Sync Structure",
            cls: "mod-cta"
        });
        saveBtn.addEventListener("click", () => {
            const diff = this.computeDiff();
            void this.onSaveCallback(this.currentStructure, diff).then(() => {
                this.close();
            });
        });
    }

    /**
     * 초기 구조 대비 변경 사항(Rename, Remove, Add) 계산
     */
    private computeDiff(): RoutineDiff {
        const renamedCategories: Record<string, string> = {};
        const removedCategories: string[] = [];
        const addedCategories: string[] = [];

        const currentCatIds = new Set(this.currentStructure.categories.map(c => c.id));

        // 삭제된 카테고리
        for (const [id, origName] of this.originalCategoryNamesById.entries()) {
            if (!currentCatIds.has(id)) {
                removedCategories.push(origName);
            }
        }

        // 개명 및 추가된 카테고리
        for (const cat of this.currentStructure.categories) {
            const origName = this.originalCategoryNamesById.get(cat.id);
            if (origName) {
                if (origName !== cat.name) {
                    renamedCategories[origName] = cat.name;
                }
            } else {
                addedCategories.push(cat.name);
            }
        }

        return {
            renamedCategories,
            removedCategories,
            addedCategories
        };
    }
}
