---
작성일: 2026-06-05
수정일: 2026-06-05T11:59
---
# MyWorld Task Manager

> **파편화된 할 일과 스케줄 관리를 중앙 집중화하고, 일일 루틴과 프로젝트를 완벽하게 연동하는 옵시디언 코어 플러그인**  
> 이 플러그인은 기존 템플레이터(Templater)의 복잡한 스크립트를 완전히 대체하며, 단 한 번의 클릭으로 스마트한 지식 관리 체계를 구축합니다.

---

<br>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Obsidian-483699?style=flat-square&logo=obsidian&logoColor=white" />
  <img src="https://img.shields.io/badge/esbuild-FFCF00?style=flat-square&logo=esbuild&logoColor=black" />
</p>

<div align="center">
  <!-- 이미지 스크린샷은 나중에 실제 저장소에 맞게 수정해주세요 -->
  <img src="./images/main.png" width="49%" alt="스케줄 메인 화면">
  <img src="./images/quick_capture.png" width="49%" alt="빠른 캡처 창">
</div>

---

> [!IMPORTANT]  
> **사용자의 지식 관리 시스템(PARA)과 결합하여 강력한 데일리 플래너와 스케줄링 환경을 제공합니다.**  
> - 문서 하단의 `<details>`를 열어보시면 플러그인의 핵심 아키텍처와 상세 기능들을 확인하실 수 있습니다.
> - **[자세한 설치 및 통합 사용 설명서 보러가기](./docs/8.%20플러그인_통합_사용_설명서.md)**

---
<details>
<summary><b>1. 기본 정보 (개발 환경 및 기술 스택) 📅</b></summary>
<br>

- 🖥️ **플랫폼:** Obsidian Desktop (Windows/Mac)
- 🛠️ **기술 스택 (Tech Stack):**
  - **Language:** `TypeScript`
  - **Environment:** `Node.js 18+`, `Obsidian API 1.5.0+`
  - **Bundler:** `esbuild`
  - **Styling:** `CSS3`

</details>

---
<details>
<summary><b>2. 프로젝트 전체 개요 (설계도 및 구조) 📊</b></summary>
<br>

**🎯 1. 프로젝트 목표**
> 옵시디언 내에서 할 일(Task)들이 파편화되는 문제를 막고, 메인 스케줄 노트와 서브 프로젝트 노트들이 서로 완벽하게 **양방향 동기화(Bi-directional Sync)**되는 것을 목표로 합니다.

**📊 2. 시스템 아키텍처 및 플러그인 설계 명세**
- 구조적이고 안정적인 데이터 동기화를 위해 옵시디언 파일 I/O 및 메타데이터 캐시 시스템을 활용했습니다.
- 👉 **[플러그인 설계 및 구현 명세서](./docs/3.%20플러그인_설계_및_구현_명세서.md)**

**💡 3. 사용자 메뉴얼 및 가이드**
- 플러그인 초기 세팅부터 모든 버튼의 동작 원리를 기술한 통합 매뉴얼
- 👉 **[플러그인 통합 사용 설명서](./docs/8.%20플러그인_통합_사용_설명서.md)**

</details>

---
<details id="core-features">
<summary><b>3. 주요 기능 하이라이트 (Core Features) 🚀</b></summary>
<br>

**1) 지식 관리 시스템 자동 구축 (Setup Helper)**
- 버튼 한 번 클릭으로 **PARA (Project, Area, Resource, Archive)** 구조와 **제텔카스텐(Zettelkasten)** 폴더 구조를 자동 생성합니다.
- 데일리 스케줄 및 프로젝트를 관리할 기본 템플릿(Template) 파일들까지 완벽하게 세팅합니다.

**2) 강력한 할 일 양방향 동기화 (Task Sync)**
- 메인 `스케줄 노트`와 각 `프로젝트 노트` 사이의 할 일 완료 상태(`[x]`)나 내용 수정이 **양방향으로 동기화**됩니다. (⚡ 수시 동기화 버튼 클릭)
- 어디서 체크하든 원본 데이터가 안전하게 일치됩니다.

