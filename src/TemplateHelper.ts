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

    
    public readonly scRenderJsContent = `// 1. 프로젝트 파일 가져오기 ("1. Project/01.List" 폴더)
const pages = dv.pages('"1. Project/01.List"').where(p => !p.file.name.includes("스케줄"));
const todayObj = new Date();
todayObj.setHours(0, 0, 0, 0);
const todayMoment = moment().startOf('day');

let projects = [];

// 2. 데이터 추출 및 계산
for (let p of pages) {
    // === 기한 필터링 ===
    let isWithinDate = true;
    let infoLists = p.file.lists.where(l => l.text.includes("기한 :"));
    if (infoLists.length > 0) {
        let text = infoLists[0].text;
        let dates = text.match(/📅\\s*(\\d{4}-\\d{2}-\\d{2})/g);
        if (dates && dates.length >= 2) {
            let startStr = dates[0].replace('📅', '').trim();
            let endStr = dates[1].replace('📅', '').trim();
            let startDate = moment(startStr).startOf('day');
            let endDate = moment(endStr).endOf('day');
            if (todayMoment.isBefore(startDate) || todayMoment.isAfter(endDate)) {
                isWithinDate = false;
            }
        }
    }
    
    if (!isWithinDate) continue; // 기한에 해당하지 않는 프로젝트는 목록에서 제외
    
    let fileTasks = p.file.tasks;
    
    // [0] 상태인 체크박스를 Dataview가 '미완료'로 인식하도록 강제 수정하여 클릭 오류 해결
    fileTasks.forEach(t => {
        if (t.status === "0") {
            t.completed = false;
            t.status = " ";
        }
    });
    
    // 계획 태스크 추출 (진행도 산정용)
    let planTasks = fileTasks.where(t => t.header.subpath === "계획" || t.header.subpath === "📅 계획");
    let planTasksTotal = planTasks.length;
    let planTasksDone = planTasks.where(t => t.completed).length;
    let pct = planTasksTotal > 0 ? Math.round((planTasksDone / planTasksTotal) * 100) : 0;
    
    // 실행 태스크 추출 (우선순위 산정 및 UI 출력용 - 완료된 항목도 리스트에 표시)
    let execTasks = fileTasks.where(t => t.header.subpath === "실행" || t.header.subpath === "🏃‍♂️ 실행");
    
    let pMinDiff = Infinity;
    let pSortPri = 99;
    
    // 부모의 뱃지를 자식에게 하향 전파하기 위해 줄번호 순 정렬 및 맵 사용
    let sortedExecTasks = execTasks.sort(t => t.line);
    let badgeMap = new Map();
    
    sortedExecTasks.forEach(t => {
        const text = t.text;
        const match = text.match(/📅\\s*(\\d{4}-\\d{2}-\\d{2})/);
        let diff = Infinity;
        
        let inheritedBadge = null;
        if (t.parent && badgeMap.has(t.parent)) {
            inheritedBadge = badgeMap.get(t.parent);
        }
        
        if (match) {
            const dateStr = match[1];
            const pts = dateStr.split('-');
            const targetDate = new Date(parseInt(pts[0]), parseInt(pts[1]) - 1, parseInt(pts[2]));
            diff = Math.ceil((targetDate.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
            
            // 미완료 태스크만 프로젝트 전체 우선순위 산정에 반영
            if (!t.completed && diff < pMinDiff) {
                pMinDiff = diff;
            }
        }
        
        // 텍스트 맨 앞에 D-Day 뱃지 추가 (렌더링 용도)
        let badge = "";
        let color = "";
        if (diff !== Infinity) {
            if (diff < 0) { badge = "[!] "; color = "#8c0028"; }
            else if (diff === 0) { badge = "[D] "; color = "#e93147"; }
            else if (diff === 1) { badge = "[D] "; color = "#ffd200"; }
            else if (diff === 2) { badge = "[D] "; color = "#44cf6e"; }
            else if (diff === 3) { badge = "[D] "; color = "#086ddd"; }
            else { badge = "[D] "; color = "#969696"; }
        } else if (inheritedBadge) {
            badge = inheritedBadge.badge;
            color = inheritedBadge.color;
        }

        if (badge !== "") {
            badgeMap.set(t.line, { badge, color });
            // t.text를 수정하면 원본 파일 매칭에 실패하여 클릭 시 업데이트가 안되는 버그 발생
            // 따라서 시각적 렌더링에만 관여하는 t.visual 속성을 사용합니다.
            t.visual = \`<span><span class="dday-virtual-badge" style="color: \${color};">\${badge}</span>\` + t.text + \`</span>\`;
        }
    });

    if (planTasksTotal > 0 && planTasksDone === planTasksTotal && sortedExecTasks.length > 0) pSortPri = 100;
    else if (pMinDiff < 0) pSortPri = 0;
    else if (pMinDiff === 0) pSortPri = 1;
    else if (pMinDiff === 1) pSortPri = 2;
    else if (pMinDiff === 2) pSortPri = 3;
    else if (pMinDiff === 3) pSortPri = 4;

    projects.push({
        noteName: p.file.name,
        link: p.file.link,
        planTasksTotal,
        planTasksDone,
        pct,
        execTasks: sortedExecTasks,
        sortPri: pSortPri,
        minDiff: pMinDiff
    });
}

// 우선순위에 따라 정렬
projects.sort((a, b) => {
    if (a.sortPri !== b.sortPri) return a.sortPri - b.sortPri;
    if (a.pct !== b.pct) return b.pct - a.pct; // 진행도 내림차순
    return a.noteName.localeCompare(b.noteName);
});

// 3. 대시보드 UI 생성
if (projects.length > 0) {
    let html = \`<div style="padding: 16px; background: var(--background-secondary); border-radius: 12px; border: 1px solid var(--background-modifier-border); margin: 10px 0 25px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">\\n\`;
    html += \`    <div style="font-weight: 800; font-size: 1.1em; margin-bottom: 15px; color: var(--text-accent); display: flex; align-items: center; gap: 8px;">🚀 전체 프로젝트 요약</div>\\n\`;

    projects.forEach((p, idx) => {
        let isLast = idx === projects.length - 1;
        let marginStyle = isLast ? "" : "margin-bottom: 20px;";

        let color = "#969696";
        let icon = "📝";

        if (p.sortPri === 0) { color = "#8c0028"; icon = "🔥"; }
        else if (p.sortPri === 1) { color = "#e93147"; icon = "🚨"; }
        else if (p.sortPri === 2) { color = "#ffd200"; icon = "⚠️"; }
        else if (p.sortPri === 3) { color = "#44cf6e"; icon = "✅"; }
        else if (p.sortPri === 4) { color = "#086ddd"; icon = "ℹ️"; }
        else if (p.sortPri === 100) { color = "#10b981"; icon = "🏁"; }
        else if (p.pct === 0) { color = "#969696"; icon = "💭"; }

        html += \`    <div style="\${marginStyle}">\\n\`;
        html += \`        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 600; font-size: 0.95em;">\\n\`;
        html += \`            <span>\${icon} \${p.noteName}</span>\\n\`;
        html += \`            <span style="color: \${p.pct > 0 ? color : 'var(--text-muted)'};">\${p.pct}% (\${p.planTasksDone}/\${p.planTasksTotal})</span>\\n\`;
        html += \`        </div>\\n\`;
        html += \`        <div style="position: relative; width: 100%; height: 10px; border-radius: 5px; background: var(--background-modifier-hover); overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);">\\n\`;
        html += \`            <div style="width: \${p.pct}%; height: 100%; background: linear-gradient(90deg, \${color}, \${color}dd); border-radius: 5px;"></div>\\n\`;
        html += \`            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; background: linear-gradient(to right, transparent calc(50% - 1px), rgba(0,0,0,0.7) calc(50% - 1px), rgba(0,0,0,0.7) calc(50% + 1px), transparent calc(50% + 1px));"></div>\\n\`;
        html += \`        </div>\\n\`;
        html += \`    </div>\\n\`;
    });
    html += \`</div>\`;
    dv.span(html);

    // 4. 상호작용 가능한 태스크 리스트 UI 생성 (콜아웃 디자인 + Dataview TaskList)
    projects.forEach(p => {
        if (p.planTasksTotal === 0 && p.execTasks.length === 0) return;
        
        let calloutType = "info";
        let icon = "📝";
        if (p.sortPri === 0 || p.sortPri === 1) { calloutType = "error"; icon = (p.sortPri === 0) ? "🔥" : "🚨"; }
        else if (p.sortPri === 2) { calloutType = "warning"; icon = "⚠️"; }
        else if (p.sortPri === 100) { calloutType = "success"; icon = "🏁"; }
        
        // 옵시디언 네이티브 콜아웃 스타일로 헤더 생성 (제목 클릭 시 해당 노트로 이동)
        let linkHtml = \`<a data-href="\${p.link.path}" href="\${p.link.path}" class="internal-link" target="_blank" rel="noopener" style="text-decoration: none; color: inherit;">\${p.noteName}</a>\`;
        let headerHtml = \`<div class="callout" data-callout="\${calloutType}" style="margin-top: 20px; margin-bottom: 10px;">
  <div class="callout-title" dir="auto">
    <div class="callout-title-inner">\${icon} \${linkHtml} <span style="font-weight:normal; font-size:0.9em; opacity:0.8;">(\${p.pct}%)</span></div>
  </div>
</div>\`;
        dv.span(headerHtml);
        
        if (p.execTasks.length > 0) {
            // dv.taskList를 사용하여 렌더링하면 체크박스 클릭(상호작용)이 작동합니다.
            dv.taskList(p.execTasks, false);
            // 들여쓰기를 위해 방금 렌더링된 <ul> 태그에 스타일 적용
            if (dv.container.lastElementChild) {
                dv.container.lastElementChild.style.marginLeft = "25px";
                dv.container.lastElementChild.style.marginBottom = "15px";
            }
        } else {
            dv.span("<div style='margin-left: 25px; margin-bottom: 15px; font-size: 0.9em; color: var(--text-muted);'>등록된 실행 항목이 없습니다.</div>");
        }
    });

    // 태스크 글자를 클릭해도 체크박스가 토글되도록 이벤트 리스너와 스타일 주입
    setTimeout(() => {
        if (!dv.container.dataset.clickBound) {
            dv.container.dataset.clickBound = "true";
            dv.container.addEventListener('click', (e) => {
                let li = e.target.closest('.task-list-item');
                if (li && e.target.tagName !== 'INPUT' && e.target.tagName !== 'A') {
                    let checkbox = li.querySelector('input.task-list-item-checkbox');
                    if (checkbox) checkbox.click();
                }
            });
            dv.container.classList.add("myworld-dv-container");
            const style = createEl("style");
            style.innerHTML = \`
                .myworld-dv-container .task-list-item { cursor: pointer; transition: background-color 0.2s ease; border-radius: 4px; padding-right: 5px; }
                .myworld-dv-container .task-list-item:hover { background-color: var(--background-modifier-hover); }
            \`;
            dv.container.appendChild(style);
        }
    }, 100);

} else {
    dv.paragraph("등록된 프로젝트가 없습니다.");
}
`;

    async createDefaultTemplatesFolderAndFiles(templatesDir: string): Promise<void> {
        await this.utils.ensureFolder(templatesDir);

        const projectPath_ko = `${templatesDir}/01.프로젝트 계획서 템플릿.md`;
        const projectPath_en = `${templatesDir}/01.Project Plan Template.md`;

        const defaultProjectText_ko = `---
작성일: "2000-01-01T00:00"
수정일: "2000-01-01T00:00"
---
# 실행
- [ ] \`# 실행\` 헤더 옆의 ✏️ 버튼을 누르거나 이곳에 임시 작업 및 아이디어를 즉시 입력하세요. 📅
- [ ] 혹은 하단의 '계획(Plan)' 구역에서 ⬆️ 버튼을 눌러 핵심 중요 태스크를 이곳으로 보내면 메인 스케줄에 즉시 연동됩니다. 📅

# 개요
- 기한 : 📅 2099-12-31 ~ 📅 2099-12-31
- 목표 : 프로젝트가 달성하고자 하는 궁극적인 목표를 한 줄로 선명하게 작성하세요.

# 계획
> **${t("progress_label", this.settings.language)}**: **${t("progress_need_write", this.settings.language)}**
- [ ] 프로젝트의 구체적인 실행 계획을 행동(Task) 단위로 쪼개어 이곳에 작성하세요. 📅 2026-07-14 ^step1
- [ ] 작성한 태스크 옆에 나타나는 ⬆️(실행 복사) 버튼을 클릭하면 최상단 \`# 실행\` 영역으로 쉽게 올려보낼 수 있습니다. ^step2
- [ ] 태스크 끝에 생성되는 고유 ID(\`^step3\`)를 통해 흩어진 태스크들의 진행률이 이 프로젝트 노트로 실시간 통합됩니다. ^step3

# 세부 사항
이곳에는 프로젝트의 세부적인 메모, 회의록, 참고 자료 링크 등을 자유롭게 서술하세요.
`;

        const defaultProjectText_en = `---
Created: "2000-01-01T00:00"
Modified: "2000-01-01T00:00"
---
# Execution
- [ ] Click the ✏️ button next to the \`# Execution\` header or jot down immediate tasks here. 📅
- [ ] Or, click the ⬆️ button in the 'Plan' section below to send critical tasks here. These tasks will also instantly sync to your main schedule. 📅

# Overview
- Deadline : 📅 2099-12-31 ~ 📅 2099-12-31
- Goal : Write a clear, one-line objective that this project ultimately aims to achieve.

# Plan
> **Progress**: **🚨 Needs writing!**
- [ ] Break down your specific execution plans into actionable tasks here. 📅 2026-07-14 ^step1
- [ ] Click the ⬆️ (Copy to Execution) button that appears next to the task to easily send it to the \`# Execution\` section at the top. ^step2
- [ ] The unique ID (\`^step3\`) at the end of each task ensures that progress from scattered tasks is integrated back here in real-time. ^step3

# Details
Freely document detailed notes, meeting minutes, reference links, and other project-related information here.
`;

        if (!this.app.vault.getAbstractFileByPath(projectPath_ko)) await this.app.vault.create(projectPath_ko, defaultProjectText_ko);
        if (!this.app.vault.getAbstractFileByPath(projectPath_en)) await this.app.vault.create(projectPath_en, defaultProjectText_en);

        const projectGuidePath_ko = `${templatesDir}/02.프로젝트_노트_작성_가이드.md`;
        const projectGuidePath_en = `${templatesDir}/02.Project_Note_Guide.md`;

        const projectGuideText_ko = `# 📘 프로젝트 노트 작성 가이드

이 문서는 프로젝트 노트에서 **'어떻게 태스크를 쪼개고, 어떻게 메인 스케줄과 연동시키는지'**를 알려주는 상세 사용법 가이드입니다.

---

## 🎯 핵심 연동 원리 (식별자 맵핑, ⬆️ 복사 & ✏️ 빠른 추가)
1. **\`# 실행\` 헤더 ✏️ 빠른 추가 버튼**: 최상단 \`# 실행\` 헤더 옆에 위치한 **✏️ (빠른 추가) 버튼**을 클릭하여 당장 쳐내야 할 태스크를 즉시 생성할 수 있습니다.
2. **\`계획(Plan)\` ⬆️ 복사 버튼**: 프로젝트 노트 하단의 **'계획(Plan)'** 구역에 체크박스를 만들고 글을 쓰면, 플러그인이 자동으로 문장 끝에 \`^abc12\` 와 같은 **고유 식별자(ID)**를 부여해 줍니다. 
   - 작성된 계획 태스크 옆에 나타나는 **⬆️ (실행 탭으로 복사) 버튼**을 클릭하면 해당 태스크가 최상단의 **\`# 실행\` 구역으로 자동 복사**되며, 메인 스케줄 노트 대시보드에 즉시 노출됩니다.
3. **양방향 완료 동기화**: 스케줄 화면이나 프로젝트 내에서 그 할 일을 체크(완료)하는 순간, 프로젝트 노트의 원본 태스크도 **자동으로 완료 처리**되며 프로젝트의 총 **진행률(%)**이 즉시 반영됩니다!

## 💡 요약: 예쁘게 쓰는 방법
- **# 개요**: 언제부터 언제까지 할 건지, 가장 큰 목표가 뭔지 적어두세요. 날짜는 📅(달력) 아이콘을 사용합니다 (예: \`- 기한 : 📅 2026-07-01 ~ 📅 2026-12-31\`).
- **# 계획**: 여기에 해야 할 일들을 쭉 나열하세요. (자동으로 \`^id\` 식별자가 생성됩니다)
- **# 실행**: ✏️ 버튼을 눌러 빠른 태스크를 추가하거나, ⬆️ 버튼을 통해 '계획'에서 올려보낸 중요한 태스크들을 수집하고 관리하세요.
- **# 세부 사항**: 관련된 메모나 링크, 긴 회의록 등을 편하게 적어두시면 됩니다.
`;

        const projectGuideText_en = `# 📘 Project Note Guide

This document explains **how to break down tasks and sync them with your main schedule** in a Project Note.

---

## 🎯 Core Sync Principle (ID Mapping, ⬆️ Copy & ✏️ Quick Add)
1. **\`# Execution\` ✏️ Quick Add Button**: Click the **✏️ (Quick Add) button** next to the top \`# Execution\` header to instantly create immediate tasks.
2. **\`Plan\` ⬆️ Copy Button**: When you create a checkbox in the **'Plan'** section at the bottom of a project note, the plugin automatically assigns a **unique ID** like \`^abc12\` at the end.
   - Click the **⬆️ (Copy to Execution) button** next to the planned task to copy it to the \`# Execution\` section at the top, which will instantly appear on your main schedule dashboard.
3. **Bi-directional Sync**: Checking off that task on your schedule or project note **automatically completes the original task** and updates the total **progress (%)** instantly!

## 💡 Summary: Best Practices
- **# Overview**: Write down the start/end dates and your main goal. Use the 📅 (calendar) icon for dates.
- **# Plan**: List everything you need to do here. (IDs will generate automatically).
- **# Execution**: Click the ✏️ button to add immediate tasks, or manage critical tasks sent up from 'Plan' via the ⬆️ button.
- **# Details**: Freely write related notes, links, or long meeting minutes here.
`;

        if (!this.app.vault.getAbstractFileByPath(projectGuidePath_ko)) await this.app.vault.create(projectGuidePath_ko, projectGuideText_ko);
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
  - **Routine & Schedule Stats**: Stores weekly/monthly routine checklist archive notes (e.g. \`2026-W31\`, \`2026-07\`) automatically created by the plugin.

---

## ⚙️ Routine & Schedule Management Controls
- **⚙️ Routine Manager Modal**: Click the ⚙️ button next to \`# Routine\` to safely manage categories and items without breaking markdown syntax.
- **🌤️ Daily Reset**: Click ☀️ next to \`# Routine\` to archive daily progress and reset checklists for tomorrow.
- **🗂️ Monthly Archive**: Click 🗂️ next to \`# Checklist\` to generate a monthly stats report.
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
  - **아카이브 자동 적재**: 일간 마감(☀️) 및 월간 아카이브(🗂️) 실행 시 생성되는 주간/월간 루틴 통계 노트(예: \`2026-W31.md\`, \`2026-07.md\`)가 이곳에 안전하게 자동 보관됩니다.

---

## ⚙️ 헤더 버튼 조작법 요약
- **⚙️ 루틴 편집 모달**: \`# 루틴\` 옆 ⚙️ 버튼을 클릭하여 양식 깨짐 없이 안전하게 루틴 카테고리/항목을 관리합니다.
- **☀️ 일간 마감 (Daily Reset)**: \`# 루틴\` 옆 ☀️ 버튼을 클릭하여 하루 기록을 마스터 표에 적재하고 내일 루틴을 리셋합니다.
- **🗂️ 월간 아카이브**: \`# 체크리스트\` 옆 🗂️ 버튼을 클릭하여 이번 달 루틴 달성률 집계 보고서를 생성합니다.
- **✏️ 빠른 할 일 / 📋 임시 메모**: \`# Todo\` 옆 ✏️ 버튼으로 할 일을 즉시 등록하거나 📋 버튼으로 아이디어 메모 노트를 엽니다.
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

