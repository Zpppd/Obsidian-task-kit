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

		// ================================================================
		//  第一部分：提醒通知
		// ================================================================
		containerEl.createEl('h2', { text: '⏰ 提醒通知' });
		this.createReminderHelp(containerEl);

		new Setting(containerEl)
			.setName('启用提醒')
			.setDesc('开启后，到期的任务提醒会自动弹窗通知')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.reminder.enabled)
					.onChange(async value => {
						this.plugin.settings.reminder.enabled = value;
						await this.plugin.saveSettings();
						this.display();
						if (this.plugin.reminderScheduler) {
							this.plugin.reminderScheduler.rescan();
						}
					}),
			);

		if (this.plugin.settings.reminder.enabled) {
			this.renderReminderDetails(containerEl);
		}

		containerEl.createEl('hr');

		// ================================================================
		//  第二部分：时间追踪
		// ================================================================
		containerEl.createEl('h2', { text: '⏱️ 时间追踪' });

		new Setting(containerEl)
			.setName('启用时间追踪与三态流转')
			.setDesc('开启后，任务 Checkbox 支持 待办/进行中/已完成 三态切换，并自动记录时间')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.enableTimeTracking)
					.onChange(async value => {
						this.plugin.settings.enableTimeTracking = value;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.enableTimeTracking) {
			this.createTemplateHelp(containerEl);
			this.createTimeTrackingFormatSettings(containerEl);
			this.checkIdentifierConflict(containerEl);
		}

		containerEl.createEl('hr');

		// ================================================================
		//  第三部分：任务扫描
		// ================================================================
		containerEl.createEl('h2', { text: '📁 任务扫描设置' });
		this.createScanDirectoriesSetting(containerEl);
	}

	/**
	 * 渲染提醒详情设置（仅在启用提醒时显示）
	 */
	private renderReminderDetails(containerEl: HTMLElement): void {
		// ── 用法说明 ──
		const help = containerEl.createDiv({ cls: 'setting-item-description' });
		help.innerHTML = `
			在任务行末尾添加 <code>(@时间)</code> 设置提醒，支持三种写法：<br><br>
			<code>(@2026-05-21 14:05)</code> — 完整日期+时间<br>
			<code>(@14:00)</code> — 仅时间，默认为今天<br>
			<code>(@2026-05-21)</code> — 仅日期，自动使用下方的默认提醒时间<br><br>
			稍后提醒时会按 <code>YYYY-MM-DD HH:mm</code> 格式标准化回写。
		`;
		help.style.marginBottom = '8px';
		help.style.padding = '8px';
		help.style.backgroundColor = 'var(--background-secondary)';
		help.style.borderRadius = '4px';
		help.style.whiteSpace = 'pre-line';

		// ── 默认提醒时间 ──
		new Setting(containerEl)
			.setName('默认提醒时间')
			.setDesc('当任务仅指定日期未指定时间时，默认使用此时间触发（格式 HH:mm）')
			.addText(text =>
				text
					.setPlaceholder('09:00')
					.setValue(this.plugin.settings.reminder.defaultReminderTime)
					.onChange(async value => {
						if (/^\d{2}:\d{2}$/.test(value)) {
							this.plugin.settings.reminder.defaultReminderTime = value;
							await this.plugin.saveSettings();
						}
					}),
			);

		// ── 进行中任务提醒 ──
		const remindProgressSetting = new Setting(containerEl)
			.setName('提醒进行中任务')
			.setDesc(
				'开启后，对正在进行的任务 (-[/]) 也触发提醒。需先启用"时间追踪与三态流转"功能',
			);

		const progressToggle = remindProgressSetting.addToggle(toggle =>
			toggle
				.setValue(
					this.plugin.settings.enableTimeTracking &&
						this.plugin.settings.reminder.remindOnProgress,
				)
				.onChange(async value => {
					this.plugin.settings.reminder.remindOnProgress = value;
					await this.plugin.saveSettings();
				}),
		);

		if (!this.plugin.settings.enableTimeTracking) {
			progressToggle.setDisabled(true);
			remindProgressSetting.descEl.setText(
				'请先启用"时间追踪与三态流转"功能后，此选项才能生效',
			);
		}

		// ── 稍后提醒预设 ──
		containerEl.createEl('h3', { text: '稍后提醒预设' });
		const presetList = containerEl.createDiv();
		this.renderPresetList(presetList);

		new Setting(containerEl)
			.setName('添加预设')
			.setDesc('输入分钟数，添加一个稍后提醒选项')
			.addText(text => {
				text.setPlaceholder('例如: 15');
				text.inputEl.type = 'number';
				text.inputEl.min = '1';
				return text;
			})
			.addButton(btn =>
				btn.setButtonText('添加').onClick(async () => {
					const val = parseInt(text.getValue());
					if (isNaN(val) || val <= 0) {
						new Notice('请输入有效的分钟数');
						return;
					}
					if (this.plugin.settings.reminder.snoozePresets.includes(val)) {
						new Notice('该预设已存在');
						return;
					}
					this.plugin.settings.reminder.snoozePresets.push(val);
					this.plugin.settings.reminder.snoozePresets.sort((a, b) => a - b);
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		// ── 内置弹窗通知 ──
		new Setting(containerEl)
			.setName('Obsidian 内置弹窗')
			.setDesc('到期时在 Obsidian 中弹出提醒窗口，可进行操作（标记完成/稍后提醒等）')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.reminder.useBuiltinNotification)
					.onChange(async value => {
						this.plugin.settings.reminder.useBuiltinNotification = value;
						await this.plugin.saveSettings();
					}),
			);

		// ── 系统通知 ──
		new Setting(containerEl)
			.setName('系统通知（Windows）')
			.setDesc(
				'通过 Windows 桌面弹窗通知（仅有文字，点击后打开内置弹窗）。可与上方内置弹窗同时开启',
			)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.reminder.useSystemNotification)
					.onChange(async value => {
						this.plugin.settings.reminder.useSystemNotification = value;
						await this.plugin.saveSettings();
					}),
			);
	}

	// ==================== 提醒帮助 ====================

	private createReminderHelp(containerEl: HTMLElement): void {
		const helpDiv = containerEl.createDiv({ cls: 'time-tracking-help' });
		helpDiv.createEl('h3', { text: '快速示例' });
		helpDiv.createEl('code', { text: '- [ ] 买咖啡 (@14:00)' });
		helpDiv.createEl('br');
		helpDiv.createEl('code', { text: '- [ ] 写报告 (@2026-05-21 14:00)' });
		helpDiv.createEl('br');
		helpDiv.createEl('small', {
			text: '开启提醒后，到时间自动弹窗通知',
		});
	}

	// ==================== 稍后提醒预设列表 ====================

	private renderPresetList(container: HTMLElement): void {
		container.empty();
		const presets = this.plugin.settings.reminder.snoozePresets;
		if (presets.length === 0) {
			container.createEl('div', {
				text: '暂无预设，请在下方添加',
				cls: 'setting-item-description',
			});
			return;
		}
		presets.forEach((min, index) => {
			const label = min >= 60 ? `${min / 60} 小时` : `${min} 分钟`;
			const item = container.createDiv();
			item.style.display = 'flex';
			item.style.alignItems = 'center';
			item.style.gap = '8px';
			item.style.padding = '4px 8px';
			item.style.marginBottom = '4px';
			item.style.backgroundColor = 'var(--background-secondary)';
			item.style.borderRadius = '4px';
			item.createSpan({ text: label });
			const delBtn = item.createEl('button', { text: '✕' });
			delBtn.style.marginLeft = 'auto';
			delBtn.style.cursor = 'pointer';
			delBtn.style.border = 'none';
			delBtn.style.background = 'none';
			delBtn.style.color = 'var(--text-muted)';
			delBtn.addEventListener('click', async () => {
				this.plugin.settings.reminder.snoozePresets.splice(index, 1);
				await this.plugin.saveSettings();
				this.renderPresetList(container);
			});
		});
	}

	// ==================== 标识冲突检测 ====================

	private checkIdentifierConflict(containerEl: HTMLElement): void {
		const progress = this.plugin.settings.timeTracking.progressTemplate;
		const completed = this.plugin.settings.timeTracking.completedTemplate;
		if (progress.includes('@') || completed.includes('@')) {
			const warnEl = containerEl.createDiv({ cls: 'setting-warning' });
			warnEl.style.color = '#e74c3c';
			warnEl.style.padding = '8px';
			warnEl.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
			warnEl.style.borderRadius = '4px';
			warnEl.style.marginTop = '8px';
			warnEl.innerHTML =
				'⚠️ <strong>标识冲突风险：</strong>时间追踪模板中包含了 <code>@</code> 字符，' +
				'可能与提醒标识 <code>(@...</code> 冲突。建议时间追踪模板使用 <code>:</code> 作为标识符。';
		}
	}

	// ==================== 时间追踪设置 ====================

	private createTimeTrackingFormatSettings(containerEl: HTMLElement): void {
		const progressErrorEl = containerEl.createDiv({ cls: 'setting-error' });
		const progressWarningEl = containerEl.createDiv({ cls: 'setting-warning' });
		const progressSetting = new Setting(containerEl).setName('进行中状态模板');
		const progressDescEl = progressSetting.descEl;
		progressDescEl.innerHTML = this.createTemplateDescription(
			'任务进入进行中状态时添加的时间标记格式',
			'(:开始：{startDate})',
			this.plugin.settings.timeTracking.progressTemplate,
			false,
		);
		progressDescEl.style.whiteSpace = 'pre-line';
		progressSetting.addText(text =>
			text
				.setPlaceholder('(:{start})')
				.setValue(this.plugin.settings.timeTracking.progressTemplate)
				.onChange(async value => {
					const validation = this.validateTemplateWithMixedFormatCheck(
						value,
						'进行中状态模板',
						'progress',
					);
					if (!validation.valid) {
						progressErrorEl.setText(`❌ ${validation.error}`);
						progressErrorEl.style.color = '#e74c3c';
						progressErrorEl.style.marginTop = '8px';
						progressWarningEl.setText('');
						return;
					}
					progressErrorEl.setText('');
					if (validation.warning) {
						progressWarningEl.setText(`⚠️ ${validation.warning}`);
						progressWarningEl.style.color = '#f39c12';
						progressWarningEl.style.marginTop = '8px';
					} else {
						progressWarningEl.setText('');
					}
					this.plugin.settings.timeTracking.progressTemplate = value;
					await this.plugin.saveSettings();
					progressDescEl.innerHTML = this.createTemplateDescription(
						'任务进入进行中状态时添加的时间标记格式',
						'(:开始：{startDate})',
						value,
						false,
					);
				}),
		);

		const completedErrorEl = containerEl.createDiv({ cls: 'setting-error' });
		const completedWarningEl = containerEl.createDiv({ cls: 'setting-warning' });
		const completedSetting = new Setting(containerEl).setName('已完成状态模板');
		const completedDescEl = completedSetting.descEl;
		completedDescEl.innerHTML = this.createTemplateDescription(
			'任务完成时添加的时间标记格式',
			'(:开始：{startDate} - 结束：{endDate})',
			this.plugin.settings.timeTracking.completedTemplate,
			true,
		);
		completedDescEl.style.whiteSpace = 'pre-line';
		completedSetting.addText(text =>
			text
				.setPlaceholder('(:{startDate} - {endDate})')
				.setValue(this.plugin.settings.timeTracking.completedTemplate)
				.onChange(async value => {
					const validation = this.validateTemplateWithMixedFormatCheck(
						value,
						'已完成状态模板',
						'completed',
					);
					if (!validation.valid) {
						completedErrorEl.setText(`❌ ${validation.error}`);
						completedErrorEl.style.color = '#e74c3c';
						completedErrorEl.style.marginTop = '8px';
						completedWarningEl.setText('');
						return;
					}
					completedErrorEl.setText('');
					if (validation.warning) {
						completedWarningEl.setText(`⚠️ ${validation.warning}`);
						completedWarningEl.style.color = '#f39c12';
						completedWarningEl.style.marginTop = '8px';
					} else {
						completedWarningEl.setText('');
					}
					this.plugin.settings.timeTracking.completedTemplate = value;
					await this.plugin.saveSettings();
					completedDescEl.innerHTML = this.createTemplateDescription(
						'任务完成时添加的时间标记格式',
						'(:开始：{startDate} - 结束：{endDate})',
						value,
						true,
					);
				}),
		);

		new Setting(containerEl)
			.setName('重置为默认值')
			.setDesc('将时间追踪格式恢复为默认设置')
			.addButton(button =>
				button
					.setButtonText('重置')
					.onClick(async () => {
						this.plugin.settings.timeTracking.progressTemplate = '(:{start})';
						this.plugin.settings.timeTracking.completedTemplate = '(:{start} - {end})';
						await this.plugin.saveSettings();
						this.display();
					}),
			);
	}

	// ==================== 扫描目录 ====================

	private createScanDirectoriesSetting(containerEl: HTMLElement): void {
		const descEl = containerEl.createDiv({ cls: 'setting-item-description' });
		descEl.innerHTML = this.getPathHelpText();
		descEl.style.marginBottom = '15px';
		descEl.style.padding = '10px';
		descEl.style.backgroundColor = '#f8f9fa';
		descEl.style.borderRadius = '4px';
		descEl.style.borderLeft = '3px solid #007bff';

		const listContainer = containerEl.createDiv({ cls: 'scan-directories-list' });
		listContainer.style.marginTop = '10px';
		listContainer.style.marginBottom = '15px';
		this.renderDirectoryList(listContainer);

		new Setting(containerEl)
			.setName('添加扫描目录')
			.setDesc('添加一个要扫描的目录路径（留空白名单表示扫描所有目录）')
			.addButton(button =>
				button
					.setButtonText('+ 添加目录')
					.onClick(() => this.addDirectoryInput(listContainer)),
			);

		new Setting(containerEl)
			.setName('清空白名单')
			.setDesc('清空后将扫描所有目录')
			.addButton(button =>
				button
					.setButtonText('清空')
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.scanDirectories = [];
						await this.plugin.saveSettings();
						this.display();
						new Notice('已清空扫描目录白名单');
					}),
			);
	}

	private getPathHelpText(): string {
		let basePath = '';
		if ((this.app.vault.adapter as any).getBasePath) {
			basePath = (this.app.vault.adapter as any).getBasePath();
		}
		return `<strong>📁 当前仓库：</strong><br><code>${basePath || '(Obsidian vault 根目录)'}</code><br><br>
			<strong>💡 路径填写示例：</strong><br>
			<code>Projects/Tasks</code> — 扫描 Projects/Tasks 文件夹<br>
			<code>Daily Notes</code> — 扫描 Daily Notes 文件夹`;
	}

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
		this.plugin.settings.scanDirectories.forEach((dir, index) =>
			this.createDirectoryItem(container, dir, index),
		);
	}

	private createDirectoryItem(container: HTMLElement, dir: string, index: number): void {
		const item = container.createDiv({ cls: 'directory-item' });
		item.style.display = 'flex';
		item.style.alignItems = 'center';
		item.style.gap = '8px';
		item.style.marginBottom = '8px';
		item.style.padding = '8px';
		item.style.backgroundColor = '#f5f5f5';
		item.style.borderRadius = '4px';
		const input = item.createEl('input', { type: 'text' });
		input.value = dir;
		input.placeholder = '例如: Projects/Tasks';
		input.style.flex = '1';
		input.style.padding = '6px 10px';
		input.style.border = '1px solid #ddd';
		input.style.borderRadius = '4px';
		input.addEventListener('blur', async () => {
			const newValue = input.value.trim();
			if (newValue) {
				this.plugin.settings.scanDirectories[index] = newValue;
				await this.plugin.saveSettings();
			}
		});
		const deleteBtn = item.createEl('button', { text: '🗑️' });
		deleteBtn.style.cursor = 'pointer';
		deleteBtn.style.padding = '4px 8px';
		deleteBtn.style.border = 'none';
		deleteBtn.style.background = 'transparent';
		deleteBtn.addEventListener('click', async () => {
			this.plugin.settings.scanDirectories.splice(index, 1);
			await this.plugin.saveSettings();
			this.renderDirectoryList(container);
			new Notice('已删除目录');
		});
	}

	private addDirectoryInput(container: HTMLElement): void {
		this.plugin.settings.scanDirectories.push('');
		this.renderDirectoryList(container);
		setTimeout(() => {
			const inputs = container.querySelectorAll('input[type="text"]');
			const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
			if (lastInput) lastInput.focus();
		}, 0);
	}

	// ==================== 模板相关 ====================

	private createTemplateDescription(
		description: string,
		example: string,
		template: string,
		isCompleted: boolean,
	): string {
		let preview: string;
		try {
			preview = TimeTemplateRenderer.generatePreview(template, isCompleted);
		} catch {
			preview = '模板格式错误';
		}
		return `${description}\n示例: ${example}\n预览: ${preview}`;
	}

	private validateTemplateWithMixedFormatCheck(
		template: string,
		templateName: string,
		templateType: 'progress' | 'completed',
	): { valid: boolean; error?: string; warning?: string } {
		const baseValidation = TimeTemplateRenderer.validateTemplate(template);
		if (!baseValidation.valid) return baseValidation;
		const semanticValidation = TimeTemplateRenderer.validateTemplateSemantics(template, templateType);
		if (!semanticValidation.valid) {
			return { valid: false, error: `${templateName}：${semanticValidation.error}` };
		}
		return { valid: true, warning: semanticValidation.warning };
	}

	private createTemplateHelp(containerEl: HTMLElement): void {
		const helpDiv = containerEl.createDiv({ cls: 'time-tracking-help' });
		helpDiv.createEl('h3', { text: '时间追踪可用变量' });
		const table = helpDiv.createEl('table');
		table.style.width = '100%';
		table.style.borderCollapse = 'collapse';
		table.style.marginBottom = '12px';
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.style.backgroundColor = 'var(--background-modifier-hover)';
		['变量', '说明', '示例'].forEach(text => {
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
			[variable.variable, variable.description, variable.example].forEach(text => {
				const td = row.createEl('td', { text });
				td.style.border = '1px solid var(--background-modifier-border)';
				td.style.padding = '6px 12px';
			});
		});
		const warningDiv = helpDiv.createDiv({ cls: 'template-warning' });
		warningDiv.style.color = '#e67e22';
		warningDiv.style.marginTop = '12px';
		warningDiv.style.padding = '8px';
		warningDiv.style.backgroundColor = '#fef5e7';
		warningDiv.style.borderRadius = '4px';
		warningDiv.innerHTML = `
			<strong>⚠️ 重要提示：</strong><br>
			1. 不允许混合格式：不能同时使用 <code>{startDate}/{endDate}</code> 和 <code>{start}/{end}</code><br>
			2. 变量必须配对：<code>{start}</code> 与 <code>{end}</code> 成对出现<br>
			3. 进行中模板必须包含开始时间<br>
			4. ⚠️ 时间追踪模板中不应包含 <code>@</code> 字符（@ 是提醒功能的标识）
		`;
	}
}
