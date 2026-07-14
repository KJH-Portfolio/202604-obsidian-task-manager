import { App, PluginSettingTab, Setting, Notice, Modal } from "obsidian";
import MyWorldTaskManagerPlugin from "./main";
import { FolderSuggest, FileSuggest } from "./suggest";
import { t } from "./i18n";

export interface PluginSettings {
    language: "en" | "ko";
    projectDirectory: string;
    mainSchedulePath: string;
    archiveDirectory: string;
    fleetingMemoPath: string;
    templatesDirectory: string;
    statsDirectory: string;
    syncLogPath: string;
    midnightOffsetHour: number;
    syncOnStartup: boolean;
    customTemplates: {
        dailySchedule: string;
        projectNote: string;
    };
}

export const DEFAULT_SETTINGS: PluginSettings = {
    language: "en",
    projectDirectory: "1. Project",
    mainSchedulePath: "1. Project/-Main/Schedule Management.md",
    archiveDirectory: "4. Archive/98.Schedule",
    fleetingMemoPath: "5. Zettelkasten/01.Fleeting/Fleeting Memo.md",
    templatesDirectory: "3. Resource/01.Templates",
    statsDirectory: "4. Archive/99.Stats",
    syncLogPath: "0. Inbox/Automation_Note.md",
    midnightOffsetHour: 4,
    syncOnStartup: false,
    customTemplates: {
        dailySchedule: "",
        projectNote: ""
    }
};

export class MyWorldTaskManagerSettingTab extends PluginSettingTab {
    plugin: MyWorldTaskManagerPlugin;

    constructor(app: App, plugin: MyWorldTaskManagerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    // 설정 탭 새로고침 메서드 (this.display() deprecated 대체)
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
                        // Check if current values match the old language defaults, if so update them
                        if (this.plugin.settings.mainSchedulePath === t("default_main_schedule_path", oldLang)) {
                            this.plugin.settings.mainSchedulePath = t("default_main_schedule_path", value);
                        }
                        if (this.plugin.settings.projectDirectory === t("default_project_directory", oldLang)) {
                            this.plugin.settings.projectDirectory = t("default_project_directory", value);
                        }
                        if (this.plugin.settings.archiveDirectory === t("default_archive_folder", oldLang)) {
                            this.plugin.settings.archiveDirectory = t("default_archive_folder", value);
                        }
                        if (this.plugin.settings.fleetingMemoPath === t("default_fleeting_memo_path", oldLang)) {
                            this.plugin.settings.fleetingMemoPath = t("default_fleeting_memo_path", value);
                        }
                        if (this.plugin.settings.templatesDirectory === t("default_templates_folder", oldLang)) {
                            this.plugin.settings.templatesDirectory = t("default_templates_folder", value);
                        }
                        if (this.plugin.settings.syncLogPath === t("default_sync_log_path", oldLang)) {
                            this.plugin.settings.syncLogPath = t("default_sync_log_path", value);
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
            .setName(t("settings_sync_startup_name", this.plugin.settings.language))
            .setDesc(t("settings_sync_startup_desc", this.plugin.settings.language))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.syncOnStartup)
                .onChange(async (value) => {
                    this.plugin.settings.syncOnStartup = value;
                    await this.plugin.saveSettings();
                }));

        // 1. 경로 설정 섹션
        new Setting(containerEl).setName(t("settings_header_paths", this.plugin.settings.language)).setHeading();

