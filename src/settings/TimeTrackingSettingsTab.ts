import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
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

		this.createTemplateHelp(containerEl);

		// 进行中状态模板
		const progressSetting = new Setting(containerEl)
			.setName('进行中状态模板')
			.setDesc('任务进入进行中状态时添加的时间标记格式');
		
		progressSetting.addText(text => text
			.setPlaceholder('[开始：{start}]')
			.setValue(this.plugin.settings.timeTracking.progressTemplate)
			.onChange(async (value) => {
				const validation = this.validateTemplateWithMixedFormatCheck(value, '进行中状态模板');
				
				if (!validation.valid) {
					progressErrorEl.setText(`❌ ${validation.error}`);
					progressErrorEl.style.color = '#e74c3c';
					progressErrorEl.style.marginTop = '8px';
					return;
				}
				
				progressErrorEl.setText('');
				
				this.plugin.settings.timeTracking.progressTemplate = value;
				await this.plugin.saveSettings();
				
				progressPreviewEl.setText(
					`预览: ${TimeTemplateRenderer.generatePreview(value, false)}`
				);
			})
		);
		
		const progressErrorEl = containerEl.createDiv({ cls: 'setting-error' });
		
		const progressPreviewEl = containerEl.createDiv({ 
			cls: 'setting-item-description time-tracking-preview' 
		});
		progressPreviewEl.setText(
			`预览: ${TimeTemplateRenderer.generatePreview(
				this.plugin.settings.timeTracking.progressTemplate,
				false
			)}`
		);

		// 已完成状态模板
		const completedSetting = new Setting(containerEl)
			.setName('已完成状态模板')
			.setDesc('任务完成时添加的时间标记格式');
		
		completedSetting.addText(text => text
			.setPlaceholder('[开始：{start} - 结束：{end}]')
			.setValue(this.plugin.settings.timeTracking.completedTemplate)
			.onChange(async (value) => {
				const validation = this.validateTemplateWithMixedFormatCheck(value, '已完成状态模板');
				
				if (!validation.valid) {
					completedErrorEl.setText(`❌ ${validation.error}`);
					completedErrorEl.style.color = '#e74c3c';
					completedErrorEl.style.marginTop = '8px';
					return;
				}
				
				completedErrorEl.setText('');
				
				this.plugin.settings.timeTracking.completedTemplate = value;
				await this.plugin.saveSettings();
				
				completedPreviewEl.setText(
					`预览: ${TimeTemplateRenderer.generatePreview(value, true)}`
				);
			})
		);
		
		const completedErrorEl = containerEl.createDiv({ cls: 'setting-error' });
		
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
					this.display();
				})
			);

		// ===== 新增：任务扫描目录设置 =====
		containerEl.createEl('h2', { text: '任务扫描设置' });
		
		this.createScanDirectoriesSetting(containerEl);
	}

	/**
	 * 创建扫描目录设置
	 */
	private createScanDirectoriesSetting(containerEl: HTMLElement): void {
		// 说明文字和路径提示
		const descEl = containerEl.createDiv({ cls: 'setting-item-description' });
		descEl.innerHTML = this.getPathHelpText();
		descEl.style.marginBottom = '15px';
		descEl.style.padding = '10px';
		descEl.style.backgroundColor = '#f8f9fa';
		descEl.style.borderRadius = '4px';
		descEl.style.borderLeft = '3px solid #007bff';

		// 动态列表容器
		const listContainer = containerEl.createDiv({ cls: 'scan-directories-list' });
		listContainer.style.marginTop = '10px';
		listContainer.style.marginBottom = '15px';

		// 渲染现有目录列表
		this.renderDirectoryList(listContainer);

		// 添加按钮
		new Setting(containerEl)
			.setName('添加扫描目录')
			.setDesc('添加一个要扫描的目录路径（留空白名单表示扫描所有目录）')
			.addButton(button => button
				.setButtonText('+ 添加目录')
				.onClick(() => {
					this.addDirectoryInput(listContainer);
				})
			);

		// 重置按钮
		new Setting(containerEl)
			.setName('清空白名单')
			.setDesc('清空后将扫描所有目录')
			.addButton(button => button
				.setButtonText('清空')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.scanDirectories = [];
					await this.plugin.saveSettings();
					this.display();
					new Notice('已清空扫描目录白名单');
				})
			);
	}

	/**
	 * 获取路径帮助文本
	 */
	private getPathHelpText(): string {
		// 尝试多种方式获取仓库根目录
		let basePath = '';
		
		// 方式1: 通过 adapter 获取（如果可用）
		// @ts-ignore - getBasePath 可能在某些版本中存在
		if (this.app.vault.adapter.getBasePath) {
			// @ts-ignore
			basePath = this.app.vault.adapter.getBasePath();
		}
		
		// 方式2: 从第一个文件推断
		if (!basePath) {
			const files = this.app.vault.getFiles();
			if (files.length > 0) {
				// 使用第一个文件的父目录作为参考
				const firstFile = files[0];
				const parts = firstFile.path.split('/');
				if (parts.length > 1) {
					basePath = `(仓库包含 ${files.length} 个文件，根目录为当前工作区)`;
				} else {
					basePath = `(仓库根目录)`;
				}
			} else {
				basePath = '(空仓库)';
			}
		}
		
		return `
			<strong>📁 当前仓库：</strong><br>
			<code>${basePath}</code><br><br>
			<strong>💡 路径填写示例（相对于仓库根目录）：</strong><br>
			<code>Projects/Tasks</code> - 扫描 Projects/Tasks 文件夹及其子目录<br>
			<code>Work/2024</code> - 扫描 Work/2024 文件夹及其子目录<br>
			<code>Daily Notes</code> - 扫描 Daily Notes 文件夹及其子目录
		`;
	}

	/**
	 * 渲染目录列表
	 */
	private renderDirectoryList(container: HTMLElement): void {
		container.empty();
		
		if (this.plugin.settings.scanDirectories.length === 0) {
			const emptyMsg = container.createDiv({ cls: 'empty-message' });
			emptyMsg.setText('暂无白名单目录，将扫描所有目录');
			emptyMsg.style.color = '#888';
			emptyMsg.style.fontStyle = 'italic';
			emptyMsg.style.padding = '10px';
			return;
		}

		this.plugin.settings.scanDirectories.forEach((dir, index) => {
			this.createDirectoryItem(container, dir, index);
		});
	}

	/**
	 * 创建单个目录项
	 */
	private createDirectoryItem(container: HTMLElement, dir: string, index: number): void {
		const item = container.createDiv({ cls: 'directory-item' });
		item.style.display = 'flex';
		item.style.alignItems = 'center';
		item.style.gap = '8px';
		item.style.marginBottom = '8px';
		item.style.padding = '8px';
		item.style.backgroundColor = '#f5f5f5';
		item.style.borderRadius = '4px';

		// 输入框
		const input = item.createEl('input', { type: 'text' });
		input.value = dir;
		input.placeholder = '例如: Projects/Tasks';
		input.style.flex = '1';
		input.style.padding = '6px 10px';
		input.style.border = '1px solid #ddd';
		input.style.borderRadius = '4px';
		
		// 实时去重检测
		const checkDuplicate = () => {
			const currentValue = input.value.trim();
			const isDuplicate = this.plugin.settings.scanDirectories.some(
				(d, i) => i !== index && d.toLowerCase() === currentValue.toLowerCase()
			);
			
			if (isDuplicate && currentValue) {
				input.style.borderColor = '#e74c3c';
				input.style.backgroundColor = '#ffeaea';
				input.title = '此目录已存在';
			} else {
				input.style.borderColor = '#ddd';
				input.style.backgroundColor = '#f5f5f5';
				input.title = '';
			}
		};
		
		input.addEventListener('input', checkDuplicate);
		input.addEventListener('blur', async () => {
			checkDuplicate();
			const newValue = input.value.trim();
			if (newValue) {
				this.plugin.settings.scanDirectories[index] = newValue;
				await this.plugin.saveSettings();
			}
		});

		// 删除按钮
		const deleteBtn = item.createEl('button', { text: '🗑️' });
		deleteBtn.title = '删除此目录';
		deleteBtn.style.cursor = 'pointer';
		deleteBtn.style.padding = '4px 8px';
		deleteBtn.style.border = 'none';
		deleteBtn.style.backgroundColor = 'transparent';
		deleteBtn.style.fontSize = '16px';
		
		deleteBtn.addEventListener('click', async () => {
			this.plugin.settings.scanDirectories.splice(index, 1);
			await this.plugin.saveSettings();
			this.renderDirectoryList(container);
			new Notice('已删除目录');
		});
	}

	/**
	 * 添加新的目录输入框
	 */
	private addDirectoryInput(container: HTMLElement): void {
		this.plugin.settings.scanDirectories.push('');
		this.renderDirectoryList(container);
		
		// 聚焦到新添加的输入框
		setTimeout(() => {
			const inputs = container.querySelectorAll('input[type="text"]');
			const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
			if (lastInput) {
				lastInput.focus();
			}
		}, 0);
	}

	/**
	 * 增强的模板验证：禁止混合格式
	 */
	private validateTemplateWithMixedFormatCheck(
		template: string,
		templateName: string
	): { valid: boolean; error?: string } {
		const baseValidation = TimeTemplateRenderer.validateTemplate(template);
		if (!baseValidation.valid) {
			return baseValidation;
		}

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

		// 混合格式警告
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

		// 常用示例
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
