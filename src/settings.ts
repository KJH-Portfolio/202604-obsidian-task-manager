import { App, PluginSettingTab, Setting, Notice, Modal } from "obsidian";
import MyWorldTaskManagerPlugin from "./main";
import { FolderSuggest, FileSuggest } from "./suggest";
import { t } from "./i18n";
import { RoutineStructure } from "./types";


export interface PluginSettings {
    language: "en" | "ko";
    mainSchedulePath: string;
    archiveDirectory: string;
    templatesDirectory: string;
    scriptsDirectory: string;
    statsDirectory: string;
    midnightOffsetHour: number;
    projectDirectory: string;
    customTemplates: {
        dailySchedule: string;
    };
    routineStructure?: RoutineStructure;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    language: "ko",
    mainSchedulePath: "1. Project/01.스케줄.md",
    archiveDirectory: "4. Archive/98.Schedule",
    templatesDirectory: "3. Resource/01.Tools/Obsidian tools/01.Templater",
    scriptsDirectory: "3. Resource/01.Tools/Obsidian tools/Scripts",
    statsDirectory: "4. Archive/99.Stats",
    midnightOffsetHour: 4,
    projectDirectory: "1. Project/00.Tasks",
    customTemplates: {
        dailySchedule: ""
    }
};

export class MyWorldTaskManagerSettingTab extends PluginSettingTab {
    plugin: MyWorldTaskManagerPlugin;

