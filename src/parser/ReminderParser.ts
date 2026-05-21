import moment from 'moment';

/**
 * 提醒时间解析器
 *
 * 固定格式 (@时间)，解析策略（按优先级）：
 * 1. YYYY-MM-DD HH:mm（标准日期时间）
 * 2. HH:mm（快捷输入，默认为今天）
 * 3. YYYY-MM-DD（仅日期 + 默认时间）
 */
export class ReminderParser {
	parseReminderTime(
		text: string,
		now: moment.Moment,
		defaultTime?: string,
	): moment.Moment | null {
		const reminderMatch = text.match(/\(@([^)]+)\)/);
		if (!reminderMatch) return null;

		const timeStr = reminderMatch[1].trim();

		// 1. YYYY-MM-DD HH:mm（严格匹配）
		const full = moment(timeStr, 'YYYY-MM-DD HH:mm', true);
		if (full.isValid()) return full;

		// 2. HH:mm 快捷输入
		const pure = timeStr.match(/^(\d{1,2}):(\d{2})$/);
		if (pure) {
			return now.clone().hour(parseInt(pure[1])).minute(parseInt(pure[2])).second(0).millisecond(0);
		}

		// 3. YYYY-MM-DD + 默认时间
		const dateOnly = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (dateOnly) {
			const date = moment(`${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`, 'YYYY-MM-DD', true);
			if (date.isValid()) {
				if (defaultTime) {
					const p = defaultTime.split(':');
					if (p.length === 2) date.hour(parseInt(p[0])).minute(parseInt(p[1]));
				}
				return date;
			}
		}

		return null;
	}

	removeReminderTag(text: string): string {
		return text.replace(/\s*\(@[^)]+\)/g, '').trim();
	}
}
