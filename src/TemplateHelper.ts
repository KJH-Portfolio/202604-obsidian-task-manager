import { App } from "obsidian";
import { PluginSettings } from "./settings";
import { TaskUtils } from "./TaskUtils";
import { t } from "./i18n";

export class TemplateHelper {
    private app: App;
    private settings: PluginSettings;
    private utils: TaskUtils;

    constructor(app: App, settings: PluginSettings, utils: TaskUtils) {
        this.app = app;
        this.settings = settings;
        this.utils = utils;
    }

    public updateSettings(settings: PluginSettings) {
        this.settings = settings;
    }

    public getScheduleTemplateContent(isKo: boolean): string {
        let content = isKo ? defaultScheduleText_ko : defaultScheduleText_en;
        content = content.replace("{{YEAR}}", new Date().getFullYear().toString());
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

    // 4. 상호작용 가능한 태스크 리스트 UI 생성
    projects.forEach(p => {
        if (p.planTasksTotal === 0 && p.execTasks.length === 0) return;
        
        let calloutType = "info";
        let icon = "📝";
        if (p.sortPri === 0 || p.sortPri === 1) { calloutType = "error"; icon = (p.sortPri === 0) ? "🔥" : "🚨"; }
        else if (p.sortPri === 2) { calloutType = "warning"; icon = "⚠️"; }
        else if (p.sortPri === 100) { calloutType = "success"; icon = "🏁"; }
        
        let linkHtml = \`<a data-href="\${p.link.path}" href="\${p.link.path}" class="internal-link" target="_blank" rel="noopener" style="text-decoration: none; color: inherit;">\${p.noteName}</a>\`;
        let headerHtml = \`<div class="callout" data-callout="\${calloutType}" style="margin-top: 20px; margin-bottom: 10px;">
  <div class="callout-title" dir="auto">
    <div class="callout-title-inner">\${icon} \${linkHtml} <span style="font-weight:normal; font-size:0.9em; opacity:0.8;">(\${p.pct}%)</span></div>
  </div>
</div>\`;
        dv.span(headerHtml);
        
        if (p.execTasks.length > 0) {
            dv.taskList(p.execTasks, false);
            if (dv.container.lastElementChild) {
                dv.container.lastElementChild.style.marginLeft = "25px";
                dv.container.lastElementChild.style.marginBottom = "15px";
            }
        } else {
            dv.span("<div style='margin-left: 25px; margin-bottom: 15px; font-size: 0.9em; color: var(--text-muted);'>등록된 실행 항목이 없습니다.</div>");
        }
    });

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
- [ ] 메인 스케줄의 \`# Project ⚙️\` 버튼 팝업을 열거나, 하단의 '계획' 구역에서 ⬆️ 버튼을 눌러 중요한 핵심 태스크를 이곳으로 전달하세요. 📅

# 개요
- 기한 : 📅 2099-12-31 ~ 📅 2099-12-31
- 목표 : 프로젝트가 달성하고자 하는 궁극적인 목표를 한 줄로 선명하게 작성하세요.

# 계획
> **${t("progress_label", this.settings.language)}**: **${t("progress_need_write", this.settings.language)}**
- [ ] 이곳은 프로젝트의 세부 로드맵, 분석 항목, 백엔드/프론트엔드 태스크를 자유롭게 수립하고 수정하는 공간입니다. 📅 2026-07-14 ^step1
- [ ] 항목 우측의 ⬆️(복사) 버튼을 클릭하면 상단 \`# 실행\` 영역으로 빠르게 올려보내 메인 스케줄 노트에 즉시 노출됩니다. ^step2

# 세부 사항
이곳에는 프로젝트의 세부 메모, 회의록, 아키텍처 분석 자료, 참고 링크 등을 자유롭게 서술하세요.
`;

        const defaultProjectText_en = `---
Created: "2000-01-01T00:00"
Modified: "2000-01-01T00:00"
---
# Execution
- [ ] Open the \`# Project ⚙️\` popup on your main schedule, or click the ⬆️ button under 'Plan' below to send tasks here. 📅

# Overview
- Deadline : 📅 2099-12-31 ~ 📅 2099-12-31
- Goal : Write a clear, one-line objective that this project aims to achieve.

# Plan
> **Progress**: **🚨 Needs writing!**
- [ ] Freely document and edit your roadmap, analysis tasks, and milestones here. 📅 2026-07-14 ^step1
- [ ] Click the ⬆️ (Copy to Execution) button next to a task to send it to \`# Execution\` for main schedule visibility. ^step2

# Details
Freely write notes, reference materials, architecture docs, and meeting minutes here.
`;

        if (!this.app.vault.getAbstractFileByPath(projectPath_ko)) await this.app.vault.create(projectPath_ko, defaultProjectText_ko);
        if (!this.app.vault.getAbstractFileByPath(projectPath_en)) await this.app.vault.create(projectPath_en, defaultProjectText_en);

        const projectGuidePath_ko = `${templatesDir}/02.프로젝트_노트_작성_가이드.md`;
        const projectGuidePath_en = `${templatesDir}/02.Project_Note_Guide.md`;

        const projectGuideText_ko = `# 📘 프로젝트 노트 작성 및 관리 가이드 (v1.0.101)

이 문서는 프로젝트 노트에서 **'어떻게 자유롭게 계획을 수립하고, 모달 팝업으로 메인 스케줄과 손쉽게 연동하는지'**를 알려주는 가이드입니다.

---

## 🎯 핵심 사용 방법 (원스톱 ⚙️ 모달 & ⬆️ 계획 복사)

1. **스케줄 문서는 팝업 모달로 100% 원스톱 수정**:
   - 스케줄 문서의 마크다운을 직접 고칠 필요 없이, 메인 스케줄의 **\`# Project ⚙️\` 버튼**을 누르면 모든 활성 프로젝트의 실행 항목이 한눈에 세로로 나열됩니다.
   - 팝업에서 실행 항목을 손쉽게 추가/수정/삭제/순서 이동하고 **\`[💾 프로젝트 저장 및 동기화]\`** 버튼 하나로 일괄 반영합니다.

2. **\`# 계획\` (Plan) 구역 — 자유로운 로드맵 수립**:
   - 프로젝트 하단의 **\`# 계획\`** 영역은 사용자가 세부 분석 항목, 개발 단계, 백엔드/프론트엔드 작업 등을 **자유롭게 수립하고 고치는 전용 공간**입니다.
   - 계획 항목 우측에 붙은 **⬆️ (실행 탭 복사) 버튼**을 누르면 최상단 **\`# 실행\` 탭으로 자동 복사**되어 메인 스케줄 노트에 즉시 노출됩니다.

3. **D-Day 테두리 시각화 & 부모 마감일 상속**:
   - 지저분한 문구 없이 **텍스트 박스 테두리 색상만** exact D-Day 색상(🔴 오늘/지연, 🟡 D-1, 🟢 D-2, 🔵 D-3 등)으로 깔끔하게 연동됩니다.
   - 자식 태스크는 **직계 부모 태스크의 마감일을 자동으로 역추적 상속**받아 동일한 긴급도 테두리가 적용됩니다.

---

## 💡 요약: 영역별 역할
- **# 개요**: 기한(\`- 기한 : 📅 2026-07-01 ~ 📅 2026-12-31\`) 및 핵심 목표를 적는 곳입니다.
- **# 계획**: 로드맵과 세부 작업을 자유롭게 나열하고 수정하는 공간입니다. (⬆️ 버튼으로 실행 탭 복사)
- **# 실행**: 메인 스케줄의 **\`# Project ⚙️\` 모달**을 통해 원스톱으로 관리되는 실천 작업 구역입니다.
- **# 세부 사항**: 회의록, 아키텍처 분석, 참고 링크 등을 편하게 적어두시면 됩니다.
`;

        const projectGuideText_en = `# 📘 Project Note & Task Management Guide (v1.0.101)

This document explains **how to freely plan roadmap tasks and manage execution via GUI popups**.

---

## 🎯 Core Principles (One-stop ⚙️ Modal & ⬆️ Plan Copy)

1. **One-stop GUI Schedule Management**:
   - No need to edit raw markdown text manually. Click the **\`# Project ⚙️\` button** on your schedule note to manage all active project execution tasks in a single popup window.
   - Easily add, edit, delete, or reorder tasks, and click **\`[Save & Sync]\`** to update all notes instantly.

2. **\`# Plan\` Section — Freely Editable Roadmap**:
   - The **\`# Plan\`** area is your personal space to freely outline milestones, technical analysis, and roadmap steps.
   - Click the **⬆️ (Copy to Execution) button** next to any planned task to copy it up to the **\`# Execution\`** section for main schedule visibility.

3. **D-Day Border Visualization & Date Inheritance**:
   - Clear urgency border colors (🔴 Today/Overdue, 🟡 D-1, 🟢 D-2, 🔵 D-3) without clutter.
   - Indented child tasks automatically inherit their parent's deadline for consistent border colors.

---

## 💡 Summary: Section Roles
- **# Overview**: Write target deadlines and main objectives here.
- **# Plan**: Freely outline and edit detailed roadmaps here (click ⬆️ to copy to Execution).
- **# Execution**: Managed seamlessly via the **\`# Project ⚙️\` modal** on your main schedule.
- **# Details**: Document meeting notes, links, and reference materials freely.
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

### 3️⃣ 3. Resource
- **Definition**: Interests or external knowledge databases that are not immediately needed for current tasks, but **may be useful in the future**.

### 4️⃣ 4. Archive
- **Definition**: A historical repository preserving items from the above three folders that are **no longer active or have been completed**.

---

## ⚙️ One-Stop ⚙️ Modal Controls
- **⚙️ Todo Modal**: Click ⚙️ next to \`# Todo\` to manage tasks, order, dates, and indents without touching raw markdown.
- **⚙️ Routine Modal**: Click ⚙️ next to \`# Routine\` to safely manage routine categories and items.
- **⚙️ Project Modal**: Click ⚙️ next to \`# Project\` to view all active project tasks at a glance, edit them, and sync instantly.
`;

        const guideContent_ko = `# 🧠 제2의 두뇌: 통합 지식 관리 시스템 가이드

이 옵시디언 환경은 파편화된 할 일과 지식들을 체계적으로 관리하기 위해 세팅되었습니다.
우리의 지식 관리 생태계는 크게 **[수집(Inbox)] ➡️ [분류 및 행동(PARA)] ➡️ [영구 지식화(Zettelkasten)]** 의 3단계 흐름으로 굴러갑니다.

---

## 📥 1단계: 수집 (0. Inbox)
지금 이 문서를 보고 계신 \`0. Inbox\` 폴더는 **모든 날것의 생각과 메모들이 가장 먼저 거쳐가는 대기소(정거장)**입니다.
- **💡 활용 원칙**
  - **빠른 수집**: 형식을 따지지 않고 생각나는 메모, 웹 클리핑 자료 등을 무조건 여기에 수집합니다.
  - **주기적 비우기**: 하루에 한 번 또는 일주일에 한 번씩 이 폴더의 노트들을 검토하여 적절한 폴더로 이동시킵니다.

---

## 🏗️ 2단계: 분류 및 행동 (PARA 시스템)

### 1️⃣ 1. Project (프로젝트)
- **정의**: 명확한 목표와 **데드라인(마감일)**이 있는 단기적인 작업들.
- **💡 활용 원칙**
  - 메인 스케줄의 **\`# Project ⚙️\` 버튼 팝업**을 이용하여 100% 원스톱으로 실행 항목을 파악하고 일괄 동기화합니다.
  - 프로젝트 노트 하단의 **\`# 계획\`** 구역은 로드맵과 세부 분석 내용을 **자유롭게 수립하고 수정**하며, **\`⬆️\` 복사 버튼**으로 실행 탭에 빠르게 전송합니다.

---

## ⚙️ 헤더 버튼 팝업 조작법 요약
- **⚙️ Todo 관리**: \`# Todo\` 옆 ⚙️ 버튼을 클릭하여 할 일, 마감일, 순서(\`Alt+↑/↓\`), 들여쓰기를 원스톱으로 관리합니다.
- **⚙️ 루틴 관리**: \`# 루틴\` 옆 ⚙️ 버튼을 클릭하여 루틴 카테고리/항목을 안전하게 관리합니다.
- **⚙️ 프로젝트 관리**: \`# Project\` 옆 ⚙️ 버튼을 클릭하여 모든 활성 프로젝트의 실행 항목을 한눈에 일괄 편집하고 저장합니다.
- **☀️ 일간 마감 (Daily Reset)**: 하루 기록을 마스터 표에 적재하고 내일 루틴을 리셋합니다.
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

const defaultScheduleText_ko = `---
작성일: "{{YEAR}}-01-01T00:00"
수정일: "{{YEAR}}-01-01T00:00"
---
# Todo

# 루틴
> **[루틴 체크리스트]**

# 프로젝트

# 체크리스트
`;

const defaultScheduleText_en = `---
Created: "{{YEAR}}-01-01T00:00"
Modified: "{{YEAR}}-01-01T00:00"
---
# Todo

# Routine
> **[Routine Checklist]**

# Project

# Checklist
`;
