export const translations = {
    // ----------------------------------------------------
    // Settings Tab Headers
    // ----------------------------------------------------
    settings_header_general: { en: "General Settings", ko: "일반 설정" },
    settings_header_paths: { en: "1. Path Settings", ko: "1. 경로 설정" },
    settings_header_helper_para: { en: "2. Knowledge Management System Setup Helper (PARA & Zettelkasten)", ko: "2. 지식 관리 시스템 구축 헬퍼 (PARA & 제텔카스텐)" },
    settings_header_helper_file: { en: "3. Default Environment & File Creation Helper", ko: "3. 기본 환경 및 파일 생성 헬퍼" },
    settings_header_custom_templates: { en: "4. Custom Template Settings", ko: "4. 커스텀 노트 템플릿 본문 정의" },
    settings_header_danger_zone: { en: "5. Danger Zone", ko: "5. 설정 초기화" },
    settings_header_support: { en: "6. Support & Feedback", ko: "6. 지원 및 피드백" },

    // ----------------------------------------------------
    // General Settings
    // ----------------------------------------------------
    settings_language_name: { en: "Language (언어)", ko: "언어 (Language)" },
    settings_language_desc: { en: "Choose plugin default language. / 플러그인 기본 언어를 선택합니다.", ko: "플러그인 기본 언어를 선택합니다. / Choose plugin default language." },


    // ----------------------------------------------------
    // Path Settings
    // ----------------------------------------------------
    settings_projects_folder_name: { en: "Projects Folder Path", ko: "프로젝트 폴더 경로" },
    settings_projects_folder_desc: { en: "Specify the folder path where project plan notes are stored.", ko: "프로젝트 계획서 노트들이 보관될 폴더 경로를 지정하세요." },

    settings_main_schedule_name: { en: "Main Schedule Note Path", ko: "메인 스케줄 노트 경로" },
    settings_main_schedule_desc: { en: "Specify the daily schedule file path containing routines and the integrated dashboard.", ko: "루틴과 통합 대시보드가 들어간 일일 스케줄 파일 경로를 지정하세요." },

    settings_archive_folder_name: { en: "Archive Root Folder Path", ko: "아카이브 루트 폴더 경로" },
    settings_archive_folder_desc: { en: "Specify the archive folder path where weekly/monthly stats and journal notes will be automatically created and accumulated.", ko: "주간/월간 통계 및 일지 노트가 자동 생성되고 누적될 아카이브 폴더 경로를 지정하세요." },

    settings_fleeting_memo_name: { en: "Fleeting Memo File Path", ko: "임시 메모 파일 경로" },
    settings_fleeting_memo_desc: { en: "Specify the fleeting memo markdown file path that will be created and opened when clicking the 📋 button in the main schedule.", ko: "메인 스케줄의 📋 버튼 클릭 시 생성되고 열릴 임시 메모 마크다운 파일 경로를 지정하세요." },

    settings_templates_folder_name: { en: "Templates Folder Path", ko: "템플릿 폴더 경로" },
    settings_templates_folder_desc: { en: "Specify the folder path where the default template notes for the plugin (Daily Schedule, Project Plan) will be saved.", ko: "플러그인용 기본 템플릿 노트(데일리 스케줄, 프로젝트 계획서)가 보존될 폴더 경로를 지정하세요." },


    settings_midnight_offset_name: { en: "Midnight Offset Hour", ko: "자정 보정 기준 시간" },
    settings_midnight_offset_desc: { en: "Specify the hour until which morning executions are treated as records of the previous day. (0-12 hours)", ko: "새벽 몇 시 이전까지의 마감 실행을 전날 날짜의 기록으로 취급할지 지정합니다. (0~12시)" },

    // ----------------------------------------------------
    // Knowledge Management System Setup Helper
    // ----------------------------------------------------
    settings_para_create_name: { en: "Create PARA Structure", ko: "PARA 구조 생성" },
    settings_para_create_desc: { en: "Automatically creates the PARA Knowledge Management System structure (0. Inbox, 1. Project, 2. Area, 3. Resource, 4. Archive, 10.File) and manuals for each folder at the vault root.", ko: "보관소 루트에 PARA 지식 관리 시스템(0. Inbox, 1. Project, 2. Area, 3. Resource, 4. Archive, 10.File) 구조와 폴더별 설명서를 자동 생성합니다." },
    settings_para_create_btn: { en: "Create PARA Structure", ko: "PARA 구조 생성" },
    confirm_para_create: { en: "Are you sure you want to create the PARA folder structure at the vault root?\\n(Existing folders will be safely skipped.)", ko: "정말 PARA 지식 관리 폴더 구조를 보관소 최상단에 일괄 생성하시겠습니까?\\n(이미 존재하는 폴더는 안전하게 건너뜁니다.)" },
    notice_para_created: { en: "✅ Created {count} new PARA system folders/manuals!", ko: "✅ PARA 시스템 폴더/설명서 {count}개가 신규 생성되었습니다!" },
    notice_para_exists: { en: "✅ Skipped file creation because all PARA structures already exist.", ko: "✅ 이미 모든 PARA 구조가 존재하여 파일 생성을 건너뛰었습니다." },
    notice_para_error: { en: "🚨 An error occurred while creating the PARA system structure.", ko: "🚨 PARA 시스템 구조 생성 중 오류가 발생했습니다." },

    settings_zettel_create_name: { en: "Create Zettelkasten Structure", ko: "제텔카스텐 구조 생성" },
    settings_zettel_create_desc: { en: "Automatically creates the Zettelkasten system structure (5. Zettelkasten and subfolders Fleeting, Literature, Permanent) and manuals for each folder at the vault root.", ko: "보관소 루트에 제텔카스텐 지식 관리 시스템(5. Zettelkasten 및 하위 Fleeting, Literature, Permanent 폴더) 구조와 폴더별 설명서를 자동 생성합니다." },
    settings_zettel_create_btn: { en: "Create Zettelkasten Structure", ko: "제텔카스텐 구조 생성" },
    confirm_zettel_create: { en: "Are you sure you want to create the Zettelkasten folder structure at the vault root?\\n(Existing folders will be safely skipped.)", ko: "정말 제텔카스텐 지식 관리 폴더 구조를 보관소 최상단에 일괄 생성하시겠습니까?\\n(이미 존재하는 폴더는 안전하게 건너뜁니다.)" },
    notice_zettel_created: { en: "✅ Created {count} new Zettelkasten folders/manuals!", ko: "✅ 제텔카스텐 폴더/설명서 {count}개가 신규 생성되었습니다!" },
    notice_zettel_exists: { en: "✅ Skipped file creation because all Zettelkasten structures already exist.", ko: "✅ 이미 모든 제텔카스텐 구조가 존재하여 파일 생성을 건너뛰었습니다." },
    notice_zettel_error: { en: "🚨 An error occurred while creating the Zettelkasten structure.", ko: "🚨 제텔카스텐 구조 생성 중 오류가 발생했습니다." },

    // ----------------------------------------------------
    // Default Environment & File Creation Helper
    // ----------------------------------------------------
    settings_template_create_name: { en: "Create Project Plan Template", ko: "프로젝트 계획서 템플릿 생성" },
    settings_template_create_desc: { en: "Automatically creates a default Project Plan template note after receiving the desired vault folder path.", ko: "원하는 보관소 내 폴더 경로를 입력받아 플러그인용 프로젝트 계획서 기본 양식을 자동으로 생성합니다." },
    settings_template_create_btn: { en: "Create Project Plan Template", ko: "프로젝트 계획서 템플릿 생성" },
    notice_template_created: { en: "✅ Default template files created under {resultPath}!", ko: "✅ {resultPath} 하위에 기본 템플릿 파일들이 생성되었습니다!" },
    notice_template_error: { en: "🚨 An error occurred while creating templates.", ko: "🚨 템플릿 파일 생성 중 오류가 발생했습니다." },

    settings_schedule_create_name: { en: "Create Schedule Management Note", ko: "스케줄 관리 노트 생성" },
    settings_schedule_create_desc: { en: "Instantly creates the permanent Schedule Management note based on the 'Main Schedule Note Path'.", ko: "설정된 '메인 스케줄 노트 경로'를 감지하여 관제탑 역할의 영구 스케줄 노트를 즉시 생성합니다." },
    settings_schedule_create_btn: { en: "Run Schedule Creation", ko: "스케줄 생성 실행" },
    notice_schedule_created: { en: "✅ Schedule Management note created!", ko: "✅ 스케줄 관리 노트가 생성되었습니다!" },



    // ----------------------------------------------------
    // Custom Template Settings
    // ----------------------------------------------------
    settings_custom_daily_name: { en: "Custom Daily Schedule Template", ko: "커스텀 데일리 스케줄 템플릿" },
    settings_custom_daily_desc: { en: "Write your own daily schedule note content to use instead of the default template. (Leave empty to use default)", ko: "데일리 스케줄 노트 생성 시 활용될 커스텀 본문 양식을 입력하세요 (비워두면 기본 내장 양식 사용)." },
    settings_custom_daily_placeholder: { en: "You can use placeholders like {{date}}, {{time}}, {{currentDay}}.", ko: "{{date}}, {{time}}, {{currentDay}} 등의 플레이스홀더를 사용할 수 있습니다." },

    settings_custom_project_name: { en: "Custom Project Note Template", ko: "커스텀 프로젝트 노트 템플릿" },
    settings_custom_project_desc: { en: "Write your own project note content to use instead of the default template. (Leave empty to use default)", ko: "신규 프로젝트 노트 생성 시 활용될 커스텀 본문 양식을 입력하세요 (비워두면 기본 내장 양식 사용)." },
    settings_custom_project_placeholder: { en: "You can use placeholders like {{projectName}}.", ko: "{{projectName}} 등의 플레이스홀더를 사용할 수 있습니다." },

    // ----------------------------------------------------
    // Danger Zone
    // ----------------------------------------------------
    settings_reset_name: { en: "Reset Plugin Settings", ko: "설정값 초기화" },
    settings_reset_desc: { en: "Reset all plugin settings and custom templates to default. Warning: This cannot be undone!", ko: "플러그인의 모든 설정을 기본값으로 되돌립니다. (주의: 기존 설정 정보가 소실되며, 되돌릴 수 없습니다.)" },
    settings_reset_btn: { en: "Run Reset", ko: "초기화 실행" },
    confirm_reset: { en: "Are you sure you want to reset all settings to default?", ko: "정말로 모든 설정값을 초기 상태로 되돌리시겠습니까?" },
    notice_reset_complete: { en: "✅ All settings have been reset!", ko: "✅ 모든 설정값이 초기화되었습니다!" },

    // ----------------------------------------------------
    // Support & Feedback
    // ----------------------------------------------------
    settings_support_name: { en: "Bug Reports & Feature Requests", ko: "버그 제보 및 기능 제안" },
    settings_support_desc: { en: "If you encounter any issues or need new features, please let us know via GitHub issues.", ko: "플러그인 사용 중 문제가 발생했거나 새로운 기능이 필요하다면 GitHub 이슈를 통해 알려주세요." },
    settings_support_btn: { en: "Go to GitHub Issues", ko: "GitHub 이슈로 이동" },

    settings_notice_toggle_name: { en: "Recent Updates & Developer Comments", ko: "최근 업데이트 및 개발자 코멘트" },
    settings_notice_toggle_desc: { en: "Check the latest plugin changes and messages from the developer.", ko: "플러그인의 최신 변경 사항 및 개발자의 메시지를 확인합니다." },
    settings_notice_update_title: { en: "✨ Recent Updates", ko: "✨ 최근 업데이트" },
    settings_notice_update_content: { en: "- The plugin is continuously being improved and developed.\n- Testing English version support in settings.", ko: "- 현재 지속적으로 기능 개선 및 개발이 진행 중인 단계입니다.\n- 현재 설정창 및 템플릿의 영어 버전(English Version) 지원을 테스트 중입니다." },
    settings_notice_dev_title: { en: "💬 Developer Comments", ko: "💬 개발자 코멘트" },
    settings_notice_dev_content: { en: "Thank you for using MyWorld Task Manager! Feel free to leave feedback on GitHub.", ko: "MyWorld Task Manager를 사용해 주셔서 감사합니다! 버그나 피드백은 언제든 GitHub에 남겨주세요." },
    btn_show_content: { en: "Show Content", ko: "내용 보기" },
    btn_hide_content: { en: "Hide Content", ko: "내용 숨기기" },

    // ----------------------------------------------------
    // Modals & Startup
    // ----------------------------------------------------
    modal_template_path_title: { en: "Specify Template Note Location", ko: "템플릿 노트 생성 위치 지정" },
    modal_template_path_desc: { en: "Enter the relative path (from Vault) of the folder to create default templates (Daily Schedule, Project Plan). (e.g. 3. Resource/01.Templates)\\nIf the folder doesn't exist, it will be created.", ko: "기본 템플릿 노트(데일리 스케줄, 프로젝트 계획서)를 생성할 폴더의 보관소(Vault) 기준 상대 경로를 입력하세요. (예: 3. Resource/01.Templates)\\n폴더가 없는 경우 자동으로 생성됩니다." },
    modal_template_path_label: { en: "Creation Folder Path", ko: "생성 폴더 경로" },
    btn_create: { en: "Create", ko: "생성하기" },
    btn_cancel: { en: "Cancel", ko: "취소" },
    btn_confirm: { en: "Confirm", ko: "확인" },
    notice_empty_path: { en: "🚨 Please enter the folder path to create.", ko: "🚨 생성할 폴더 경로를 입력해 주세요." },

    // ----------------------------------------------------
    // Commands
    // ----------------------------------------------------
    cmd_sync_main: { en: "Sync Project Identifiers", ko: "프로젝트 식별자 동기화" },
    cmd_quick_capture: { en: "Manage Todo Items", ko: "Todo 항목 관리" },
    cmd_daily_reset: { en: "Daily Reset", ko: "메인 스케줄 일간 마감" },
    cmd_monthly_archive: { en: "Create Monthly Archive", ko: "월간 아카이브 생성" },
    cmd_para_setup: { en: "Setup PARA System", ko: "PARA 지식 관리 시스템 구축" },
    cmd_zettelkasten_setup: { en: "Setup Zettelkasten System", ko: "제텔카스텐 지식 관리 시스템 구축" },
    cmd_monthly_stats: { en: "Extract Monthly Routine Stats to Archive", ko: "월간 루틴 달성률 아카이브 추출" },

    // ----------------------------------------------------
    // Quick Capture Modal
    // ----------------------------------------------------
    modal_add_task_title: { en: "✏️ Add Task", ko: "✏️ 할 일 등록" },
    modal_add_task_desc: { en: "Will be added instantly to the main schedule.", ko: "메인 스케줄에 즉시 추가됩니다." },
    modal_add_task_desc_project: { en: "Will be added instantly to the project Execution section.", ko: "프로젝트 실행 탭에 즉시 추가됩니다." },
    modal_add_task_placeholder: { en: "e.g. Drink 2L water", ko: "예: 물 2L 마시기" },
    modal_add_task_btn: { en: "Save (Enter)", ko: "저장하기 (Enter)" },
    modal_empty_warning: { en: "Please enter a task or text.", ko: "할 일 또는 텍스트를 입력하세요." },

    // Todo Manager Modal
    todo_modal_title: { en: "⚙️ Manage Todo Items", ko: "⚙️ Todo 항목 관리" },
    todo_modal_help_title: { en: "💡 Keyboard Shortcuts Guide", ko: "💡 키보드 단축키 안내" },
    todo_modal_help_move: { en: "• Alt + ↑ / ↓ : Move item order up / down", ko: "• Alt + ↑ / ↓ : 항목 순서 위/아래 이동" },
    todo_modal_help_indent: { en: "• Tab / Shift+Tab (or Alt + → / ←) : Indent (make child) / Outdent", ko: "• Tab / Shift+Tab (또는 Alt + → / ←) : 들여쓰기(자식화) / 내어쓰기" },
    todo_modal_help_enter: { en: "• Enter : Add new task in top input", ko: "• Enter : 상단 입력창에서 새 할 일 추가" },
    todo_modal_help_date: { en: "• Click Date Box : Open calendar picker", ko: "• 날짜 박스 클릭 : 달력 팝업 오픈" },
    todo_modal_input_placeholder: { en: "Add new todo task... (Enter)", ko: "새 할 일 추가... (Enter)" },

    // ----------------------------------------------------
    // Notices / Notifications
    // ----------------------------------------------------
    notice_task_added: { en: "✅ Task added to main schedule.", ko: "✅ 할 일이 메인 스케줄에 추가되었습니다." },
    
    notice_project_exists: { en: "⚠️ Project with the same name already exists.", ko: "⚠️ 동일한 이름의 프로젝트가 이미 존재합니다." },
    notice_project_created: { en: "✅ New project note created: {projectName}", ko: "✅ 새 프로젝트 노트가 생성되었습니다: {projectName}" },
    notice_project_error: { en: "🚨 An error occurred while creating the project.", ko: "🚨 프로젝트 생성 중 에러가 발생했습니다." },
    notice_schedule_exists: { en: "ℹ️ Schedule Management note already exists.", ko: "ℹ️ 스케줄 관리 노트가 이미 존재합니다." },
    notice_schedule_error: { en: "🚨 An error occurred while creating the schedule management note.", ko: "🚨 스케줄 관리 노트 생성 중 에러가 발생했습니다." },
    
    // ----------------------------------------------------
    // Parser Strings & Automated Generation
    // ----------------------------------------------------
    header_checklist: { en: "# Checklist", ko: "# 체크리스트" },
    header_stats: { en: "# Stats", ko: "# 통계" },
    header_plan: { en: "# Plan", ko: "# 계획" },
    header_record: { en: "# Record", ko: "# 기록" },
    msg_no_data: { en: "> [!info] Segment {num}: No data", ko: "> [!info] {num}구간: 데이터 없음" },
    segment_1: { en: "Segment 1 (1st-10th)", ko: "1구간 (1일~10일)" },
    segment_2: { en: "Segment 2 (11th-20th)", ko: "2구간 (11일~20일)" },
    segment_3: { en: "Segment 3 (21st-End)", ko: "3구간 (21일~말일)" },
    monthly_total: { en: "Monthly Total Stats", ko: "이달의 전체 종합 통계" },

    // ----------------------------------------------------
    // Default Paths
    // ----------------------------------------------------
    default_main_schedule_path: { en: "1. Project/01.Schedule.md", ko: "1. Project/01.스케줄.md" },
    default_archive_folder: { en: "4. Archive/98.Schedule", ko: "4. Archive/98.Schedule" },
    default_fleeting_memo_path: { en: "5. Zettelkasten/01.Fleeting/Fleeting Memo.md", ko: "5. Zettelkasten/01.Fleeting/임시 메모.md" },
    default_templates_folder: { en: "3. Resource/01.Templates", ko: "3. Resource/01.Templates" },
    default_project_directory: { en: "1. Project/00.Tasks", ko: "1. Project/00.Tasks" },
    default_stats_directory: { en: "4. Archive/99.Stats", ko: "4. Archive/99.Stats" },



    // Default Values

    // ----------------------------------------------------
    // System Notices (Synchronizer, ResetManager, Main)
    // ----------------------------------------------------
    sync_full_start: { en: "⏳ Starting full schedule sync...", ko: "⏳ 스케줄 전체 동기화 시작..." },
    sync_full_complete: { en: "✅ Full schedule sync complete!", ko: "✅ 스케줄 전체 동기화 완료!" },
    sync_fail_restore: { en: "🚨 Sync failed: Original data restored.", ko: "🚨 동기화 실패: 원본 데이터를 복구했습니다." },
    sync_fail_critical: { en: "🚨 Sync and restore failed. Please check files manually.", ko: "🚨 동기화 실패 + 복구도 실패했습니다. 파일을 수동으로 확인해주세요." },
    sync_dashboard_start: { en: "⏳ Updating schedule and dashboard...", ko: "⏳ 스케줄 반영 및 대시보드 갱신 중..." },
    sync_no_main: { en: "🚨 Cannot find the main schedule file.", ko: "🚨 메인 스케줄 파일을 찾을 수 없습니다." },
    sync_update_fail_restore: { en: "🚨 Update failed: Original data restored.", ko: "🚨 반영 실패: 원본 데이터를 복구했습니다." },
    sync_update_fail_critical: { en: "🚨 Update and restore failed. Please check files manually.", ko: "🚨 반영 실패 + 복구도 실패했습니다. 파일을 수동으로 확인해주세요." },
    empty_project_dashboard: { en: "> (No active projects.)", ko: "> (진행 중인 프로젝트가 없습니다.)" },

    reset_prep_daily: { en: "⏳ Preparing daily reset...", ko: "⏳ 일간 마감 준비 중..." },
    reset_start_daily: { en: "⏳ Starting daily reset...", ko: "⏳ 일간 마감 및 리셋 시작..." },
    reset_complete: { en: "✅ Ready for a new day!", ko: "✅ 새로운 하루 준비 완료!" },
    reset_fail_restore: { en: "🚨 Reset failed: All related files restored.", ko: "🚨 리셋 실패: 모든 연관 파일을 복구했습니다." },
    reset_fail_error: { en: "🚨 Reset failed: An error occurred.", ko: "🚨 리셋 초기화 실패: 에러가 발생했습니다." },
    
    reset_archive_start: { en: "⏳ Starting manual monthly stats archiving...", ko: "⏳ 월간 통계 수동 아카이빙 시작..." },
    reset_archive_no_table: { en: "⚠️ Cannot find checklist table to archive.", ko: "⚠️ 아카이빙할 체크리스트 표를 찾을 수 없습니다." },
    reset_archive_no_data: { en: "⚠️ Not enough data in the checklist table.", ko: "⚠️ 체크리스트 표에 데이터가 부족합니다." },
    reset_archive_complete: { en: "✅ Manual monthly stats archiving and dashboard update complete!", ko: "✅ 월간 통계 수동 아카이빙 및 대시보드 갱신 완료!" },
    reset_archive_no_dashboard: { en: "⚠️ No generated stats dashboard found.", ko: "⚠️ 생성된 통계 대시보드가 없습니다." },
    reset_archive_fail_restore: { en: "🚨 Archiving failed: Original data restored.", ko: "🚨 아카이빙 실패: 원본 데이터를 복구했습니다." },
    reset_archive_fail_error: { en: "🚨 An error occurred during archiving.", ko: "🚨 아카이빙 중 에러가 발생했습니다." },
    reset_archive_fail_critical: { en: "🚨 Archiving and restore failed. Please check files manually.", ko: "🚨 아카이빙 실패 + 복구도 실패했습니다. 파일을 수동으로 확인해주세요." },

    notice_project_name_req: { en: "Please enter a project name.", ko: "프로젝트명을 입력해주세요." },
    notice_not_project_folder: { en: "⚠️ The currently open note is not in the project folder.", ko: "⚠️ 현재 열려 있는 노트가 프로젝트 폴더에 속해 있지 않습니다." },
    notice_add_task_error: { en: "🚨 An error occurred while adding the task.", ko: "🚨 할 일 추가 도중 에러가 발생했습니다." },
    notice_sync_project_complete: { en: "🔄 Schedule sync complete.", ko: "🔄 스케줄 동기화가 완료되었습니다." },
    notice_no_active_sync: { en: "⚠️ No active document to sync.", ko: "⚠️ 동기화할 활성 문서가 없습니다." },
    
    notice_para_created2: { en: "✅ PARA system folder structure and manual created.", ko: "✅ PARA 시스템 폴더 구조 및 가이드 문서가 생성되었습니다." },
    notice_para_error2: { en: "🚨 An error occurred while creating PARA system structure.", ko: "🚨 PARA 시스템 구조 생성 중 에러가 발생했습니다." },
    notice_zettel_created2: { en: "✅ Zettelkasten folder structure and manual created.", ko: "✅ 제텔카스텐 폴더 구조 및 가이드 문서가 생성되었습니다." },
    notice_zettel_error2: { en: "🚨 An error occurred while creating Zettelkasten structure.", ko: "🚨 제텔카스텐 구조 생성 중 에러가 발생했습니다." },
    
    notice_quick_memo_created: { en: "📝 New fleeting memo file created.", ko: "📝 새 임시 메모 파일이 생성되었습니다." },
    notice_quick_memo_error: { en: "🚨 An error occurred while creating or opening fleeting memo.", ko: "🚨 임시 메모를 생성하거나 여는 도중 에러가 발생했습니다." },

    // ----------------------------------------------------
    // Additional Missed Translations
    // ----------------------------------------------------
    sync_project_complete: { en: "✅ [{noteName}] Schedule sync complete!", ko: "✅ [{noteName}] 스케줄 반영 완료!" },
    progress_label: { en: "Progress", ko: "진행도" },
    overall_project_summary: { en: "🚀 Overall Project Summary", ko: "🚀 전체 프로젝트 요약" },
    overall_project_summary_desc: { en: "🚀 Overall project summary dashboard and callouts will be updated here in real time.", ko: "🚀 전체 프로젝트 요약 대시보드 및 콜아웃 목록이 여기에 실시간으로 갱신됩니다." },
    progress_need_write: { en: "🚨 Needs Writing!", ko: "🚨 작성 필요!" },

    // ----------------------------------------------------
    // Calendar Widget UI
    // ----------------------------------------------------
    cal_sun: { en: "Sun", ko: "일" },
    cal_mon: { en: "Mon", ko: "월" },
    cal_tue: { en: "Tue", ko: "화" },
    cal_wed: { en: "Wed", ko: "수" },
    cal_thu: { en: "Thu", ko: "목" },
    cal_fri: { en: "Fri", ko: "금" },
    cal_sat: { en: "Sat", ko: "토" },
    cal_delete: { en: "Clear", ko: "삭제" },
    cal_today: { en: "Today", ko: "오늘" },
    cal_tooltip: { en: "Set Date", ko: "날짜 지정" },

    // Command Palette
    cmd_push_project: { en: "Push Project Info to Schedule", ko: "현재 프로젝트 정보를 스케줄에 반영" },
    cmd_refresh_view: { en: "Refresh Active View Sync", ko: "현재 창 수동 동기화 실행" },
    cmd_create_project: { en: "Create New Project", ko: "새 프로젝트 노트 생성" },
    cmd_create_schedule: { en: "Create Today's Schedule", ko: "오늘의 일정 관리 노트 생성" },
    cmd_setup_para: { en: "Setup PARA Folder Structure", ko: "원클릭 PARA 시스템 폴더 구조 생성" },
    cmd_setup_zettel: { en: "Setup Zettelkasten Structure", ko: "원클릭 제텔카스텐 폴더 구조 생성" },

    // New Notices
    notice_no_schedule_path: { en: "🚨 Schedule Management note not found. Check path: {path}", ko: "🚨 스케줄 관리 노트를 찾을 수 없습니다. 경로를 확인하세요: {path}" },
    notice_no_schedule: { en: "🚨 Schedule Management note not found: {path}", ko: "🚨 스케줄 관리 노트를 찾을 수 없습니다: {path}" },
    notice_archive_updating: { en: "📂 Updating weekly archive...", ko: "📂 주간 아카이브 갱신 중..." },
    notice_project_emptied: { en: "✅ [{noteName}] Project was emptied and pushed to schedule.", ko: "✅ [{noteName}] 프로젝트가 비워져 스케줄에 반영되었습니다." },

    no_info: { en: "(No info)", ko: "(정보없음)" },

    no_data: { en: "No data to display.", ko: "표시할 데이터가 없습니다." },
    stats_title: { en: "Checklist Statistics", ko: "체크리스트 통계" },

    // ----------------------------------------------------
    // Daily Reset Modal & Stats Table
    // ----------------------------------------------------
    modal_reset_title: { en: "🌤️ Daily Reset & Review", ko: "🌤️ 일간 마감 및 데일리 리셋" },
    modal_review_label: { en: "Today's Review", ko: "오늘의 회고" },
    modal_review_desc: { en: "Enter your thoughts or reflections for today.", ko: "오늘 하루의 생각이나 소회를 기입하세요." },
    modal_review_placeholder: { en: "Write your review for today here...", ko: "여기에 오늘의 회고를 작성하세요..." },
    modal_step_label: { en: "Tomorrow's Step", ko: "내일의 Step" },
    modal_step_desc: { en: "Enter your core D-day goal to execute tomorrow.", ko: "내일 실행할 핵심 디데이 목표를 기입하세요." },
    modal_step_placeholder: { en: "e.g. Follow the plan...", ko: "예: 계획 따라 움직이기 등..." },
    modal_submit_btn: { en: "Submit & Finish", ko: "제출 및 마감" },

    table_header_item: { en: "Item", ko: "항목" },
    table_header_chart: { en: "Cumulative Chart", ko: "세부 누적 그래프" },

    // Essential Plugins
    settings_header_plugins: { en: "Essential Plugins", ko: "필수 플러그인 안내" },
    settings_plugins_name: { en: "Required Plugins List", ko: "필수 플러그인 목록 확인" },
    settings_plugins_desc: { en: "View the list of plugins required for MyWorld Task Manager to work perfectly.", ko: "MyWorld Task Manager를 100% 활용하기 위해 함께 설치해야 하는 필수 플러그인 목록을 확인합니다." },
    settings_plugins_btn: { en: "View Plugins", ko: "목록 보기" },
    modal_plugins_title: { en: "Essential & Recommended Plugins", ko: "필수 및 권장 플러그인 안내" },
    modal_plugins_desc: { en: "To fully utilize this plugin, please install and enable the following plugins in Obsidian:\n\n🚨 [Required] Advanced URI (by Vinzent03)\nWhy? The 'Magic Buttons' (Quick Capture, Daily Reset, Monthly Archive, etc.) in the daily schedule use `obsidian://advanced-uri` links. Without this plugin, clicking them will do nothing.\n\n🌟 [Highly Recommended] Periodic Notes\nWhy? Helpful for seamlessly navigating and managing your daily schedule notes every day, in addition to the plugin's built-in creation button.\n\n🌟 [Highly Recommended] Calendar (by Liam Cain)\nWhy? Highly recommended for quickly navigating between daily schedules using the right sidebar calendar.", ko: "이 플러그인을 100% 활용하기 위해 다음 플러그인들을 꼭 함께 설치해 주세요:\n\n🚨 [필수] Advanced URI (by Vinzent03)\n왜 필요한가요? 데일리 스케줄 상단의 '매직 버튼(빠른 캡처, 일간 마감 등)'은 명령 실행을 위해 이 플러그인에 의존합니다. 설치하지 않으면 버튼을 눌러도 반응하지 않습니다.\n\n🌟 [강력 권장] Periodic Notes\n왜 필요한가요? 플러그인에 내장된 '스케줄 자동 생성' 버튼 외에도, 매일 새로운 스케줄 노트를 쉽게 관리하고 다른 날짜로 이동하려면 권장됩니다.\n\n🌟 [강력 권장] Calendar (by Liam Cain)\n왜 필요한가요? 우측 사이드바에 달력을 띄워두고 특정 날짜의 스케줄로 빠르게 이동하기 위해 가장 찰떡궁합입니다." },

    // ----------------------------------------------------
    // Project Overview & Plan Modals
    // ----------------------------------------------------
    header_overview: { en: "# Overview", ko: "# 개요" },
    cmd_edit_project_overview: { en: "Edit Project Overview", ko: "프로젝트 개요 관리" },
    cmd_edit_project_plan: { en: "Edit Project Plan", ko: "프로젝트 계획 관리" },
    overview_modal_title: { en: "⚙️ Manage Project Overview", ko: "⚙️ 프로젝트 개요 관리" },
    plan_modal_title: { en: "⚙️ Manage Project Plan", ko: "⚙️ 프로젝트 계획 관리" },
    overview_period_title: { en: "📅 Period Setting", ko: "📅 기한 설정" },
    overview_start_date: { en: "Start Date", ko: "시작일" },
    overview_end_date: { en: "End Date", ko: "종료일" },
    overview_goals_title: { en: "🎯 Core Goals", ko: "🎯 핵심 목표" },
    overview_goal_placeholder: { en: "Enter core goal (Enter)...", ko: "새 목표 입력 후 Enter..." },
    overview_save_btn: { en: "💾 Save Overview", ko: "💾 개요 저장" },
    plan_progress_label: { en: "📊 Plan Progress", ko: "📊 계획 실시간 진행도" },
    plan_add_placeholder: { en: "Enter new plan task... (Enter to add, Enter on empty to save)", ko: "새 계획 태스크 입력 후 Enter... (빈 칸에서 Enter 누르면 저장)" },
    plan_save_btn: { en: "💾 Save & Sync", ko: "💾 저장 및 양방향 동기화" },
    notice_overview_saved: { en: "✅ Project overview updated successfully.", ko: "✅ 프로젝트 개요가 성공적으로 업데이트되었습니다." },
    notice_plan_saved: { en: "✅ Project plan and progress updated successfully.", ko: "✅ 프로젝트 계획 및 진행도가 성공적으로 업데이트되었습니다." },
    notice_copy_to_exec: { en: "✅ Copied to Execution tab!", ko: "✅ 실행 탭으로 복사 완료!" },
    help_overview_title: { en: "Keyboard Shortcuts Guide", ko: "단축키 사용 설명서" },
    help_overview_enter: { en: "• Enter : Add new goal in input / Save when empty", ko: "• Enter : 입력창에서 새 목표 추가 / 빈 칸에서 엔터 시 저장" },
    help_overview_indent: { en: "• Tab / Shift+Tab : Indent sub-goal (1., 2. -> Bullet)", ko: "• Tab / Shift+Tab : 하위 목표 들여쓰기 (1., 2. -> 불릿)" },
    help_overview_move: { en: "• Alt + ↑/↓ : Move goal order", ko: "• Alt + ↑/↓ : 목표 순서 이동" },

    // ----------------------------------------------------
    // Monthly Transition & Archive
    // ----------------------------------------------------
    modal_monthly_transition_title: { en: "🗓️ A new month has started!", ko: "🗓️ 새로운 달이 시작되었습니다!" },
    modal_monthly_transition_desc: { en: "Would you like to safely archive last month's checklist and start fresh for this month?", ko: "지난 달의 체크리스트 기록을 월간 아카이브에 안전하게 백업하고, 이번 달 체크리스트를 깨끗하게 비울까요?" },
    modal_monthly_transition_btn_confirm: { en: "🚀 Archive & Reset", ko: "🚀 아카이브 후 비우기" },
    modal_monthly_transition_btn_later: { en: "⏳ Later", ko: "⏳ 나중에 하기" },
    notice_monthly_reset_success: { en: "🗓️ Previous month archived and checklist reset for the new month!", ko: "🗓️ 지난 달 기록이 아카이브되고, 새 달 체크리스트가 초기화되었습니다!" },
    cmd_monthly_reset_archive: { en: "Archive and reset monthly checklist", ko: "이달의 체크리스트 아카이브 및 비우기" }
};

export function t(key: keyof typeof translations, language: string, params: Record<string, string | number> = {}): string {
    const lang = language === 'ko' ? 'ko' : 'en';
    if (!translations[key]) {
        console.warn(`[i18n] Missing translation key: ${key}`);
        return String(key);
    }
    let text = translations[key][lang] || translations[key]['en'] || String(key);
    
    // Replace params like {count}
    for (const [paramKey, paramValue] of Object.entries(params)) {
        text = text.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
    }
    
    return text;
}
