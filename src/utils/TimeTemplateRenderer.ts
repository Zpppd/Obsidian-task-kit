import moment from 'moment';
import { VALID_VARIABLE_NAMES } from '../types/settings';

export class TimeTemplateRenderer {
  /**
   * 渲染时间模板
   */
  static render(
    template: string,
    startTime: moment.Moment,
    endTime?: moment.Moment,
    durationDate?: string
  ): string {
    if (!template || template.trim() === '') {
      return '';
    }

    const start = startTime.format('HH:mm');
    const startDate = startTime.format('YYYY-MM-DD HH:mm');
    
    let result = template
      .replace(/\{start\}/g, start)
      .replace(/\{startDate\}/g, startDate);

    if (endTime) {
      const end = endTime.format('HH:mm');
      const endDate = endTime.format('YYYY-MM-DD HH:mm');
      
      const finalDurationDate = durationDate || this.formatDurationDate(endTime.diff(startTime, 'minutes'));
      const durationMinutes = endTime.diff(startTime, 'minutes');

      result = result
        .replace(/\{end\}/g, end)
        .replace(/\{endDate\}/g, endDate)
        .replace(/\{duration\}/g, durationMinutes.toString())
        .replace(/\{durationDate\}/g, finalDurationDate);
    } else {
      result = result
        .replace(/\{end\}/g, '')
        .replace(/\{endDate\}/g, '')
        .replace(/\{duration\}/g, '')
        .replace(/\{durationDate\}/g, '');
    }

    return result;
  }

  /**
   * 格式化耗时为"几天几小时几分钟"格式
   */
  private static formatDurationDate(minutes: number): string {
    if (minutes <= 0) {
      return '0分钟';
    }

    const days = Math.floor(minutes / (60 * 24));
    const hours = Math.floor((minutes % (60 * 24)) / 60);
    const remainingMinutes = minutes % 60;

    const parts: string[] = [];
    
    if (days > 0) {
      parts.push(`${days}天`);
    }
    
    if (hours > 0) {
      parts.push(`${hours}小时`);
    }
    
    if (remainingMinutes > 0) {
      parts.push(`${remainingMinutes}分钟`);
    }

    return parts.length > 0 ? parts.join('') : '0分钟';
  }

