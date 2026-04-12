import { App } from 'obsidian';
import moment from 'moment';
import type { Task } from '../types/task';
import { TaskStatus } from '../types/task';
import { TaskParser } from '../parser/TaskParser';
import { TimeTemplateRenderer } from '../utils/TimeTemplateRenderer';
import type TaskMasterProPlugin from '../main';

/**
 * 时间追踪服务
 * 负责任务的三态切换和时间追踪管理
 */
export class TimeTrackerService {
	private app: App;
	private taskParser: TaskParser;
	private plugin: TaskMasterProPlugin; // ✅ 添加插件实例引用

	constructor(app: App, taskParser: TaskParser, plugin: TaskMasterProPlugin) {
		this.app = app;
		this.taskParser = taskParser;
		this.plugin = plugin;
	}

	/**
	 * 切换任务状态（主入口）
	 * 根据当前状态自动判断下一步操作
	 * @param task 任务对象
	 */
	async toggleTaskStatus(task: Task): Promise<void> {
		try {
			switch (task.status) {
				case TaskStatus.Pending:
					await this.startTask(task);
					break;
				case TaskStatus.Progress:
					await this.completeTask(task);
					break;
				case TaskStatus.Completed:
					await this.resetTask(task);
					break;
				default:
					console.warn(`Unknown task status: ${task.status}`);
			}
		} catch (error) {
			console.error('Failed to toggle task status:', error);
			throw error;
		}
	}

	/**
	 * Pending → Progress（开始任务）
	 * ✅ 使用模板渲染引擎生成时间标记，并记录使用的模板
	 * @param task 任务对象
	 */
	private async startTask(task: Task): Promise<void> {
		const now = this.getCurrentTime();
		
		console.log(`[TimeTrackerService] Starting task: ${task.content}`);
		console.log(`[TimeTrackerService] Current status: ${task.status}, changing to: ${TaskStatus.Progress}`);
		
		// 更新任务状态
		task.status = TaskStatus.Progress;
		
		// ✅ 获取当前设置的进行中模板
		const progressTemplate = this.plugin.settings.timeTracking.progressTemplate;
		
		// 初始化时间追踪信息
		task.timeTracking = {
			startTime: now.clone(),
			endTime: undefined,
			durationMinutes: undefined,
			usedTemplate: progressTemplate // ✅ 记录使用的模板
		};
		
		// ✅ 使用模板渲染引擎生成时间标记
		const timeMarker = TimeTemplateRenderer.render(progressTemplate, now);
		
		// 构建新的任务行
		const newLine = this.buildTaskLineWithTimeMarker(task, timeMarker);
		console.log(`[TimeTrackerService] New line content: ${newLine}`);
		console.log(`[TimeTrackerService] Updating file: ${task.file.path}, line: ${task.line}`);
		
		await this.taskParser.updateTaskLine(task, newLine);
		
		console.log(`✅ Task started: ${task.content} at ${now.format('HH:mm')}`);
	}

	/**
	 * Progress → Completed（完成任务）
	 * ✅ 使用存储的模板信息，无需正则提取
	 * @param task 任务对象
	 */
	private async completeTask(task: Task): Promise<void> {
		const now = this.getCurrentTime();
		
		console.log(`[TimeTrackerService] Completing task: ${task.content}`);
		
		if (!task.timeTracking || !task.timeTracking.startTime) {
			console.warn('[TimeTrackerService] Task has no start time, cannot complete');
			return;
		}
		
		// ✅ 直接使用存储的开始时间，不需要从文本中提取！
		const startTime = task.timeTracking.startTime;
		
		// ✅ 计算耗时（自动处理跨天）
		const durationMinutes = this.calculateDuration(startTime, now);
		
		// ✅ 格式化耗时为可读字符串（如 "1小时30分钟"）
		const durationDate = this.formatDuration(durationMinutes);
		
		// 更新任务状态
		task.status = TaskStatus.Completed;
		
		// 更新时间追踪信息
		task.timeTracking.endTime = now.clone();
		task.timeTracking.durationMinutes = durationMinutes;
		
		// ✅ 使用模板渲染引擎生成时间标记（传入 durationDate）
		const timeMarker = TimeTemplateRenderer.render(
			this.plugin.settings.timeTracking.completedTemplate,
			startTime,
			now,
			durationDate  // ← 新增参数
		);
		
		// 构建新的任务行
		const newLine = this.buildTaskLineWithTimeMarker(task, timeMarker);
		console.log(`[TimeTrackerService] New line content: ${newLine}`);
		
		await this.taskParser.updateTaskLine(task, newLine);
		
		console.log(`✅ Task completed: ${task.content}, duration: ${durationMinutes} minutes (${durationDate})`);
	}

	/**
	 * Completed → Pending（回退任务）
	 * ⚠️ 关键点：必须清除所有时间标记
	 * @param task 任务对象
	 */
	private async resetTask(task: Task): Promise<void> {
		// 更新任务状态
		task.status = TaskStatus.Pending;
		
		// ⚠️ 关键：清除所有时间追踪信息
		task.timeTracking = undefined;
		
		// 重建任务行并更新文件
		const newLine = this.taskParser.buildTaskLine(task);
		await this.taskParser.updateTaskLine(task, newLine);
		
		console.log(`✅ Task reset: ${task.content}, time tracking cleared`);
	}

