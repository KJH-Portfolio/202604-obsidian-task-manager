# MyWorld Task Manager

> [!WARNING] 🚨 Major Update Notice (Action Required) 🚨
> For a better user experience and performance, the template generation and schedule rendering system has been **massively refactored to use dynamic rendering via Dataview**!
> 
> We have completely eliminated the inconvenient path hardcoding and template entanglement issues to prioritize user convenience.
> 
> **⚠️ Note:** Because of this, there might be conflicts with the hardcoded contents of your older schedule notes. 
> Please copy and paste any important contents from your existing schedule notes to a safe place. Then, click the **'Create Daily Schedule'** button in the plugin to generate a brand-new format schedule note, and paste your contents back.
> 
> We will continue to improve the plugin with your convenience as our top priority. Thank you!

> **A Powerful Obsidian Plugin for Centralized Task & Schedule Management**
>
> Centralize fragmented tasks, automate daily routines, and synchronize your schedule seamlessly with your project notes using a robust bi-directional sync engine. Eliminate complex Templater scripts and establish a smart PARA & Zettelkasten knowledge management system with a single click.

---

## ✨ Key Features

*   **🔄 Bi-directional Auto-Synchronization**: Tasks created or completed in your daily schedule automatically sync back to their original project notes in the background as you type or save.
*   **📅 Smart Priority Sorting**: Utilizing custom markdown checkbox markers (`[0]`, `[1]`, `[!]`, etc.), tasks are automatically calculated for D-Day and sorted by urgency.
*   **🌤️ Daily Routine Automation**: Reset your daily checklists with a single click. Completed routines are archived into a master statistics table, and tasks are rolled over smoothly.
*   **🗂️ 1-Click System Setup**: Automatically generates a complete PARA (Project, Area, Resource, Archive) and Zettelkasten folder structure, along with default templates.
*   **🚀 Perfect Multi-Window Support (NEW)**: Flawless synchronization and UI rendering across multiple Obsidian popout windows. No more context switching bugs.
*   **🎨 Revamped UI/UX (NEW)**: Beautifully designed Calendar widgets for date picking, an interactive Startup Sync Modal, and inline routine checklists. Fully integrated with CodeMirror 6 for seamless Live Preview and Reading View support.
*   **⚙️ Standardized Settings (NEW)**: A newly overhauled settings tab featuring togglable update notices, robust path configurations, and developer feedback links.

---

## 🚀 Initial Setup Guide (One-time)

If you have installed the plugin for the first time, please set up the framework in the following order:

### Step 0. Install Required Plugins
To use the "Magic Buttons" (Quick Capture, Daily Reset, Monthly Archive, etc.) generated in the templates, you **MUST** install the following plugin:
*   **[Required] Advanced URI (by Vinzent03)**: This plugin allows markdown links (`obsidian://advanced-uri?commandid=...`) to trigger internal plugin commands. Without it, the magic buttons will not work.
*   **[Required] Dataview (by blacksmithgu)**: Essential for dynamic rendering of your schedule and tasks. The plugin relies heavily on Dataview scripts to sync and display your project tasks in real-time.
*   **[Highly Recommended] Periodic Notes & Calendar**: For seamless daily schedule creation and navigation.

### Step 1. Enable the Plugin
1. Go to Obsidian Settings > `Community plugins` tab and ensure **MyWorld Task Manager** is enabled.
2. Click on **MyWorld Task Manager** in the bottom settings menu to enter the configuration page.

### Step 2. Knowledge Management System (PARA & Zettelkasten)
Navigate to the **[2. Knowledge Management System Setup Helper]** section in settings:
*   **`[Create PARA Structure]`**: Click to instantly generate `1. Project`, `2. Area`, `3. Resource`, and `4. Archive` folders along with user manuals.
*   **`[Create Zettelkasten Structure]`**: Click to set up a 3-level memo folder structure (`5. Zettelkasten`) to store your thoughts.

### Step 3. Create Default Templates
Navigate to the **[3. Basic Environment and File Creation Helper]** section:
*   **`[Create Project Plan Template]`**: Generates the `01.Project Plan Template.md` and its guide note. You will be prompted to specify the destination path (e.g., `3. Resource/01.Templates`).
*   **`[Create Schedule Management Note]`**: Creates the `스케줄 관리.md` (Schedule Management) file, which acts as your core control tower.

