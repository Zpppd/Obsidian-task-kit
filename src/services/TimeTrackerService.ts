import { App } from 'obsidian';
import moment from 'moment';
import type { Task } from '../types/task';
import { TaskStatus } from '../types/task';
import { TaskParser } from '../parser/TaskParser';

/**
 * 时间追踪服务
 * 负责任务的三态切换和时间追踪管理
 */
export class TimeTrackerService {
	private app: App;
	private taskParser: TaskParser;

	constructor(app: App, taskParser: TaskParser) {
		this.app = app;
		this.taskParser = taskParser;
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
	 * 添加 [开始：HH:mm] 标记
	 * @param task 任务对象
	 */
	private async startTask(task: Task): Promise<void> {
		const now = this.getCurrentTime();
		
		console.log(`[TimeTrackerService] Starting task: ${task.content}`);
		console.log(`[TimeTrackerService] Current status: ${task.status}, changing to: ${TaskStatus.Progress}`);
		
		// 更新任务状态
		task.status = TaskStatus.Progress;
		
		// 初始化时间追踪信息
		task.timeTracking = {
			startTime: now.clone(),
			endTime: undefined,
			durationMinutes: undefined
		};
		
		// 重建任务行并更新文件
		const newLine = this.taskParser.buildTaskLine(task);
		console.log(`[TimeTrackerService] New line content: ${newLine}`);
		console.log(`[TimeTrackerService] Updating file: ${task.file.path}, line: ${task.line}`);
		
		await this.taskParser.updateTaskLine(task, newLine);
		
		console.log(`✅ Task started: ${task.content} at ${now.format('HH:mm')}`);
	}

	/**
	 * Progress → Completed（完成任务）
	 * 计算耗时，替换为 [开始时间 - 结束时间] 格式
	 * @param task 任务对象
	 */
	private async completeTask(task: Task): Promise<void> {
		const now = this.getCurrentTime();
		
		console.log(`[TimeTrackerService] Completing task: ${task.content}`);
		
		if (!task.timeTracking || !task.timeTracking.startTime) {
			console.warn('[TimeTrackerService] Task has no start time, cannot complete');
			return;
		}
		
		// 计算耗时
		const durationMinutes = this.calculateDuration(
			task.timeTracking.startTime,
			now
		);
		
		// 更新任务状态
		task.status = TaskStatus.Completed;
		
		// 更新时间追踪信息
		task.timeTracking.endTime = now.clone();
		task.timeTracking.durationMinutes = durationMinutes;
		
		// 重建任务行并更新文件
		const newLine = this.taskParser.buildTaskLine(task);
		console.log(`[TimeTrackerService] New line content: ${newLine}`);
		
		await this.taskParser.updateTaskLine(task, newLine);
		
		console.log(`✅ Task completed: ${task.content}, duration: ${durationMinutes} minutes`);
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
	 * 获取当前时间
	 * @returns 当前时间的 moment 对象
	 */
	private getCurrentTime(): moment.Moment {
		return moment();
	}

	/**
	 * 格式化显示文本（根据配置）
	 * @param task 任务对象
	 * @param format 显示格式：'range' | 'duration' | 'ai'
	 * @returns 格式化后的文本
	 */
	formatDisplayText(task: Task, format: string = 'range'): string {
		if (!task.timeTracking || !task.timeTracking.startTime) {
			return '';
		}

		switch (format) {
			case 'range':
				// 起止时间格式：[14:30 - 15:45]
				if (task.timeTracking.endTime) {
					const start = task.timeTracking.startTime.format('HH:mm');
					const end = task.timeTracking.endTime.format('HH:mm');
					return `[${start} - ${end}]`;
				} else {
					const start = task.timeTracking.startTime.format('HH:mm');
					return `[开始：${start}]`;
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
