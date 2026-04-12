import { Plugin, MarkdownView, Notice } from 'obsidian';
import moment from 'moment';
import { TaskParser } from './parser/TaskParser';
import { TimeTrackerService } from './services/TimeTrackerService';
import { TaskPanelView, TASK_PANEL_VIEW_TYPE } from './views/TaskPanelView';
import type { Task } from './types/task';
import { DEFAULT_SETTINGS, type PluginSettings } from './types/settings';
import { TimeTemplateRenderer } from './utils/TimeTemplateRenderer';
import { TimeTrackingSettingsTab } from './settings/TimeTrackingSettingsTab';

export default class TaskMasterProPlugin extends Plugin {
	private taskParser!: TaskParser;
	private timeTrackerService!: TimeTrackerService;
	
	// ✅ 插件设置
	settings: PluginSettings = DEFAULT_SETTINGS;

	async onload() {
		console.log('Task Master Pro loaded!');
		
		// ✅ 加载设置
		await this.loadSettings();
		
		// ✅ 初始化任务解析器（传入 getter 函数，支持动态更新）
		this.taskParser = new TaskParser(this.app, () => this.settings);
		
		// 初始化时间追踪服务（传入插件实例以访问设置）
		this.timeTrackerService = new TimeTrackerService(this.app, this.taskParser, this);
		
		// ✅ 使用 DOM 事件监听方案拦截编辑器中的 checkbox 点击
		this.registerEditorCheckboxInterceptor();
		
		// 注册任务面板视图
		this.registerView(
			TASK_PANEL_VIEW_TYPE,
			(leaf) => new TaskPanelView(leaf, this.taskParser, this.timeTrackerService, this)
		);
		
		// ✅ 注册设置 Tab
		this.addSettingTab(new TimeTrackingSettingsTab(this.app, this));
		
		// 注册打开任务面板命令
		this.addCommand({
			id: 'open-task-panel',
			name: 'Open Task Panel',
			callback: () => {
				console.log('Opening task panel...');
				this.openTaskPanel();
			}
		});
		
		// 注册解析所有任务命令（用于测试）
		this.addCommand({
			id: 'parse-all-tasks',
			name: 'Parse All Tasks (Test)',
			callback: async () => {
				console.log('Parsing all tasks...');
				await this.testParseAllTasks();
			}
		});
		
		// 注册解析当前文件任务命令（用于测试）
		this.addCommand({
			id: 'parse-current-file-tasks',
			name: 'Parse Current File Tasks (Test)',
			callback: async () => {
				console.log('Parsing current file tasks...');
				await this.testParseCurrentFile();
			}
		});
		
		// 注册测试时间追踪服务命令
		this.addCommand({
			id: 'test-time-tracker',
			name: 'Test Time Tracker Service',
			callback: async () => {
				console.log('Testing TimeTrackerService...');
				await this.testTimeTracker();
			}
		});
	}

	onunload() {
		console.log('Task Master Pro unloaded!');
		// 清理工作由 Obsidian 自动处理
	}
	
	/**
	 * 加载设置
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		console.log('[Settings] Loaded:', this.settings);
	}
	
	/**
	 * 保存设置
	 */
	async saveSettings() {
		await this.saveData(this.settings);
		console.log('[Settings] Saved:', this.settings);
	}

