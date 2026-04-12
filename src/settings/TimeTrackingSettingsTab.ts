import { App, PluginSettingTab, Setting } from 'obsidian';
import type TaskMasterProPlugin from '../main';
import { TimeTemplateRenderer } from '../utils/TimeTemplateRenderer';
import { TEMPLATE_VARIABLES } from '../types/settings';

export class TimeTrackingSettingsTab extends PluginSettingTab {
	plugin: TaskMasterProPlugin;

	constructor(app: App, plugin: TaskMasterProPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: '时间追踪格式设置' });

		// 模板语法说明
		this.createTemplateHelp(containerEl);

		// ✅ 进行中状态模板
		const progressSetting = new Setting(containerEl)
			.setName('进行中状态模板')
			.setDesc('任务进入进行中状态时添加的时间标记格式');
		
		const progressInput = progressSetting.addText(text => text
			.setPlaceholder('[开始：{start}]')
			.setValue(this.plugin.settings.timeTracking.progressTemplate)
			.onChange(async (value) => {
				// 实时验证
				const validation = this.validateTemplateWithMixedFormatCheck(value, '进行中状态模板');
				
				if (!validation.valid) {
					// 显示错误提示
					progressErrorEl.setText(`❌ ${validation.error}`);
					progressErrorEl.style.color = '#e74c3c';
					progressErrorEl.style.marginTop = '8px';
					return;
				}
				
				// 验证通过，清除错误提示
				progressErrorEl.setText('');
				
				// 更新设置
				this.plugin.settings.timeTracking.progressTemplate = value;
				await this.plugin.saveSettings();
				
				// 更新预览
				progressPreviewEl.setText(
					`预览: ${TimeTemplateRenderer.generatePreview(value, false)}`
				);
			})
		);
		
		// 错误提示元素
		const progressErrorEl = containerEl.createDiv({ cls: 'setting-error' });
		
		// 进行中状态预览
		const progressPreviewEl = containerEl.createDiv({ 
			cls: 'setting-item-description time-tracking-preview' 
		});
		progressPreviewEl.setText(
			`预览: ${TimeTemplateRenderer.generatePreview(
				this.plugin.settings.timeTracking.progressTemplate,
				false
			)}`
		);

		// ✅ 已完成状态模板
		const completedSetting = new Setting(containerEl)
			.setName('已完成状态模板')
			.setDesc('任务完成时添加的时间标记格式');
		
		const completedInput = completedSetting.addText(text => text
			.setPlaceholder('[开始：{start} - 结束：{end}]')
			.setValue(this.plugin.settings.timeTracking.completedTemplate)
			.onChange(async (value) => {
				// 实时验证
				const validation = this.validateTemplateWithMixedFormatCheck(value, '已完成状态模板');
				
				if (!validation.valid) {
					// 显示错误提示
					completedErrorEl.setText(`❌ ${validation.error}`);
					completedErrorEl.style.color = '#e74c3c';
					completedErrorEl.style.marginTop = '8px';
					return;
				}
				
				// 验证通过，清除错误提示
				completedErrorEl.setText('');
				
				// 更新设置
				this.plugin.settings.timeTracking.completedTemplate = value;
				await this.plugin.saveSettings();
				
				// 更新预览
				completedPreviewEl.setText(
					`预览: ${TimeTemplateRenderer.generatePreview(value, true)}`
				);
			})
		);
		
		// 错误提示元素
		const completedErrorEl = containerEl.createDiv({ cls: 'setting-error' });
		
		// 已完成状态预览
		const completedPreviewEl = containerEl.createDiv({ 
			cls: 'setting-item-description time-tracking-preview' 
		});
		completedPreviewEl.setText(
			`预览: ${TimeTemplateRenderer.generatePreview(
				this.plugin.settings.timeTracking.completedTemplate,
				true
			)}`
		);

		// 重置为默认值按钮
		new Setting(containerEl)
			.setName('重置为默认值')
			.setDesc('将时间追踪格式恢复为默认设置')
			.addButton(button => button
				.setButtonText('重置')
				.onClick(async () => {
					this.plugin.settings.timeTracking.progressTemplate = '[开始：{start}]';
					this.plugin.settings.timeTracking.completedTemplate = '[开始：{start} - 结束：{end}]';
					await this.plugin.saveSettings();
					this.display(); // 重新渲染
				})
			);
	}

	/**
	 * 增强的模板验证：禁止混合格式
	 * @param template 模板字符串
	 * @param templateName 模板名称（用于错误提示）
	 */
	private validateTemplateWithMixedFormatCheck(
		template: string,
		templateName: string
	): { valid: boolean; error?: string } {
		// 基础验证
		const baseValidation = TimeTemplateRenderer.validateTemplate(template);
		if (!baseValidation.valid) {
			return baseValidation;
		}

		// ✅ 检查是否混合格式
		const hasFullDate = template.includes('{startDate}') || template.includes('{endDate}');
		const hasTimeOnly = template.includes('{start}') || template.includes('{end}');

		if (hasFullDate && hasTimeOnly) {
			return {
				valid: false,
				error: `${templateName} 不允许混合格式：不能同时使用 {startDate}/{endDate} 和 {start}/{end}`
			};
		}

		return { valid: true };
	}

	private createTemplateHelp(containerEl: HTMLElement): void {
		const helpDiv = containerEl.createDiv({ cls: 'time-tracking-help' });
		helpDiv.createEl('h3', { text: '可用变量' });
		
		const table = helpDiv.createEl('table');
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: '变量' });
		headerRow.createEl('th', { text: '说明' });
		headerRow.createEl('th', { text: '示例' });

		const tbody = table.createEl('tbody');
		TEMPLATE_VARIABLES.forEach(variable => {
			const row = tbody.createEl('tr');
			row.createEl('td', { text: variable.variable });
			row.createEl('td', { text: variable.description });
			row.createEl('td', { text: variable.example });
		});

		// ⚠️ 添加混合格式警告
		const warningDiv = helpDiv.createDiv({ cls: 'template-warning' });
		warningDiv.style.color = '#e67e22';
		warningDiv.style.marginTop = '12px';
		warningDiv.style.padding = '8px';
		warningDiv.style.backgroundColor = '#fef5e7';
		warningDiv.style.borderRadius = '4px';
		warningDiv.innerHTML = `
			<strong>⚠️ 重要提示：</strong><br>
			不允许混合格式：模板中不能同时使用 <code>{startDate}/{endDate}</code> 和 <code>{start}/{end}</code><br>
			请选择其中一种格式使用。
		`;

		// 添加一些常用示例
		helpDiv.createEl('h3', { text: '常用示例' });
		const examples = [
			{ name: '简洁模式', progress: '[{start}]', completed: '[{start} - {end}]' },
			{ name: '标注模式（默认）', progress: '[开始：{start}]', completed: '[开始：{start} - 结束：{end}]' },
			{ name: '中文模式', progress: '[{start}开始]', completed: '[{start}至{end}]' },
			{ name: '完整模式', progress: '[{startDate}]', completed: '[{startDate} - {endDate}]' },
			{ name: '含耗时', progress: '[{start}]', completed: '[{start} - {end}，耗时{duration}分钟]' }
		];

		const exampleList = helpDiv.createEl('ul');
		examples.forEach(example => {
			const li = exampleList.createEl('li');
			li.createEl('strong', { text: example.name });
			li.createEl('br');
			li.appendText(`进行中: ${example.progress}`);
			li.createEl('br');
			li.appendText(`已完成: ${example.completed}`);
		});
	}
}
