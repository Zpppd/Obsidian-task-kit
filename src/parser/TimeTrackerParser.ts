import moment from 'moment';
import type { TimeTracking } from '../types/task';
import type { TimeTrackingSettings } from '../types/settings';

/**
 * 时间追踪解析器
 * 采用特征提取策略：直接根据文本格式特征进行解析，不依赖模板配置
 */
export class TimeTrackerParser {
	private getSettings: () => TimeTrackingSettings;
	
	constructor(getSettings: () => TimeTrackingSettings) {
		this.getSettings = getSettings;
	}

	/**
	 * 从文本中提取时间追踪信息
	 * @param text 任务文本
	 * @param now 当前时间（用于计算日期）
	 * @returns 时间追踪信息或 null
	 */
	parseTimeTracking(text: string, now: moment.Moment): TimeTracking | null {
		// ✅ 优先匹配 (:...) 格式，避免与 Markdown 语法冲突
		const identifierMatch = text.match(/\(:([^)]+)\)/);
		
		if (identifierMatch) {
			const content = identifierMatch[1].trim(); // 提取括号内的内容
			return this.parseIdentifierContent(content, now);
		}
		
		return null;
	}

	/**
	 * 解析标识符内容（支持多种时间格式）
	 */
	private parseIdentifierContent(content: string, now: moment.Moment): TimeTracking | null {
		// ✅ 策略1：完整日期时间格式（YYYY-MM-DD HH:mm - YYYY-MM-DD HH:mm）
		const fullDateMatch = content.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/g);
		
		if (fullDateMatch && fullDateMatch.length >= 2) {
			return this.parseCompletedTime(fullDateMatch[0].trim(), fullDateMatch[1].trim(), now);
		} else if (fullDateMatch && fullDateMatch.length === 1) {
			return this.parseProgressTimeFromFullDate(fullDateMatch[0].trim());
		}
		
		// ✅ 策略2：纯时间格式（HH:mm - HH:mm 或 HH:mm）
		const timeMatch = content.match(/\b(\d{1,2}:\d{2})\b/g);
		
		if (timeMatch && timeMatch.length >= 2) {
			const startTimeStr = timeMatch[0].trim();
			const endTimeStr = timeMatch[1].trim();
			
			// 确保两个时间不相同（避免误匹配单个时间）
			if (startTimeStr !== endTimeStr) {
				return this.parseCompletedTime(startTimeStr, endTimeStr, now);
			}
		} else if (timeMatch && timeMatch.length === 1) {
			return this.parseProgressTime(timeMatch[0].trim(), now);
		}
		
		return null;
	}

	/**
	 * 解析已完成任务的时间
	 * 支持两种格式：HH:mm 和 YYYY-MM-DD HH:mm
	 */
	private parseCompletedTime(
		startTimeStr: string,
		endTimeStr: string,
		now: moment.Moment
	): TimeTracking {
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

		if (!startTime || !startTime.isValid() || !endTime || !endTime.isValid()) {
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
	 * 解析进行中任务的时间（从完整日期时间）
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
	 * @deprecated 待功能测试完成后删除
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
	 * 从文本中移除时间追踪标记
	 * ✅ 支持 (:...) 格式，避免与 Markdown 链接语法 [...]((...)) 冲突
	 * 
	 * 支持的格式：
	 * 1. (:HH:mm) - 进行中任务
	 * 2. (:HH:mm - HH:mm) - 已完成任务
	 * 3. (:YYYY-MM-DD HH:mm - YYYY-MM-DD HH:mm) - 完整日期时间
	 */
	removeTimeTrackingTag(text: string): string {
		// ✅ 移除 (:...) 格式的标记，包括前面的可选空白字符
		text = text.replace(/\s*\(:[^)]+\)/g, '');
		
		return text.trim();
	}
}
