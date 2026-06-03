import { App, TFile, moment } from "obsidian";
import { PluginSettings } from "./settings";
import { TaskUtils } from "./TaskUtils";

export class TemplateHelper {
    app: App;
    settings: PluginSettings;
    utils: TaskUtils;

    constructor(app: App, settings: PluginSettings, utils: TaskUtils) {
        this.app = app;
        this.settings = settings;
        this.utils = utils;
    }

    async createDefaultTemplatesFolderAndFiles(templatesDir: string): Promise<void> {
        await this.utils.ensureFolder(templatesDir);

        const dailyPath = `${templatesDir}/데일리 스케줄 템플릿.md`;
        const projectPath = `${templatesDir}/프로젝트 계획서 템플릿.md`;

        const defaultDailyText = `---
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
#### 프로젝트
> (오늘 할 일 없음)

#### 할 일
- [ ] 오늘 마감인 작업 📅 {{date}}
# Project
> 🚀 전체 프로젝트 요약 대시보드 및 콜아웃 목록이 여기에 실시간으로 갱신됩니다.

# 체크리스트

| 날짜  | Step | Block | 멘탈  | 식단  | 운동  | 취침  | 디톡스 |
| :-: | :--: | :---: | :-: | :-: | :-: | :-: | :-: |
|  1  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
|  2  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
|  3  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
|  4  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
|  5  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
|  6  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
|  7  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
|  8  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
|  9  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 10  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 11  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 12  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 13  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 14  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 15  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 16  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 17  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 18  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 19  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 20  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 21  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 22  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 23  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 24  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 25  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 26  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 27  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 28  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 29  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 30  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |
| 31  |  -   |   -   |  -  |  -  |  -  |  -  |  -  |

# 통계
> 📈 루틴 집계 및 아카이브 통계가 10일 구간별로 렌더링됩니다.
`;

        const defaultProjectText = `---
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

        if (!this.app.vault.getAbstractFileByPath(dailyPath)) {
            await this.app.vault.create(dailyPath, defaultDailyText);
        }
        if (!this.app.vault.getAbstractFileByPath(projectPath)) {
            await this.app.vault.create(projectPath, defaultProjectText);
        }
    }

    replacePlaceholder(template: string, replacements: Record<string, string>): string {
        let result = template;
        for (const [key, value] of Object.entries(replacements)) {
            const regex = new RegExp(`{{${key}}}`, "g");
            result = result.replace(regex, value);
        }
        return result;
    }

    async setupParaStructure(): Promise<number> {
        let createdCount = 0;
        const paraSpecs = [
            {
                dir: "0. Inbox",
                file: "0. Inbox/00.Inbox_설명.md",
                content: `# 📥 0. Inbox (수집함) 사용 설명서\n\n이 폴더는 외부에서 유입되는 날것의 정보나 스쳐 지나가는 아이디어를 가장 먼저 빠르게 담는 **대기소(임시 수집함)**입니다.\n\n### 💡 활용 원칙\n- **빠른 수집**: 형식을 따지지 않고 생각나는 메모, 웹 클리핑 자료 등을 무조건 여기에 수집합니다.\n- **주기적 비우기**: 하루에 한 번 또는 일주일에 한 번씩 이 폴더의 노트들을 검토하여 적절한 폴더(Project, Area, Resource, Zettelkasten 등)로 이동시키고 이 폴더는 비워진 상태를 유지합니다.\n`
            },
            {
                dir: "1. Project",
                file: "1. Project/00.Project_설명.md",
                content: `# 🚀 1. Project (프로젝트) 사용 설명서\n\n이 폴더는 **명확한 목표와 데드라인(기한)이 있는 단기적 작업**에 대한 기획서 및 실행 노트를 보관합니다.\n\n### 💡 활용 원칙\n- **단기적 집중**: 구체적인 완성 일정이 있는 프로젝트들을 독립 노드로 만들어 관리합니다.\n- **연동 관리**: 할 일 목록 및 D-Day 마커를 연동하여 적극적으로 마감을 추적합니다.\n- **아카이브 이관**: 프로젝트가 완료되거나 중단되면 즉시 \`4. Archive\` 폴더로 이동시킵니다.\n`
            },
            {
                dir: "2. Area",
                file: "2. Area/00.Area_설명.md",
                content: `# 🌿 2. Area (역할 영역) 사용 설명서\n\n이 폴더는 데드라인은 없지만 **내 삶이나 업무에서 지속적으로 관리하고 개선해야 하는 책임 영역**을 관리합니다.\n\n### 💡 활용 원칙\n- **지속성**: 건강 관리, 재정 계획, 개인 공부 루틴, 인간관계 등 명확한 종결 시점이 없는 영역을 다룹니다.\n- **체크 관리**: 주기적으로 확인하여 삶의 밸런스와 루틴이 무너지지 않도록 기준선을 잡는 노트를 작성합니다.\n`
            },
            {
                dir: "3. Resource",
                file: "3. Resource/00.Resource_설명.md",
                content: `# 📚 3. Resource (지식 자료) 사용 설명서\n\n이 폴더는 지속적인 의무 영역은 아니지만 **미래에 유용하게 참고할 수 있는 관심사, 연구 자료, 지식 데이터베이스**를 아카이빙합니다.\n\n### 💡 활용 원칙\n- **참고 자료**: 책 요약, 강의 정리 노트, 개발 소스코드 스니펫, 템플릿 양식 등을 모아둡니다.\n- **지식 탐색**: 나중에 특정 주제를 연구하거나 개발할 때 지식 검색 창고로 활용합니다.\n`
            },
            {
                dir: "4. Archive",
                file: "4. Archive/00.Archive_설명.md",
                content: `# 🗂️ 4. Archive (보관소) 사용 설명서\n\n이 폴더는 **더 이상 활성화되지 않거나 종료된 항목들을 보존**하는 역사 창고입니다.\n\n### 💡 활용 원칙\n- **정리 대상**: 완료된 프로젝트, 폐기된 계획, 관심사가 멀어진 영역 리소스 등을 보관합니다.\n- **보존 가치**: 지우기는 아깝지만 당장 내 눈에 띄어 주의력을 분산시키는 요소들을 격리하여 인지 과부하를 줄입니다.\n`
            },
            {
                dir: "10.File",
                file: "10.File/00.File_설명.md",
                content: `# 📎 10.File (미디어 첨부파일) 사용 설명서\n\n이 폴더는 지식 노트에 첨부되는 **이미지, PDF, 오디오, 비디오 등의 바이너리 자산**을 격리 보관하는 장소입니다.\n\n### 💡 활용 팁\n- **자동 지정 추천**: 옵시디언의 \`설정 ➡️ 파일 및 링크 ➡️ 새 첨부파일 저장 경로\`를 **"아래에 지정한 폴더"**로 선택한 후 \`10.File\` 폴더를 타겟으로 지정해 두면, 노트 본문이 지저분한 이미지 파일들로 인해 복잡해지는 것을 막을 수 있습니다.\n`
            }
        ];

        for (const spec of paraSpecs) {
            await this.utils.ensureFolder(spec.dir);
            if (!this.app.vault.getAbstractFileByPath(spec.file)) {
                await this.app.vault.create(spec.file, spec.content);
                createdCount++;
            }
        }
        return createdCount;
    }

    async setupZettelkastenStructure(): Promise<number> {
        let createdCount = 0;
        const zettelSpecs = [
            {
                dir: "5. Zettelkasten",
                file: "5. Zettelkasten/00.Zettelkasten_설명.md",
                content: `# 🧠 5. Zettelkasten (상자 메모법) 사용 설명서\n\n이 폴더는 파편화된 지식을 엮어 나만의 독창적인 아이디어와 지식 네트워크를 구축하는 **제텔카스텐(Zettelkasten) 허브**입니다.\n\n### 💡 하위 구조 및 활용\n- **01. Fleeting (임시 메모)**: 순간적인 생각이나 메모를 적어두고 1~2일 내에 정제하여 영구 메모로 승격하는 곳입니다.\n- **02. Literature (문헌 메모)**: 책, 논문, 기사, 동영상 등을 감상하고 저자의 관점에서 핵심만 요약한 독서 노트입니다.\n- **03. Permanent (영구 메모)**: 문헌 메모나 임시 메모를 기반으로 나만의 언어로 완전히 새롭게 쓴 지식 조각이며, 다른 메모들과 양방향 링크로 연결되어 사유의 그물을 형성합니다.\n`
            },
            {
                dir: "5. Zettelkasten/01.Fleeting",
                file: "5. Zettelkasten/01.Fleeting/00.Fleeting_설명.md",
                content: `# 📝 01. Fleeting (임시 메모) 사용 설명서\n\n하루 동안 생각나는 날것의 아이디어, 영감, 낙서를 빠르게 기록하는 임시 상자입니다.\n\n### 💡 원칙\n- 격식 없이 자유롭게 적고, 주기적으로(1~2일 내) 검토하여 영구 메모(Permanent Note)로 확장하거나 불필요한 생각은 삭제합니다.\n`
            },
            {
                dir: "5. Zettelkasten/02.Literature",
                file: "5. Zettelkasten/02.Literature/00.Literature_설명.md",
                content: `# 📖 02. Literature (문헌 메모) 사용 설명서\n\n책, 웹사이트, 비디오, 논문 등 다른 매체에서 습득한 외부 아이디어를 저술가의 맥락에서 정리하는 공간입니다.\n\n### 💡 원칙\n- 저자의 핵심 주장을 나만의 문장으로 짧게 요약하며, 반드시 참고한 출처(서지 정보)를 기입합니다.\n`
            },
            {
                dir: "5. Zettelkasten/03.Permanent",
                file: "5. Zettelkasten/03.Permanent/00.Permanent_설명.md",
                content: `# 💎 03. Permanent (영구 메모) 사용 설명서\n\n나만의 생각과 통찰로 완전히 재구성한 독자적인 핵심 아이디어 메모 공간입니다.\n\n### 💡 원칙\n- **일자일의(一子一意)**: 한 노트에는 오직 하나의 완성된 아이디어만 담습니다.\n- **링크 연결**: 기존의 다른 영구 메모들과 촘촘하게 링크로 엮어 관계와 의미의 네트워크를 만듭니다.\n`
            }
        ];

        for (const spec of zettelSpecs) {
            await this.utils.ensureFolder(spec.dir);
            if (!this.app.vault.getAbstractFileByPath(spec.file)) {
                await this.app.vault.create(spec.file, spec.content);
                createdCount++;
            }
        }
        return createdCount;
    }
}
