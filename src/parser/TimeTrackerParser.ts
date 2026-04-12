import moment from 'moment';
import type { TimeTracking } from '../types/task';

/**
 * 时间追踪解析器
 * 从任务文本中提取 [开始：HH:mm] 或 [开始 - 结束] 格式的时间追踪信息
 */
export class TimeTrackerParser {
	/**
	 * 从文本中提取时间追踪信息
	 * @param text 任务文本
	 * @param now 当前时间（用于计算日期）
	 * @returns 时间追踪信息或 null
	 */
	parseTimeTracking(text: string, now: moment.Moment): TimeTracking | null {
		// 尝试匹配 [开始 - 结束] 格式（已完成任务）
		const completedMatch = text.match(/\[(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\]/);
		if (completedMatch) {
			return this.parseCompletedTime(completedMatch[1], completedMatch[2], now);
		}

		// 尝试匹配 [开始：HH:mm] 格式（进行中任务）
		const progressMatch = text.match(/\[开始[：:]\s*(\d{1,2}:\d{2})\]/);
		if (progressMatch) {
			return this.parseProgressTime(progressMatch[1], now);
		}

		return null;
	}

	/**
	 * 解析已完成任务的时间
	 * @param startTimeStr 开始时间字符串
	 * @param endTimeStr 结束时间字符串
	 * @param now 当前时间
	 */
	private parseCompletedTime(
		startTimeStr: string,
		endTimeStr: string,
		now: moment.Moment
	): TimeTracking {
		const startTime = this.parseTimeString(startTimeStr, now);
		const endTime = this.parseTimeString(endTimeStr, now);

		if (!startTime || !endTime) {
			return {};
		}

		// 如果结束时间早于开始时间，说明跨天了
		let adjustedEndTime = endTime.clone();
		if (adjustedEndTime.isBefore(startTime)) {
			adjustedEndTime.add(1, 'day');
		}

		const durationMinutes = adjustedEndTime.diff(startTime, 'minutes');

		return {
			startTime,
			endTime: adjustedEndTime,
			durationMinutes
		};
	}

	/**
	 * 解析进行中任务的时间
	 * @param startTimeStr 开始时间字符串
	 * @param now 当前时间
	 */
	private parseProgressTime(startTimeStr: string, now: moment.Moment): TimeTracking {
		const startTime = this.parseTimeString(startTimeStr, now);

		if (!startTime) {
			return {};
		}

		return {
			startTime
		};
	}

	/**
	 * 解析时间字符串为 moment 对象
	 * @param timeStr 时间字符串 (HH:mm)
	 * @param now 当前时间（用于获取日期）
	 */
	private parseTimeString(timeStr: string, now: moment.Moment): moment.Moment | null {
		const timeRegex = /^(\d{1,2}):(\d{2})$/;
		const match = timeStr.match(timeRegex);

		if (!match) {
			return null;
		}

		const [, hour, minute] = match;
		const time = now.clone()
			.hour(parseInt(hour))
			.minute(parseInt(minute))
			.second(0)
			.millisecond(0);

		return time.isValid() ? time : null;
	}

	/**
	 * 格式化时间追踪信息为显示文本
	 * @param timeTracking 时间追踪信息
	 * @param format 显示格式类型
	 */
	formatTimeTracking(timeTracking: TimeTracking, format: string = 'range'): string {
		if (!timeTracking.startTime) {
			return '';
		}

		switch (format) {
			case 'range':
				// 起止时间格式：[14:30 - 15:45]
				if (timeTracking.endTime) {
					const start = timeTracking.startTime.format('HH:mm');
					const end = timeTracking.endTime.format('HH:mm');
					return `[${start} - ${end}]`;
				} else {
					const start = timeTracking.startTime.format('HH:mm');
					return `[开始：${start}]`;
				}

			case 'duration':
				// 总耗时格式：[⏱️ 75 分钟]
				if (timeTracking.durationMinutes !== undefined) {
					return `[⏱️ ${timeTracking.durationMinutes} 分钟]`;
				} else if (timeTracking.startTime) {
					// 计算从开始到现在的时长
					const now = moment();
					const duration = now.diff(timeTracking.startTime, 'minutes');
					return `[⏱️ ${duration} 分钟]`;
				}
				return '';

			default:
				return this.formatTimeTracking(timeTracking, 'range');
		}
	}

	/**
	 * 从文本中移除时间追踪标记
	 * @param text 原始文本
	 * @returns 清理后的文本
	 */
	removeTimeTrackingTag(text: string): string {
		// 移除 [开始：HH:mm] 或 [HH:mm - HH:mm] 格式
		return text.replace(/\s*\[[^[\]]*(?:开始[：:]|-\s*\d)[^[\]]*\]/g, '').trim();
	}
}
