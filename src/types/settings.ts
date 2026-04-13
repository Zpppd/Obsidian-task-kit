/**
 * 时间追踪设置
 */
export interface TimeTrackingSettings {
  /** 进行中状态的时间标记模板 */
  progressTemplate: string;
  
  /** 已完成状态的时间标记模板 */
  completedTemplate: string;
}

/**
 * 插件完整设置
 */
export interface PluginSettings {
  /** 时间追踪设置 */
  timeTracking: TimeTrackingSettings;
  
  /** 任务扫描目录白名单（空数组表示扫描所有目录） */
  scanDirectories: string[];
}

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  timeTracking: {
    progressTemplate: '(::{start})',
    completedTemplate: '(::{start} - {end})'
  },
  scanDirectories: []
};

/**
 * 可用的模板变量
 */
export const TEMPLATE_VARIABLES = [
  { 
    variable: '{start}', 
    description: '开始时间 (HH:mm)',
    example: '12:40'
  },
  { 
    variable: '{end}', 
    description: '结束时间 (HH:mm)',
    example: '12:50'
  },
  { 
    variable: '{startDate}', 
    description: '开始日期时间 (YYYY-MM-DD HH:mm)',
    example: '2026-04-12 12:40'
  },
  { 
    variable: '{endDate}', 
    description: '结束日期时间 (YYYY-MM-DD HH:mm)',
    example: '2026-04-12 12:50'
  },
  { 
    variable: '{duration}', 
    description: '耗时（分钟数）',
    example: '10'
  },
  { 
    variable: '{durationDate}', 
    description: '耗时文本（几天几小时几分钟）',
    example: '1天2小时30分钟'
  }
];

/**
 * 合法的变量名列表
 */
export const VALID_VARIABLE_NAMES = [
  'start',
  'end',
  'startDate',
  'endDate',
  'duration',
  'durationDate'
];
