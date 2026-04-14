import { Plugin, MarkdownView, Notice } from 'obsidian';
import moment from 'moment';
import { TaskParser } from './parser/TaskParser';
import { TimeTrackerService } from './services/TimeTrackerService';
import { TaskManagerService } from './services/TaskManagerService';
import { TaskPanelView, TASK_PANEL_VIEW_TYPE } from './views/TaskPanelView';
import type { Task } from './types/task';
import { DEFAULT_SETTINGS, type PluginSettings } from './types/settings';
import { TimeTemplateRenderer } from './utils/TimeTemplateRenderer';
import { TimeTrackingSettingsTab } from './settings/TimeTrackingSettingsTab';

export default class TaskMasterProPlugin extends Plugin {
	private taskParser!: TaskParser;
	private timeTrackerService!: TimeTrackerService;
	private taskManagerService!: TaskManagerService;
	
	// ✅ 插件设置
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
		
		this.registerView(
			TASK_PANEL_VIEW_TYPE,
			(leaf) => new TaskPanelView(leaf, this.taskParser, this.timeTrackerService, this.taskManagerService, this)
		);
		
		this.addSettingTab(new TimeTrackingSettingsTab(this.app, this));
		
		// ✅ 新增：在 Ribbon 左侧工具栏添加图标按钮
		this.addRibbonIcon('list-todo', 'Open Task Panel', () => {
			this.openTaskPanel();
		});
		
