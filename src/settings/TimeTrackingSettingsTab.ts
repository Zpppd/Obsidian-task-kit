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
		const progressErrorEl = containerEl.createDiv({ cls: 'setting-error' });
		const progressWarningEl = containerEl.createDiv({ cls: 'setting-warning' });

		const progressSetting = new Setting(containerEl)
			.setName('进行中状态模板');
		
		// 手动设置描述内容，支持换行
		const progressDescEl = progressSetting.descEl;
		progressDescEl.innerHTML = this.createTemplateDescription(
			'任务进入进行中状态时添加的时间标记格式',
			'(:开始：{startDate})',
			this.plugin.settings.timeTracking.progressTemplate,
			false
		);
		progressDescEl.style.whiteSpace = 'pre-line';
		
		progressSetting.addText(text => text
			.setPlaceholder('(:{start})')
			.setValue(this.plugin.settings.timeTracking.progressTemplate)
			.onChange(async (value) => {
				const validation = this.validateTemplateWithMixedFormatCheck(value, '进行中状态模板', 'progress');
				
				if (!validation.valid) {
					progressErrorEl.setText(`❌ ${validation.error}`);
					progressErrorEl.style.color = '#e74c3c';
					progressErrorEl.style.marginTop = '8px';
					progressWarningEl.setText('');
					return;
				}
				
				progressErrorEl.setText('');
				
				// 显示警告（如果有）
				if (validation.warning) {
					progressWarningEl.setText(`⚠️ ${validation.warning}`);
					progressWarningEl.style.color = '#f39c12';
					progressWarningEl.style.marginTop = '8px';
				} else {
					progressWarningEl.setText('');
				}
				
				this.plugin.settings.timeTracking.progressTemplate = value;
				await this.plugin.saveSettings();
				
				// 实时更新描述中的预览
				progressDescEl.innerHTML = this.createTemplateDescription(
					'任务进入进行中状态时添加的时间标记格式',
					'(:开始：{startDate})',
					value,
					false
				);
			})
		);

		// 已完成状态模板
		const completedErrorEl = containerEl.createDiv({ cls: 'setting-error' });
		const completedWarningEl = containerEl.createDiv({ cls: 'setting-warning' });

		const completedSetting = new Setting(containerEl)
			.setName('已完成状态模板');
		
		// 手动设置描述内容，支持换行
		const completedDescEl = completedSetting.descEl;
		completedDescEl.innerHTML = this.createTemplateDescription(
			'任务完成时添加的时间标记格式',
			'(:开始：{startDate} - 结束：{endDate})',
			this.plugin.settings.timeTracking.completedTemplate,
			true
		);
		completedDescEl.style.whiteSpace = 'pre-line';
		
		completedSetting.addText(text => text
			.setPlaceholder('(:{startDate} - {endDate})')
			.setValue(this.plugin.settings.timeTracking.completedTemplate)
			.onChange(async (value) => {
				const validation = this.validateTemplateWithMixedFormatCheck(value, '已完成状态模板', 'completed');
				
				if (!validation.valid) {
					completedErrorEl.setText(`❌ ${validation.error}`);
					completedErrorEl.style.color = '#e74c3c';
					completedErrorEl.style.marginTop = '8px';
					completedWarningEl.setText('');
					return;
				}
				
				completedErrorEl.setText('');
				
				// 显示警告（如果有）
				if (validation.warning) {
					completedWarningEl.setText(`⚠️ ${validation.warning}`);
					completedWarningEl.style.color = '#f39c12';
					completedWarningEl.style.marginTop = '8px';
				} else {
					completedWarningEl.setText('');
				}
				
				this.plugin.settings.timeTracking.completedTemplate = value;
				await this.plugin.saveSettings();
				
				// 实时更新描述中的预览
				completedDescEl.innerHTML = this.createTemplateDescription(
					'任务完成时添加的时间标记格式',
					'(:开始：{startDate} - 结束：{endDate})',
					value,
					true
				);
			})
		);

		// 重置为默认值按钮
		new Setting(containerEl)
			.setName('重置为默认值')
			.setDesc('将时间追踪格式恢复为默认设置')
			.addButton(button => button
				.setButtonText('重置')
				.onClick(async () => {
					this.plugin.settings.timeTracking.progressTemplate = '(:{start})';
					this.plugin.settings.timeTracking.completedTemplate = '(:{start} - {end})';
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
	 * 创建模板描述文本（包含示例和预览）
	 */
	private createTemplateDescription(
		description: string,
		example: string,
		template: string,
		isCompleted: boolean
	): string {
		let preview: string;
		try {
			preview = TimeTemplateRenderer.generatePreview(template, isCompleted);
		} catch (error) {
			preview = '模板格式错误';
		}

		// 使用 \n 换行符，配合 CSS white-space: pre-line 实现换行
		return `${description}\n示例: ${example}\n预览: ${preview}`;
	}

	/**
	 * 增强的模板验证：包含基础校验和语义校验
	 */
	private validateTemplateWithMixedFormatCheck(
		template: string,
		templateName: string,
		templateType: 'progress' | 'completed'
	): { valid: boolean; error?: string; warning?: string } {
		// 1. 基础校验（语法、变量名、重复等）
		const baseValidation = TimeTemplateRenderer.validateTemplate(template);
		if (!baseValidation.valid) {
			return baseValidation;
		}

		// 2. 语义校验（配对、必填项、混合格式等）
		const semanticValidation = TimeTemplateRenderer.validateTemplateSemantics(
			template,
			templateType
		);

		if (!semanticValidation.valid) {
			return {
				valid: false,
				error: `${templateName}：${semanticValidation.error}`
			};
		}

		return {
			valid: true,
			warning: semanticValidation.warning
		};
	}

	private createTemplateHelp(containerEl: HTMLElement): void {
		const helpDiv = containerEl.createDiv({ cls: 'time-tracking-help' });
		helpDiv.createEl('h3', { text: '可用变量' });
		
		const table = helpDiv.createEl('table');
		table.style.width = '100%';
		table.style.borderCollapse = 'collapse';
		table.style.marginBottom = '12px';
		
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.style.backgroundColor = 'var(--background-modifier-hover)';
		
		const headers = ['变量', '说明', '示例'];
		headers.forEach(text => {
			const th = headerRow.createEl('th', { text });
			th.style.border = '1px solid var(--background-modifier-border)';
			th.style.padding = '8px 12px';
			th.style.textAlign = 'left';
			th.style.fontWeight = '600';
		});

		const tbody = table.createEl('tbody');
		TEMPLATE_VARIABLES.forEach(variable => {
			const row = tbody.createEl('tr');
			row.style.backgroundColor = 'var(--background-primary)';
			
			const cells = [variable.variable, variable.description, variable.example];
			cells.forEach(text => {
				const td = row.createEl('td', { text });
				td.style.border = '1px solid var(--background-modifier-border)';
				td.style.padding = '6px 12px';
			});
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
			1. 不允许混合格式：模板中不能同时使用 <code>{startDate}/{endDate}</code> 和 <code>{start}/{end}</code><br>
			2. 变量必须配对：<code>{start}</code> 与 <code>{end}</code>、<code>{startDate}</code> 与 <code>{endDate}</code> 必须成对出现<br>
			3. 进行中模板必须包含开始时间，已完成模板必须包含时间范围或耗时信息<br>
			4. 建议使用 <code>(:...)</code> 格式以避免与 Markdown 链接冲突
		`;

	}

}
