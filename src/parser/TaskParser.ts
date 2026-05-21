import { App, TFile } from 'obsidian';
import moment from 'moment';
import type { Task, ParseResult } from '../types/task';
import { TaskStatus } from '../types/task';
import type { PluginSettings } from '../types/settings';
import { ReminderParser } from './ReminderParser';
import { TimeTrackerParser } from './TimeTrackerParser';
import { TimeTemplateRenderer } from '../utils/TimeTemplateRenderer';

/**
 * 任务解析器
 * 从 Markdown 文件中智能识别和提取任务信息
 */
export class TaskParser {
	private app: App;
	private reminderParser: ReminderParser;
	private timeTrackerParser: TimeTrackerParser;
	private getSettings: () => PluginSettings;

	/**
	 * @param app - Obsidian App 实例
	 * @param getSettings - 一个返回最新设置的函数，支持动态更新
	 */
	constructor(app: App, getSettings: () => PluginSettings) {
		this.app = app;
		this.getSettings = getSettings;
		this.reminderParser = new ReminderParser();
		this.timeTrackerParser = new TimeTrackerParser(() => getSettings().timeTracking);
	}

	/**
	 * 解析单个文件中的所有任务
	 * @param file 要解析的文件
	 * @returns 任务数组
	 */
	async parseFile(file: TFile): Promise<Task[]> {
		try {
			const content = await this.app.vault.read(file);
			
			// ⚠️ 防御性编程：确保 content 不为 undefined 或 null
			if (content === undefined || content === null) {
				console.warn(`[TaskParser] File content is empty for ${file.path}`);
				return [];
			}
			
			const lines = content.split('\n');
			
			const tasks: Task[] = [];

			for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
				const line = lines[lineNumber];
				const result = this.parseLine(line, file, lineNumber);
				
				if (result.task) {
					tasks.push(result.task);
				}
			}

			return tasks;
		} catch (error) {
			console.error(`[TaskParser] Failed to parse file ${file.path}:`, error);
			return [];
		}
	}

	/**
	 * 解析所有 Markdown 文件中的任务
	 * @returns Map<文件, 任务数组>
	 */
	async parseAllFiles(): Promise<Map<TFile, Task[]>> {
		const files = this.app.vault.getMarkdownFiles();
		const result = new Map<TFile, Task[]>();

		for (const file of files) {
			// 跳过隐藏文件和系统文件夹
			if (this.shouldSkipFile(file)) {
				continue;
			}

			const tasks = await this.parseFile(file);
			if (tasks.length > 0) {
				result.set(file, tasks);
			}
		}

		return result;
	}

	/**
	 * 解析单行文本
	 * @param line 行文本
	 * @param file 所在文件
	 * @param lineNumber 行号（0-based）
	 * @returns 解析结果
	 */
	parseLine(line: string, file: TFile, lineNumber: number): ParseResult {
		// 1. 检查是否是任务格式 - [ ]
		const taskMatch = line.match(/^(\s*-\s*\[)(.)(\]\s*)(.*)$/);
		if (!taskMatch) {
			return { task: null };
		}

		const prefix = taskMatch[1];  // ✅ 提取前缀（包含缩进）：如 "  - [" 
		const statusChar = taskMatch[2];
		const fullContent = taskMatch[4];

		// 2. 解析状态
		const status = this.parseStatus(statusChar);
		if (status === null) {
			return { task: null, error: `Invalid status character: ${statusChar}` };
		}

		// 3. 提取标签
		const tags = this.extractTags(fullContent);

		// 4. 提取提醒时间
			const now = moment();
			const reminderTime =
				this.reminderParser.parseReminderTime(
					fullContent,
					now,
					this.getSettings().reminder.defaultReminderTime,
				) || undefined;

		// 5. 提取时间追踪信息
		const timeTracking = this.timeTrackerParser.parseTimeTracking(fullContent, now) || undefined;

		// 6. 清理任务内容（移除所有标记）
		let content = fullContent;
		content = this.reminderParser.removeReminderTag(content);
		content = this.timeTrackerParser.removeTimeTrackingTag(content);
		content = this.removeTags(content);
		content = content.trim();

		// 7. 构建任务对象
		const taskId = `${file.path}:${lineNumber}`;
		const task: Task = {
			id: taskId,
			file,
			line: lineNumber,
			status,
			content,
			tags,
			reminderTime,
			timeTracking,
			originalLine: line,
			parsedAt: Date.now(),
			indentation: prefix.replace('[', '').replace(']', '').trimEnd()  // ✅ 保存缩进和前缀：如 "  -"
		};

		return { task };
	}

	/**
	 * 解析任务状态字符
	 * @param char 状态字符 (' ', '/', 'x')
	 * @returns 任务状态枚举或 null
	 */
	private parseStatus(char: string): TaskStatus | null {
		switch (char) {
			case ' ':
				return TaskStatus.Pending;
			case '/':
				return TaskStatus.Progress;
			case 'x':
			case 'X':
				return TaskStatus.Completed;
			default:
				return null;
		}
	}

	/**
	 * 从文本中提取所有标签
	 * @param text 任务文本
	 * @returns 标签数组
	 */
	private extractTags(text: string): string[] {
		const tagRegex = /#([^\s#]+)/g;
		const tags: string[] = [];
		let match;

		while ((match = tagRegex.exec(text)) !== null) {
			tags.push(`#${match[1]}`);
		}

		return tags;
	}

	/**
	 * 从文本中移除标签
	 * @param text 原始文本
	 * @returns 清理后的文本
	 */
	private removeTags(text: string): string {
		return text.replace(/#[^\s#]+/g, '').trim();
	}

	/**
	 * 判断是否应该跳过该文件
	 * @param file 文件对象
	 */
	public shouldSkipFile(file: TFile): boolean {
		// 1. 跳过隐藏文件
		if (file.name.startsWith('.')) {
			return true;
		}

		// 2. 跳过系统文件夹
		const skipFolders = ['.obsidian', '.git', 'node_modules'];
		for (const folder of skipFolders) {
			if (file.path.startsWith(`${folder}/`) || file.path.includes(`/${folder}/`)) {
				return true;
			}
		}

		// 3. 白名单检查（如果配置了白名单）
		const settings = this.getSettings();
		if (settings.scanDirectories.length > 0) {
			const isInWhitelist = settings.scanDirectories.some(dir => {
				// 标准化路径分隔符
				const normalizedDir = dir.replace(/\\/g, '/').replace(/\/$/, '');
				const normalizedPath = file.path.replace(/\\/g, '/');
				
				// 检查文件是否在白名单目录或其子目录中
				return normalizedPath.startsWith(normalizedDir + '/') || 
				       normalizedPath === normalizedDir;
			});
			
			// 如果不在白名单中，则跳过
			if (!isInWhitelist) {
				return true;
			}
		}

		return false;
	}

	/**
	 * 根据 ID 查找任务
	 * @param allTasks 所有任务的 Map
	 * @param taskId 任务 ID
	 * @returns 任务对象或 undefined
	 */
	findTaskById(allTasks: Map<TFile, Task[]>, taskId: string): Task | undefined {
		for (const [, tasks] of allTasks) {
			const task = tasks.find(t => t.id === taskId);
			if (task) {
				return task;
			}
		}
		return undefined;
	}

	/**
	 * 更新任务在文件中的内容
	 * @param task 任务对象
	 * @param newLine 新的行内容
	 */
	async updateTaskLine(task: Task, newLine: string): Promise<void> {
		try {
			const content = await this.app.vault.read(task.file);
			
			// ⚠️ 防御性编程：确保 content 不为 undefined 或 null
			if (content === undefined || content === null) {
				console.error(`[TaskParser] Cannot update task: file content is empty for ${task.file.path}`);
				throw new Error(`File content is empty: ${task.file.path}`);
			}
			
			const lines = content.split('\n');
			
			if (task.line >= 0 && task.line < lines.length) {
				lines[task.line] = newLine;
				const newContent = lines.join('\n');
				
				await this.app.vault.modify(task.file, newContent);
				
				// 更新缓存
				task.originalLine = newLine;
				task.parsedAt = Date.now();
			} else {
				console.warn(`[TaskParser] Task line ${task.line} is out of range (file has ${lines.length} lines)`);
			}
		} catch (error) {
			console.error(`[TaskParser] Failed to update task line:`, error);
			throw error;
		}
	}

	/**
	 * 获取任务的状态标记
	 * @param status 任务状态
	 * @returns 状态标记字符
	 */
	getStatusMarker(status: TaskStatus): string {
		switch (status) {
			case TaskStatus.Pending:
				return ' ';
			case TaskStatus.Progress:
				return '/';
			case TaskStatus.Completed:
				return 'x';
		}
	}

	/**
	 * 构建完整的任务行文本
	 * @param task 任务对象
	 * @returns 完整的 Markdown 任务行
	 */
	buildTaskLine(task: Task): string {
		const statusMarker = this.getStatusMarker(task.status);
		
		// ✅ 使用保存的缩进和前缀，如果没有则使用默认值
		const prefix = task.indentation || '-';
		let content = task.content;

		// 添加标签
		if (task.tags && task.tags.length > 0) {
			content += ' ' + task.tags.join(' ');
		}

		// 添加提醒时间
		if (task.reminderTime) {
			const timeStr = task.reminderTime.format('YYYY-MM-DD HH:mm');
			content += ` (@${timeStr})`;
		}

		// ✅ 只有启用时间追踪功能时，才添加/更新时间追踪标记
		if (this.getSettings().enableTimeTracking && task.timeTracking) {
			const settings = this.getSettings();
			if (task.timeTracking.endTime && task.timeTracking.durationMinutes !== undefined && task.timeTracking.startTime) {
				// 已完成状态：使用 completedTemplate
				const durationDate = this.formatDuration(task.timeTracking.durationMinutes);
				const timeMarker = TimeTemplateRenderer.render(
					settings.timeTracking.completedTemplate,
					task.timeTracking.startTime,
					task.timeTracking.endTime,
					durationDate
				);
				content += ` ${timeMarker}`;
			} else if (task.timeTracking.startTime) {
				// 进行中状态：使用 progressTemplate
				const timeMarker = TimeTemplateRenderer.render(
					settings.timeTracking.progressTemplate,
					task.timeTracking.startTime
				);
				content += ` ${timeMarker}`;
			}
		}

		return `${prefix} [${statusMarker}] ${content}`;
	}

	/**
	 * 格式化耗时为可读字符串
	 * @private
	 */
	private formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		
		if (hours > 0 && remainingMinutes > 0) {
			return `${hours}小时${remainingMinutes}分钟`;
		} else if (hours > 0) {
			return `${hours}小时`;
		} else {
			return `${remainingMinutes}分钟`;
		}
	}
}
