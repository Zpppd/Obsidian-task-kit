import moment from 'moment';

/**
 * 提醒时间解析器
 * 从任务文本中提取 (@日期时间) 格式的提醒时间
 */
export class ReminderParser {
	/**
	 * 从文本中提取提醒时间
	 * @param text 任务文本
	 * @param now 当前时间（用于相对时间计算）
	 * @returns 解析后的时间或 null
	 */
	parseReminderTime(text: string, now: moment.Moment): moment.Moment | null {
		// 匹配 (@...) 格式
		const reminderMatch = text.match(/\(@([^)]+)\)/);
		if (!reminderMatch) {
			return null;
		}

		const timeStr = reminderMatch[1].trim();
		return this.parseTimeString(timeStr, now);
	}

	/**
	 * 解析时间字符串
	 * 支持多种格式：
	 * - 绝对时间：2024-01-15 09:00, 2024-01-15T09:00
	 * - 相对时间：今天 09:00, 明天 14:00
	 * - 纯时间：09:00 (默认为今天)
	 */
	private parseTimeString(timeStr: string, now: moment.Moment): moment.Moment | null {
		// 尝试解析绝对时间格式
		const absoluteDate = this.parseAbsoluteTime(timeStr);
		if (absoluteDate) {
			return absoluteDate;
		}

		// 尝试解析相对时间格式
		const relativeDate = this.parseRelativeTime(timeStr, now);
		if (relativeDate) {
			return relativeDate;
		}

		// 尝试解析纯时间格式 (HH:mm)
		const pureTime = this.parsePureTime(timeStr, now);
		if (pureTime) {
			return pureTime;
		}

		return null;
	}

	/**
	 * 解析绝对时间
	 * 格式：YYYY-MM-DD HH:mm, YYYY-MM-DDTHH:mm
	 */
	private parseAbsoluteTime(timeStr: string): moment.Moment | null {
		// 匹配 YYYY-MM-DD HH:mm 或 YYYY-MM-DDTHH:mm
		const dateTimeRegex = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})$/;
		const match = timeStr.match(dateTimeRegex);
		
		if (match) {
			const [, year, month, day, hour, minute] = match;
			const date = moment(`${year}-${month}-${day} ${hour}:${minute}`, 'YYYY-MM-DD HH:mm');
			
			if (date.isValid()) {
				return date;
			}
		}

		// 匹配 YYYY-MM-DD
		const dateOnlyRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
		const dateMatch = timeStr.match(dateOnlyRegex);
		
		if (dateMatch) {
			const [, year, month, day] = dateMatch;
			const date = moment(`${year}-${month}-${day}`, 'YYYY-MM-DD');
			
			if (date.isValid()) {
				return date.startOf('day'); // 默认为当天开始
			}
		}

		return null;
	}

	/**
	 * 解析相对时间
	 * 格式：今天 HH:mm, 明天 14:00, 后天 09:00
	 */
	private parseRelativeTime(timeStr: string, now: moment.Moment): moment.Moment | null {
		// 匹配 "今天/明天/后天 HH:mm"
		const relativeRegex = /^(今天|明天|后天)\s+(\d{1,2}):(\d{2})$/;
		const match = timeStr.match(relativeRegex);
		
		if (match) {
			const [, dayKeyword, hour, minute] = match;
			let targetDate = now.clone();

			switch (dayKeyword) {
				case '今天':
					// 保持当前日期
					break;
				case '明天':
					targetDate.add(1, 'day');
					break;
				case '后天':
					targetDate.add(2, 'days');
					break;
			}

			targetDate.hour(parseInt(hour)).minute(parseInt(minute)).second(0).millisecond(0);
			return targetDate;
		}

		return null;
	}

	/**
	 * 解析纯时间
	 * 格式：HH:mm (默认为今天)
	 */
	private parsePureTime(timeStr: string, now: moment.Moment): moment.Moment | null {
		const timeRegex = /^(\d{1,2}):(\d{2})$/;
		const match = timeStr.match(timeRegex);
		
		if (match) {
			const [, hour, minute] = match;
			const time = now.clone()
				.hour(parseInt(hour))
				.minute(parseInt(minute))
				.second(0)
				.millisecond(0);
			
			return time;
		}

		return null;
	}

	/**
	 * 从文本中移除提醒时间标记
	 * @param text 原始文本
	 * @returns 清理后的文本
	 */
	removeReminderTag(text: string): string {
		return text.replace(/\s*\(@[^)]+\)/g, '').trim();
	}
}
