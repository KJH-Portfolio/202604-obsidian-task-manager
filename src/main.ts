/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
import { Plugin, TFile, Notice, Modal, Setting, App, moment } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS, MyWorldTaskManagerSettingTab } from "./settings";
import { TaskUtils } from "./TaskUtils";
import { Synchronizer } from "./Synchronizer";
import { ResetManager } from "./ResetManager";
import { TemplateHelper } from "./TemplateHelper";

// 1. 빠른 할 일 캡처 모달
class QuickCaptureModal extends Modal {
    content: string;
    onSubmit: (content: string) => void;

    constructor(app: App, onSubmit: (content: string) => void) {
        super(app);
        this.content = "";
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: "✏️ 빠른 할 일 등록" });

        new Setting(contentEl)
            .setName("할 일 내용")
            .setDesc("메인 스케줄 노트의 할 일 목록에 추가할 내용을 입력하세요.")
            .addText(text => text
                .setPlaceholder("예: 물 2L 마시기")
                .onChange(value => this.content = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText("추가")
                .setCta()
                .onClick(() => {
                    if (this.content.trim() === "") {
                        new Notice("내용을 입력해주세요.");
                        return;
                    }
                    this.close();
                    this.onSubmit(this.content.trim());
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 2. 새 프로젝트 생성 모달
class CreateProjectModal extends Modal {
    projectName: string;
    onSubmit: (projectName: string) => void;

    constructor(app: App, onSubmit: (projectName: string) => void) {
        super(app);
        this.projectName = "";
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: "🚀 새 프로젝트 생성" });

        new Setting(contentEl)
            .setName("프로젝트명")
            .setDesc("생성할 프로젝트 노트의 제목을 입력하세요.")
            .addText(text => text
                .setPlaceholder("예: 파이썬 웹 크롤러 개발")
                .onChange(value => this.projectName = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText("프로젝트 생성")
                .setCta()
                .onClick(() => {
                    if (this.projectName.trim() === "") {
                        new Notice("프로젝트명을 입력해주세요.");
                        return;
                    }
                    this.close();
                    this.onSubmit(this.projectName.trim());
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export default class MyWorldTaskManagerPlugin extends Plugin {
    settings: PluginSettings;
    utils: TaskUtils;
    synchronizer: Synchronizer;
    resetManager: ResetManager;
    templateHelper: TemplateHelper;

    async onload() {
        console.log("Loading MyWorld Task Manager...");

        // 1. 설정 불러오기
        await this.loadSettings();

        // 2. 핵심 모듈 인스턴스 생성
        this.utils = new TaskUtils(this.app, this.settings);
        this.synchronizer = new Synchronizer(this.app, this.settings, this.utils);
        this.resetManager = new ResetManager(this.app, this.settings, this.utils);
        this.templateHelper = new TemplateHelper(this.app, this.settings, this.utils);

        // 3. 설정 탭 등록
        this.addSettingTab(new MyWorldTaskManagerSettingTab(this.app, this));

        // 4. 스타일 강제 재적용 (styles.css는 이미 obsidian이 빌드 후 알아서 읽지만, 필요한 클래스를 지원함)
        
        // 5. 명령어(Command) 등록

        // 명령어 A: 양방향 프로젝트 및 스케줄 동기화 (task-manage)
        this.addCommand({
            id: "task-manage",
            name: "양방향 프로젝트 및 스케줄 동기화",
            callback: async () => {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    await this.synchronizer.syncDailyTasks(scheduleFile);
                } else {
                    new Notice(`🚨 스케줄 관리 노트를 찾을 수 없습니다. 경로를 확인하세요: ${this.settings.mainSchedulePath}`);
                }
            }
        });

        // 명령어 B: 일간 루틴 리셋 및 회고 기록 (daily-task-reset)
        this.addCommand({
            id: "daily-task-reset",
            name: "일간 루틴 리셋 및 회고 기록",
            callback: async () => {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    await this.resetManager.runDailyReset(scheduleFile);
                } else {
                    new Notice(`🚨 스케줄 관리 노트를 찾을 수 없습니다. 경로를 확인하세요: ${this.settings.mainSchedulePath}`);
                }
            }
        });

        // 명령어 C: 현재 프로젝트 정보를 스케줄에 반영 (push-project-to-schedule)
        this.addCommand({
            id: "push-project-to-schedule",
            name: "현재 프로젝트 정보를 스케줄에 반영",
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.path.startsWith(this.settings.projectDirectory)) {
                    await this.synchronizer.pushProjectToSchedule(activeFile);
                } else {
                    new Notice("⚠️ 현재 열려 있는 노트가 프로젝트 폴더에 속해 있지 않습니다.");
                }
            }
        });

        // 명령어 D: 월간 통계 수동 아카이빙 (monthly-stats-archive)
        this.addCommand({
            id: "monthly-stats-archive",
            name: "월간 통계 수동 아카이빙 및 대시보드 갱신",
            callback: async () => {
                const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                if (scheduleFile && scheduleFile instanceof TFile) {
                    await this.resetManager.runManualArchive(scheduleFile);
                } else {
                    new Notice(`🚨 스케줄 관리 노트를 찾을 수 없습니다. 경로를 확인하세요: ${this.settings.mainSchedulePath}`);
                }
            }
        });

        // 명령어 E: 빠른 할 일 등록 (quick-capture)
        this.addCommand({
            id: "quick-capture",
            name: "빠른 할 일 등록",
            callback: () => {
                new QuickCaptureModal(this.app, async (content) => {
                    const scheduleFile = this.app.vault.getAbstractFileByPath(this.settings.mainSchedulePath);
                    if (scheduleFile && scheduleFile instanceof TFile) {
                        try {
                            const original = await this.app.vault.read(scheduleFile);
                            let text = this.utils.preprocessContent(original);
                            
                            // # Todo 섹션 하단의 #### 할 일 아래에 추가 시도
                            const todoHeader = "#### 할 일";
                            const todoRange = this.utils.getSectionRange(text, todoHeader, 4);
                            
                            const newTaskLine = `- [ ] ${content}`;
                            
                            if (todoRange) {
                                // #### 할 일 바로 아랫줄에 추가
                                const startIdx = (todoRange as any).start;
                                const endIdx = (todoRange as any).end;
                                
                                const before = text.substring(0, startIdx + todoHeader.length);
                                const after = text.substring(startIdx + todoHeader.length);
                                
                                text = before + "\n" + newTaskLine + after;
                            } else {
                                // # Todo 섹션 아래에 추가
                                const mainTodoHeader = "# Todo";
                                const mainTodoRange = this.utils.getSectionRange(text, mainTodoHeader, 1);
                                if (mainTodoRange) {
                                    const startIdx = (mainTodoRange as any).start;
                                    const before = text.substring(0, startIdx + mainTodoHeader.length);
                                    const after = text.substring(startIdx + mainTodoHeader.length);
                                    
                                    text = before + "\n" + newTaskLine + after;
                                } else {
                                    // 섹션이 전혀 없으면 파일 끝에 추가
                                    text = text.trimEnd() + "\n\n" + newTaskLine;
                                }
                            }
                            
                            // 추가 후 자동 정렬 및 디데이 마킹 프로세스 수행
                            const todayObj = moment().startOf('day').toDate();
                            text = this.utils.processSectionLogic(text, "# Todo", todayObj, false, true);
                            
                            await this.utils.saveIfChanged(scheduleFile, text, original);
                            new Notice(`✅ 할 일이 메인 스케줄에 추가되었습니다: "${content}"`);
                        } catch (err) {
                            console.error(err);
                            new Notice("🚨 할 일 추가 도중 에러가 발생했습니다.");
                        }
                    } else {
                        new Notice(`🚨 스케줄 관리 노트를 찾을 수 없습니다: ${this.settings.mainSchedulePath}`);
                    }
                }).open();
            }
        });

        // 명령어 F: 임시 메모 파일 열기 및 생성 (open-memo)
        this.addCommand({
            id: "open-memo",
            name: "임시 메모 파일 열기 및 생성",
            callback: async () => {
                await this.openOrCreateFleetingMemoFile();
            }
        });

        // 명령어 G: 새 프로젝트 생성 (create-new-project)
        this.addCommand({
            id: "create-new-project",
            name: "새 프로젝트 노트 생성",
            callback: () => {
                new CreateProjectModal(this.app, async (projectName) => {
                    const file = await this.createNewProjectFile(projectName);
                    if (file) {
                        const leaf = this.app.workspace.getLeaf(false);
                        await leaf.openFile(file);
                    }
                }).open();
            }
        });

        // 명령어 H: 오늘의 스케줄 관리 노트 생성 (create-today-schedule)
        this.addCommand({
            id: "create-today-schedule",
            name: "오늘의 스케줄 관리 노트 생성",
            callback: async () => {
                const file = await this.createTodayScheduleFile();
                if (file) {
                    const leaf = this.app.workspace.getLeaf(false);
                    await leaf.openFile(file);
                }
            }
        });

        // 명령어 I: 원클릭 PARA 시스템 폴더 구조 생성 (myworld-setup-para)
        this.addCommand({
            id: "myworld-setup-para",
            name: "원클릭 PARA 시스템 폴더 구조 생성",
            callback: async () => {
                try {
                    await this.templateHelper.setupParaStructure();
                    new Notice("✅ PARA 시스템 폴더 구조 및 가이드 문서가 생성되었습니다.");
                } catch (err) {
                    console.error(err);
                    new Notice("🚨 PARA 시스템 구조 생성 중 에러가 발생했습니다.");
                }
            }
        });

        // 명령어 J: 원클릭 제텔카스텐 폴더 구조 생성 (myworld-setup-zettelkasten)
        this.addCommand({
            id: "myworld-setup-zettelkasten",
            name: "원클릭 제텔카스텐 폴더 구조 생성",
            callback: async () => {
                try {
                    await this.templateHelper.setupZettelkastenStructure();
                    new Notice("✅ 제텔카스텐 폴더 구조 및 가이드 문서가 생성되었습니다.");
                } catch (err) {
                    console.error(err);
                    new Notice("🚨 제텔카스텐 구조 생성 중 에러가 발생했습니다.");
                }
            }
        });
    }

    onunload() {
        console.log("Unloading MyWorld Task Manager...");
    }

    // 1. 공용 새 프로젝트 노트 생성 메서드
    async createNewProjectFile(projectName: string): Promise<TFile | null> {
        try {
            const projectDir = this.settings.projectDirectory;
            await this.utils.ensureFolder(projectDir);
            
            const projectFilePath = `${projectDir}/${projectName}.md`;
            if (this.app.vault.getAbstractFileByPath(projectFilePath)) {
                new Notice("⚠️ 동일한 이름의 프로젝트가 이미 존재합니다.");
                return this.app.vault.getAbstractFileByPath(projectFilePath) as TFile;
            }

            // 템플릿 텍스트 가져오기
            let templateText = this.settings.customTemplates.projectNote;
            if (!templateText) {
                const defaultPath = `${this.settings.templatesDirectory}/프로젝트 계획서 템플릿.md`;
                const defaultFile = this.app.vault.getAbstractFileByPath(defaultPath);
                if (defaultFile && defaultFile instanceof TFile) {
                    templateText = await this.app.vault.read(defaultFile);
                } else {
                    templateText = `---
작성일: "{{date}}T{{time}}"
수정일: "{{date}}T{{time}}"
---
---
버튼
<div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 20px;">
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:push-project-to-schedule" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #00cec9;">📤</div>
  </a>
</div>

# 실행
- 
# 개요
- 기한 : 
- 목표 : 
# 계획
> **진행도**: **🚨 작성 필요!**
- 
# 세부 사항
`;
                }
            }

            const now = moment();
            const replacements = {
                projectName: projectName,
                date: now.format("YYYY-MM-DD"),
                time: now.format("HH:mm")
            };

            const content = this.templateHelper.replacePlaceholder(templateText, replacements);
            const newFile = await this.app.vault.create(projectFilePath, content);
            new Notice(`✅ 새 프로젝트 노트가 생성되었습니다: ${projectName}`);
            return newFile;
        } catch (err) {
            console.error(err);
            new Notice("🚨 프로젝트 생성 중 에러가 발생했습니다.");
            return null;
        }
    }

    // 2. 공용 오늘의 스케줄 노트 생성 메서드
    async createTodayScheduleFile(): Promise<TFile | null> {
        try {
            const schedulePath = this.settings.mainSchedulePath;
            const parts = schedulePath.split("/");
            parts.pop();
            const folderPath = parts.join("/");
            
            await this.utils.ensureFolder(folderPath);

            const existingFile = this.app.vault.getAbstractFileByPath(schedulePath);
            if (existingFile && existingFile instanceof TFile) {
                new Notice("ℹ️ 스케줄 관리 노트가 이미 존재합니다.");
                return existingFile;
            }

            // 템플릿 가져오기
            let templateText = this.settings.customTemplates.dailySchedule;
            if (!templateText) {
                const defaultPath = `${this.settings.templatesDirectory}/데일리 스케줄 템플릿.md`;
                const defaultFile = this.app.vault.getAbstractFileByPath(defaultPath);
                if (defaultFile && defaultFile instanceof TFile) {
                    templateText = await this.app.vault.read(defaultFile);
                } else {
                    let checklistTable = "";
                    for (let i = 1; i <= 31; i++) {
                        checklistTable += `|  ${i.toString().padEnd(2, ' ')}  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |\n`;
                    }
                    
                    templateText = `---
작성일: "{{date}}T{{time}}"
수정일: "{{date}}T{{time}}"
cssclasses:
  - inline-routine
---
- 
<div style="display: flex; gap: 20px; margin-bottom: 20px; align-items: center; justify-content: center;">
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:task-manage" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #00cec9;">⚡️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:daily-task-reset" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #ff7675;">🌤️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:monthly-stats-archive" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px; margin: 0 20px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #fdcb6e;">🗂️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:quick-capture" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #a29bfe;">✏️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:open-memo" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #74b9ff;">📋</div>
  </a>
</div>
# 루틴
>Step : {{defaultStep}}

> [!routine]
> 확언 : {{defaultAffirmation}}
> ## ==Step==
> - [ ] 작성
> - [ ] 실행
> ## ==Block==
> - [ ] 1
> - [ ] 2
> - [ ] 3
> - [ ] 4
> - [ ] 5
> - [ ] 6
> ## ==멘탈==
> - [ ] 확언 읽기
> - [ ] 10분 명상
> ## ==식단==
> - [ ] 아침
> - [ ] 점심
> - [ ] 저녁
> ## ==운동==
> - [ ] 스쿼트 60, 팔굽 20
> ## ==취침==
> - [ ] 11시부터 정적 활동
> ## ==디톡스==
> - [ ] 1회
> - [ ] 3회
> - [ ] 5회+
---

| 날짜  | Step | Block | 멘탈  | 식단  | 운동  | 취침  | 디톡스 |
| :-: | :--: | :---: | :-: | :-: | :-: | :-: | :-: |
| {{currentDay}}  |      |      |      |      |      |      |      |
# Todo
#### 프로젝트
> (오늘 할 일 없음)

#### 할 일
- [ ] 오늘 마감인 작업 📅 {{date}}
# Project
> 🚀 전체 프로젝트 요약 대시보드 및 콜아웃 목록이 여기에 실시간으로 갱신됩니다.

# 체크리스트

| 날짜  | Step | Block | 멘탈  | 식단  | 운동  | 취침  | 디톡스 |
| :-: | :--: | :---: | :-: | :-: | :-: | :-: | :-: |
${checklistTable}
# 통계
> 📈 루틴 집계 및 아카이브 통계가 10일 구간별로 렌더링됩니다.
`;
                }
            }

            const now = moment();
            const replacements = {
                date: now.format("YYYY-MM-DD"),
                time: now.format("HH:mm"),
                currentDay: now.date().toString(),
                defaultStep: "계획 따라 움직이기. 1:30 취침하기.",
                defaultAffirmation: "시작이 반 이다."
            };

            const content = this.templateHelper.replacePlaceholder(templateText, replacements);
            const newFile = await this.app.vault.create(schedulePath, content);
            new Notice("✅ 오늘의 스케줄 관리 노트가 성공적으로 생성되었습니다!");
            return newFile;
        } catch (err) {
            console.error(err);
            new Notice("🚨 스케줄 관리 노트 생성 중 에러가 발생했습니다.");
            return null;
        }
    }

    // 3. 공용 임시 메모 파일 생성 및 열기 메서드
    async openOrCreateFleetingMemoFile(): Promise<TFile | null> {
        try {
            const memoPath = this.settings.fleetingMemoPath;
            const parts = memoPath.split("/");
            parts.pop();
            const folderPath = parts.join("/");
            
            // 폴더가 존재하지 않는다면 자동 생성
            await this.utils.ensureFolder(folderPath);

            let memoFile = this.app.vault.getAbstractFileByPath(memoPath);
            if (!memoFile) {
                const now = moment();
                const defaultContent = `---
작성일: "${now.format("YYYY-MM-DDTHH:mm")}"
수정일: "${now.format("YYYY-MM-DDTHH:mm")}"
---
# 임시 메모

`;
                memoFile = await this.app.vault.create(memoPath, defaultContent);
                new Notice("📝 새 임시 메모 파일이 생성되었습니다.");
            }

            if (memoFile && memoFile instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(memoFile);
                return memoFile;
            }
            return null;
        } catch (err) {
            console.error(err);
            new Notice("🚨 임시 메모를 생성하거나 여는 도중 에러가 발생했습니다.");
            return null;
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
        // 의존성 모듈의 설정 객체 갱신
        if (this.utils) this.utils.settings = this.settings;
        if (this.synchronizer) this.synchronizer.settings = this.settings;
        if (this.resetManager) this.resetManager.settings = this.settings;
        if (this.templateHelper) this.templateHelper.settings = this.settings;
    }
}
