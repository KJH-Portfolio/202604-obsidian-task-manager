import { App } from "obsidian";
import { PluginSettings } from "./settings";
import { TaskUtils } from "./TaskUtils";
import { DateManager } from "./DateManager";
import { FileManager } from "./FileManager";
import { t } from "./i18n";

export class TemplateHelper {
    app: App;
    settings: PluginSettings;
    utils: TaskUtils;
    dateManager: DateManager;
    fileManager: FileManager;

    constructor(app: App, settings: PluginSettings, utils: TaskUtils, dateManager: DateManager, fileManager: FileManager) {
        this.app = app;
        this.settings = settings;
        this.utils = utils;
        this.dateManager = dateManager;
        this.fileManager = fileManager;
    }


    replacePlaceholder(templateText: string, replacements: Record<string, string>): string {
        let content = templateText;
        for (const key of Object.keys(replacements)) {
            const value = replacements[key];
            content = content.replace(new RegExp(`\\{\\{(?:\\s*)${key}(?:\\s*)\\}\\}`, 'g'), String(value));
        }
        return content;
    }

    async createDefaultTemplatesFolderAndFiles(templatesDir: string): Promise<void> {
        await this.utils.ensureFolder(templatesDir);

        const dailyPath_ko = `${templatesDir}/01.데일리 스케줄 템플릿.md`;
        const projectPath_ko = `${templatesDir}/02.프로젝트 계획서 템플릿.md`;
        const dailyPath_en = `${templatesDir}/01.Daily Schedule Template.md`;
        const projectPath_en = `${templatesDir}/02.Project Plan Template.md`;

        let checklistTable = "";
        for (let i = 1; i <= 31; i++) {
            checklistTable += `|  ${i.toString().padEnd(2, ' ')}  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
`;
        }

        const defaultDailyText_ko = `---
작성일: "2000-01-01T00:00"
수정일: "2000-01-01T00:00"
---
-
<div style="display: flex; gap: 20px; margin-bottom: 20px; align-items: center; justify-content: center;">
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:quick-capture" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #00cec9;">✏️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:daily-task-reset" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #ff7675;">🌤️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:monthly-stats-archive" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #fdcb6e;">🗂️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:open-memo" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #74b9ff;">📋</div>
  </a>
</div>
# 루틴
>Step : 계획 따라 움직이기. 1:30 취침하기.

> [!routine]
> 확언 : 시작이 반 이다.
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
#### 할 일
- [ ] 이곳은 오늘 해야 할 일들이 모이는 곳입니다. 우측의 달력(📅)을 눌러 마감일을 오늘로 지정해보세요! 📅 {{date}}
- [ ] 다른 프로젝트 노트에서 작성한 태스크를 이곳으로 복사해오면, 상태와 진행률이 실시간으로 동기화됩니다. ^dummy1
- [x] 완료된 작업은 매일 밤 '일간 마감(🌤️)' 버튼을 누르면 깔끔하게 정리됩니다.
# Project
> ${t("overall_project_summary_desc", this.settings.language)}

# 체크리스트

| 날짜  | Step | Block | 멘탈  | 식단  | 운동  | 취침  | 디톡스 |
| :-: | :--: | :---: | :-: | :-: | :-: | :-: | :-: |
${checklistTable}
# 통계
> 📈 루틴 집계 및 아카이브 통계가 10일 구간별로 렌더링됩니다.
`

        const defaultDailyText_en = `---
Created: "2000-01-01T00:00"
Modified: "2000-01-01T00:00"
---
-
<div style="display: flex; gap: 20px; margin-bottom: 20px; align-items: center; justify-content: center;">
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:quick-capture" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #00cec9;">✏️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:daily-task-reset" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #ff7675;">🌤️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:monthly-stats-archive" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #fdcb6e;">🗂️</div>
  </a>
  <a href="obsidian://advanced-uri?commandid=myworld-task-manager:open-memo" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px;">
    <div style="width: 46px; height: 46px; background: rgba(255,255,255,0.02); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 20px; border-top: 2px solid #74b9ff;">📋</div>
  </a>
</div>
# Routine
>Step : Follow the plan. Sleep at 1:30.

> [!routine]
> Affirmation : Well begun is half done.
> ## ==Step==
> - [ ] Write
> - [ ] Execute
> ## ==Block==
> - [ ] 1
> - [ ] 2
> - [ ] 3
> - [ ] 4
> - [ ] 5
> - [ ] 6
> ## ==Mental==
> - [ ] Read affirmation
> - [ ] 10 min meditation
> ## ==Diet==
> - [ ] Breakfast
> - [ ] Lunch
> - [ ] Dinner
> ## ==Exercise==
> - [ ] Squat 60, Pushup 20
> ## ==Sleep==
> - [ ] Quiet time from 11
> ## ==Detox==
> - [ ] 1 time
> - [ ] 3 times
> - [ ] 5 times+
---

| Date  | Step | Block | Mental  | Diet  | Exercise  | Sleep  | Detox |
| :-: | :--: | :---: | :-: | :-: | :-: | :-: | :-: |
| {{currentDay}}  |      |      |      |      |      |      |      |
# Todo
#### Todo
- [ ] This is where your daily tasks are gathered. Click the calendar (📅) to set today's deadline! 📅 {{date}}
- [ ] If you copy tasks from other project notes here, their status and progress will sync in real-time. ^dummy1
- [x] Completed tasks will be neatly archived when you click the 'Daily Reset (🌤️)' button at night.
# Project
> 🚀 The overall project summary dashboard and callout list are updated here in real-time.

# Checklist

| Date  | Step | Block | Mental  | Diet  | Exercise  | Sleep  | Detox |
| :-: | :--: | :---: | :-: | :-: | :-: | :-: | :-: |
${checklistTable}
# Stats
> 📈 Routine aggregation and archive statistics are rendered per 10-day intervals.
`

        const defaultProjectText_ko = `---
작성일: "2000-01-01T00:00"
수정일: "2000-01-01T00:00"
---
# 실행
- [ ] 갑자기 떠오른 즉각적인 임시 작업이나 아이디어를 이곳에 자유롭게 기록하세요. 📅
- [ ] 혹은 하단의 '계획(Plan)' 구역에서 복사한 핵심 중요 태스크를 이곳에 배치하면 해당 작업 또한 메인 스케줄에 즉시 연동됩니다. 📅

# 개요
- 기한 : 📅 2099-12-31 ~ 📅 2099-12-31
- 목표 : 프로젝트가 달성하고자 하는 궁극적인 목표를 한 줄로 선명하게 작성하세요.

# 계획
> **${t("progress_label", this.settings.language)}**: **${t("progress_need_write", this.settings.language)}**
- [ ] 프로젝트의 구체적인 실행 계획을 할 일(Task) 단위로 쪼개어 이곳에 작성하세요. 📅 2026-07-14 ^step1
- [ ] 작성된 태스크를 데일리 노트의 \`#### 할 일\` 영역으로 복사해서 가져가면 스케줄에 연동됩니다. ^step2
- [ ] 태스크 끝에 생성되는 고유 ID(\`^step3\`)를 통해 흩어진 태스크들의 진행률이 이 프로젝트 노트로 실시간 통합됩니다. ^step3

# 세부 사항
이곳에는 프로젝트의 세부적인 메모, 회의록, 참고 자료 링크 등을 자유롭게 서술하세요.
`

        const defaultProjectText_en = `---
Created: "2000-01-01T00:00"
Modified: "2000-01-01T00:00"
---
# Execution
- [ ] Freely jot down any sudden ideas or immediate, temporary tasks here. 📅
- [ ] Or, paste critical tasks copied from the 'Plan' section below. These tasks will also instantly sync to your main schedule. 📅

# Overview
- Deadline : 📅 2099-12-31 ~ 📅 2099-12-31
- Goal : Write a clear, one-line objective that this project ultimately aims to achieve.

# Plan
> **Progress**: **🚨 Needs writing!**
- [ ] Break down your specific execution plans into actionable tasks here. 📅 2026-07-14 ^step1
- [ ] Copy these tasks into the \`#### Todo\` section of your daily schedule to sync them. ^step2
- [ ] The unique ID (\`^step3\`) at the end of each task ensures that progress from scattered tasks is integrated back here in real-time. ^step3

# Details
Freely document detailed notes, meeting minutes, reference links, and other project-related information here.
`

        if (!this.app.vault.getAbstractFileByPath(dailyPath_ko)) await this.app.vault.create(dailyPath_ko, defaultDailyText_ko);
        if (!this.app.vault.getAbstractFileByPath(projectPath_ko)) await this.app.vault.create(projectPath_ko, defaultProjectText_ko);
        if (!this.app.vault.getAbstractFileByPath(dailyPath_en)) await this.app.vault.create(dailyPath_en, defaultDailyText_en);
        if (!this.app.vault.getAbstractFileByPath(projectPath_en)) await this.app.vault.create(projectPath_en, defaultProjectText_en);

        const dailyGuidePath_ko = `${templatesDir}/98.스케줄_노트_작성_가이드.md`;
        const projectGuidePath_ko = `${templatesDir}/99.프로젝트_노트_작성_가이드.md`;
        const dailyGuidePath_en = `${templatesDir}/98.Daily_Schedule_Note_Guide.md`;
        const projectGuidePath_en = `${templatesDir}/99.Project_Note_Guide.md`;

        const dailyGuideText_ko = `# 📝 데일리 스케줄 노트 작성 가이드

이 문서는 데일리 스케줄 노트에서 **'어떤 버튼이 무슨 역할을 하는지'**, 그리고 **'내가 마음대로 수정해도 되는 영역과 건드리면 안 되는 영역'**이 어디인지 알려주는 가이드입니다.

---

## 🔄 실시간 자동 동기화 & 수동 새로고침
- 스케줄 노트나 프로젝트 노트에서 할 일(태스크)을 수정하는 즉시, **백그라운드에서 실시간으로 모든 데이터가 양방향 자동 동기화**됩니다! 더 이상 일일이 동기화 버튼을 찾아서 누를 필요가 없습니다.
- **수동 새로고침(단축키)**: 만약 일시적인 렌더링 지연 등으로 인해 현재 화면을 강제로 최신화하고 싶다면, 옵시디언의 '단축키 설정'에서 \`Refresh Active View Sync\` 명령에 원하는 단축키(예: F5 등)를 지정하여 언제든지 즉시 새로고침 할 수 있습니다.

## 🔘 상단 컨트롤 버튼 (매직 버튼)
스케줄 노트 상단에는 옵시디언의 복잡한 동작을 클릭 한 번으로 처리해 주는 자동화 버튼들이 있습니다.

- ✏️ **(빠른 캡처 / Quick Capture)**: 언제 어디서든 빠르게 할 일을 스케줄의 \`#### 할 일\` 밑으로 밀어넣고 싶을 때 누릅니다.
- 🌤️ **(일간 마감 / Daily Reset)**: 하루가 끝나고 다음 날 스케줄을 준비할 때 누릅니다. 루틴의 체크박스를 싹 비워주고, 오늘 달성한 루틴 통계를 월간 표로 이관해 줍니다.
- 🗂️ **(월간 아카이브 / Monthly Archive)**: 한 달이 끝나고 이번 달 루틴 달성률 통계를 추출하여 아카이브 폴더로 예쁘게 저장할 때 누릅니다.
- 📋 **(빠른 메모 / Open Memo)**: 생각나는 아이디어를 빠르게 메모하고 싶을 때 누릅니다.

---

## 🎨 수정 가이드 (예시 화면)

아래는 스케줄 노트의 예시입니다. 플러그인이 데이터를 덮어씌우는 영역을 피해, **형광펜(==하이라이트==)으로 칠해진 부분만 자유롭게 수정 및 체크**하며 사용하시면 됩니다.

\`\`\`markdown
---
작성일: "2000-01-01T00:00"
수정일: "2000-01-01T00:00"
---
==- 오늘 하루도 파이팅! (자유롭게 메모하는 공간)==

<div style="display: flex; ... 버튼 영역 (건드리지 마세요) ... </div>

# 루틴
>Step : ==계획 따라 움직이기. 1:30 취침하기.==

> [!routine]
> 확언 : ==시작이 반 이다.==
> ## ==Step==
> - [x] ==작성== (루틴 체크박스는 자유롭게 클릭하세요)
> - [ ] ==실행==

---
| ==날짜==  | ==Step== | ==Block== | ... (루틴 임시 저장 테이블 - 내용은 건드리지 마세요) ...
---

> 💡 **Q. 만약 표의 1행(항목명)인 'Step', '식단', '운동' 등의 루틴 카테고리를 내 입맛대로 바꾸고 싶다면요?**
> A. 카테고리 이름을 변경하려면, 현재 스케줄 노트 안에서 **두 군데의 표 1행(헤더)을 모두 동일하게 수정**해 주셔야 합니다!
> 1. 루틴 영역 바로 밑에 있는 **임시 저장 테이블(미니 테이블)**의 1행
> 2. 스케줄 노트 하단에 있는 **\`# 체크리스트\` (월간 누적 테이블)**의 1행
>
> 이 두 곳의 항목명이 똑같아야만 매일 밤 '일간 마감(🌤️)' 버튼을 눌렀을 때, 오늘의 루틴 데이터가 월간 표로 고장 없이 무사히 누적됩니다.

# Todo
#### 할 일
==- [ ] 은행 가서 송금하기 📅 2026-06-05== (여기에 매일매일의 일반 할 일을 적으세요)
==- [ ] 장보기 📅 2026-06-06==

# Project
> ${t("overall_project_summary_desc", this.settings.language)}
> (절대로 건드리지 마세요! 플러그인이 통째로 덮어씌우는 영역입니다.)

# 체크리스트
| 날짜  | Step | Block | ... (월간 누적 테이블 - 건드리지 마세요) ...

# 통계
> 📈 루틴 집계 및 아카이브 통계가 10일 구간별로 렌더링됩니다.
> (건드리지 마세요)
\`\`\`

### 🚨 요약: 절대 지우면 안 되는 키워드 (헤더)
아래 제목들은 플러그인이 데이터를 찾을 때 쓰는 '이정표'입니다. 이 글자들을 지우거나 수정하면 플러그인이 고장 납니다!
- \`# 루틴\`
- \`# Todo\`, \`#### 할 일\`
- \`# Project\`
- \`# 체크리스트\`, \`# 통계\`
`

        const dailyGuideText_en = `# 📝 Daily Schedule Note Guide

This document is a guide that explains **'what each button does'**, and **'which areas you can freely modify vs which areas you shouldn't touch'** in the daily schedule note.

---

## 🔄 Real-time Auto-Sync & Manual Refresh
- The moment you modify a task in the schedule note or project note, **all data is bi-directionally auto-synced in real-time in the background!** You no longer need to find and click a sync button.
- **Manual Refresh (Hotkey)**: If you ever want to forcefully update the current screen due to a temporary rendering delay, you can assign a hotkey (e.g., F5) to the \`Refresh Active View Sync\` command in Obsidian's 'Hotkeys' settings to refresh instantly at any time.

## 🔘 Top Control Buttons (Magic Buttons)
There are automation buttons at the top of the schedule note that handle complex Obsidian actions with a single click.

- ✏️ **(Quick Capture)**: Click when you want to quickly push a task under \`#### Todo\` in the schedule anytime, anywhere.
- 🌤️ **(Daily Reset)**: Click at the end of the day to prepare the schedule for the next day. It clears the routine checkboxes and transfers today's routine statistics to the monthly table.
- 🗂️ **(Monthly Archive)**: Click at the end of the month to extract the routine achievement rate statistics for this month and save them neatly in the archive folder.
- 📋 **(Open Memo)**: Click when you want to quickly memo an idea that comes to mind.

---

## 🎨 Modification Guide (Example Screen)

Below is an example of a schedule note. Avoid the areas where the plugin overwrites data, and **freely modify and check only the highlighted areas (==highlight==)**.

\`\`\`markdown
---
Created: "2000-01-01T00:00"
Modified: "2000-01-01T00:00"
---
==- Have a great day today! (Space for free memo)==

<div style="display: flex; ... Button Area (Do not touch) ... </div>

# Routine
>Step : ==Follow the plan. Sleep at 1:30.==

> [!routine]
> Affirmation : ==Well begun is half done.==
> ## ==Step==
> - [x] ==Write== (Feel free to click the routine checkboxes)
> - [ ] ==Execute==

---
| ==Date==  | ==Step== | ==Block== | ... (Routine temporary storage table - Do not touch the contents) ...
---

> 💡 **Q. What if I want to customize the routine categories like 'Step', 'Diet', 'Exercise' in the 1st row (header) of the table?**
> A. To change the category names, you must **modify the 1st row (header) of both tables identically** within the current schedule note!
> 1. The 1st row of the **temporary storage table (mini table)** right below the Routine area.
> 2. The 1st row of the **\`# Checklist\` (monthly accumulation table)** at the bottom of the schedule note.
>
> The item names in these two places must be identical so that when you click the 'Daily Reset (🌤️)' button every night, today's routine data will safely accumulate in the monthly table without breaking.

# Todo
#### Todo
==- [ ] Transfer money at the bank 📅 2026-06-05== (Write your daily general tasks here)
==- [ ] Grocery shopping 📅 2026-06-06==

# Project
> 🚀 The overall project summary dashboard and callout list are updated here in real-time.
> (DO NOT touch! This is the area entirely overwritten by the plugin.)

# Checklist
| Date | Step | Block | ... (Monthly accumulation table - Do not touch) ...

# Stats
> 📈 Routine aggregation and archive statistics are rendered per 10-day intervals.
> (Do not touch)
\`\`\`

### 🚨 Summary: Keywords (Headers) you must NEVER delete
The titles below are 'milestones' the plugin uses to find data. Deleting or modifying these words will break the plugin!
- \`# Routine\`
- \`# Todo\`, \`#### Todo\`
- \`# Project\`
- \`# Checklist\`, \`# Stats\`
`

        const projectGuideText_ko = `# 🚀 프로젝트 노트 작성 가이드

이 문서는 개별 프로젝트 노트를 작성할 때, **어떤 방식으로 메인 스케줄과 연동되는지**, 그리고 **문서의 어느 위치에 계획과 세부 내용을 작성해야 하는지** 알려주는 가이드입니다.

---

## 🔄 실시간 자동 동기화 & 수동 새로고침

- 📡 **(자동 동기화)**: 프로젝트 노트에서 할 일을 적거나 완료 처리하는 즉시, **변경된 진행 상황과 할 일 목록이 메인 데일리 스케줄 노트의 대시보드(\`# Project\` 영역)로 실시간 자동 덮어씌워집니다.** (버튼을 누를 필요가 없습니다!)
- 🔄 **(수동 새로고침 단축키)**: 만약 일시적인 오류로 화면을 강제로 최신화하고 싶다면, 옵시디언 단축키 설정에서 \`Refresh Active View Sync\` 명령에 단축키(예: F5)를 지정하여 언제든지 즉시 새로고침 할 수 있습니다.

---

## 🎨 수정 가이드 (예시 화면)

프로젝트 노트는 자유도가 높지만, 플러그인이 할 일을 추적하기 위해 꼭 지켜야 하는 규칙이 있습니다. **형광펜(==하이라이트==)으로 칠해진 부분을 확인해 보세요.**

\`\`\`markdown
---
작성일: "2000-01-01T00:00"
수정일: "2000-01-01T00:00"
---
# 실행
==- [ ] 메인 페이지 디자인 시안 완성하기==
==- [x] 기획안 제출==

# 개요
- 기한 : ==📅 2026-07-01 ~ 📅 2026-07-20==
- 목표 : ==플러그인 V1.0 스토어 정식 배포==

# 계획
> **${t("progress_label", this.settings.language)}**: **${t("progress_need_write", this.settings.language)}** (This part is automatically replaced with a progress bar 🟩🟩⬜⬜ by the plugin. Do not delete it!)
==- [x] 아이디어 구상== (앞으로 해야 할 전체 로드맵 할 일들을 적어두세요)
==- [ ] 개발 세팅==

# 세부 사항
==이 아래부터는 완전한 자유 영역입니다.==
==미팅 회의록, 아이디어 스케치, 코드 스니펫 등 프로젝트와 관련된 모든 내용을 자유롭게 마음껏 적어주세요!==
\`\`\`

### 🚨 요약: 절대 지우면 안 되는 키워드 (헤더)
아래 제목들은 플러그인이 진행도(Progress)를 계산하고 데이터를 이동시킬 때 쓰는 '이정표'입니다.
- \`# 실행\`
- \`# 개요\`
- \`# 계획\`
- \`# 세부 사항\`
`

        const projectGuideText_en = `# 🚀 Project Note Guide

This document is a guide that explains **how your edits automatically link with the main schedule** when writing individual project notes, and **where in the document you should write your plans and details**.

---

## 🔄 Real-time Auto-Sync & Manual Refresh

- 📡 **(Auto-Sync)**: The moment you write or complete a task in the project note, **the changed progress and task list are automatically overwritten in real-time to the dashboard (\`# Project\` area) of the main daily schedule note.** (No need to press any buttons!)
- 🔄 **(Manual Refresh Hotkey)**: If you want to forcefully update the screen due to a temporary error, you can assign a hotkey (e.g., F5) to the \`Refresh Active View Sync\` command in Obsidian's hotkeys settings to refresh instantly.

---

## 🎨 Modification Guide (Example Screen)

Project notes offer high freedom, but there are rules you must follow for the plugin to track tasks. **Please check the areas colored with highlighter (==highlight==).**

\`\`\`markdown
---
Created: "2000-01-01T00:00"
Modified: "2000-01-01T00:00"
---
# Execution
==- [ ] Complete main page design draft==
==- [x] Submit proposal==

# Plan Overview
- Deadline : ==📅 2026-07-01 ~ 📅 2026-07-20==
- Goal : ==Official plugin V1.0 store release==

# Work Summary
> **Progress**: **🚨 Needs writing!** (This part is automatically replaced with a progress bar 🟩🟩⬜⬜ by the plugin. Do not delete!)
==- [x] Idea conception== (Write down all roadmap tasks you need to do in the future)
==- [ ] Development setup==

# Details
==From here down is an entirely free area.==
==Feel free to write all content related to the project such as meeting minutes, idea sketches, code snippets, etc.!==
\`\`\`

### 🚨 Summary: Keywords (Headers) you must NEVER delete
The titles below are 'milestones' the plugin uses to calculate progress and move data.
- \`# Execution\`
- \`# Plan Overview\`
- \`# Work Summary\`
- \`# Details\`
`

        if (!this.app.vault.getAbstractFileByPath(dailyGuidePath_ko)) await this.app.vault.create(dailyGuidePath_ko, dailyGuideText_ko);
        if (!this.app.vault.getAbstractFileByPath(projectGuidePath_ko)) await this.app.vault.create(projectGuidePath_ko, projectGuideText_ko);
        if (!this.app.vault.getAbstractFileByPath(dailyGuidePath_en)) await this.app.vault.create(dailyGuidePath_en, dailyGuideText_en);
        if (!this.app.vault.getAbstractFileByPath(projectGuidePath_en)) await this.app.vault.create(projectGuidePath_en, projectGuideText_en);
    }