        new Setting(containerEl)
            .setName(t("settings_projects_folder_name", this.plugin.settings.language))
            .setDesc(t("settings_projects_folder_desc", this.plugin.settings.language))
            .addText(text => {
                text.setPlaceholder(t("default_project_directory", this.plugin.settings.language))
                    .setValue(this.plugin.settings.projectDirectory)
                    .onChange(async (value) => {
                        this.plugin.settings.projectDirectory = value.trim();
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

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
            .setName(t("settings_fleeting_memo_name", this.plugin.settings.language))
            .setDesc(t("settings_fleeting_memo_desc", this.plugin.settings.language))
            .addText(text => {
                text.setPlaceholder(t("default_fleeting_memo_path", this.plugin.settings.language))
                    .setValue(this.plugin.settings.fleetingMemoPath)
                    .onChange(async (value) => {
                        this.plugin.settings.fleetingMemoPath = value.trim();
                        await this.plugin.saveSettings();
                    });
                new FileSuggest(this.app, text.inputEl);
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
            .setName(t("settings_sync_log_name", this.plugin.settings.language))
            .setDesc(t("settings_sync_log_desc", this.plugin.settings.language))
            .addText(text => {
                const defaultSyncLog = t("default_sync_log_path", this.plugin.settings.language);
                text.setPlaceholder(defaultSyncLog)
                    .setValue(this.plugin.settings.syncLogPath || defaultSyncLog)
                    .onChange(async (value) => {
                        this.plugin.settings.syncLogPath = value.trim();
                        await this.plugin.saveSettings();
                    });
                new FileSuggest(this.app, text.inputEl);
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

        new Setting(containerEl)
            .setName(t("settings_sample_create_name", this.plugin.settings.language))
            .setDesc(t("settings_sample_create_desc", this.plugin.settings.language))
            .addButton(btn => btn
                .setButtonText(t("settings_sample_create_btn", this.plugin.settings.language))
                .setCta()
                .onClick(async () => {
                    const file = await this.plugin.createNewProjectFile(t("default_sample_project_name", this.plugin.settings.language));
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

        new Setting(containerEl)
            .setName(t("settings_custom_project_name", this.plugin.settings.language))
            .setDesc(t("settings_custom_project_desc", this.plugin.settings.language))
            .addTextArea(text => text
                .setValue(this.plugin.settings.customTemplates.projectNote)
                .setPlaceholder(t("settings_custom_project_placeholder", this.plugin.settings.language))
                .onChange(async (value) => {
                    this.plugin.settings.customTemplates.projectNote = value;
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

// 부팅 시 동기화 확인 팝업
export class StartupSyncModal extends Modal {
    language: string;
    onSync: () => Promise<void>;

    constructor(app: App, language: string, onSync: () => Promise<void>) {
        super(app);
        this.language = language;
        this.onSync = onSync;
    }

    onOpen() {
        const { contentEl, modalEl } = this;
        contentEl.empty();
        modalEl.addClass("myworld-startup-modal");

        // 아이콘 + 타이틀
        const header = contentEl.createDiv({ cls: "myworld-startup-header" });
        header.createEl("div", { text: "🔄", cls: "myworld-startup-icon" });
        header.createEl("h2", { text: t("modal_startup_title", this.language), cls: "myworld-startup-title" });

        // 안내 메시지
        const desc = contentEl.createDiv({ cls: "myworld-startup-desc" });
        desc.createEl("p", { text: t("modal_startup_desc", this.language) });

        // 오늘 날짜 표시
        const today = window.moment().format("YYYY년 MM월 DD일 (ddd)");
        const dateEl = contentEl.createDiv({ cls: "myworld-startup-date" });
        dateEl.createEl("span", { text: "📅 " + today });

        // 안내 문구
        const notice = contentEl.createDiv({ cls: "myworld-startup-notice" });
        notice.createEl("span", { text: t("modal_startup_notice", this.language) });

        // 버튼 영역
        const btnArea = contentEl.createDiv({ cls: "myworld-startup-btn-area" });

        const skipBtn = btnArea.createEl("button", { text: t("btn_skip", this.language), cls: "myworld-startup-btn-skip" });
        skipBtn.addEventListener("click", () => {
            this.close();
        });

        const syncBtn = btnArea.createEl("button", { text: t("btn_sync_now", this.language), cls: "myworld-startup-btn-sync" });
        syncBtn.addEventListener("click", () => {
            void (async () => {
                syncBtn.disabled = true;
                syncBtn.textContent = t("btn_syncing", this.language);
                this.close();
                await this.onSync();
            })();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
