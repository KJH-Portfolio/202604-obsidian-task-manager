import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, debounce } from 'obsidian';
import { TaskUtils, CONFIG } from './TaskUtils';
import { Synchronizer } from './Synchronizer';

interface MyWorldSettings {
	projectDir: string;
	schedulePath: string;
	archiveDir: string;
	fleetingMemoPath: string;
	autoSync: boolean;
}

const DEFAULT_SETTINGS: MyWorldSettings = {
	projectDir: CONFIG.PATHS.PROJECT_DIR,
	schedulePath: CONFIG.PATHS.MAIN_SCHEDULE,
	archiveDir: CONFIG.PATHS.ARCHIVE_DIR,
	fleetingMemoPath: "5. Zettelkasten/01.Fleeting/99.임시 메모.md",
	autoSync: true
}

export default class MyWorldPlugin extends Plugin {
	settings: MyWorldSettings;
	utils: TaskUtils;
	synchronizer: Synchronizer;

	async onload() {
		await this.loadSettings();

		this.utils = new TaskUtils(this.app, this.settings);
		this.synchronizer = new Synchronizer(this.app, this.utils, this.settings);

		// [자동 동기화] 저장(수정) 시 자동으로 수행
		this.registerEvent(
			this.app.vault.on('modify', debounce((file: TFile) => {
				if (!this.settings.autoSync) return;
				this.handleAutoSync(file);
			}, 2000, true))
		);

		this.addSettingTab(new MyWorldSettingTab(this.app, this));

		this.addCommand({
			id: 'daily-task-reset',
			name: 'Daily Task Reset (99)',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) this.synchronizer.dailyTaskReset(activeFile);
			}
		});

		this.addCommand({
			id: 'archive-monthly-stats',
			name: 'Archive Monthly Stats (103)',
			callback: () => {
				this.synchronizer.archiveMonthlyStats();
			}
		});

		this.addCommand({
			id: 'quick-capture',
			name: 'Quick Capture (100)',
			callback: async () => {
				// @ts-ignore
				const idea = await this.app.plugins.plugins.templater?.templater?.tp?.system?.prompt("💡 무언가 떠오르셨나요?");
				if (idea) {
					const file = this.app.vault.getAbstractFileByPath(this.settings.fleetingMemoPath);
					if (file instanceof TFile) {
						const now = this.utils.getAdjustedNow();
						const todayStr = now.format("YYYY-MM-DD");
						const time = moment().format("HH:mm");
						let content = await this.app.vault.read(file);
						const headerStr = `## ${todayStr}`;
						let newAddition = "";
						if (!content.includes(headerStr)) {
							newAddition += (content.trim() === "" ? "" : "\n\n") + headerStr;
						}
						newAddition += `\n- [ ] ${idea} ⏱️${time}`;
						await this.app.vault.append(file, newAddition);
						new Notice("✅ 임시 메모에 성공적으로 저장되었습니다!");
					}
				}
			}
		});

		this.addCommand({
			id: 'open-fleeting-memo',
			name: 'Open Fleeting Memo (101)',
			callback: () => {
				const file = this.app.vault.getAbstractFileByPath(this.settings.fleetingMemoPath);
				if (file instanceof TFile) {
					this.app.workspace.getLeaf(false).openFile(file);
				}
			}
		});

		console.log('MyWorld Task Manager loaded');
	}

	async handleAutoSync(file: TFile) {
		// 프로젝트 파일이거나 데일리 노트인 경우에만 동기화 실행
		const isProjectFile = file.path.startsWith(this.settings.projectDir);
		const isDailyNote = file.path.includes("Daily"); // 사용자의 데일리 노트 폴더명에 맞춰 조정 필요

		if (isProjectFile || isDailyNote) {
			console.log(`Auto-sync triggered for: ${file.path}`);
			await this.synchronizer.syncTaskManage(file);
			// 102 로직도 필요한 경우 추가
		}
	}

	onunload() {
		console.log('MyWorld Task Manager unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MyWorldSettingTab extends PluginSettingTab {
	plugin: MyWorldPlugin;

	constructor(app: App, plugin: MyWorldPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Project Directory')
			.setDesc('Folder where project files are stored')
			.addText(text => text
				.setPlaceholder('1. Project')
				.setValue(this.plugin.settings.projectDir)
				.onChange(async (value) => {
					this.plugin.settings.projectDir = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Schedule File Path')
			.setDesc('Path to the main schedule markdown file')
			.addText(text => text
				.setPlaceholder('1. Project/-Main/01.스케줄 관리.md')
				.setValue(this.plugin.settings.schedulePath)
				.onChange(async (value) => {
					this.plugin.settings.schedulePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Archive Directory')
			.setDesc('Root folder for archiving tasks and stats')
			.addText(text => text
				.setPlaceholder('4. Archive/98.Schedule')
				.setValue(this.plugin.settings.archiveDir)
				.onChange(async (value) => {
					this.plugin.settings.archiveDir = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Fleeting Memo Path')
			.setDesc('Path to the temporary/fleeting memo file')
			.addText(text => text
				.setPlaceholder('5. Zettelkasten/01.Fleeting/99.임시 메모.md')
				.setValue(this.plugin.settings.fleetingMemoPath)
				.onChange(async (value) => {
					this.plugin.settings.fleetingMemoPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto Sync')
			.setDesc('Automatically run sync logic (98, 102) on file modification')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSync)
				.onChange(async (value) => {
					this.plugin.settings.autoSync = value;
					await this.plugin.saveSettings();
				}));
	}
}