    constructor(app: App, plugin: MyWorldTaskManagerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private refresh(): void {
        this.renderSettings();
    }

    display(): void {
        this.renderSettings();
    }

    private renderSettings(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl).setName(t("settings_header_general", this.plugin.settings.language)).setHeading();

        new Setting(containerEl)
            .setName(t("settings_language_name", this.plugin.settings.language))
            .setDesc(t("settings_language_desc", this.plugin.settings.language))
            .addDropdown(dropdown => {
                dropdown.addOption("en", "English");
                dropdown.addOption("ko", "한국어");
                dropdown.setValue(this.plugin.settings.language);
                dropdown.onChange(async (value: "en" | "ko") => {
                    const oldLang = this.plugin.settings.language;
                    this.plugin.settings.language = value;
                    
                    if (oldLang !== value) {
                        if (this.plugin.settings.mainSchedulePath === t("default_main_schedule_path", oldLang)) {
                            this.plugin.settings.mainSchedulePath = t("default_main_schedule_path", value);
                        }
                        if (this.plugin.settings.archiveDirectory === t("default_archive_folder", oldLang)) {
                            this.plugin.settings.archiveDirectory = t("default_archive_folder", value);
                        }

                        if (this.plugin.settings.templatesDirectory === t("default_templates_folder", oldLang)) {
                            this.plugin.settings.templatesDirectory = t("default_templates_folder", value);
                        }
                        if (this.plugin.settings.statsDirectory === t("default_stats_directory", oldLang)) {
                            this.plugin.settings.statsDirectory = t("default_stats_directory", value);
                        }
                    }

                    await this.plugin.saveSettings();
                    this.refresh();
                });
            });

        new Setting(containerEl)
            .setName(this.plugin.settings.language === "ko" ? "⚙️ 루틴 관리 및 설정" : "⚙️ Routine Manager & Structure")
            .setDesc(this.plugin.settings.language === "ko"
                ? "루틴 카테고리(루틴 이름)와 세부 실행 항목을 GUI 창에서 손쉽게 추가, 수정, 삭제합니다."
                : "Add, edit, or remove routine categories and items via user-friendly GUI modal.")
            .addButton(btn => {
                btn.setButtonText(this.plugin.settings.language === "ko" ? "루틴 편집 모달 열기" : "Open Routine Manager")
                   .setCta()
                   .onClick(async () => {
                       await this.plugin.openRoutineManagerModal();
                   });
            });

        // 1. 경로 설정 섹션
        new Setting(containerEl).setName(t("settings_header_paths", this.plugin.settings.language)).setHeading();

        new Setting(containerEl)
            .setName(t("settings_main_schedule_name", this.plugin.settings.language))
            .setDesc(t("settings_main_schedule_desc", this.plugin.settings.language))
            .addText(text => {
                text.setPlaceholder(t("default_main_schedule_path", this.plugin.settings.language))
                    .setValue(this.plugin.settings.mainSchedulePath)
                    .onChange(async (value) => {
                        this.plugin.settings.mainSchedulePath = value.trim();
                        await this.plugin.saveSettings();
                    });
                new FileSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName(t("settings_archive_folder_name", this.plugin.settings.language))
            .setDesc(t("settings_archive_folder_desc", this.plugin.settings.language))
            .addText(text => {
                text.setPlaceholder(t("default_archive_folder", this.plugin.settings.language))
                    .setValue(this.plugin.settings.archiveDirectory)
                    .onChange(async (value) => {
                        this.plugin.settings.archiveDirectory = value.trim();
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName(this.plugin.settings.language === "ko" ? "태스크 계획서 폴더 경로" : "Task Plan Directory")
            .setDesc(this.plugin.settings.language === "ko"
                ? "스케줄 노트와 연동되어 태스크 식별자(^p-1) 및 D-Day를 관리할 전용 폴더를 지정합니다."
                : "Folder path where task plan notes are stored for identifier sync and D-Day tracking.")
            .addText(text => {
                text.setPlaceholder("1. Project/00.Tasks")
                    .setValue(this.plugin.settings.projectDirectory || "1. Project/00.Tasks")
                    .onChange(async (value) => {
                        this.plugin.settings.projectDirectory = value.trim() || "1. Project/00.Tasks";
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });



        new Setting(containerEl)
            .setName(t("settings_templates_folder_name", this.plugin.settings.language))
            .setDesc(t("settings_templates_folder_desc", this.plugin.settings.language))
            .addText(text => {
                const defaultDir = t("default_templates_folder", this.plugin.settings.language);
                text.setPlaceholder(defaultDir)
                    .setValue(this.plugin.settings.templatesDirectory || defaultDir)
                    .onChange(async (value) => {
                        this.plugin.settings.templatesDirectory = value.trim();
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName(t("settings_midnight_offset_name", this.plugin.settings.language))
            .setDesc(t("settings_midnight_offset_desc", this.plugin.settings.language))
            .addText(text => {
                text.setPlaceholder("4")
                    .setValue((this.plugin.settings.midnightOffsetHour ?? 4).toString())
                    .onChange(async (value) => {
                        const num = parseInt(value.trim(), 10);
                        if (!isNaN(num) && num >= 0 && num <= 12) {
                            this.plugin.settings.midnightOffsetHour = num;
                            await this.plugin.saveSettings();
                        } else if (value.trim() === "") {
                            this.plugin.settings.midnightOffsetHour = 4;
                            await this.plugin.saveSettings();
                        }
                    });
                text.inputEl.type = "number";
                text.inputEl.min = "0";
                text.inputEl.max = "12";
            });

        // 2. 지식 관리 시스템 구축 헬퍼 섹션
        new Setting(containerEl).setName(t("settings_header_helper_para", this.plugin.settings.language)).setHeading();

        new Setting(containerEl)
            .setName(t("settings_para_create_name", this.plugin.settings.language))
            .setDesc(t("settings_para_create_desc", this.plugin.settings.language))
            .addButton(btn => btn
                .setButtonText(t("settings_para_create_btn", this.plugin.settings.language))
                .setCta()
                .onClick(async () => {
                    new ConfirmModal(this.app, t("confirm_para_create", this.plugin.settings.language).replace(/\\n/g, "\n"), this.plugin.settings.language, async () => {
                        try {
                            const count = await this.plugin.templateHelper.setupParaStructure();
                            if (count > 0) {
                                new Notice(t("notice_para_created", this.plugin.settings.language, { count: count }));
                            } else {
                                new Notice(t("notice_para_exists", this.plugin.settings.language));
                            }
                        } catch (err) {
                            console.error(err);
                            new Notice(t("notice_para_error", this.plugin.settings.language));
                        }
                    }).open();
                }));

        new Setting(containerEl)
            .setName(t("settings_zettel_create_name", this.plugin.settings.language))
            .setDesc(t("settings_zettel_create_desc", this.plugin.settings.language))
            .addButton(btn => btn
                .setButtonText(t("settings_zettel_create_btn", this.plugin.settings.language))
                .setCta()
                .onClick(async () => {
                    new ConfirmModal(this.app, t("confirm_zettel_create", this.plugin.settings.language).replace(/\\n/g, "\n"), this.plugin.settings.language, async () => {
                        try {
                            const count = await this.plugin.templateHelper.setupZettelkastenStructure();
                            if (count > 0) {
                                new Notice(t("notice_zettel_created", this.plugin.settings.language, { count: count }));
                            } else {
                                new Notice(t("notice_zettel_exists", this.plugin.settings.language));
                            }
                        } catch (err) {
                            console.error(err);
                            new Notice(t("notice_zettel_error", this.plugin.settings.language));
                        }
                    }).open();
                }));

        // 3. 기본 환경 및 파일 생성 헬퍼 섹션
        new Setting(containerEl).setName(t("settings_header_helper_file", this.plugin.settings.language)).setHeading();

        new Setting(containerEl)
            .setName(t("settings_template_create_name", this.plugin.settings.language))
            .setDesc(t("settings_template_create_desc", this.plugin.settings.language))
            .addButton(btn => btn
                .setButtonText(t("settings_template_create_btn", this.plugin.settings.language))
                .setCta()
                .onClick(() => {
                    const defaultDir = this.plugin.settings.templatesDirectory || "3. Resource/01.Templates";
                    new TemplatePathModal(this.app, defaultDir, this.plugin.settings.language, async (resultPath) => {
                        try {
                            await this.plugin.templateHelper.createDefaultTemplatesFolderAndFiles(resultPath);
                            this.plugin.settings.templatesDirectory = resultPath;
                            await this.plugin.saveSettings();
                            this.refresh();
                            new Notice(t("notice_template_created", this.plugin.settings.language, { resultPath: resultPath }));
                        } catch (err) {
                            console.error(err);
                            new Notice(t("notice_template_error", this.plugin.settings.language));
                        }
                    }).open();
                }));

        new Setting(containerEl)
            .setName(t("settings_schedule_create_name", this.plugin.settings.language))
            .setDesc(t("settings_schedule_create_desc", this.plugin.settings.language))
            .addButton(btn => btn
                .setButtonText(t("settings_schedule_create_btn", this.plugin.settings.language))
                .setCta()
                .onClick(async () => {
                    const file = await this.plugin.createTodayScheduleFile();
                    if (file) {
                        // Notice is handled internally
                    }
                }));


        // 4. 커스텀 템플릿 에디터 섹션
        new Setting(containerEl).setName(t("settings_header_custom_templates", this.plugin.settings.language)).setHeading();

        new Setting(containerEl)
            .setName(t("settings_custom_daily_name", this.plugin.settings.language))
            .setDesc(t("settings_custom_daily_desc", this.plugin.settings.language))
            .addTextArea(text => text
                .setValue(this.plugin.settings.customTemplates.dailySchedule)
                .setPlaceholder(t("settings_custom_daily_placeholder", this.plugin.settings.language))
                .onChange(async (value) => {
                    this.plugin.settings.customTemplates.dailySchedule = value;
                    await this.plugin.saveSettings();
                }));


        // 5. 설정 초기화 섹션
        new Setting(containerEl).setName(t("settings_header_danger_zone", this.plugin.settings.language)).setHeading();
        new Setting(containerEl)
            .setName(t("settings_reset_name", this.plugin.settings.language))
            .setDesc(t("settings_reset_desc", this.plugin.settings.language))
            .addButton(btn => {
                btn.setButtonText(t("settings_reset_btn", this.plugin.settings.language));
                btn.buttonEl.addClass("mod-warning");
                btn.onClick(async () => {
                        new ConfirmModal(this.app, t("confirm_reset", this.plugin.settings.language), this.plugin.settings.language, async () => {
                            this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
                            await this.plugin.saveSettings();
                            this.refresh();
                            new Notice(t("notice_reset_complete", this.plugin.settings.language));
                        }).open();
                });
            });

        // 6. 지원 및 피드백 섹션
        new Setting(containerEl).setName(t("settings_header_support", this.plugin.settings.language)).setHeading();
        new Setting(containerEl)
            .setName(t("settings_support_name", this.plugin.settings.language))
            .setDesc(t("settings_support_desc", this.plugin.settings.language))
            .addButton(btn => {
                btn.setButtonText(t("settings_support_btn", this.plugin.settings.language));
                btn.onClick(() => {
                    window.open("https://github.com/KJH-Portfolio/202604-obsidian-task-manager/issues");
                });
            });

        // 7. 필수 플러그인 안내 섹션
        new Setting(containerEl).setName(t("settings_header_plugins", this.plugin.settings.language)).setHeading();
        new Setting(containerEl)
            .setName(t("settings_plugins_name", this.plugin.settings.language))
            .setDesc(t("settings_plugins_desc", this.plugin.settings.language))
            .addButton(btn => {
                btn.setButtonText(t("settings_plugins_btn", this.plugin.settings.language));
                btn.onClick(() => {
                    new EssentialPluginsModal(this.app, this.plugin.settings.language).open();
                });
            });

        let isNoticeVisible = false;
        const toggleBtnSetting = new Setting(containerEl)
            .setName(t("settings_notice_toggle_name", this.plugin.settings.language))
            .setDesc(t("settings_notice_toggle_desc", this.plugin.settings.language));

        // --- 📢 공지 및 업데이트 정보 (토글 컨텐츠) ---
        const noticeEl = containerEl.createDiv();
        noticeEl.hide(); // 초기 상태는 숨김

        new Setting(noticeEl).setName(t("settings_notice_update_title", this.plugin.settings.language)).setHeading();
        new Setting(noticeEl).setDesc(t("settings_notice_update_content", this.plugin.settings.language));

        new Setting(noticeEl).setName(t("settings_notice_dev_title", this.plugin.settings.language)).setHeading();
        new Setting(noticeEl).setDesc(t("settings_notice_dev_content", this.plugin.settings.language));

        toggleBtnSetting.addButton(btn => {
            btn.setButtonText(t("btn_show_content", this.plugin.settings.language));
            btn.onClick(() => {
                isNoticeVisible = !isNoticeVisible;
                if (isNoticeVisible) {
                    noticeEl.show();
                    btn.setButtonText(t("btn_hide_content", this.plugin.settings.language));
                } else {
                    noticeEl.hide();
                    btn.setButtonText(t("btn_show_content", this.plugin.settings.language));
                }
            });
        });
    }
}

export class EssentialPluginsModal extends Modal {
    language: string;

    constructor(app: App, language: string) {
        super(app);
        this.language = language;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl("h2", { text: t("modal_plugins_title", this.language) });
        
        const descDiv = contentEl.createDiv();
        const descText = t("modal_plugins_desc", this.language);
        
        // Split by newlines to render properly
        descText.split("\n").forEach(line => {
            if (line.trim() === "") {
                descDiv.createEl("br");
            } else {
                descDiv.createEl("p", { text: line, cls: "myworld-plugin-desc-line" });
            }
        });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText("Close")
                .onClick(() => {
                    this.close();
                })
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class TemplatePathModal extends Modal {
    language: string;
    resultPath: string;
    onSubmit: (path: string) => Promise<void>;

    constructor(app: App, defaultPath: string, language: string, onSubmit: (path: string) => Promise<void>) {
        super(app);
        this.language = language;
        this.resultPath = defaultPath;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: t("modal_template_path_title", this.language) });
        contentEl.createEl("p", { text: t("modal_template_path_desc", this.language).replace(/\\n/g, "\n") });

        new Setting(contentEl)
            .setName(t("modal_template_path_label", this.language))
            .addText(text => {
                text.setPlaceholder(t("default_templates_folder", this.language))
                    .setValue(this.resultPath)
                    .onChange(value => {
                        this.resultPath = value.trim();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(t("btn_create", this.language))
                .setCta()
                .onClick(async () => {
                    if (!this.resultPath) {
                        new Notice(t("notice_empty_path", this.language));
                        return;
                    }
                    this.close();
                    await this.onSubmit(this.resultPath);
                })
            )
            .addButton(btn => btn
                .setButtonText(t("btn_cancel", this.language))
                .onClick(() => {
                    this.close();
                })
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class ConfirmModal extends Modal {
    language: string;
    message: string;
    onConfirm: () => Promise<void>;

    constructor(app: App, message: string, language: string, onConfirm: () => Promise<void>) {
        super(app);
        this.language = language;
        this.message = message;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("p", { text: this.message });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(t("btn_confirm", this.language))
                .setCta()
                .onClick(async () => {
                    this.close();
                    await this.onConfirm();
                })
            )
            .addButton(btn => btn
                .setButtonText(t("btn_cancel", this.language))
                .onClick(() => {
                    this.close();
                })
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