    async setupParaStructure(): Promise<number> {
        let createdCount = 0;
        const paraDirs = ["0. Inbox", "1. Project", "2. Area", "3. Resource", "4. Archive", "10.File"];

        for (const dir of paraDirs) {
            await this.utils.ensureFolder(dir);
        }

        const guidePath_ko = "0. Inbox/00.지식관리_시스템_통합_가이드.md";
        const guidePath_en = "0. Inbox/00.Knowledge_Management_System_Guide.md";

        const guideContent_en = `# 🧠 Second Brain: Integrated Knowledge Management System Guide

This Obsidian environment is set up to systematically manage fragmented tasks and knowledge.
Our knowledge management ecosystem operates in 3 main stages: **[Collection (Inbox)] ➡️ [Classification & Action (PARA)] ➡️ [Permanent Knowledge (Zettelkasten)]**.

---

## 📥 Stage 1: Collection (0. Inbox)
The \`0. Inbox\` folder where you are viewing this document is **the waiting area (station) where all raw thoughts and memos pass through first**.
- **💡 Usage Principles**
  - **Quick Collection**: Collect any memos or web clippings that come to mind here regardless of format.
  - **Periodic Emptying**: Review the notes in this folder once a day or once a week, move them to appropriate folders (Project, Area, Resource, Zettelkasten, etc.), and keep this folder empty.

---

## 🏗️ Stage 2: Classification & Action (PARA System)
Among the filtered information from the Inbox, items that involve **'a certain purpose or action'** are classified into 4 categories according to Tiago Forte's PARA framework.

### 1️⃣ 1. Project
- **Definition**: Short-term tasks with clear goals and **deadlines**.
- **💡 Usage Principles**
  - **Short-term Focus**: Manage projects with specific completion schedules by making them independent nodes.
  - **Linked Management**: Actively track deadlines by linking task lists and D-Day markers.
  - **Archive Transfer**: When a project is completed or suspended, immediately move it to the \`4. Archive\` folder.

### 2️⃣ 2. Area
- **Definition**: Areas with no deadlines, but which require **continuous maintenance and management of standards** in life or work.
- **💡 Usage Principles**
  - **Continuity**: Handles areas without a clear end point, such as health management, financial planning, personal study routines, and relationships.
  - **Check Management**: Write notes to set baselines to periodically check and prevent life balance and routines from collapsing.

### 3️⃣ 3. Resource
- **Definition**: Interests or external knowledge databases that are not immediately needed for current tasks, but **may be useful in the future**.
- **💡 Usage Principles**
  - **Reference Materials**: Collect book summaries, lecture notes, development code snippets, template forms, etc.
  - **Knowledge Exploration**: Use as a knowledge search warehouse when researching or developing specific topics later.

### 4️⃣ 4. Archive
- **Definition**: A historical repository preserving items from the above three folders that are **no longer active or have been completed**.
- **💡 Usage Principles**
  - **Organization Targets**: Store completed projects, discarded plans, and area resources that are no longer of interest.
  - **Preservation Value**: Isolate elements that are a waste to delete but distract your attention right now to reduce cognitive overload.

> **📎 10. File (Attachment Only)**
> Setting the 'Default location for new attachments' to this folder in Obsidian settings prevents images/PDFs from cluttering the document list.

---

## 🧠 Stage 3: Permanent Knowledge (Zettelkasten)
Beyond simple 'tasks' or 'others' knowledge (Resource)', the \`5. Zettelkasten\` folder is the hub that weaves fragmented knowledge together to build **your own unique ideas and knowledge network**.

### 📝 01. Fleeting
- **💡 Principle**: Write freely without formality, and periodically (within 1-2 days) review to expand into permanent notes or delete unnecessary thoughts.

### 📖 02. Literature
- **💡 Principle**: Summarize external ideas from books, videos, papers, etc. according to the author's context, and be sure to fill in the referenced source (bibliographic information).

### 💎 03. Permanent
- **💡 Principle**: Based on others' knowledge (literature) or your own intuition (fleeting), include **only one core idea completely reconstructed in your own words (one idea per note)**. These permanent notes connect to each other like a spider web through Links, forming a true 'Second Brain'.

---
> 🚀 **Based on these guidelines, now start building your own knowledge ecosystem in earnest!**
`;

        const guideContent_ko = `# 🧠 제2의 두뇌: 통합 지식 관리 시스템 가이드

이 옵시디언 환경은 파편화된 할 일과 지식들을 체계적으로 관리하기 위해 세팅되었습니다.
우리의 지식 관리 생태계는 크게 **[수집(Inbox)] ➡️ [분류 및 행동(PARA)] ➡️ [영구 지식화(Zettelkasten)]** 의 3단계 흐름으로 굴러갑니다.

---

## 📥 1단계: 수집 (0. Inbox)
지금 이 문서를 보고 계신 \`0. Inbox\` 폴더는 **모든 날것의 생각과 메모들이 가장 먼저 거쳐가는 대기소(정거장)**입니다.
- **💡 활용 원칙**
  - **빠른 수집**: 형식을 따지지 않고 생각나는 메모, 웹 클리핑 자료 등을 무조건 여기에 수집합니다.
  - **주기적 비우기**: 하루에 한 번 또는 일주일에 한 번씩 이 폴더의 노트들을 검토하여 적절한 폴더(Project, Area, Resource, Zettelkasten 등)로 이동시키고 이 폴더는 비워진 상태를 유지합니다.

---

## 🏗️ 2단계: 분류 및 행동 (PARA 시스템)
Inbox에서 걸러진 정보 중 **'어떤 목적이나 행동'**이 수반되는 항목들은 Tiago Forte의 PARA 프레임워크에 따라 4가지로 분류됩니다.

### 1️⃣ 1. Project (프로젝트)
- **정의**: 명확한 목표와 **데드라인(마감일)**이 있는 단기적인 작업들.
- **💡 활용 원칙**
  - **단기적 집중**: 구체적인 완성 일정이 있는 프로젝트들을 독립 노드로 만들어 관리합니다.
  - **연동 관리**: 할 일 목록 및 D-Day 마커를 연동하여 적극적으로 마감을 추적합니다.
  - **아카이브 이관**: 프로젝트가 완료되거나 중단되면 즉시 \`4. Archive\` 폴더로 이동시킵니다.

### 2️⃣ 2. Area (책임 영역)
- **정의**: 데드라인은 없지만, 내 삶이나 업무에서 **지속적으로 기준을 유지하고 관리해야 하는** 영역들.
- **💡 활용 원칙**
  - **지속성**: 건강 관리, 재정 계획, 개인 공부 루틴, 인간관계 등 명확한 종결 시점이 없는 영역을 다룹니다.
  - **체크 관리**: 주기적으로 확인하여 삶의 밸런스와 루틴이 무너지지 않도록 기준선을 잡는 노트를 작성합니다.

### 3️⃣ 3. Resource (자원/지식)
- **정의**: 현재 진행 중인 작업에 당장 필요하진 않지만, **미래에 유용하게 쓰일 수 있는** 관심사나 외부 지식 데이터베이스.
- **💡 활용 원칙**
  - **참고 자료**: 책 요약, 강의 정리 노트, 개발 소스코드 스니펫, 템플릿 양식 등을 모아둡니다.
  - **지식 탐색**: 나중에 특정 주제를 연구하거나 개발할 때 지식 검색 창고로 활용합니다.

### 4️⃣ 4. Archive (보관소)
- **정의**: 위 세 가지 폴더에서 **더 이상 활성화되지 않거나 종료된 항목**들을 보존하는 역사 기록소.
- **💡 활용 원칙**
  - **정리 대상**: 완료된 프로젝트, 폐기된 계획, 관심사가 멀어진 영역 리소스 등을 보관합니다.
  - **보존 가치**: 지우기는 아깝지만 당장 내 눈에 띄어 주의력을 분산시키는 요소들을 격리하여 인지 과부하를 줄입니다.

> **📎 10. File (첨부파일 전용)**
> 옵시디언 설정에서 '새 첨부파일 저장 경로'를 이 폴더로 지정해 두면, 이미지/PDF 등이 문서 목록을 어지럽히는 것을 막을 수 있습니다.

---

## 🧠 3단계: 영구 지식화 (Zettelkasten)
단순한 '할 일'이나 '남의 지식(Resource)'을 넘어, 파편화된 지식을 엮어 **나만의 독창적인 아이디어와 지식 네트워크**를 구축하는 허브가 바로 \`5. Zettelkasten\` 폴더입니다.

### 📝 01. Fleeting (임시 메모)
- **💡 원칙**: 격식 없이 자유롭게 적고, 주기적으로(1~2일 내) 검토하여 영구 메모(Permanent Note)로 확장하거나 불필요한 생각은 삭제합니다.

### 📖 02. Literature (문헌 메모)
- **💡 원칙**: 책, 영상, 논문 등에서 얻은 외부 아이디어를 저자의 맥락에 따라 요약하며, 반드시 참고한 출처(서지 정보)를 기입합니다.

### 💎 03. Permanent (영구 메모)
- **💡 원칙**: 타인의 지식(문헌)이나 내 직관(임시)을 바탕으로, **완전히 내 언어로 재구성한 단 하나의 핵심 아이디어(일자일의)**만 담습니다. 이 영구 메모들이 서로 링크(Link)로 거미줄처럼 연결되며 진정한 '제2의 두뇌'가 형성됩니다.

---
> 🚀 **이 가이드라인을 바탕으로, 이제 본격적으로 나만의 지식 생태계를 구축해 보세요!**
`;

        if (!this.app.vault.getAbstractFileByPath(guidePath_ko)) {
            await this.app.vault.create(guidePath_ko, guideContent_ko);
            createdCount++;
        }
        if (!this.app.vault.getAbstractFileByPath(guidePath_en)) {
            await this.app.vault.create(guidePath_en, guideContent_en);
            createdCount++;
        }

        return createdCount;
    }

    async setupZettelkastenStructure(): Promise<number> {
        let createdCount = 0;
        const zettelDirs = [
            "5. Zettelkasten",
            "5. Zettelkasten/01.Fleeting",
            "5. Zettelkasten/02.Literature",
            "5. Zettelkasten/03.Permanent"
        ];

        for (const dir of zettelDirs) {
            await this.utils.ensureFolder(dir);
        }

        return createdCount;
    }
}
