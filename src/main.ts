import { Plugin, MarkdownView, Notice, TFile } from 'obsidian';
import moment from 'moment';
import { TaskParser } from './parser/TaskParser';
import { TimeTrackerService } from './services/TimeTrackerService';
import { TaskManagerService } from './services/TaskManagerService';
import { ReminderScheduler } from './services/ReminderScheduler';
import { TaskPanelView, TASK_PANEL_VIEW_TYPE } from './views/TaskPanelView';
import type { Task } from './types/task';
import { DEFAULT_SETTINGS, type PluginSettings } from './types/settings';
import { TimeTrackingSettingsTab } from './settings/TimeTrackingSettingsTab';
import { DateTimeEditModal } from './modals/DateTimeEditModal';

export default class TaskMasterProPlugin extends Plugin {
	taskParser!: TaskParser;
	timeTrackerService!: TimeTrackerService;
	taskManagerService!: TaskManagerService;
	reminderScheduler!: ReminderScheduler;

	// 插件设置
	settings: PluginSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.taskParser = new TaskParser(this.app, () => this.settings);

		this.timeTrackerService = new TimeTrackerService(this.app, this.taskParser, this);

		this.taskManagerService = new TaskManagerService(
			this.app,
			this.taskParser,
			() => this.settings
		);

		this.registerEditorCheckboxInterceptor();
		this.registerEditorContextMenu();

		this.registerView(
			TASK_PANEL_VIEW_TYPE,
			(leaf) => new TaskPanelView(leaf, this.taskParser, this.timeTrackerService, this.taskManagerService, this)
		);

		this.addSettingTab(new TimeTrackingSettingsTab(this.app, this));

		// 提醒调度：等布局就绪后加载任务缓存并启动
		this.app.workspace.onLayoutReady(async () => {
			try {
				console.log('[TaskMasterPro] Layout ready, initializing reminder scheduler...');
				await this.taskManagerService.loadAllTasks();
				this.reminderScheduler = new ReminderScheduler(this);
				this.reminderScheduler.start();
				console.log('[TaskMasterPro] Reminder scheduler started successfully');
			} catch (error) {
				console.error('[TaskMasterPro] Failed to start reminder scheduler:', error);
			}
		});

		// Ribbon 图标
		this.addRibbonIcon('list-todo', '打开任务面板', () => {
			this.openTaskPanel();
		});

		this.addCommand({
			id: 'open-task-panel',
			name: '打开任务面板',
			callback: () => {
				this.openTaskPanel();
			}
		});

		this.addCommand({
			id: 'parse-all-tasks',
			name: 'Parse All Tasks (Test)',
			callback: async () => {
				await this.testParseAllTasks();
			}
		});

		this.addCommand({
			id: 'parse-current-file-tasks',
			name: 'Parse Current File Tasks (Test)',
			callback: async () => {
				await this.testParseCurrentFile();
			}
		});

		this.addCommand({
			id: 'test-time-tracker',
			name: 'Test Time Tracker Service',
			callback: async () => {
				await this.testTimeTracker();
			}
		});

		this.addCommand({
			id: 'reminder-status',
			name: 'Reminder: Show Status',
			callback: () => {
				this.showReminderStatus();
			}
		});

