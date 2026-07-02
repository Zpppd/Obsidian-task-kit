import moment from 'moment';
import type { Task } from '../types/task';
import type { TaskParser } from '../parser/TaskParser';

/**
 * 快捷提醒时间预设项
 */
export interface ReminderPreset {
	label: string;
	/** 计算出的提醒时间 moment */
	time: moment.Moment;
}

/**
 * 快捷提醒时间工具
 *
 * 提供预设时间选项的计算，以及任务行中提醒时间的手术式更新。
 */
export class ReminderQuickSet {
	/**
	 * 获取快捷提醒时间预设列表
	 *
	 * @param now 当前时间（用于计算"今天"、"明天"等）
	 * @returns 预设选项数组
	 */
	static getPresets(now: moment.Moment): ReminderPreset[] {
		const today = now.clone().startOf('day');

		const presets: ReminderPreset[] = [
			{
				label: '今天 17:00',
				time: today.clone().hour(17).minute(0),
			},
			{
				label: '今天 20:00',
				time: today.clone().hour(20).minute(0),
			},
			{
				label: '明天 09:00',
				time: today.clone().add(1, 'day').hour(9).minute(0),
			},
			{
				label: '后天 09:00',
				time: today.clone().add(2, 'days').hour(9).minute(0),
			},
			{
				label: '下周一 09:00',
				time: getNextMonday(today).hour(9).minute(0),
			},
		];

		// 过滤掉已经过去的预设时间，但保留今天还没到的
		return presets.filter(p => p.time.isAfter(now));
	}

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

/**
 * 计算下周一
 */
function getNextMonday(today: moment.Moment): moment.Moment {
	const day = today.isoWeekday(); // 1=Mon, 7=Sun
	const daysUntilMonday = day <= 1 ? (1 - day) : (8 - day);
	return today.clone().add(daysUntilMonday === 0 ? 7 : daysUntilMonday, 'days');
}