  /**
   * 验证模板是否有效
   */
  static validateTemplate(template: string): { valid: boolean; error?: string } {
    if (!template || template.trim() === '') {
      return { valid: false, error: '模板不能为空' };
    }

    // 检查 (: ) 圆括号匹配
    const openParentheses = (template.match(/\(/g) || []).length;
    const closeParentheses = (template.match(/\)/g) || []).length;
    
    if (openParentheses !== closeParentheses) {
      return { valid: false, error: '模板中存在未闭合的圆括号 ()' };
    }

    // 检查 {} 花括号匹配
    const openBraces = (template.match(/\{/g) || []).length;
    const closeBraces = (template.match(/\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      return { valid: false, error: '模板中存在未闭合的花括号 {}' };
    }

    // 提取所有变量名并验证
    const variableMatches = template.match(/\{([^}]+)\}/g);
    if (variableMatches) {
      // 检测重复变量
      const variableNames = variableMatches.map(m => m.slice(1, -1));
      const duplicates = this.findDuplicates(variableNames);
      if (duplicates.length > 0) {
        return { 
          valid: false, 
          error: `检测到重复变量: ${duplicates.map(v => `{${v}}`).join(', ')}` 
        };
      }

      // 验证变量名合法性
      for (const match of variableMatches) {
        const variableName = match.slice(1, -1);
        if (!VALID_VARIABLE_NAMES.includes(variableName)) {
          return { 
            valid: false, 
            error: `无效的变量名: ${match}。可用的变量有: ${VALID_VARIABLE_NAMES.map(v => `{${v}}`).join(', ')}` 
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 验证模板的语义正确性（变量配对、必填项等）
   * @param template 模板字符串
   * @param templateType 模板类型：'progress' 或 'completed'
   */
  static validateTemplateSemantics(
    template: string, 
    templateType: 'progress' | 'completed'
  ): { valid: boolean; error?: string; warning?: string } {
    // 1. 标识符格式建议性警告
    let warning: string | undefined;
    if (!template.includes('(:')) {
      warning = '建议使用 (:...) 格式以避免与 Markdown 链接语法冲突';
    }

    // 2. 检查混合格式
    const hasFullDate = template.includes('{startDate}') || template.includes('{endDate}');
    const hasTimeOnly = template.includes('{start}') || template.includes('{end}');

    if (hasFullDate && hasTimeOnly) {
      return {
        valid: false,
        error: '不允许混合格式：不能同时使用 {startDate}/{endDate} 和 {start}/{end}'
      };
    }

    // 3. 提取变量存在情况
    const hasStart = template.includes('{start}');
    const hasEnd = template.includes('{end}');
    const hasStartDate = template.includes('{startDate}');
    const hasEndDate = template.includes('{endDate}');

    // 4. 根据模板类型进行差异化校验
    if (templateType === 'progress') {
      // === 进行中模板校验 ===
      
      // 不允许出现结束时间变量
      if (hasEnd) {
        return {
          valid: false,
          error: '进行中模板不应包含 {end}，只有任务完成时才记录结束时间',
          warning
        };
      }
      if (hasEndDate) {
        return {
          valid: false,
          error: '进行中模板不应包含 {endDate}，只有任务完成时才记录结束日期',
          warning
        };
      }

      // 必须包含开始时间
      if (!hasStart && !hasStartDate) {
        return {
          valid: false,
          error: '进行中模板必须包含 {start} 或 {startDate} 以记录开始时间',
          warning
        };
      }

    } else if (templateType === 'completed') {
      // === 已完成模板校验 ===
      
      // {start} 和 {end} 必须配对
      if (hasStart !== hasEnd) {
        return {
          valid: false,
          error: hasStart 
            ? '检测到 {start} 但缺少配对的 {end}，时间变量必须成对出现'
            : '检测到 {end} 但缺少配对的 {start}，时间变量必须成对出现'
        };
      }

      // {startDate} 和 {endDate} 必须配对
      if (hasStartDate !== hasEndDate) {
        return {
          valid: false,
          error: hasStartDate
            ? '检测到 {startDate} 但缺少配对的 {endDate}，日期变量必须成对出现'
            : '检测到 {endDate} 但缺少配对的 {startDate}，日期变量必须成对出现'
        };
      }

      // 必须有时间范围或耗时信息
      const hasTimeRange = (hasStart && hasEnd) || (hasStartDate && hasEndDate);
      const hasDuration = template.includes('{duration}') || template.includes('{durationDate}');

      if (!hasTimeRange && !hasDuration) {
        return {
          valid: false,
          error: '已完成模板必须包含时间范围（{start}/{end} 或 {startDate}/{endDate}）或耗时信息（{duration}/{durationDate}）'
        };
      }
    }

    return { valid: true, warning };
  }

  /**
   * 查找数组中的重复元素
   */
  private static findDuplicates<T>(array: T[]): T[] {
    const seen = new Set<T>();
    const duplicates = new Set<T>();
    
    for (const item of array) {
      if (seen.has(item)) {
        duplicates.add(item);
      } else {
        seen.add(item);
      }
    }
    
    return Array.from(duplicates);
  }

  /**
   * 生成预览文本（使用示例时间）
   */
  static generatePreview(
    template: string,
    isCompleted: boolean = false
  ): string {
    const now = moment();
    const startTime = now.clone().subtract(75, 'minutes'); // 1小时15分钟前
    const endTime = isCompleted ? now.clone() : undefined;

    try {
      const validation = this.validateTemplate(template);
      if (!validation.valid) {
        return `错误: ${validation.error}`;
      }
      
      return this.render(template, startTime, endTime);
    } catch (error) {
      return '模板格式错误';
    }
  }
}
