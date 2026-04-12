import type { TFile } from 'obsidian';
import type moment from 'moment';

/**
 * 任务状态枚举
 */
export enum TaskStatus {
	Pending = 'pending',     // - [ ]
	Progress = 'progress',   // - [/]
	Completed = 'completed'  // - [x]
}

/**
 * 时间追踪信息
 */
export interface TimeTracking {
	startTime?: moment.Moment;
	endTime?: moment.Moment;
	durationMinutes?: number;
	displayFormat?: string;
}

/**
 * 任务接口
 */
export interface Task {
	// 基础信息
	id: string;                    // 唯一标识：`${filePath}:${lineNumber}`
	file: TFile;                   // 所在文件对象
	line: number;                  // 行号（0-based）
	
	// 状态
	status: TaskStatus;            // 任务状态
	content: string;               // 任务文本（不含标记）
	
	// 元数据
	tags: string[];                // 标签列表 ['#工作', '#重要']
	reminderTime?: moment.Moment;  // 提醒时间
	timeTracking?: TimeTracking;   // 时间追踪信息
	
	// 重复任务
	isRecurring?: boolean;         // 是否来自重复模板
	recurringRuleId?: string;      // 关联的重复规则 ID
	
	// 缓存（避免重复解析）
	originalLine: string;          // 原始行文本
	parsedAt: number;              // 最后解析时间戳
	indentation: string;           // ✅ 新增：缩进和前缀（如 "  - " 或 "- "）
	
	// UI 状态（不持久化）
	isDisplaying?: boolean;        // 是否正在显示提醒
	isMuted?: boolean;             // 是否被静音
}

/**
 * 任务解析结果
 */
export interface ParseResult {
	task: Task | null;
	error?: string;
}

/**
 * 任务筛选条件
 */
export interface TaskFilter {
	searchText?: string;           // 搜索文本
	dateFilter?: DateFilterType;   // 日期筛选
	filePath?: string;             // 文件路径
	tags?: string[];               // 标签筛选
	status?: TaskStatus[];         // 状态筛选
}

/**
 * 日期筛选类型
 */
export type DateFilterType = 
	| 'today'
	| 'tomorrow'
	| 'this-week'
	| 'all'
	| 'overdue';

/**
 * 视图模式
 */
export type ViewMode = 'list' | 'board';

/**
 * 看板列
 */
export interface BoardColumn {
	id: string;
	title: string;
	status: TaskStatus;
	tasks: Task[];
}