		this.addCommand({
			id: 'reminder-rescan',
			name: 'Reminder: Force Rescan',
			callback: () => {
				this.rescanReminders();
			}
		});
	}

	onunload() {
		if (this.reminderScheduler) {
			this.reminderScheduler.stop();
		}
	}

	async loadSettings() {
		const savedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);

		// 深层合并嵌套对象
		if (savedData?.reminder) {
			this.settings.reminder = Object.assign(
				{},
				DEFAULT_SETTINGS.reminder,
				savedData.reminder,
			);
		}
		if (savedData?.timeTracking) {
			this.settings.timeTracking = Object.assign(
				{},
				DEFAULT_SETTINGS.timeTracking,
				savedData.timeTracking,
			);
		}

	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private registerEditorCheckboxInterceptor() {
		const viewCleanupMap = new Map<MarkdownView, () => void>();

		const registerViewInterceptor = (activeView: MarkdownView) => {
			if (viewCleanupMap.has(activeView)) {
				return;
			}

			const handleClick = async (event: MouseEvent) => {
				if (!this.settings.enableTimeTracking) {
					return;
				}

				const target = event.target as HTMLElement;

				if (target.tagName !== 'INPUT' || (target as HTMLInputElement).type !== 'checkbox') {
					return;
				}

				if (!target.classList.contains('task-list-item-checkbox')) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();

				try {
					const editor = activeView.editor;

					// @ts-ignore - cm 是内部属性
					const cmView = editor.cm;

					if (!cmView) {
						console.error('[CheckboxInterceptor] CodeMirror view not found');
						return;
					}

					// @ts-ignore - posAtDOM 是 CodeMirror 6 API
					const pos = cmView.posAtDOM(target);
					const line = cmView.state.doc.lineAt(pos);
					const lineNumber = line.number - 1;

					const activeFile = this.app.workspace.getActiveFile();
					if (!activeFile) {
						console.error('[CheckboxInterceptor] No active file');
						return;
					}

					const tasks = await this.taskParser.parseFile(activeFile);
					const task = tasks.find(t => t.line === lineNumber);

					if (!task) {
						console.warn('[CheckboxInterceptor] Task not found at line', lineNumber);
						return;
					}

					await this.timeTrackerService.toggleTaskStatus(task);

				} catch (error) {
					console.error('[CheckboxInterceptor] Failed to handle checkbox click:', error);
					new Notice('处理checkbox点击失败，请查看控制台');
				}
			};

			activeView.contentEl.addEventListener('click', handleClick, true);

			const cleanup = () => {
				activeView.contentEl.removeEventListener('click', handleClick, true);
				viewCleanupMap.delete(activeView);
			};

			viewCleanupMap.set(activeView, cleanup);
			this.register(cleanup);
		};

		const currentActiveView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (currentActiveView) {
			registerViewInterceptor(currentActiveView);
		}

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!activeView) return;
				registerViewInterceptor(activeView);
			})
		);

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (!leaf) return;
				const view = leaf.view;
				if (view instanceof MarkdownView) {
					registerViewInterceptor(view);
				}
			})
		);
	}

	/**
	 * 注册编辑器右键菜单拦截器
	 *
	 * 在编辑器中右键单击任务行时，在 Obsidian 原生菜单中追加：
	 * - 设置提醒时间（需 reminder.enabled 开启）→ 弹出 DateTimeEditModal
	 * - 修改追踪时间（需 enableTimeTracking 开启）→ 弹出 DateTimeEditModal
	 * - 完成任务（需 enableTimeTracking 开启 且 任务非 completed）→ 直接标记 [x]
	 */
	private registerEditorContextMenu() {
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, view) => {
				// 只在 Markdown 编辑器中显示
				if (!(view instanceof MarkdownView)) return;

				const file = view.file;
				if (!file) return;

				// 获取光标所在行
				const cursor = editor.getCursor();
				const lineNumber = cursor.line;
				const line = editor.getLine(lineNumber);

				// 检查是否为任务行
				const taskMatch = line.match(/^(\s*-\s*\[)(.)(\]\s*)(.*)$/);
				if (!taskMatch) return;

				// 尝试解析任务（使用 TaskParser 获取完整 Task 对象）
				const parseResult = this.taskParser.parseLine(line, file, lineNumber);
				const task = parseResult.task;
				if (!task) return;

				// ── 分隔线 ──
				menu.addSeparator();

				// ── 设置提醒时间（仅提醒开启时显示） ──
				if (this.settings.reminder.enabled) {
					menu.addItem(item => {
						item.setTitle('设置提醒时间')
							.setIcon('bell')
							.onClick(() => {
								new DateTimeEditModal(
									this.app, task, 'reminder',
									this.timeTrackerService, this.taskParser,
								).open();
							});
					});
				}

				// ── 修改追踪时间（仅时间追踪开启时显示） ──
				if (this.settings.enableTimeTracking) {
					menu.addItem(item => {
						item.setTitle('修改追踪时间')
							.setIcon('clock')
							.onClick(() => {
								new DateTimeEditModal(
									this.app, task, 'tracking',
									this.timeTrackerService, this.taskParser,
								).open();
							});
					});

					// ── 完成任务（非 completed 状态时显示） ──
					if (task.status !== 'completed') {
						menu.addItem(item => {
							item.setTitle('完成任务')
								.setIcon('checkmark')
								.onClick(async () => {
									try {
										await this.timeTrackerService.completeTaskWithoutTracking(task);
									} catch (error) {
										console.error('[TaskKit] Failed to complete task without tracking:', error);
										new Notice('操作失败，请重试');
									}
								});
						});
					}
				}
			}),
		);
	}

	private async openTaskPanel() {
		const existingLeaf = this.app.workspace.getLeavesOfType(TASK_PANEL_VIEW_TYPE)[0];

		if (existingLeaf) {
			this.app.workspace.revealLeaf(existingLeaf);
		} else {
			await this.app.workspace.getRightLeaf(false)?.setViewState({
				type: TASK_PANEL_VIEW_TYPE,
				active: true
			});
		}
	}

	private async testParseAllTasks() {
		try {
			const allTasks = await this.taskParser.parseAllFiles();
			let totalTasks = 0;
			for (const [_, tasks] of allTasks) {
				totalTasks += tasks.length;
			}
			new Notice(`Parsed ${totalTasks} tasks from ${allTasks.size} files`);
		} catch (error) {
			console.error('Failed to parse tasks:', error);
			new Notice('Failed to parse tasks. Check console for details.');
		}
	}

	private async testParseCurrentFile() {
		try {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice('No active file');
				return;
			}
			const tasks = await this.taskParser.parseFile(activeFile);
			new Notice(`Parsed ${tasks.length} tasks from current file`);
		} catch (error) {
			console.error('Failed to parse current file:', error);
			new Notice('Failed to parse current file. Check console for details.');
		}
	}

	private async testTimeTracker() {
		try {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice('No active file');
				return;
			}

			const tasks = await this.taskParser.parseFile(activeFile);
			if (tasks.length === 0) {
				new Notice('No tasks found in current file');
				return;
			}

			const testTask = tasks[0];

			if (testTask.status === 'pending') {
				await this.timeTrackerService.toggleTaskStatus(testTask);

				const updatedTasks = await this.taskParser.parseFile(activeFile);
				const updatedTask = updatedTasks.find(t => t.id === testTask.id);

				if (updatedTask && updatedTask.status === 'progress') {
					await this.timeTrackerService.toggleTaskStatus(updatedTask);

					const completedTasks = await this.taskParser.parseFile(activeFile);
					const completedTask = completedTasks.find(t => t.id === updatedTask.id);

					if (completedTask) {
						await this.timeTrackerService.toggleTaskStatus(completedTask);
					}
				}
			}

			new Notice('TimeTrackerService test completed.');
		} catch (error) {
			console.error('TimeTrackerService test failed:', error);
			new Notice('TimeTrackerService test failed. Check console for details.');
		}
	}

	/**
	 * 显示提醒调度器状态（诊断用）
	 */
	private showReminderStatus() {
		if (!this.reminderScheduler) {
			new Notice('⚠️ 提醒调度器未启动');
			console.log('[TaskMasterPro] Reminder scheduler not initialized');
			return;
		}

		const diag = this.reminderScheduler.getDiagnostics();
		console.log('[TaskMasterPro] Reminder Status:', JSON.stringify(diag, null, 2));
		new Notice(
			`🧠 缓存中 ${diag.totalTasksInCache} 个任务，${diag.tasksWithReminder} 个有待提醒`
		);
	}

	/**
	 * 强制重新扫描提醒
	 */
	private rescanReminders() {
		if (!this.reminderScheduler) {
			new Notice('⚠️ 提醒调度器未启动');
			return;
		}
		this.reminderScheduler.rescan();
		new Notice('🔄 已重新扫描提醒');
	}
}
