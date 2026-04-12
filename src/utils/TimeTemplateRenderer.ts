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

    // 检查 [] 括号匹配
    const openBrackets = (template.match(/\[/g) || []).length;
    const closeBrackets = (template.match(/\]/g) || []).length;
    
    if (openBrackets !== closeBrackets) {
      return { valid: false, error: '模板中存在未闭合的方括号 []' };
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
      for (const match of variableMatches) {
        const variableName = match.slice(1, -1); // 去除 {}
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
