import { App, PluginSettingTab, Setting, Notice, Modal } from "obsidian";
import MyWorldTaskManagerPlugin from "./main";
import { FolderSuggest, FileSuggest } from "./suggest";

export interface PluginSettings {
    projectDirectory: string;
    mainSchedulePath: string;
    archiveDirectory: string;
    fleetingMemoPath: string;
    templatesDirectory: string;
    midnightOffsetHour: number;
    customTemplates: {
        dailySchedule: string;
        projectNote: string;
    };
}

export const DEFAULT_SETTINGS: PluginSettings = {
    projectDirectory: "1. Project",
    mainSchedulePath: "1. Project/-Main/스케줄 관리.md",
    archiveDirectory: "4. Archive/98.Schedule",
    fleetingMemoPath: "5. Zettelkasten/01.Fleeting/임시 메모.md",
    templatesDirectory: "3. Resource/01.Templates",
    midnightOffsetHour: 4,
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

        // --- 📢 공지 및 업데이트 정보 시작 ---
        const noticeEl = containerEl.createDiv({ attr: { style: "padding: 15px; background-color: var(--background-secondary); border-left: 4px solid var(--color-accent); border-radius: 6px; margin-bottom: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);" }});
        
        noticeEl.createEl("h3", { text: "✨ 최근 업데이트", attr: { style: "margin-top: 0; margin-bottom: 10px; color: var(--text-accent);" }});
        noticeEl.createEl("p", { text: "- 현재 지속적으로 기능 개선 및 개발이 진행 중인 단계입니다.", attr: { style: "white-space: pre-wrap; margin-bottom: 15px; font-size: 0.95em; line-height: 1.5;" }});
        
        noticeEl.createEl("h4", { text: "💬 개발자 코멘트", attr: { style: "margin-bottom: 8px; margin-top: 0;" }});
        noticeEl.createEl("p", { text: "이 플러그인은 현재 개발 중인 단계입니다. 추후 필요 시 영어 버전(English Version)을 추가할 계획을 가지고 있습니다.", attr: { style: "font-style: italic; color: var(--text-muted); margin: 0; font-size: 0.9em;" }});
        // --- 📢 공지 및 업데이트 정보 끝 ---

        new Setting(containerEl).setName("일반 설정").setHeading();

        // 1. 경로 설정 섹션
        new Setting(containerEl).setName("1. 경로 설정").setHeading();
        
        new Setting(containerEl)
            .setName("프로젝트 폴더 경로")
            .setDesc("프로젝트 계획서 노트들이 보관될 폴더 경로를 지정하세요.")
            .addText(text => {
                text.setPlaceholder("1. Project")
                    .setValue(this.plugin.settings.projectDirectory)
                    .onChange(async (value) => {
                        this.plugin.settings.projectDirectory = value.trim();
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName("메인 스케줄 노트 경로")
            .setDesc("루틴과 통합 대시보드가 들어간 일일 스케줄 파일 경로를 지정하세요.")
            .addText(text => {
                text.setPlaceholder("1. Project/-Main/스케줄 관리.md")
                    .setValue(this.plugin.settings.mainSchedulePath)
                    .onChange(async (value) => {
                        this.plugin.settings.mainSchedulePath = value.trim();
                        await this.plugin.saveSettings();
                    });
                new FileSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName("아카이브 루트 폴더 경로")
            .setDesc("주간/월간 통계 및 일지 노트가 자동 생성되고 누적될 아카이브 폴더 경로를 지정하세요.")
            .addText(text => {
                text.setPlaceholder("4. Archive/98.Schedule")
                    .setValue(this.plugin.settings.archiveDirectory)
                    .onChange(async (value) => {
                        this.plugin.settings.archiveDirectory = value.trim();
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName("임시 메모 파일 경로")
            .setDesc("메인 스케줄의 📋 버튼 클릭 시 생성되고 열릴 임시 메모 마크다운 파일 경로를 지정하세요.")
            .addText(text => {
                text.setPlaceholder("5. Zettelkasten/01.Fleeting/임시 메모.md")
                    .setValue(this.plugin.settings.fleetingMemoPath)
                    .onChange(async (value) => {
                        this.plugin.settings.fleetingMemoPath = value.trim();
                        await this.plugin.saveSettings();
                    });
                new FileSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName("템플릿 폴더 경로")
            .setDesc("플러그인용 기본 템플릿 노트(데일리 스케줄, 프로젝트 계획서)가 보존될 폴더 경로를 지정하세요.")
            .addText(text => {
                text.setPlaceholder("3. Resource/01.Templates")
                    .setValue(this.plugin.settings.templatesDirectory || "3. Resource/01.Templates")
                    .onChange(async (value) => {
                        this.plugin.settings.templatesDirectory = value.trim();
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName("자정 보정 기준 시간")
            .setDesc("새벽 몇 시 이전까지의 마감 실행을 전날 날짜의 기록으로 취급할지 지정합니다. (0~12시)")
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
        new Setting(containerEl).setName("2. 지식 관리 시스템 구축 헬퍼 (PARA & 제텔카스텐)").setHeading();

        new Setting(containerEl)
            .setName("PARA 구조 생성")
            .setDesc("보관소 루트에 PARA 지식 관리 시스템(0. Inbox, 1. Project, 2. Area, 3. Resource, 4. Archive, 10.File) 구조와 폴더별 설명서를 자동 생성합니다.")
            .addButton(btn => btn
                .setButtonText("PARA 구조 생성")
                .setCta()
                .onClick(async () => {
                    new ConfirmModal(this.app, "정말 PARA 지식 관리 폴더 구조를 보관소 최상단에 일괄 생성하시겠습니까?\n(이미 존재하는 폴더는 안전하게 건너뜁니다.)", async () => {
                        try {
                            const count = await this.plugin.templateHelper.setupParaStructure();
                            if (count > 0) {
                                new Notice(`✅ PARA 시스템 폴더/설명서 ${count}개가 신규 생성되었습니다!`);
                            } else {
                                new Notice("✅ 이미 모든 PARA 구조가 존재하여 파일 생성을 건너뛰었습니다.");
                            }
                        } catch (err) {
                            console.error(err);
                            new Notice("🚨 PARA 시스템 구조 생성 중 오류가 발생했습니다.");
                        }
                    }).open();
                }));

        new Setting(containerEl)
            .setName("제텔카스텐 구조 생성")
            .setDesc("보관소 루트에 제텔카스텐 지식 관리 시스템(5. Zettelkasten 및 하위 Fleeting, Literature, Permanent 폴더) 구조와 폴더별 설명서를 자동 생성합니다.")
            .addButton(btn => btn
                .setButtonText("제텔카스텐 구조 생성")
                .setCta()
                .onClick(async () => {
                    new ConfirmModal(this.app, "정말 제텔카스텐 지식 관리 폴더 구조를 보관소 최상단에 일괄 생성하시겠습니까?\n(이미 존재하는 폴더는 안전하게 건너뜁니다.)", async () => {
                        try {
                            const count = await this.plugin.templateHelper.setupZettelkastenStructure();
                            if (count > 0) {
                                new Notice(`✅ 제텔카스텐 폴더/설명서 ${count}개가 신규 생성되었습니다!`);
                            } else {
                                new Notice("✅ 이미 모든 제텔카스텐 구조가 존재하여 파일 생성을 건너뛰었습니다.");
                            }
                        } catch (err) {
                            console.error(err);
                            new Notice("🚨 제텔카스텐 구조 생성 중 오류가 발생했습니다.");
                        }
                    }).open();
                }));

        // 3. 기본 환경 및 파일 생성 헬퍼 섹션
        new Setting(containerEl).setName("3. 기본 환경 및 파일 생성 헬퍼").setHeading();

        new Setting(containerEl)
            .setName("기본 템플릿 노트 생성")
            .setDesc("원하는 보관소 내 폴더 경로를 입력받아 플러그인용 기본 노트 양식 2종(데일리 스케줄/프로젝트 계획서)을 자동으로 생성합니다.")
            .addButton(btn => btn
                .setButtonText("템플릿 생성 실행")
                .setCta()
                .onClick(() => {
                    const defaultDir = this.plugin.settings.templatesDirectory || "3. Resource/01.Templates";
                    new TemplatePathModal(this.app, defaultDir, async (resultPath) => {
                        try {
                            await this.plugin.templateHelper.createDefaultTemplatesFolderAndFiles(resultPath);
                            this.plugin.settings.templatesDirectory = resultPath;
                            await this.plugin.saveSettings();
                            this.refresh();
                            new Notice(`✅ ${resultPath} 하위에 기본 템플릿 파일들이 생성되었습니다!`);
                        } catch (err) {
                            console.error(err);
                            new Notice("🚨 템플릿 파일 생성 중 오류가 발생했습니다.");
                        }
                    }).open();
                }));

        new Setting(containerEl)
            .setName("스케줄 관리 노트 생성")
            .setDesc("설정된 '메인 스케줄 노트 경로'에 오늘 날짜 기반의 루틴 스케줄 노트를 즉시 자동 생성합니다.")
            .addButton(btn => btn
                .setButtonText("스케줄 생성 실행")
                .setCta()
                .onClick(async () => {
                    const file = await this.plugin.createTodayScheduleFile();
                    if (file) {
                        new Notice("✅ 스케줄 관리 노트가 생성되었습니다!");
                    }
                }));

        new Setting(containerEl)
            .setName("샘플 프로젝트 노트 생성")
            .setDesc("설정된 '프로젝트 폴더 경로' 하위에 기본 '샘플 프로젝트.md' 관리 문서를 즉시 자동 생성합니다.")
            .addButton(btn => btn
                .setButtonText("샘플 생성 실행")
                .setCta()
                .onClick(async () => {
                    const file = await this.plugin.createNewProjectFile("샘플 프로젝트");
                    if (file) {
                        new Notice("✅ 샘플 프로젝트 노트가 생성되었습니다!");
                    }
                }));

        // 4. 커스텀 템플릿 에디터 섹션
        new Setting(containerEl).setName("4. 커스텀 노트 템플릿 본문 정의").setHeading();
        
        new Setting(containerEl)
            .setName("커스텀 데일리 스케줄 템플릿")
            .setDesc("데일리 스케줄 노트 생성 시 활용될 커스텀 본문 양식을 입력하세요 (비워두면 기본 내장 양식 사용).")
            .addTextArea(text => text
                .setValue(this.plugin.settings.customTemplates.dailySchedule)
                .setPlaceholder("{{date}}, {{time}}, {{currentDay}} 등의 플레이스홀더를 사용할 수 있습니다.")
                .onChange(async (value) => {
                    this.plugin.settings.customTemplates.dailySchedule = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("커스텀 프로젝트 노트 템플릿")
            .setDesc("신규 프로젝트 노트 생성 시 활용될 커스텀 본문 양식을 입력하세요 (비워두면 기본 내장 양식 사용).")
            .addTextArea(text => text
                .setValue(this.plugin.settings.customTemplates.projectNote)
                .setPlaceholder("{{projectName}} 등의 플레이스홀더를 사용할 수 있습니다.")
                .onChange(async (value) => {
                    this.plugin.settings.customTemplates.projectNote = value;
                    await this.plugin.saveSettings();
                }));

        // 5. 설정 초기화 섹션
        new Setting(containerEl).setName("5. 설정 초기화").setHeading();
        new Setting(containerEl)
            .setName("설정값 초기화")
            .setDesc("플러그인의 모든 설정을 기본값으로 되돌립니다. (주의: 기존 설정 정보가 소실되며, 되돌릴 수 없습니다.)")
            .addButton(btn => {
                btn.setButtonText("초기화 실행");
                btn.buttonEl.addClass("mod-warning");
                btn.onClick(async () => {
                        new ConfirmModal(this.app, "정말로 모든 설정값을 초기 상태로 되돌리시겠습니까?", async () => {
                            this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
                            await this.plugin.saveSettings();
                            this.refresh();
                            new Notice("✅ 모든 설정값이 초기화되었습니다!");
                        }).open();
                });
            });

        // 6. 지원 및 피드백 섹션
        new Setting(containerEl).setName("6. 지원 및 피드백").setHeading();
        new Setting(containerEl)
            .setName("버그 제보 및 기능 제안")
            .setDesc("플러그인 사용 중 문제가 발생했거나 새로운 기능이 필요하다면 GitHub 이슈를 통해 알려주세요.")
            .addButton(btn => {
                btn.setButtonText("GitHub 이슈로 이동");
                btn.onClick(() => {
                    window.open("https://github.com/KJH-Portfolio/202604-obsidian-task-manager/issues");
                });
            });
    }
}

export class TemplatePathModal extends Modal {
    resultPath: string;
    onSubmit: (path: string) => Promise<void>;

    constructor(app: App, defaultPath: string, onSubmit: (path: string) => Promise<void>) {
        super(app);
        this.resultPath = defaultPath;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl("h2", { text: "템플릿 노트 생성 위치 지정" });
        contentEl.createEl("p", { text: "기본 템플릿 노트(데일리 스케줄, 프로젝트 계획서)를 생성할 폴더의 보관소(Vault) 기준 상대 경로를 입력하세요. (예: 3. Resource/01.Templates)\n폴더가 없는 경우 자동으로 생성됩니다." });

        new Setting(contentEl)
            .setName("생성 폴더 경로")
            .addText(text => {
                text.setPlaceholder("3. Resource/01.Templates")
                    .setValue(this.resultPath)
                    .onChange(value => {
                        this.resultPath = value.trim();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText("생성하기")
                .setCta()
                .onClick(async () => {
                    if (!this.resultPath) {
                        new Notice("🚨 생성할 폴더 경로를 입력해 주세요.");
                        return;
                    }
                    this.close();
                    await this.onSubmit(this.resultPath);
                })
            )
            .addButton(btn => btn
                .setButtonText("취소")
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
    message: string;
    onConfirm: () => Promise<void>;

    constructor(app: App, message: string, onConfirm: () => Promise<void>) {
        super(app);
        this.message = message;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl("p", { text: this.message });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText("확인")
                .setCta()
                .onClick(async () => {
                    this.close();
                    await this.onConfirm();
                })
            )
            .addButton(btn => btn
                .setButtonText("취소")
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
