# MyWorld Task Manager

> [!NOTE] 🚨 Major Update Notice (v1.0.101) 🚨
> **Dedicated GUI Routine Manager Modal & Integrated Header Action Widgets!**
> Completely eliminates markdown formatting corruption caused by manual text editing.
> Simply click the **⚙️ (Edit Routine) button** next to the `# Routine` header to safely add, edit, delete, or reorder routine categories and items. All changes automatically propagate seamlessly across master checklist tables, mini-tables, and weekly/monthly archive notes!

> **A Powerful Obsidian Plugin for Centralized Task & Schedule Management**
>
> Centralize fragmented tasks, automate daily routines, and synchronize your schedule seamlessly with your project notes using a robust bi-directional sync engine. Eliminate complex Templater scripts and establish a smart PARA & Zettelkasten knowledge management system with a single click.

---

## ✨ Key Features

* **⚙️ GUI Routine Manager (Routine Manager Modal)**: Edit your routines via a sleek modal window without touching raw markdown text. Easily add, delete, rename, or reorder (▲/▼) categories and items.
* **🔄 Real-time Bi-directional Auto-Sync**: Tasks created or completed in your daily schedule automatically sync back to their original project notes in real-time as you type or save.
* **📅 Smart Priority & D-Day Sorting**: Automatically calculates D-Day badges (`[D]`, `[!]`) from custom markdown checkboxes and date emojis (`📅 2026-07-28`), sorting tasks by urgency.
* **📊 Active-First Table Alignment & Strict Cell Rules**: 
  - **Active Routines First**: Currently active routine columns are sorted to the left (front) of checklist tables for high visibility.
  - **Inactive Routines Last**: Discontinued/deleted routines are automatically moved to the far right to preserve historical data integrity.
  - **Cell Value Rules**: Today & future cells of active routines remain **clean empty spaces (` `)** for active input; past unrecorded cells and inactive routine cells are filled with **`-`**.
* **🌤️ One-Click Daily Reset**: Archives checked routine counts into master statistics tables, resets routines for tomorrow, and cleans up completed tasks automatically.
* **🗂️ 1-Click System Setup (PARA & Zettelkasten)**: Instantly generates complete PARA (`0. Inbox`, `1. Project`, `2. Area`, `3. Resource`, `4. Archive`) and Zettelkasten (`5. Zettelkasten`) folder structures along with built-in user guides.
* **🧩 Header-Integrated Action Widgets**: Sleek action buttons embedded right next to markdown headers (`# Todo`, `# Routine`, `# Checklist`, `# Execution`). Zero HTML clutter in your notes!

---

## 📖 Complete User Guide

### 1. Initial Setup (First-time Users)

#### Step 1. Required & Recommended Plugins
1. **[Required] Dataview (by blacksmithgu)**: Essential for dynamic real-time rendering of project tasks inside your schedule notes.
2. **[Recommended] Periodic Notes & Calendar**: For seamless creation and navigation of daily and weekly schedule notes.

#### Step 2. Generate Folder Structure & Guides
* Navigate to Obsidian Settings > `MyWorld Task Manager`.
* Click **`[Create PARA Structure]`**: Creates `0. Inbox`, `1. Project`, `2. Area`, `3. Resource`, `4. Archive` folders and user manuals.
* Click **`[Create Zettelkasten Structure]`**: Creates `5. Zettelkasten` (`01.Fleeting`, `02.Literature`, `03.Permanent`) folders.

#### Step 3. Generate Templates & Schedule Note
* Click **`[Create Project Plan Template]`**: Generates `01.Project Plan Template.md` and its guide note inside your templates directory.
* Click **`[Create Schedule Management Note]`**: Creates your main control tower document (`Schedule Management.md` or `스케줄 관리.md`).

---

### 2. Header Action Widgets & Controls

Access system commands directly via the sleek action widgets embedded next to markdown headers in your notes:

| Header Location | Icon | Action Button Name | Primary Function & Role |
|---|:---:|---|---|
| **`# Routine`** (`# 루틴`) | ⚙️ | **Routine Manager** | Opens GUI modal to add/delete/reorder routine categories & items. Syncs across all archive notes upon saving. |
| **`# Routine`** (`# 루틴`) | ☀️ | **Daily Reset** | Archives today's routine checks into master stats, resets checklists for tomorrow, and archives completed tasks. |
| **`# Todo`** | ✏️ | **Quick Capture** | Opens popup to quickly enter new tasks, injected under `# Todo` with automatic D-Day sorting. |
| **`# Todo`** | 📋 | **Fleeting Memo** | Instantly creates and opens a blank idea memo note under `5. Zettelkasten/01.Fleeting`. |
| **`# Checklist`** (`# 체크리스트`) | 🗂️ | **Monthly Archive** | Aggregates the current month's routine achievement stats into an archive report note under `4. Archive`. |
| **`# Execution`** (`# 실행`) | ✏️ | **Quick Add Task** | Injects an immediate execution task inside a project note's `# Execution` section. |
| **`# Plan`** (`# 계획`) | ⬆️ | **Copy to Execution** | Copies a planned task up to the top `# Execution` section, exposing it instantly to the main schedule dashboard. |

---

### 3. Routine Management & Checklist Rules

1. **Using the ⚙️ Routine Manager Modal**:
   - Click the ⚙️ icon next to `# Routine` (or `# 루틴`).
   - Add new categories (e.g., `Meditation`, `Sleep`), add items, delete unused ones, change order via ▲/▼ buttons, or update your affirmation text.
   - Click **[Save]**: All changes safely update the routine callout, master checklist table, top mini-table, and **all weekly/monthly archive notes under `4. Archive`** without data loss.

2. **Checklist Table Alignment & Cell Filling Rules**:
   - **Active-First Column Alignment**: Active routines are placed on the left side of the table; discontinued routines are moved to the far right (`| Date | Active 1 | Active 2 | ... | Inactive 1 | Inactive 2 |`).
   - **Today & Future Cells**: Left as **clean empty spaces (` `)** for user input.
   - **Past Unrecorded & Inactive Cells**: Filled with **`-`** to indicate unstarted or discontinued states.
   - **Deficient Item Highlighting (`==`)**: During Daily Reset, category headers with achievement rates below 50% automatically receive `==Category Name==` warning highlights.

---

### 4. Project Notes & Bi-directional Sync Workflow

1. **Create a Project Note**: Place a new project note in `1. Project/01.List` (or use the built-in template).
2. **Plan to Execution (⬆️ Button)**: Write tasks under `# Plan`. Click the ⬆️ button next to a task to copy it up to `# Execution`.
3. **Bi-directional Auto-Sync**:
   - Tasks under `# Execution` automatically appear on the main Schedule note's Dataview dashboard.
   - Checking off or modifying a task anywhere (Schedule note or Project note) updates the original note in real-time.
4. **D-Day Inheritance**:
   - Add a date emoji (e.g., `📅 2026-08-15`) to a task for D-Day calculation.
   - Indented child tasks automatically inherit their parent's target deadline.

---

## 🛠️ Customization & Signpost Rules (Do & Don't)

### ⛔ [Strictly Prohibited] Do not alter these signposts
Modifying these will break automatic parsing and synchronization:
1. **Major Section Headers**: `# Todo`, `# Routine` (`# 루틴`), `# Checklist` (`# 체크리스트`), `# Stats` (`# 통계`), `# Project` (`# 프로젝트`), `# Plan` (`# 계획`), `# Execution` (`# 실행`).
2. **Task Block IDs**: The 6-character identifier at the end of synced lines (e.g., `^a1b2c3`).
3. **Table Pipe Symbols (`|`)**: Table skeleton structure delimiters.

### ✅ [Freely Editable] Feel free to customize
1. **Routine Structure**: Add, remove, rename, or reorder freely via the ⚙️ Routine Manager Modal.
2. **Task Text & Checkbox States**: Edit task text or toggle states (`[ ]`, `[x]`, `[-]`, `[/]`) freely.
3. **Project Details & Notes**: Add meeting notes, references, or details under `# Details` or `# Overview`.

---

## 🚨 Frequently Asked Questions (FAQ)

* **Q. Daily Reset (☀️) threw an error!**
  * **A.** A required signpost header (like `# Todo` or `# Routine`) might be missing or renamed. The built-in **Transaction Rollback** feature safely restores your file. Fix the header name and try again.
* **Q. Do routine updates propagate to past archive notes?**
  * **A.** Yes! From version `1.0.99` onwards, saving in the Routine Manager Modal automatically propagates column alignment and new categories across all weekly and monthly archive files under `4. Archive`.
* **Q. Do I still need Templater or Advanced URI?**
  * **A.** No! This plugin operates 100% natively via CodeMirror 6 header widgets. No external URI dependencies or HTML clutter required.

---
*Created by KJH. For questions or support, please visit the developer feedback link in the plugin settings.*
