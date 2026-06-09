# MyWorld Task Manager

> **A Powerful Obsidian Plugin for Centralized Task & Schedule Management**
> MyWorld Task Manager is a core plugin that centralizes fragmented tasks, automates daily routines, and synchronizes your schedule seamlessly with your project notes using a bi-directional sync engine. Eliminate complex Templater scripts and establish a smart PARA & Zettelkasten knowledge management system with just one click!

---

# 📖 MyWorld Task Manager Plugin Integrated User Manual

Welcome! **MyWorld Task Manager** is a powerful core plugin that centralizes fragmented tasks and schedule management within Obsidian, perfectly automating daily routines and monthly statistics. Remove all existing complex Templater scripts and roll out a smart knowledge management system with just one click.

---

## ⚙️ 1. Initial Setup Guide (One-time)

If you have installed the plugin for the first time, please set up the framework (structure) in the following order.

### Step 1. Open Plugin Settings
1. Go to Obsidian Settings (gear icon) > `Community plugins` tab and ensure **MyWorld Task Manager** is enabled.
2. If enabled, click on **MyWorld Task Manager** in the bottom plugin settings menu to enter the settings page.

### Step 2. Knowledge Management System (PARA & Zettelkasten) Setup
Check the **[2. Knowledge Management System Setup Helper]** section in the plugin settings.
*   **`[Create PARA Structure]` Button**: If your vault doesn't have `1. Project`, `2. Area`, `3. Resource`, and `4. Archive` folders yet, click this button. A clean folder structure and user manuals will be instantly created.
*   **`[Create Zettelkasten Structure]` Button**: Click this if you don't have a `5. Zettelkasten` folder. A 3-level memo folder structure to store the seeds of your thoughts will be set up.

### Step 3. Create Default Templates
Check the **[3. Basic Environment and File Creation Helper]** section in the settings.
*   **`[Create Default Template Notes]` Button**: Creates a daily schedule template and a project template. Upon clicking, a **Path input prompt** will pop up; enter your desired folder (e.g., `3. Resource/01.Templates`) and they will be created there.
*   **`[Create Schedule Management Note]` Button**: Creates the `스케줄 관리.md` (Schedule Management) file, which is the core control tower note you will open every morning.

> [!TIP] Check Default Setting Paths
> Go to the **[1. Path Settings]** tab at the top of the settings page and ensure the specified paths match the actual folder names you created! (It is safe to leave them as default.)

---

## 🎛️ 2. Core Workflow and Button Controls (Daily Routine)

Utilize the icon buttons at the top of the Schedule Management note and the buttons in Project notes to carry out your daily routines.

### ⚡️ Sync Button (Lightning Icon)
*   **Where to click?**: Top of the Daily Schedule note
*   **What does it do?**: 
    1. Reads the links written under `# Project` in the schedule note (e.g., `[[Project A]]`) to find the original project files.
    2. Any text edits or completion marks (`[x]`) you made in the schedule note will be identically **overwritten (reflected)** in the original project.
    3. Conversely, if new tasks are added to the `# Execution` section of the original project file, it **imports** those contents into the schedule note.
    4. Calculates the task dates to apply custom D-Day markers (like `[0]`), and elegantly sorts all tasks based on priority.

### ✏️ Quick Task Capture Button (Pencil Icon)
*   **Where to click?**: Top of the Daily Schedule note
*   **What does it do?**: 
    *   Pops up a window so you don't have to write things down elsewhere.
    *   If you type "Buy milk" and press enter, `- [ ] Buy milk` is added in real-time right below the `# Todo` section of the schedule note. 
    *   As soon as it's added, it automatically calculates date markers and sorts them at once, just like pressing the ⚡️ Sync button.

### 🌤️ Daily Reset and Wrap-up Button (Cloud Icon)
*   **Where to click?**: Top of the Daily Schedule note
*   **What does it do?**: 
    1. Pops up a window to write today's review and tomorrow's goals.
    2. When you click confirm, it extracts the contents you checked today (color emojis) from the top `# Routine` table and permanently saves them into today's cell in the massive `# Checklist` table at the bottom.
    3. Reverts all clicked routine buttons (checkboxes) to an empty state (`[ ]`) so you can check them again tomorrow.
    4. Cleans up completed tasks, redraws the 10-day statistics graph, and sends it to the statistics archive (`4. Archive` folder).

### 🗂️ Manual Statistics Archive Button (Folder Icon)
*   **Where to click?**: Top of the Daily Schedule note
*   **What does it do?**: Normally this is handled automatically when you do a Daily Reset (🌤️), but this button allows you to manually force the execution if you want to extract and backup the statistics into a file in advance on the day the 10-day period ends.