**3) 디데이(D-Day) 자동 계산 및 정렬**
- 할 일을 입력할 때 마감일을 지정하면, 디데이를 계산하여 뱃지 형태(`#D-0`, `#D-5` 등)로 예쁘게 색상을 입혀 시각화합니다.
- 마감일이 임박한 순서대로 스케줄 노트에 **자동으로 정렬**되어, 무엇이 급한지 즉시 파악할 수 있습니다.

**4) ✏️ 빠른 할 일 등록 (Quick Capture)**
- 데일리 노트 어디서든 상단의 버튼을 눌러 **빠른 할 일 모달창**을 엽니다.
- 달력(Date Picker)과 입력창을 통해 내일 혹은 특정 날짜로 편하게 할 일을 주입할 수 있습니다.

**5) 🔄 자정 데일리 리셋 및 통계 아카이빙**
- 매일 자정이 지나 새로운 날이 밝으면, 전날의 스케줄 기록을 **월간 통계 노트**로 자동으로 보내어 안전하게 백업합니다.
- 오늘 해야 할 루틴과 새로운 할 일 목록들로 깔끔하게 화면을 리셋합니다.

</details>

---
<details id="technical-deepdive">
<summary><b>4. 기술적 깊이 - 문제 해결 및 최적화 사례 🛠️</b></summary>
<br>

개발 과정에서 겪었던 수많은 옵시디언 API 한계점과 동시성 문제들을 돌파한 사례입니다. 자세한 문제 해결 보고서는 👉 **[개발 중 오류 및 해결 보고서](./docs/6.%20개발_중_오류_및_해결_보고서.md)**를 참고하세요.

**1️⃣ [Data Integrity] 동기화 중 파일 훼손 방지를 위한 트랜잭션 및 롤백 시스템**
- 비동기로 파일을 읽고 쓰는 과정(`processFrontMatter` 및 `vault.modify`)에서 타이밍 에러로 인해 사용자 데이터가 날아가는 현상을 방지하기 위해, 수정 전 데이터를 메모리에 저장하고 실패 시 즉각 **롤백(Rollback)**하는 안전 장치를 구현했습니다.

**2️⃣ [CSS Specificity] 읽기 모드(Reading View) 스타일링 충돌 해결**
- 옵시디언 기본 테마의 강력한 CSS가 커스텀 스타일을 무시하는 현상을 극복하고자, `.markdown-rendered li.task-list-item.is-checked` 등 상세한 체이닝과 DOM 셀렉터를 분석하여 완벽한 크로스 뷰(라이브 프리뷰 - 읽기 모드) 경험을 제공했습니다.

**3️⃣ [UX Optimization] 모달창 입력 편의성 개선**
- 빠른 캡처 창에서 날짜 지정이 번거로운 문제를 해결하기 위해, 모달창 렌더링 시 **기본값을 '오늘'로 자동 지정**하고 `[+]` 버튼 하나만으로 날짜를 하루씩 슉슉 늘릴 수 있는 직관적 UI를 설계했습니다.

</details>

---
<details>
<summary>부록: 설치 및 시작 가이드</summary>

> 본 플러그인은 현재 커뮤니티 스토어에 등록 요청(PR) 중이며, 수동으로 바로 설치하여 사용하실 수 있습니다.

1. **저장소 다운로드**: GitHub Releases 페이지에서 최신 버전의 `main.js`, `manifest.json`, `styles.css` 파일을 다운로드합니다.
2. **폴더 복사**: 본인의 옵시디언 보관소 경로 중 `.obsidian/plugins/` 폴더 안에 `myworld-task-manager`라는 새 폴더를 만들고 세 파일을 넣습니다.
3. **활성화**: 옵시디언을 재시작한 뒤, `설정` > `커뮤니티 플러그인`에서 **MyWorld Task Manager**를 활성화합니다.
4. **시작하기**: 플러그인 설정창으로 이동하여 `[PARA 구조 생성]` 및 `[스케줄 관리 노트 생성]` 버튼을 눌러보세요!

</details>
