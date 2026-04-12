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
	private plugin: TaskMasterProPlugin;

	constructor(app: App, taskParser: TaskParser, plugin: TaskMasterProPlugin) {
		this.app = app;
		this.taskParser = taskParser;
		this.plugin = plugin;
	}

	/**
	 * 切换任务状态（主入口）
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
	 */
	private async startTask(task: Task): Promise<void> {
		const now = this.getCurrentTime();
		
		task.status = TaskStatus.Progress;
		
		const progressTemplate = this.plugin.settings.timeTracking.progressTemplate;
		
		task.timeTracking = {
			startTime: now.clone(),
			endTime: undefined,
			durationMinutes: undefined,
			usedTemplate: progressTemplate
		};
		
		const timeMarker = TimeTemplateRenderer.render(progressTemplate, now);
		const newLine = this.buildTaskLineWithTimeMarker(task, timeMarker);
		
		await this.taskParser.updateTaskLine(task, newLine);
	}

	/**
	 * Progress → Completed（完成任务）
	 */
	private async completeTask(task: Task): Promise<void> {
		const now = this.getCurrentTime();
		
		if (!task.timeTracking || !task.timeTracking.startTime) {
			console.warn('[TimeTrackerService] Task has no start time, cannot complete');
			return;
		}
		
		const startTime = task.timeTracking.startTime;
		const durationMinutes = this.calculateDuration(startTime, now);
		const durationDate = this.formatDuration(durationMinutes);
		
		task.status = TaskStatus.Completed;
		
		task.timeTracking.endTime = now.clone();
		task.timeTracking.durationMinutes = durationMinutes;
		
		const timeMarker = TimeTemplateRenderer.render(
			this.plugin.settings.timeTracking.completedTemplate,
			startTime,
			now,
			durationDate
		);
		
		const newLine = this.buildTaskLineWithTimeMarker(task, timeMarker);
		await this.taskParser.updateTaskLine(task, newLine);
	}

	/**
	 * Completed → Pending（回退任务）
	 */
	private async resetTask(task: Task): Promise<void> {
		task.status = TaskStatus.Pending;
		task.timeTracking = undefined;
		
		const newLine = this.taskParser.buildTaskLine(task);
		await this.taskParser.updateTaskLine(task, newLine);
	}

	/**
	 * 构建带有时间标记的任务行
	 */
	private buildTaskLineWithTimeMarker(task: Task, timeMarker: string): string {
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
	 * 计算任务耗时（分钟），支持跨天情况
	 */
	private calculateDuration(startTime: moment.Moment, endTime: moment.Moment): number {
		let adjustedEndTime = endTime.clone();
		
		if (adjustedEndTime.isBefore(startTime)) {
			adjustedEndTime.add(1, 'day');
		}
		
		const duration = adjustedEndTime.diff(startTime, 'minutes');
		return Math.max(0, duration);
	}

	/**
	 * 格式化耗时为可读字符串
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
	 */
	private getCurrentTime(): moment.Moment {
		return moment();
	}

	/**
	 * 格式化时间追踪信息为显示文本
	 */
	formatDisplayText(task: Task, format: string = 'range'): string {
		if (!task.timeTracking || !task.timeTracking.startTime) {
			return '';
		}

		switch (format) {
			case 'range':
				if (task.timeTracking.endTime) {
					return TimeTemplateRenderer.render(
						this.plugin.settings.timeTracking.completedTemplate,
						task.timeTracking.startTime,
						task.timeTracking.endTime
					);
				} else {
					return TimeTemplateRenderer.render(
						this.plugin.settings.timeTracking.progressTemplate,
						task.timeTracking.startTime
					);
				}

			case 'duration':
				if (task.timeTracking.durationMinutes !== undefined) {
					return `[⏱️ ${task.timeTracking.durationMinutes} 分钟]`;
				} else if (task.timeTracking.startTime) {
					const now = this.getCurrentTime();
					const duration = this.calculateDuration(task.timeTracking.startTime, now);
					return `[⏱️ ${duration} 分钟]`;
				}
				return '';

			case 'ai':
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
