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
 *
 * 切换时采用"手术式更新"：只改 checkbox 和时间标记，保留行内其他内容不变。
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

	async toggleTaskStatus(task: Task): Promise<void> {
		if (!this.plugin.settings.enableTimeTracking) {
			return;
		}
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
			}
		} catch (error) {
			console.error('Failed to toggle task status:', error);
			throw error;
		}
	}

	private async startTask(task: Task): Promise<void> {
		const now = this.getCurrentTime();
		task.status = TaskStatus.Progress;
		task.timeTracking = {
			startTime: now.clone(),
			endTime: undefined,
			durationMinutes: undefined,
		};

		const newLine = this.buildSurgicalLine(task);
		await this.taskParser.updateTaskLine(task, newLine);
		task.originalLine = newLine;
	}

	private async completeTask(task: Task): Promise<void> {
		const now = this.getCurrentTime();
		if (!task.timeTracking?.startTime) {
			return;
		}

		const durationMinutes = this.calculateDuration(task.timeTracking.startTime, now);
		task.status = TaskStatus.Completed;
		task.timeTracking.endTime = now.clone();
		task.timeTracking.durationMinutes = durationMinutes;

		const newLine = this.buildSurgicalLine(task);
		await this.taskParser.updateTaskLine(task, newLine);
		task.originalLine = newLine;
	}

	private async resetTask(task: Task): Promise<void> {
		task.status = TaskStatus.Pending;
		task.timeTracking = undefined;

		const newLine = this.buildSurgicalLine(task);
		await this.taskParser.updateTaskLine(task, newLine);
		task.originalLine = newLine;
	}

	/**
	 * 手术式更新行：只改 checkbox 和时间标记，保留提醒时间、标签等其他内容不变
	 */
	private buildSurgicalLine(task: Task): string {
		const line = task.originalLine;

		// 1. 替换 checkbox 状态
		const statusChars: Record<string, string> = {
			[TaskStatus.Pending]: ' ',
			[TaskStatus.Progress]: '/',
			[TaskStatus.Completed]: 'x',
		};
		const newChar = statusChars[task.status];
		let newLine = line.replace(/^(\s*-\s*\[).(\])/, `$1${newChar}$2`);

		// 2. 移除旧的时间追踪标记
		newLine = newLine.replace(/\s*\(:[^)]+\)/g, '');

		// 3. 追加新的时间追踪标记
		if (task.timeTracking && this.plugin.settings.enableTimeTracking) {
			const s = this.plugin.settings.timeTracking;
			let marker = '';
			if (task.timeTracking.endTime && task.timeTracking.durationMinutes !== undefined && task.timeTracking.startTime) {
				const durationDate = this.formatDuration(task.timeTracking.durationMinutes);
				marker = TimeTemplateRenderer.render(
					s.completedTemplate,
					task.timeTracking.startTime,
					task.timeTracking.endTime,
					durationDate,
				);
			} else if (task.timeTracking.startTime) {
				marker = TimeTemplateRenderer.render(s.progressTemplate, task.timeTracking.startTime);
			}
			if (marker) {
				newLine = newLine.trimEnd() + ` ${marker}`;
			}
		}

		return newLine.trimEnd();
	}

	// ==================== 耗时计算 ====================

	private calculateDuration(startTime: moment.Moment, endTime: moment.Moment): number {
		let adjustedEndTime = endTime.clone();
		if (adjustedEndTime.isBefore(startTime)) {
			adjustedEndTime.add(1, 'day');
		}
		return Math.max(0, adjustedEndTime.diff(startTime, 'minutes'));
	}

	private formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		if (hours > 0 && remainingMinutes > 0) return `${hours}小时${remainingMinutes}分钟`;
		if (hours > 0) return `${hours}小时`;
		return `${remainingMinutes}分钟`;
	}

	private getCurrentTime(): moment.Moment {
		return moment();
	}

	// ==================== 显示文本（用于面板渲染） ====================

	formatDisplayText(task: Task, format: string = 'range'): string {
		if (!task.timeTracking?.startTime) return '';

		switch (format) {
			case 'range':
				if (task.timeTracking.endTime) {
					const durationDate = this.formatDuration(task.timeTracking.durationMinutes || 0);
					return TimeTemplateRenderer.render(
						this.plugin.settings.timeTracking.completedTemplate,
						task.timeTracking.startTime,
						task.timeTracking.endTime,
						durationDate,
					);
				} else {
					return TimeTemplateRenderer.render(
						this.plugin.settings.timeTracking.progressTemplate,
						task.timeTracking.startTime,
					);
				}
			case 'duration':
				if (task.timeTracking.durationMinutes !== undefined) {
					return `[⏱️ ${task.timeTracking.durationMinutes} 分钟]`;
				} else if (task.timeTracking.startTime) {
					const now = this.getCurrentTime();
					return `[⏱️ ${this.calculateDuration(task.timeTracking.startTime, now)} 分钟]`;
				}
				return '';
			case 'ai':
				if (task.timeTracking.durationMinutes !== undefined) {
					const h = Math.floor(task.timeTracking.durationMinutes / 60);
					const m = task.timeTracking.durationMinutes % 60;
					if (h > 0 && m > 0) return `[📝 ${h} 小时 ${m} 分]`;
					if (h > 0) return `[📝 ${h} 小时]`;
					return `[📝 ${m} 分钟]`;
				}
				return '';
			default:
				return this.formatDisplayText(task, 'range');
		}
	}
}