	/**
	 * 构建带有时间标记的任务行
	 * ✅ 保留任务的缩进信息
	 * @param task 任务对象
	 * @param timeMarker 时间标记字符串
	 * @returns 完整的任务行文本
	 */
	private buildTaskLineWithTimeMarker(task: Task, timeMarker: string): string {
		// ✅ 使用任务的 indentation 属性，如果没有则使用默认值
		const prefix = task.indentation || '-';
		const checkboxMap = {
			[TaskStatus.Pending]: '[ ]',
			[TaskStatus.Progress]: '[/]',
			[TaskStatus.Completed]: '[x]'
		};
		
		const checkbox = checkboxMap[task.status];
		return `${prefix} ${checkbox} ${task.content}${timeMarker ? ' ' + timeMarker : ''}`;
	}

	/**
	 * 计算任务耗时（分钟）
	 * 支持跨天情况
	 * @param startTime 开始时间
	 * @param endTime 结束时间
	 * @returns 耗时（分钟）
	 */
	private calculateDuration(startTime: moment.Moment, endTime: moment.Moment): number {
		let adjustedEndTime = endTime.clone();
		
		// 如果结束时间早于开始时间，说明跨天了
		if (adjustedEndTime.isBefore(startTime)) {
			adjustedEndTime.add(1, 'day');
		}
		
		const duration = adjustedEndTime.diff(startTime, 'minutes');
		return Math.max(0, duration); // 确保不为负数
	}

	/**
	 * 格式化耗时为可读字符串
	 * @param minutes 耗时（分钟）
	 * @returns 格式化后的字符串（如 "1小时30分钟" 或 "90分钟"）
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

	/**
	 * 获取当前时间
	 * @returns 当前时间的 moment 对象
	 */
	private getCurrentTime(): moment.Moment {
		return moment();
	}

	/**
	 * 格式化时间追踪信息为显示文本
	 * ✅ 添加详细日志以便调试
	 * @param task 任务对象
	 * @param format 显示格式：'range' | 'duration' | 'ai'
	 * @returns 格式化后的文本
	 */
	formatDisplayText(task: Task, format: string = 'range'): string {
		console.log('[TimeTrackerService] formatDisplayText called for:', task.content);
		console.log('[TimeTrackerService] task.timeTracking:', task.timeTracking);
		
		if (!task.timeTracking || !task.timeTracking.startTime) {
			console.warn('[TimeTrackerService] No timeTracking or startTime, returning empty string');
			return '';
		}

		switch (format) {
			case 'range':
				// ✅ 使用模板渲染引擎
				if (task.timeTracking.endTime) {
					// 已完成状态
					console.log('[TimeTrackerService] Rendering completed template');
					console.log('[TimeTrackerService] Template:', this.plugin.settings.timeTracking.completedTemplate);
					console.log('[TimeTrackerService] startTime:', task.timeTracking.startTime.format('YYYY-MM-DD HH:mm'));
					console.log('[TimeTrackerService] endTime:', task.timeTracking.endTime.format('YYYY-MM-DD HH:mm'));
					
					const result = TimeTemplateRenderer.render(
						this.plugin.settings.timeTracking.completedTemplate,
						task.timeTracking.startTime,
						task.timeTracking.endTime
					);
					
					console.log('[TimeTrackerService] Rendered result:', result);
					return result;
				} else {
					// 进行中状态
					console.log('[TimeTrackerService] Rendering progress template');
					console.log('[TimeTrackerService] Template:', this.plugin.settings.timeTracking.progressTemplate);
					console.log('[TimeTrackerService] startTime:', task.timeTracking.startTime.format('YYYY-MM-DD HH:mm'));
					
					const result = TimeTemplateRenderer.render(
						this.plugin.settings.timeTracking.progressTemplate,
						task.timeTracking.startTime
					);
					
					console.log('[TimeTrackerService] Rendered result:', result);
					return result;
				}

			case 'duration':
				// 总耗时格式：[⏱️ 75 分钟]
				if (task.timeTracking.durationMinutes !== undefined) {
					return `[⏱️ ${task.timeTracking.durationMinutes} 分钟]`;
				} else if (task.timeTracking.startTime) {
					// 计算从开始到现在的时长
					const now = this.getCurrentTime();
					const duration = this.calculateDuration(task.timeTracking.startTime, now);
					return `[⏱️ ${duration} 分钟]`;
				}
				return '';

			case 'ai':
				// AI 总结格式（简化版，后续可扩展）
				if (task.timeTracking.durationMinutes !== undefined) {
					const hours = Math.floor(task.timeTracking.durationMinutes / 60);
					const minutes = task.timeTracking.durationMinutes % 60;
					
					if (hours > 0 && minutes > 0) {
						return `[📝 ${hours} 小时 ${minutes} 分]`;
					} else if (hours > 0) {
						return `[📝 ${hours} 小时]`;
					} else {
						return `[📝 ${minutes} 分钟]`;
					}
				}
				return '';

			default:
				return this.formatDisplayText(task, 'range');
		}
	}
}
