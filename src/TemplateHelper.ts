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
            if (diff < 0) { badge = "[지각] "; color = "#8c0028"; }
            else if (diff === 0) { badge = "[D-0] "; color = "#e93147"; }
            else if (diff === 1) { badge = "[D-1] "; color = "#ffd200"; }
            else if (diff === 2) { badge = "[D-2] "; color = "#44cf6e"; }
            else if (diff === 3) { badge = "[D-3] "; color = "#086ddd"; }
            else { badge = \`[D-\${diff}] \`; color = "#969696"; }
        } else if (inheritedBadge) {
            badge = inheritedBadge.badge;
            color = inheritedBadge.color;
        }

        if (badge !== "") {
            badgeMap.set(t.line, { badge, color });
            // t.text를 수정하면 원본 파일 매칭에 실패하여 클릭 시 업데이트가 안되는 버그 발생
            // 따라서 시각적 렌더링에만 관여하는 t.visual 속성을 사용합니다.
            t.visual = \`<span style="color: \${color}; font-weight: 800;">\${badge}</span>\` + t.text;
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
                // 체크박스나 링크 자체를 클릭한 게 아니라면
                if (li && e.target.tagName !== 'INPUT' && e.target.tagName !== 'A') {
                    let checkbox = li.querySelector('input.task-list-item-checkbox');
                    if (checkbox) checkbox.click(); // 체크박스 클릭 트리거
                }
            });
            // 시각적 피드백(마우스 호버 시 색상 변화, 커서 포인터) 및 체크박스 수직 정렬 보정
            const style = createEl("style");
            style.innerHTML = \`
                .task-list-item { cursor: pointer; transition: background-color 0.2s ease; border-radius: 4px; padding-right: 5px; }
                .task-list-item:hover { background-color: var(--background-modifier-hover); }
                /* 뱃지 폰트 굵기 때문에 어긋난 체크박스의 높이를 위로 살짝 끌어올려서 텍스트와 중앙 정렬을 맞춥니다 */
                .task-list-item > input.task-list-item-checkbox {
                    position: relative;
                    top: -1.5px;
                }
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
- [ ] 갑자기 떠오른 즉각적인 임시 작업이나 아이디어를 이곳에 자유롭게 기록하세요. 📆
- [ ] 혹은 하단의 '계획(Plan)' 구역에서 복사한 핵심 중요 태스크를 이곳에 배치하면 해당 작업 또한 메인 스케줄에 즉시 연동됩니다. 📆

# 개요
- 기한 : 📆 2099-12-31 ~ 📆 2099-12-31
- 목표 : 프로젝트가 달성하고자 하는 궁극적인 목표를 한 줄로 선명하게 작성하세요.

# 계획
> **${t("progress_label", this.settings.language)}**: **${t("progress_need_write", this.settings.language)}**
- [ ] 프로젝트의 구체적인 실행 계획을 행동(Task) 단위로 쪼개어 이곳에 작성하세요. 📆 2026-07-14 ^step1
- [ ] 작성한 태스크를 데일리 노트의 \`#### 할일\` 영역으로 복사해서 가져가면 스케줄에 연동됩니다. ^step2
- [ ] 태스크 끝에 생성되는 고유 ID(\`^step3\`)를 통해 흩어진 태스크들의 진행률이 이 프로젝트 노트로 실시간 통합됩니다. ^step3

# 세부 사항
이곳에는 프로젝트의 세부적인 메모, 회의록, 참고 자료 링크 등을 자유롭게 서술하세요.
`;

        const defaultProjectText_en = `---
Created: "2000-01-01T00:00"
Modified: "2000-01-01T00:00"
---
# Execution
- [ ] Freely jot down any sudden ideas or immediate, temporary tasks here. 📆
- [ ] Or, paste critical tasks copied from the 'Plan' section below. These tasks will also instantly sync to your main schedule. 📆

# Overview
- Deadline : 📆 2099-12-31 ~ 📆 2099-12-31
- Goal : Write a clear, one-line objective that this project ultimately aims to achieve.

# Plan
> **Progress**: **🚨 Needs writing!**
- [ ] Break down your specific execution plans into actionable tasks here. 📆 2026-07-14 ^step1
- [ ] Copy these tasks into the \`#### Todo\` section of your daily schedule to sync them. ^step2
- [ ] The unique ID (\`^step3\`) at the end of each task ensures that progress from scattered tasks is integrated back here in real-time. ^step3

# Details
Freely document detailed notes, meeting minutes, reference links, and other project-related information here.
`;

        if (!this.app.vault.getAbstractFileByPath(projectPath_ko)) await this.app.vault.create(projectPath_ko, defaultProjectText_ko);
        if (!this.app.vault.getAbstractFileByPath(projectPath_en)) await this.app.vault.create(projectPath_en, defaultProjectText_en);

        const projectGuidePath_ko = `${templatesDir}/02.프로젝트_노트_작성_가이드.md`;
        const projectGuidePath_en = `${templatesDir}/02.Project_Note_Guide.md`;

        const projectGuideText_ko = `# 📘 프로젝트 노트 작성 가이드

이 문서는 프로젝트 노트에서 **'어떻게 태스크를 쪼개고, 어떻게 데일리 스케줄과 연동시키는지'**를 알려주는 가이드입니다.

---

## 🎯 핵심 연동 원리 (식별자 맵핑)
프로젝트 노트 하단의 **'계획(Plan)'** 구역에 체크박스를 만들고 글을 쓰면, 플러그인이 자동으로 문장 끝에 \`^abc12\` 와 같은 **고유 식별자(ID)**를 부여해 줍니다. 
1. 이 체크박스 줄을 통째로 복사해서 **데일리 스케줄 노트의 \`#### 할일\` 영역**에 붙여넣어 보세요!
2. 그러면 데일리 노트에서 그 할 일을 체크(완료)하는 순간, 프로젝트 노트의 원본 태스크도 **자동으로 완료 처리**되며 프로젝트의 총 **진행률(%)**이 즉시 올라갑니다!

## 💡 요약: 예쁘게 쓰는 방법
- **# 개요**: 언제부터 언제까지 할 건지, 가장 큰 목표가 뭔지 적어두세요.
- **# 계획**: 여기에 해야 할 일들을 쭉 나열하세요. (자동으로 식별자가 생깁니다)
- **# 실행**: 계획에서 복사해 온 중요한 태스크나, 당장 쳐내야 할 단발성 태스크들을 올려두고 관리하세요.
- **# 세부 사항**: 관련된 메모나 링크, 긴 회의록 등을 편하게 적어두시면 됩니다.
`;

        const projectGuideText_en = `# 📘 Project Note Guide

This document explains **how to break down tasks and sync them with your daily schedule** in a Project Note.

---

## 🎯 Core Sync Principle (ID Mapping)
When you create a checkbox and write text in the **'Plan'** section at the bottom of a project note, the plugin automatically assigns a **unique ID** like \`^abc12\` at the end of the sentence.
1. Try copying this entire checkbox line and pasting it into the **\`#### Todo\` section of your Daily Schedule Note**!
2. When you check off that task in your daily note, the original task in the project note is **automatically marked as complete**, and the project's total **progress (%)** updates instantly!

## 💡 Summary: Best Practices
- **# Overview**: Write down the start/end dates and your main goal.
- **# Plan**: List everything you need to do here. (IDs will generate automatically).
- **# Execution**: Keep critical tasks copied from the Plan here, or jot down immediate, temporary tasks.
- **# Details**: Freely write related notes, links, or long meeting minutes here.
`;

        if (!this.app.vault.getAbstractFileByPath(projectGuidePath_ko)) await this.app.vault.create(projectGuidePath_ko, projectGuideText_ko);
        if (!this.app.vault.getAbstractFileByPath(projectGuidePath_en)) await this.app.vault.create(projectGuidePath_en, projectGuideText_en);
    }
}