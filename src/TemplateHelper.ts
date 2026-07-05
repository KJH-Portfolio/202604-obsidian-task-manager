import { App } from "obsidian";
import { PluginSettings } from "./settings";
import { TaskUtils } from "./TaskUtils";
import { DateManager } from "./DateManager";
import { FileManager } from "./FileManager";

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

        const dailyPath = `${templatesDir}/데일리 스케줄 템플릿.md`;
        const projectPath = `${templatesDir}/프로젝트 계획서 템플릿.md`;

        const defaultDailyText = `---
작성일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
수정일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
cssclasses:
  - inline-routine
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
작성일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
수정일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
---
# 실행
- 
# 개요
- 기한 : 📅 2099-12-31 ~ 📅 2099-12-31
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

        const dailyGuidePath = `${templatesDir}/스케줄_노트_작성_가이드.md`;
        const projectGuidePath = `${templatesDir}/프로젝트_노트_작성_가이드.md`;

        const dailyGuideText = `# 📝 데일리 스케줄 노트 작성 가이드

이 문서는 데일리 스케줄 노트에서 **'어떤 버튼이 무슨 역할을 하는지'**, 그리고 **'내가 마음대로 수정해도 되는 영역과 건드리면 안 되는 영역'**이 어디인지 알려주는 가이드입니다.

---

## 🔘 상단 컨트롤 버튼 (매직 버튼)
스케줄 노트 상단에는 옵시디언의 복잡한 동작을 클릭 한 번으로 처리해 주는 자동화 버튼들이 있습니다.

- ⚡️ **(수시 동기화 / Task Manage)**: 데일리 노트를 작성하다가 최신 상태로 정렬이 필요하거나, 프로젝트의 할 일을 데일리로 끌어오고 싶을 때 누릅니다. (\`# Todo\` 영역이 마감일 순으로 자동 정렬됩니다.)
- 🌤️ **(일간 마감 / Daily Reset)**: 하루가 끝나고 다음 날 스케줄을 준비할 때 누릅니다. 루틴의 체크박스를 싹 비워주고, 오늘 달성한 루틴 통계를 월간 표로 이관해 줍니다.
- 🗂️ **(월간 아카이브 / Monthly Archive)**: 한 달이 끝나고 이번 달 루틴 달성률 통계를 추출하여 아카이브 폴더로 예쁘게 저장할 때 누릅니다.
- ✏️ **(빠른 캡처 / Quick Capture)**: 언제 어디서든 빠르게 할 일을 스케줄의 \`#### 할 일\` 밑으로 밀어넣고 싶을 때 누릅니다.
- 📋 **(빠른 메모 / Open Memo)**: 생각나는 아이디어를 빠르게 메모하고 싶을 때 누릅니다.

---

## 🎨 수정 가이드 (예시 화면)

아래는 스케줄 노트의 예시입니다. 플러그인이 데이터를 덮어씌우는 영역을 피해, **형광펜(==하이라이트==)으로 칠해진 부분만 자유롭게 수정 및 체크**하며 사용하시면 됩니다.

\`\`\`markdown
---
작성일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
수정일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
cssclasses:
  - inline-routine
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
> 🚀 전체 프로젝트 요약 대시보드 및 콜아웃 목록이 여기에 실시간으로 갱신됩니다.
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
`;

        const projectGuideText = `# 🚀 프로젝트 노트 작성 가이드

이 문서는 개별 프로젝트 노트를 작성할 때, **어떤 버튼을 눌러야 메인 스케줄과 연동되는지**, 그리고 **문서의 어느 위치에 계획과 세부 내용을 작성해야 하는지** 알려주는 가이드입니다.

---

## 🔘 상단 컨트롤 버튼 (매직 버튼)

- 📤 **(스케줄로 동기화 / Push to Schedule)**: 프로젝트 노트에서 할 일을 적거나 완료 처리한 뒤, 이 버튼을 누르면 **변경된 진행 상황과 할 일 목록이 메인 데일리 스케줄 노트의 대시보드(\`# Project\` 영역)로 실시간 덮어씌워집니다.** 
  - 팁: 프로젝트 문서에서 뭔가 할 일을 추가하거나 체크했다면 무조건 이 버튼을 한 번 눌러준다고 생각하시면 됩니다.

---

## 🎨 수정 가이드 (예시 화면)

프로젝트 노트는 자유도가 높지만, 플러그인이 할 일을 추적하기 위해 꼭 지켜야 하는 규칙이 있습니다. **형광펜(==하이라이트==)으로 칠해진 부분을 확인해 보세요.**

\`\`\`markdown
---
작성일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
수정일: "<% tp.date.now("YYYY-MM-DD[T]HH:mm") %>"
---
# 실행
==- [ ] 메인 페이지 디자인 시안 완성하기==
==- [x] 기획안 제출==

# 개요
- 기한 : ==📅 2026-07-01 ~ 📅 2026-07-20==
- 목표 : ==플러그인 V1.0 스토어 정식 배포==

# 계획
> **진행도**: **🚨 작성 필요!** (이 부분은 플러그인이 프로그레스 바 🟩🟩⬜⬜ 로 자동 교체해 줍니다. 지우지 마세요!)
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
`;

        if (!this.app.vault.getAbstractFileByPath(dailyGuidePath)) {
            await this.app.vault.create(dailyGuidePath, dailyGuideText);
        }
        if (!this.app.vault.getAbstractFileByPath(projectGuidePath)) {
            await this.app.vault.create(projectGuidePath, projectGuideText);
        }
    }

    async setupParaStructure(): Promise<number> {
        let createdCount = 0;
        const paraDirs = ["0. Inbox", "1. Project", "2. Area", "3. Resource", "4. Archive", "10.File"];
        
        for (const dir of paraDirs) {
            await this.utils.ensureFolder(dir);
        }

        const guidePath = "0. Inbox/00.지식관리_시스템_통합_가이드.md";
        const guideContent = `# 🧠 제2의 두뇌: 통합 지식 관리 시스템 가이드

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

        if (!this.app.vault.getAbstractFileByPath(guidePath)) {
            await this.app.vault.create(guidePath, guideContent);
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