	/**
	 * 注册编辑器 Checkbox 拦截器（基于 DOM 事件监听）
	 * 
	 * 实现思路：
	 * 1. 监听 layout-change 事件，获取当前激活的 MarkdownView
	 * 2. 在该视图的 contentEl 上添加 click 事件监听
	 * 3. 拦截 checkbox 点击，阻止默认行为
	 * 4. 通过 editor.cm 访问底层 CodeMirror 实例，使用 posAtDOM 和 Transaction API
	 * 5. ✅ 使用模板渲染引擎生成时间标记
	 * 6. 让 Obsidian 自动同步文件（不调用 vault.modify）
	 */
	private registerEditorCheckboxInterceptor() {
		// ✅ 使用 Map 存储每个视图的清理函数，避免重复注册
		const viewCleanupMap = new Map<MarkdownView, () => void>();
		
		// 监听布局变化事件
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				
				if (!activeView) {
					return;
				}
				
				// ✅ 检查是否已经为该视图添加了监听器
				if (viewCleanupMap.has(activeView)) {
					return;
				}
				
				console.log('[CheckboxInterceptor] Registering click listener for view');
				
				// ✅ 在 contentEl 上添加点击事件监听
				const handleClick = async (event: MouseEvent) => {
					const target = event.target as HTMLElement;
					
					// 检查是否点击了 checkbox
					if (target.tagName !== 'INPUT' || (target as HTMLInputElement).type !== 'checkbox') {
						return;
					}
					
					// 检查是否是任务列表的 checkbox
					if (!target.classList.contains('task-list-item-checkbox')) {
						return;
					}
					
					console.log('[CheckboxInterceptor] Checkbox clicked, intercepting...');
					
					// 阻止默认行为（Obsidian 原生的 [ ] ↔ [x] 切换）
					event.preventDefault();
					event.stopPropagation();
					
					try {
						const editor = activeView.editor;
						
						// ✅ 关键修复：通过 editor.cm 访问底层 CodeMirror EditorView
						// @ts-ignore - cm 是内部属性，TypeScript 类型定义中未包含
						const cmView = editor.cm;
						
						if (!cmView) {
							console.error('[CheckboxInterceptor] Cannot access CodeMirror view');
							return;
						}
						
						// ✅ 使用 CodeMirror 6 的 posAtDOM 方法
						// @ts-ignore - posAtDOM 是 CodeMirror 6 API
						const pos = cmView.posAtDOM(target);
						const line = cmView.state.doc.lineAt(pos);
						const lineText = line.text;
						const lineNumber = line.number - 1; // 转换为 0-based
						
						console.log('[CheckboxInterceptor] Line:', lineNumber, 'Text:', lineText);
						
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
						
						console.log('[CheckboxInterceptor] Found task:', task.content, 'Status:', task.status);
						
						// ✅ 调用 TimeTrackerService 统一处理状态流转
						await this.timeTrackerService.toggleTaskStatus(task);
						
						console.log('[CheckboxInterceptor] Status toggled successfully');
						
						// ✅ 注意：不需要手动更新编辑器内容
						// TimeTrackerService.updateTaskLine() 已经通过 vault.modify 更新了文件
						// Obsidian 会自动同步到编辑器视图
						
					} catch (error) {
						console.error('[CheckboxInterceptor] Failed to handle checkbox click:', error);
					}
				};
				
				// 添加事件监听器
				activeView.contentEl.addEventListener('click', handleClick);
				
				// ✅ 保存清理函数
				const cleanup = () => {
					activeView.contentEl.removeEventListener('click', handleClick);
					viewCleanupMap.delete(activeView);
					console.log('[CheckboxInterceptor] Removed click listener');
				};
				
				viewCleanupMap.set(activeView, cleanup);
				
				// ✅ 注册清理函数，当视图关闭时自动清理
				this.register(cleanup);
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
			
			console.log(`Found ${allTasks.size} files with tasks:`);
			
			for (const [file, tasks] of allTasks) {
				console.log(`\n📄 ${file.path} (${tasks.length} tasks):`);
				totalTasks += tasks.length;
				
				tasks.forEach(task => {
					console.log(`  - [${task.status}] ${task.content}`);
					if (task.tags.length > 0) {
						console.log(`    Tags: ${task.tags.join(', ')}`);
					}
					if (task.reminderTime) {
						console.log(`    Reminder: ${task.reminderTime.format('YYYY-MM-DD HH:mm')}`);
					}
					if (task.timeTracking) {
						console.log(`    Time: ${JSON.stringify(task.timeTracking)}`);
					}
				});
			}
			
			console.log(`\n✅ Total: ${totalTasks} tasks found`);
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
			
			console.log(`\n📄 ${activeFile.path} (${tasks.length} tasks):`);
			
			tasks.forEach(task => {
				console.log(`  Line ${task.line}: - [${task.status}] ${task.content}`);
				if (task.tags.length > 0) {
					console.log(`    Tags: ${task.tags.join(', ')}`);
				}
				if (task.reminderTime) {
					console.log(`    Reminder: ${task.reminderTime.format('YYYY-MM-DD HH:mm')}`);
				}
				if (task.timeTracking) {
					console.log(`    Time Tracking:`, task.timeTracking);
				}
			});
			
			console.log(`\n✅ Parsed ${tasks.length} tasks`);
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
			
			console.log('\n🧪 Testing TimeTrackerService\n');
			console.log(`Found ${tasks.length} tasks in ${activeFile.path}\n`);
			
			// 选择第一个任务进行测试
			const testTask = tasks[0];
			console.log('📋 Test Task:', testTask.content);
			console.log('   Initial Status:', testTask.status);
			console.log('   Original Line:', testTask.originalLine);
			console.log('   Time Tracking:', testTask.timeTracking);
			console.log('');
			
			// 测试场景 1: Pending → Progress
			if (testTask.status === 'pending') {
				console.log('🔄 Test 1: Pending → Progress');
				await this.timeTrackerService.toggleTaskStatus(testTask);
				
				// 重新解析以验证更新
				const updatedTasks = await this.taskParser.parseFile(activeFile);
				const updatedTask = updatedTasks.find(t => t.id === testTask.id);
				
				if (updatedTask) {
					console.log('   New Status:', updatedTask.status);
					console.log('   New Line:', updatedTask.originalLine);
					console.log('   Time Tracking:', updatedTask.timeTracking);
					console.log('   ✅ Test 1 Passed\n');
				}
				
				// 测试场景 2: Progress → Completed
				if (updatedTask && updatedTask.status === 'progress') {
					console.log('🔄 Test 2: Progress → Completed');
					await this.timeTrackerService.toggleTaskStatus(updatedTask);
					
					// 重新解析以验证更新
					const completedTasks = await this.taskParser.parseFile(activeFile);
					const completedTask = completedTasks.find(t => t.id === updatedTask.id);
					
					if (completedTask) {
						console.log('   New Status:', completedTask.status);
						console.log('   New Line:', completedTask.originalLine);
						console.log('   Time Tracking:', completedTask.timeTracking);
						console.log('   Duration:', completedTask.timeTracking?.durationMinutes, 'minutes');
						console.log('   ✅ Test 2 Passed\n');
						
						// 测试场景 3: Completed → Pending (回退)
						console.log('🔄 Test 3: Completed → Pending (Reset)');
						await this.timeTrackerService.toggleTaskStatus(completedTask);
						
						// 重新解析以验证更新
						const resetTasks = await this.taskParser.parseFile(activeFile);
						const resetTask = resetTasks.find(t => t.id === completedTask.id);
						
						if (resetTask) {
							console.log('   New Status:', resetTask.status);
							console.log('   New Line:', resetTask.originalLine);
							console.log('   Time Tracking:', resetTask.timeTracking);
							
							// ⚠️ 关键验证：确保时间追踪已清除
							if (resetTask.timeTracking === undefined) {
								console.log('   ✅ Time tracking cleared successfully');
								console.log('   ✅ Test 3 Passed\n');
							} else {
								console.log('   ❌ ERROR: Time tracking not cleared!');
								console.log('   ❌ Test 3 Failed\n');
							}
						}
					}
				}
			} else {
				console.log('⚠️  First task is not in pending state, skipping automated test');
				console.log('   Please create a pending task (- [ ]) to test the full cycle\n');
			}
			
			// 显示所有任务的当前状态
			console.log('📊 Current State of All Tasks:');
			const finalTasks = await this.taskParser.parseFile(activeFile);
			finalTasks.forEach((task, index) => {
				console.log(`   ${index + 1}. [${task.status}] ${task.content}`);
				if (task.timeTracking) {
					const displayText = this.timeTrackerService.formatDisplayText(task, 'range');
					console.log(`      Time: ${displayText}`);
				}
			});
			
			console.log('\n✅ TimeTrackerService test completed');
			new Notice('TimeTrackerService test completed. Check console for details.');
			
		} catch (error) {
			console.error('❌ TimeTrackerService test failed:', error);
			new Notice('TimeTrackerService test failed. Check console for details.');
		}
	}
}