### 📋 Fleeting Memo Button (Clipboard Icon)
*   **Where to click?**: Top of the Daily Schedule note
*   **What does it do?**: Instantly opens a blank note (`임시 메모.md`) to temporarily pour out long and massive ideas. If the file doesn't exist, it creates one for you.

### 📤 Push Schedule Button (Export Icon)
*   **Where to click?**: Top of **each individual Project note**
*   **What does it do?**: After you actively edit plans and planning within the project note, it pushes those contents into the main schedule note. (You can push immediately without switching to the schedule window.)

---

## 🛠️ 3. Schedule Note Editing Permissions (Customization Guide)

Because the plugin automatically writes and erases documents, there is a clear distinction between "Signposts you must never touch (headers)" and "Areas users can freely customize".

### ⛔ [Strictly Prohibited] Parts that break the plugin if touched
These parts are signposts recognized by the plugin. If text or spacing changes, the plugin will lose its way.
1. **Major Classification Header Names**: `# Todo`, `#### 할 일`, `#### 프로젝트`, `# Project`, `# 루틴`, `# 체크리스트`, `# 통계`, `# 계획`, `# 실행`
2. **Block IDs at the end of tasks (`^xxxxxx`)**: Unique identifiers for synchronization. Removing them breaks the sync.
3. **Markdown table skeleton symbols (`|`)**: Deleting the pipe symbols breaks the table, making statistics accumulation impossible.

### ✅ [Freely Editable] Parts you can change as you like
As long as you don't touch the signposts and identifiers, the 'contents' inside are 100% customizable to your liking.
1. **Freely renaming 'Column (Item) Names' in the Routine Table**: Just make sure the names match exactly between the top mini table and the bottom master table. You can rename them to 'Reading', 'Meditation', etc., and the plugin will recognize them and accumulate stats.
2. **Freely changing task contents and check status**: You can edit the text or put `x`, `-`, `>`, etc. inside the checkbox; it will be perfectly recognized.
3. **Text inside the `# Routine` callout**: You can freely delete or edit quotes or goal texts without any issues.
4. **Moving the position (order) of tasks**: As long as the `^identifier` is perfectly attached to the end of each task, you can freely rearrange the order and it will synchronize without problems.

---

## 🎨 4. Customizing Your Own Routine (Table) (Details)

**[Core Tip: Operating the Top Table and Bottom Table Separately]**
Looking at the schedule note, there are two tables: **① The thin mini table at the very top (for input)**, and **② The massive `# Checklist` master table at the bottom (for statistics storage)**.
*   **You don't need to match the number of columns at all!** The plugin reads the tags (headers) and smartly matches them to transfer the data on its own.
*   **Recommended Setup**: For the ① top mini table you have to look at every day, leave only 3~4 core columns like 'Reading' or 'Exercise' to keep it thin. For the ② bottom master table, you can extend it long with 10 columns for things you check occasionally, like 'Supplements' or 'Hospital', and they will link perfectly.

---

## 💡 5. Operating Mechanism (Advanced)

Understanding the plugin's smart internal logic makes it much easier to use.

### 📅 D-Day Auto Calculation and Downward Propagation
*   If you write a calendar emoji and date like `📅 2026-06-10` after a task and press ⚡️Sync, the plugin automatically attaches a deadline marker (`- [3] Read book`).
*   **[Core]**: If a parent task has a deadline attached, the child tasks indented below it will identically inherit the parent's deadline!

### 🗑️ Simple Complete Deletion Magic (`//`)
*   If you mark something as complete (`[x]`), it remains in the statistics or archive (Plan tab). If you want to permanently delete it without a trace, please write **`//`** at the very end of the task text. (e.g., `- [ ] Task to be canceled // ^a1b2c3`)
*   When you press ⚡️Sync or 🌤️Daily Reset, it will be permanently deleted without a trace from both the main schedule and the original project.

### 🎯 Urgency-based Auto Sorting
*   The moment you execute Sync or Quick Capture, the plugin reads the deadline markers and automatically sorts them neatly in the order of **`[!] (Past) ➡️ [0] (Today) ➡️ [1] (Tomorrow) ➡️ ... No Deadline`**.

---

## 🚨 6. Frequently Asked Questions (FAQ) & Error Resolution

*   **Q. I pressed Daily Reset but it says an error occurred!**
    *   **A.** It's highly likely that a header name (e.g., `# Todo`) inside the schedule note was damaged. Even if an error occurs, the plugin's **'Transaction Rollback'** feature activates to perfectly restore the file to its original state right before the reset. Please try again after checking the header names.
*   **Q. Can I delete the past Templater scripts (.js, .md files)?**
    *   **A.** Yes! You can delete them completely. The plugin replaces all features faster and more safely.
*   **Q. The table shape broke while I was editing it.**
    *   **A.** Obsidian tables are separated by `|` symbols. Please just be careful not to delete the `|` symbols when editing the table.
