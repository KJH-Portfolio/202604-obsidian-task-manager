import { App, Modal } from "obsidian";
import { t } from "../i18n";

export class MonthlyTransitionModal extends Modal {
    private language: string;
    private prevMonthStr: string;
    private currentMonthStr: string;
    private onConfirm: () => Promise<void> | void;
    private onLater: () => void;

    constructor(
        app: App,
        language: string,
        prevMonthStr: string,
        currentMonthStr: string,
        onConfirm: () => Promise<void> | void,
        onLater: () => void
    ) {
        super(app);
        this.language = language;
        this.prevMonthStr = prevMonthStr;
        this.currentMonthStr = currentMonthStr;
        this.onConfirm = onConfirm;
        this.onLater = onLater;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.addClass("myworld-startup-modal");

        const container = contentEl.createDiv({ cls: "modal-content" });

        // Header
        const header = container.createDiv({ cls: "myworld-startup-header" });
        const iconSpan = header.createSpan({ text: "🗓️", cls: "myworld-startup-icon" });
        iconSpan.style.fontSize = "2.2em";

        const titleBox = header.createDiv();
        const isKo = this.language === "ko";
        const titleText = isKo 
            ? `새로운 달(${this.currentMonthStr})이 시작되었습니다!` 
            : `New Month (${this.currentMonthStr}) Has Started!`;
        titleBox.createEl("h3", { text: titleText, cls: "myworld-startup-title" });
        
        const subTitle = isKo 
            ? `지난달(${this.prevMonthStr}) 체크리스트 아카이빙 안내` 
            : `Archiving guide for previous month (${this.prevMonthStr})`;
        titleBox.createDiv({ text: subTitle, cls: "myworld-startup-subtitle" });

        // Description Card
        const descCard = container.createDiv({ cls: "myworld-project-overview-card" });
        descCard.style.padding = "12px 14px";
        descCard.style.margin = "8px 0";

        const descP = descCard.createEl("p", { 
            text: t("modal_monthly_transition_desc", this.language),
            cls: "myworld-margin-0" 
        });
        descP.style.lineHeight = "1.5";
        descP.style.fontSize = "0.95em";

        const detailNote = descCard.createEl("p", {
            text: isKo 
                ? "💡 [아카이브 후 비우기]를 누르면 지난달 통계가 월간 아카이브에 영구 저장되고, 스케줄 노트 표가 새 달(1일~말일)을 위해 깨끗하게 비워집니다."
                : "💡 Clicking [Archive & Reset] will permanently save previous stats to monthly archives and clear the schedule checklist for the new month.",
            cls: "myworld-text-muted-sm"
        });
        detailNote.style.marginTop = "8px";

        // Button Container
        const btnContainer = container.createDiv({ cls: "myworld-flex-between" });
        btnContainer.style.marginTop = "14px";
        btnContainer.style.display = "flex";
        btnContainer.style.justifyContent = "flex-end";
        btnContainer.style.gap = "10px";

        const btnLater = btnContainer.createEl("button", { 
            text: t("modal_monthly_transition_btn_later", this.language) 
        });
        btnLater.addClass("myworld-cal-foot-btn");
        btnLater.style.padding = "8px 16px";
        btnLater.addEventListener("click", () => {
            this.close();
            this.onLater();
        });

        const btnConfirm = btnContainer.createEl("button", { 
            text: t("modal_monthly_transition_btn_confirm", this.language) 
        });
        btnConfirm.addClass("mod-cta");
        btnConfirm.style.padding = "8px 20px";
        btnConfirm.style.fontWeight = "600";
        btnConfirm.addEventListener("click", async () => {
            this.close();
            await this.onConfirm();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
