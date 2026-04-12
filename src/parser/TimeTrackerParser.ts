import moment from 'moment';
import type { TimeTracking } from '../types/task';
import type { TimeTrackingSettings } from '../types/settings';

/**
 * 时间追踪解析器
 * ✅ 支持动态配置：根据用户自定义模板智能选择解析策略
 */
export class TimeTrackerParser {
	private getSettings: () => TimeTrackingSettings;
	
	/**
	 * @param getSettings - 一个返回最新设置的函数，支持动态更新
	 */
	constructor(getSettings: () => TimeTrackingSettings) {
		this.getSettings = getSettings;
	}

	/**
	 * 从文本中提取时间追踪信息
	 * ✅ 根据用户配置的模板智能选择解析策略
	 * @param text 任务文本
	 * @param now 当前时间（用于计算日期）
	 * @returns 时间追踪信息或 null
	 */
	parseTimeTracking(text: string, now: moment.Moment): TimeTracking | null {
		console.log('[TimeTrackerParser] Parsing time tracking from:', text);
		
		// ✅ 动态获取最新设置
		const settings = this.getSettings();
		const completedTemplate = settings.completedTemplate;
		
		// 检查模板是否使用完整日期格式
		const usesFullDate = completedTemplate.includes('{startDate}') || 
		                    completedTemplate.includes('{endDate}');
		
		console.log('[TimeTrackerParser] Template uses full date:', usesFullDate, 'Template:', completedTemplate);
		
		if (usesFullDate) {
			// 策略 1: 优先匹配完整日期时间格式
			return this.parseWithFullDatePriority(text, now);
		} else {
			// 策略 2: 仅匹配 HH:mm 格式
			return this.parseWithTimeOnlyPriority(text, now);
		}
	}