> [!TIP] Check Default Setting Paths
> Go to the **[1. Path Settings]** tab at the top of the settings page and ensure the specified paths match the actual folders you created.

---

## 🎛️ Core Workflow & Controls

Use the icon buttons at the top of the Schedule Management note and within Project notes to drive your daily workflow.

### 🔄 Real-time Auto-Sync & Manual Refresh
*   **Background Sync**: All task states (edits, completions) and D-Day calculations are automatically synced bi-directionally in the background whenever you modify a file.
*   **Manual Refresh (Hotkey)**: You do not need to press any sync buttons anymore! However, if you ever want to force an immediate refresh of the current view, you can assign a hotkey to the `Refresh Active View Sync` command in Obsidian's hotkey settings.

### ✏️ Quick Task Capture (Pencil Icon)
*   **Location**: Top of the Daily Schedule note.
*   **Action**: Opens a quick-entry modal. Type a task, press enter, and it's instantly injected under `# Todo`, automatically sorted and synced.

### 🌤️ Daily Reset & Wrap-up (Sun & Cloud Icon)
*   **Location**: Top of the Daily Schedule note.
*   **Action**: Prompts for a daily review, extracts checked routines from the top table into the master `# Checklist` statistics table, unchecks routines for tomorrow, and cleans up completed tasks.

### 🗂️ Monthly Archive (Folder Icon)
*   **Location**: Top of the Daily Schedule note.
*   **Action**: Manually aggregates the current month's routine achievement statistics and archives them neatly into your Archive folder.

### 📋 Fleeting Memo (Clipboard Icon)
*   **Location**: Top of the Daily Schedule note.
*   **Action**: Instantly opens a blank note (`임시 메모.md`) to capture long, sudden ideas.

---

## 🛠️ Customization & Permissions

To maintain perfect synchronization, the plugin relies on specific document structures.

### ⛔ [Strictly Prohibited] Do not edit these signposts
Modifying these will break the synchronization logic:
1. **Major Headers**: `# Todo`, `#### 할 일`, `# Project`, `# 루틴`, `# 체크리스트`, `# 통계`, `# 계획`, `# 실행`.
2. **Block IDs (`^xxxxxx`)**: The unique 6-character identifiers at the end of synced tasks.
3. **Table Skeleton Symbols (`|`)**: Deleting pipe symbols breaks the routine and statistics tables.

### ✅ [Freely Editable] Customize to your liking
As long as signposts are intact, the content is 100% yours:
1. **Routine Table Columns**: Rename 'Reading' to 'Meditation' as long as the top and bottom tables match.
2. **Task Content**: Edit the text or the checkbox state (`x`, `-`, `/`, `>`).
3. **Routine Callouts**: Freely edit text inside the `> [!routine]` blocks.
4. **Task Order**: Rearrange tasks freely; as long as the `^identifier` is attached, it will sync.

---

## 💡 Advanced Mechanics

*   **📅 D-Day Inheritance**: If a parent task has a date emoji (e.g., `📅 2026-06-10`), indented child tasks will automatically inherit that deadline.
*   **🗑️ Hard Deletion (`//`)**: To permanently delete a task without leaving an archived trace, append `//` to the end of the line (e.g., `- [ ] Cancelled task // ^a1b2c3`) and click Sync.
*   **🔍 Multi-Window Resilience**: Whether you are editing in a popout window, Live Preview, or Reading View, the CodeMirror 6 widgets and synchronization engine track your active context perfectly.

---

## 🚨 Troubleshooting & FAQ

*   **Q. I pressed Daily Reset but got an error!**
    *   **A.** A required header (e.g., `# Todo`) might be missing or renamed. The plugin's **Transaction Rollback** feature safely restores the file. Fix the header and try again.
*   **Q. Can I delete my old Templater scripts?**
    *   **A.** Yes! This plugin entirely replaces them, operating faster and much safer.
*   **Q. I can't click checkboxes in Live Preview.**
    *   **A.** This was fixed in version 1.0.52! Please update the plugin. The `z-index` and `pointer-events` have been optimized to bypass CodeMirror's invisible DOM layers.

---
*Created by KJH. For support, please check the feedback link in the plugin settings.*
