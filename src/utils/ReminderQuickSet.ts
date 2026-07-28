import moment from 'moment';
import type { Task } from '../types/task';
import type { TaskParser } from '../parser/TaskParser';

/**
 * 提醒时间手术式更新工具
 *
 * 提供任务行中提醒时间标记的手术式更新，不触碰行内其他内容。
 */
export class ReminderQuickSet {
	/**
	 * 手术式更新任务行的提醒时间
	 *
	 * 只修改行内的 (@...) 提醒标记，保留 checkbox、时间追踪、标签等内容不变。
	 *
	 * @param task 任务对象
	 * @param reminderTime 新的提醒时间，null 表示清除提醒
	 * @param taskParser 用于写回文件
	 */
	static async setReminderTime(
		task: Task,
		reminderTime: moment.Moment | null,
		taskParser: TaskParser,
	): Promise<void> {
		let line = task.originalLine;

		// 1. 移除旧的提醒标记
		line = line.replace(/\s*\(@[^)]+\)/g, '');

		// 2. 添加新的提醒标记（如有）
		if (reminderTime) {
			const timeStr = reminderTime.format('YYYY-MM-DD HH:mm');
			line = line.trimEnd() + ` (@${timeStr})`;
		}

		// 3. 写回文件
		await taskParser.updateTaskLine(task, line);
		task.originalLine = line;
		task.reminderTime = reminderTime || undefined;
	}
}