		this.addCommand({
			id: 'open-task-panel',
			name: 'Open Task Panel',
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
		
		// ✅ 新增：在布局就绪后自动打开任务面板
		this.app.workspace.onLayoutReady(() => {
			this.openTaskPanel();
		});
	}

	onunload() {
		// 清理工作由 Obsidian 自动处理
	}
	
	/**
	 * 加载设置
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	/**
	 * 保存设置
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * 注册编辑器 Checkbox 拦截器（基于 DOM 事件监听）
	 * 
	 * 实现思路：
	 * 1. ✅ 插件加载时立即为当前激活视图注册监听器
	 * 2. 监听 layout-change 事件，为新激活的视图注册监听器
	 * 3. 在该视图的 contentEl 上添加 click 事件监听
	 * 4. 拦截 checkbox 点击，阻止默认行为
	 * 5. 通过 editor.cm 访问底层 CodeMirror 实例，使用 posAtDOM 和 Transaction API
	 * 6. ✅ 使用模板渲染引擎生成时间标记
	 * 7. 让 Obsidian 自动同步文件（不调用 vault.modify）
	 */
	private registerEditorCheckboxInterceptor() {
		// ✅ 使用 Map 存储每个视图的清理函数，避免重复注册
		const viewCleanupMap = new Map<MarkdownView, () => void>();
		
		// ✅ 辅助函数：为指定视图注册拦截器
		const registerViewInterceptor = (activeView: MarkdownView) => {
			// ✅ 检查是否已经为该视图添加了监听器
			if (viewCleanupMap.has(activeView)) {
				return;
			}
			
			// ✅ 在 contentEl 上添加点击事件监听（使用捕获阶段）
			const handleClick = async (event: MouseEvent) => {
				// ✅ 检查功能是否启用。如果未启用，则不执行任何自定义逻辑，
				// 也不调用 preventDefault()，让 Obsidian 原生处理 checkbox 切换。
				if (!this.settings.enableTimeTracking) {
					return;
				}

				const target = event.target as HTMLElement;
				
				// 检查是否点击了 checkbox
				if (target.tagName !== 'INPUT' || (target as HTMLInputElement).type !== 'checkbox') {
					return;
				}
				
				// 检查是否是任务列表的 checkbox
				if (!target.classList.contains('task-list-item-checkbox')) {
					return;
				}
				
				// 阻止默认行为（Obsidian 原生的 [ ] ↔ [x] 切换）
				event.preventDefault();
				event.stopPropagation();
				
				try {
					const editor = activeView.editor;
					
					// ✅ 关键修复：通过 editor.cm 访问底层 CodeMirror EditorView
					// @ts-ignore - cm 是内部属性，TypeScript 类型定义中未包含
					const cmView = editor.cm;
					
					if (!cmView) {
						console.error('[CheckboxInterceptor] CodeMirror view not found');
						return;
					}
					
					// ✅ 使用 CodeMirror 6 的 posAtDOM 方法
					// @ts-ignore - posAtDOM 是 CodeMirror 6 API
					const pos = cmView.posAtDOM(target);
					const line = cmView.state.doc.lineAt(pos);
					const lineNumber = line.number - 1; // 转换为 0-based
					
					// ✅ 获取当前活动文件
					const activeFile = this.app.workspace.getActiveFile();
					if (!activeFile) {
						console.error('[CheckboxInterceptor] No active file');
						return;
					}
					
					// ✅ 解析当前文件的所有任务
					const tasks = await this.taskParser.parseFile(activeFile);
					
					// ✅ 找到对应的任务（通过行号匹配）
					const task = tasks.find(t => t.line === lineNumber);
					
					if (!task) {
						console.warn('[CheckboxInterceptor] Task not found at line', lineNumber);
						return;
					}
					
					// ✅ 调用 TimeTrackerService 统一处理状态流转
					await this.timeTrackerService.toggleTaskStatus(task);
					
				} catch (error) {
					console.error('[CheckboxInterceptor] Failed to handle checkbox click:', error);
					new Notice('处理checkbox点击失败，请查看控制台');
				}
			};

			// ✅ 关键修复：使用捕获阶段（第三个参数为true），确保我们的监听器先于Obsidian原生处理程序执行
			activeView.contentEl.addEventListener('click', handleClick, true);
			
			// ✅ 保存清理函数
			const cleanup = () => {
				activeView.contentEl.removeEventListener('click', handleClick, true);
				viewCleanupMap.delete(activeView);
			};
			
			viewCleanupMap.set(activeView, cleanup);
			
			// ✅ 注册清理函数，当视图关闭时自动清理
			this.register(cleanup);
		};
		
		// ✅ 关键修复：插件加载时立即为当前激活视图注册拦截器
		const currentActiveView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (currentActiveView) {
			registerViewInterceptor(currentActiveView);
		}
		
		// 监听布局变化事件
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				
				if (!activeView) {
					return;
				}
				
				// ✅ 使用辅助函数注册拦截器
				registerViewInterceptor(activeView);
			})
		);
		
		// ✅ 额外监听：active-leaf-change 事件（更细粒度的视图切换）
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (!leaf) {
					return;
				}
				
				const view = leaf.view;
				if (view instanceof MarkdownView) {
					// 尝试为该视图注册拦截器
					registerViewInterceptor(view);
				}
			})
		);
	}

	/**
	 * 打开任务面板
	 */
	private async openTaskPanel() {
		// 检查工作区中是否已有该视图
		const existingLeaf = this.app.workspace.getLeavesOfType(TASK_PANEL_VIEW_TYPE)[0];
		
		if (existingLeaf) {
			// 如果已存在，则激活它
			this.app.workspace.revealLeaf(existingLeaf);
		} else {
			// 否则在右侧边栏创建新视图
			await this.app.workspace.getRightLeaf(false)?.setViewState({
				type: TASK_PANEL_VIEW_TYPE,
				active: true
			});
		}
	}
	
	/**
	 * 测试：解析所有任务
	 */
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
	
	/**
	 * 测试：解析当前文件任务
	 */
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
	
	/**
	 * 测试时间追踪服务
	 */
	private async testTimeTracker() {
		try {
			const activeFile = this.app.workspace.getActiveFile();
			
			if (!activeFile) {
				new Notice('No active file');
				return;
			}
			
			// 解析当前文件的所有任务
			const tasks = await this.taskParser.parseFile(activeFile);
			
			if (tasks.length === 0) {
				new Notice('No tasks found in current file');
				return;
			}
			
			// 选择第一个任务进行测试
			const testTask = tasks[0];
			
			// 测试场景 1: Pending → Progress
			if (testTask.status === 'pending') {
				await this.timeTrackerService.toggleTaskStatus(testTask);
				
				// 重新解析以验证更新
				const updatedTasks = await this.taskParser.parseFile(activeFile);
				const updatedTask = updatedTasks.find(t => t.id === testTask.id);
				
				// 测试场景 2: Progress → Completed
				if (updatedTask && updatedTask.status === 'progress') {
					await this.timeTrackerService.toggleTaskStatus(updatedTask);
					
					// 重新解析以验证更新
					const completedTasks = await this.taskParser.parseFile(activeFile);
					const completedTask = completedTasks.find(t => t.id === updatedTask.id);
					
					if (completedTask) {
						// 测试场景 3: Completed → Pending (回退)
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
}