	/**
	 * 策略 1: 优先匹配完整日期时间格式
	 */
	private parseWithFullDatePriority(text: string, now: moment.Moment): TimeTracking | null {
		// 1. 尝试匹配完整日期时间范围：YYYY-MM-DD HH:mm ... YYYY-MM-DD HH:mm
		const fullDateRangeMatch = text.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}).*?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
		if (fullDateRangeMatch) {
			console.log('[TimeTrackerParser] Matched full date range:', fullDateRangeMatch[1], 'to', fullDateRangeMatch[2]);
			return this.parseCompletedTime(fullDateRangeMatch[1].trim(), fullDateRangeMatch[2].trim(), now);
		}

		// 2. 尝试匹配单个完整日期时间：YYYY-MM-DD HH:mm
		const fullDateTimeMatch = text.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
		if (fullDateTimeMatch) {
			console.log('[TimeTrackerParser] Matched full datetime:', fullDateTimeMatch[1]);
			return this.parseProgressTimeFromFullDate(fullDateTimeMatch[1].trim());
		}

		// 3. 降级尝试匹配时间范围 HH:mm ... HH:mm
		const timeRangeMatch = text.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
		if (timeRangeMatch && timeRangeMatch[1].trim() !== timeRangeMatch[2].trim()) {
			console.log('[TimeTrackerParser] Fallback matched time range:', timeRangeMatch[1], 'to', timeRangeMatch[2]);
			return this.parseCompletedTime(timeRangeMatch[1].trim(), timeRangeMatch[2].trim(), now);
		}

		// 4. 降级尝试匹配单个时间 HH:mm
		const timeMatch = text.match(/(\d{1,2}:\d{2})/);
		if (timeMatch) {
			console.log('[TimeTrackerParser] Fallback matched single time:', timeMatch[1]);
			return this.parseProgressTime(timeMatch[1].trim(), now);
		}

		console.log('[TimeTrackerParser] No time pattern matched (Full Date Priority)');
		return null;
	}

	/**
	 * 策略 2: 仅匹配 HH:mm 格式 (或者当模板不包含完整日期时)
	 */
	private parseWithTimeOnlyPriority(text: string, now: moment.Moment): TimeTracking | null {
		// 1. 尝试匹配时间范围：HH:mm ... HH:mm
		const timeRangeMatch = text.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
		if (timeRangeMatch) {
			const startTimeStr = timeRangeMatch[1].trim();
			const endTimeStr = timeRangeMatch[2].trim();
			console.log('[TimeTrackerParser] Matched time range:', startTimeStr, 'to', endTimeStr);
			
			// 确保两个时间不相同（避免误匹配单个时间）
			if (startTimeStr !== endTimeStr) {
				return this.parseCompletedTime(startTimeStr, endTimeStr, now);
			} else {
				console.log('[TimeTrackerParser] Skipped identical times, treating as single time');
			}
		}
		
		// 2. 尝试匹配单个时间：HH:mm
		const timeMatch = text.match(/(\d{1,2}:\d{2})/);
		if (timeMatch) {
			console.log('[TimeTrackerParser] Matched single time:', timeMatch[1]);
			return this.parseProgressTime(timeMatch[1].trim(), now);
		}

		// 3. 即使模板没配置完整日期，如果文本里显式出现了完整日期，也可以尝试解析作为后备
		const fullDateTimeMatch = text.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
		if (fullDateTimeMatch) {
			console.log('[TimeTrackerParser] Fallback matched full datetime:', fullDateTimeMatch[1]);
			return this.parseProgressTimeFromFullDate(fullDateTimeMatch[1].trim());
		}

		console.log('[TimeTrackerParser] No time pattern matched (Time Only Priority)');
		return null;
	}

	/**
	 * 解析已完成任务的时间
	 * ✅ 支持两种格式：HH:mm 和 YYYY-MM-DD HH:mm
	 * @param startTimeStr 开始时间字符串
	 * @param endTimeStr 结束时间字符串
	 * @param now 当前时间
	 */
	private parseCompletedTime(
		startTimeStr: string,
		endTimeStr: string,
		now: moment.Moment
	): TimeTracking {
		console.log('[TimeTrackerParser] parseCompletedTime called with:', startTimeStr, endTimeStr);
		
		// ✅ 支持完整日期时间格式
		let startTime: moment.Moment | null;
		let endTime: moment.Moment | null;
		
		// 检查是否为完整日期时间格式
		if (startTimeStr.includes('-')) {
			startTime = moment(startTimeStr, 'YYYY-MM-DD HH:mm');
		} else {
			startTime = this.parseTimeString(startTimeStr, now);
		}
		
		if (endTimeStr.includes('-')) {
			endTime = moment(endTimeStr, 'YYYY-MM-DD HH:mm');
		} else {
			endTime = this.parseTimeString(endTimeStr, now);
		}
		
		console.log('[TimeTrackerParser] Parsed startTime:', startTime?.isValid() ? startTime.format('YYYY-MM-DD HH:mm') : 'invalid');
		console.log('[TimeTrackerParser] Parsed endTime:', endTime?.isValid() ? endTime.format('YYYY-MM-DD HH:mm') : 'invalid');

		if (!startTime || !startTime.isValid() || !endTime || !endTime.isValid()) {
			console.error('[TimeTrackerParser] Failed to parse times:', startTimeStr, endTimeStr);
			return {};
		}

		// 如果结束时间早于开始时间，说明跨天了
		let adjustedEndTime = endTime.clone();
		if (adjustedEndTime.isBefore(startTime)) {
			adjustedEndTime.add(1, 'day');
		}

		const durationMinutes = adjustedEndTime.diff(startTime, 'minutes');
		
		console.log('[TimeTrackerParser] Duration:', durationMinutes, 'minutes');

		return {
			startTime,
			endTime: adjustedEndTime,
			durationMinutes
		};
	}

	/**
	 * 解析进行中任务的时间（从完整日期时间）
	 * @param dateTimeStr 完整日期时间字符串 (YYYY-MM-DD HH:mm)
	 */
	private parseProgressTimeFromFullDate(dateTimeStr: string): TimeTracking {
		const startTime = moment(dateTimeStr, 'YYYY-MM-DD HH:mm');
		
		if (!startTime.isValid()) {
			return {};
		}
		
		return {
			startTime
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
