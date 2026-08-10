import { App, TFile, TAbstractFile, Events } from 'obsidian';
import type { Task } from '../types/task';
import { TaskParser } from '../parser/TaskParser';
import type { PluginSettings } from '../types/settings';

/**
 * 任务管理服务
 * 
 * 核心职责：
 * - 统一的任务数据加载入口
 * - 缓存管理（按文件路径索引）
 * - 增量更新机制
 * - 文件变更监听
 * - 常用查询方法
 * - 事件通知（缓存更新时通知订阅者）
 */
export class TaskManagerService extends Events {
	private app: App;
	private taskParser: TaskParser;
	private getSettings: () => PluginSettings;
	
	// 缓存：key 为文件路径，value 为该文件的任务数组
	private tasksCache: Map<string, Task[]> = new Map();
	
	// 加载状态标志（防止重复加载）
	private isLoading: boolean = false;
	
	// 防抖定时器
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(
		app: App,
		taskParser: TaskParser,
		getSettings: () => PluginSettings
	) {
		super(); // ✅ 初始化 Events
		this.app = app;
		this.taskParser = taskParser;
		this.getSettings = getSettings;
		
		// 注册文件监听器
		this.registerFileListeners();
	}

	/**
	 * 加载所有任务（主入口）
	 * @returns 所有任务的扁平数组
	 */
	async loadAllTasks(): Promise<Task[]> {
		if (this.isLoading) {
			return this.getAllTasksFromCache();
		}

		this.isLoading = true;
		
		try {
			this.tasksCache.clear();
			
			const validFiles = this.getValidMarkdownFiles();
			
			const batchSize = 50;
			for (let i = 0; i < validFiles.length; i += batchSize) {
				const batch = validFiles.slice(i, i + batchSize);
				
				const promises = batch.map(async (file) => {
					try {
						const tasks = await this.taskParser.parseFile(file);
						return { filePath: file.path, tasks, success: true };
					} catch (error) {
						console.error(`[TaskKit:TaskManagerService] Failed to parse file ${file.path}:`, error);
						return { filePath: file.path, tasks: [], success: false };
					}
				});
				
				const results = await Promise.all(promises);
				
				for (const result of results) {
					if (result.success) {
						this.tasksCache.set(result.filePath, result.tasks);
					}
				}
			}
			
			return this.getAllTasksFromCache();
		} catch (error) {
			console.error('[TaskKit:TaskManagerService] Failed to load all tasks:', error);
			throw error;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * 从缓存获取所有任务（实时聚合）
	 * @returns 所有任务的扁平数组
	 */
	getAllTasksFromCache(): Task[] {
		const allTasks: Task[] = [];
		for (const [, tasks] of this.tasksCache) {
			allTasks.push(...tasks);
		}
		return allTasks;
	}

	/**
	 * 刷新单个文件的缓存（增量更新）
	 * @param file 要刷新的文件
	 */
	async refreshSingleFile(file: TFile): Promise<void> {
		try {
			const tasks = await this.taskParser.parseFile(file);
			
			this.tasksCache.set(file.path, tasks);
			
			// ✅ 主动通知所有订阅者：缓存已更新
			this.trigger('cache-updated', file);
		} catch (error) {
			console.error(`[TaskKit:TaskManagerService] Failed to refresh file ${file.path}:`, error);
			this.tasksCache.delete(file.path);
		}
	}

	/**
	 * 删除文件的缓存
	 * @param filePath 文件路径
	 */
	removeFileCache(filePath: string): void {
		this.tasksCache.delete(filePath);
	}

	/**
	 * 重命名文件的缓存（迁移到新路径）
	 * @param oldPath 旧文件路径
	 * @param newPath 新文件路径
	 */
	renameFileCache(oldPath: string, newPath: string): void {
		const tasks = this.tasksCache.get(oldPath);
		if (tasks) {
			this.tasksCache.delete(oldPath);
			this.tasksCache.set(newPath, tasks);
		}
	}

	/**
	 * 清空所有缓存
	 */
	clearCache(): void {
		this.tasksCache.clear();
	}

	/**
	 * 强制刷新所有任务缓存
	 *
	 * 使用场景：
	 * - 用户修改了扫描目录白名单
	 * - 用户点击了手动刷新按钮
	 * - 需要从磁盘重新加载所有任务
	 *
	 * 与 loadAllTasks() 的区别：
	 * - 不受 isLoading 标志限制（强制执行）
	 * - 完成后触发 'cache-updated' 事件通知所有订阅者
	 */
	async refreshAllTasks(): Promise<void> {
		try {
			// 清除现有缓存
			this.tasksCache.clear();

			// 重新加载所有任务
			const validFiles = this.getValidMarkdownFiles();

			const batchSize = 50;
			for (let i = 0; i < validFiles.length; i += batchSize) {
				const batch = validFiles.slice(i, i + batchSize);

				const promises = batch.map(async (file) => {
					try {
						const tasks = await this.taskParser.parseFile(file);
						return { filePath: file.path, tasks, success: true };
					} catch (error) {
						console.error(`[TaskKit:TaskManagerService] Failed to parse file ${file.path}:`, error);
						return { filePath: file.path, tasks: [], success: false };
					}
				});

				const results = await Promise.all(promises);

				for (const result of results) {
					if (result.success) {
						this.tasksCache.set(result.filePath, result.tasks);
					}
				}
			}

			// ✅ 通知所有订阅者：缓存已完全重建
			// 传递 null 表示"全量刷新"（非单文件变更）
			this.trigger('cache-updated', null);
		} catch (error) {
			console.error('[TaskKit:TaskManagerService] Failed to refresh all tasks:', error);
		}
	}

	/**
	 * 获取缓存统计信息
	 */
	getCacheStats(): { fileCount: number; totalTasks: number } {
		let totalTasks = 0;
		for (const [, tasks] of this.tasksCache) {
			totalTasks += tasks.length;
		}
		
		return {
			fileCount: this.tasksCache.size,
			totalTasks
		};
	}

	/**
	 * 获取有效的 Markdown 文件列表（已过滤）
	 * @private
	 */
	private getValidMarkdownFiles(): TFile[] {
		const files = this.app.vault.getMarkdownFiles();
		return files.filter(file => this.taskParser.shouldSkipFile(file) === false);
	}

	/**
	 * 注册文件监听器
	 * @private
	 */
	private registerFileListeners(): void {
		// 监听文件修改
		this.app.vault.on('modify', (file: TAbstractFile) => {
			if (file instanceof TFile && !this.taskParser.shouldSkipFile(file)) {
				this.handleFileModify(file);
			}
		});
		
		// 监听文件删除
		this.app.vault.on('delete', (file: TAbstractFile) => {
			if (file instanceof TFile) {
				this.removeFileCache(file.path);
			}
		});
		
		// 监听文件重命名
		this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
			if (file instanceof TFile) {
				this.renameFileCache(oldPath, file.path);
			}
		});
	}

	/**
	 * 处理文件修改事件（带防抖）
	 * @private
	 */
	private handleFileModify(file: TFile): void {
		// 清除之前的定时器
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}

		// 设置新的防抖定时器（1秒）
		this.refreshTimeout = setTimeout(async () => {
			await this.refreshSingleFile(file);
			this.refreshTimeout = null;
		}, 1000);
	}
}
