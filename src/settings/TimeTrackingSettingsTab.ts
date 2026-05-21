import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type TaskMasterProPlugin from '../main';
import { TimeTemplateRenderer } from '../utils/TimeTemplateRenderer';

export class TimeTrackingSettingsTab extends PluginSettingTab {
	plugin: TaskMasterProPlugin;

	constructor(app: App, plugin: TaskMasterProPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderTimeTrackingSection(containerEl);
		containerEl.createEl('hr');
		this.renderReminderSection(containerEl);
		containerEl.createEl('hr');
		this.renderScanSection(containerEl);
	}

	// ==================== 时间追踪 ====================

	private renderTimeTrackingSection(el: HTMLElement): void {
		el.createEl('h2', { text: '⏱️ 时间追踪' });

		new Setting(el)
			.setName('启用时间追踪与三态流转')
			.setDesc('点击 checkbox 时支持 [ ]→[/]→[x] 切换，自动记录起止时间')
			.addToggle(t =>
				t.setValue(this.plugin.settings.enableTimeTracking).onChange(async v => {
					this.plugin.settings.enableTimeTracking = v;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		if (!this.plugin.settings.enableTimeTracking) return;

		const progressSetting = new Setting(el)
			.setName('提醒进行中任务')
			.setDesc('开启后对 -[/] 任务也触发提醒');

		progressSetting.addToggle(t =>
			t
				.setValue(this.plugin.settings.reminder.remindOnProgress)
				.onChange(async v => {
					this.plugin.settings.reminder.remindOnProgress = v;
					await this.plugin.saveSettings();
					this.display();
				}),
		);

		this.renderTemplateSettings(el);
	}

	private renderTemplateSettings(el: HTMLElement): void {
		el.createEl('h3', { text: '时间标记格式' });

		// 变量说明表格
		const tbl = el.createEl('table');
		tbl.style.cssText =
			'width:100%;margin:6px 0;font-size:var(--font-ui-small);' +
			'border-collapse:collapse;border:1px solid var(--background-modifier-border)';
		const rows: [string, string, string][] = [
			['{start}', '开始时间', '14:30'],
			['{end}', '结束时间', '15:45'],
			['{startDate}', '开始日期时间', '2026-05-21 14:30'],
			['{endDate}', '结束日期时间', '2026-05-21 15:45'],
			['{duration}', '耗时分钟数', '75'],
			['{durationDate}', '耗时文本', '1小时15分钟'],
		];
		rows.forEach(([v, desc, ex]) => {
			const r = tbl.createEl('tr');
			r.createEl('td', {
				text: v,
				attr: { style: 'font-weight:600;border:1px solid var(--background-modifier-border);padding:3px 8px;font-size:var(--font-ui-small)' },
			});
			r.createEl('td', {
				text: desc,
				attr: { style: 'border:1px solid var(--background-modifier-border);padding:3px 8px;font-size:var(--font-ui-small)' },
			});
			r.createEl('td', {
				text: ex,
				attr: { style: 'color:var(--text-muted);border:1px solid var(--background-modifier-border);padding:3px 8px;font-size:var(--font-ui-small)' },
			});
		});

		// 模板示例
		const eg = el.createEl('div', { cls: 'setting-item-description' });
		eg.style.marginTop = '6px';
		eg.innerHTML =
			'示例：<code>(:{start})</code> → (∶14:30)　' +
			'<code>(:{start} - {end})</code> → (∶14:30 - 15:45)';

		const makeSetting = (
			name: string,
			placeholder: string,
			key: 'progressTemplate' | 'completedTemplate',
		) => {
			const s = new Setting(el).setName(name);
			const errEl = el.createDiv();
			errEl.style.marginTop = '4px';
			s.addText(t =>
				t
					.setPlaceholder(placeholder)
					.setValue(this.plugin.settings.timeTracking[key])
					.onChange(async v => {
						const r = TimeTemplateRenderer.validateTemplate(v);
						if (!r.valid) {
							errEl.setText(`❌ ${r.error}`);
							errEl.style.color = 'var(--text-error)';
							return;
						}
						errEl.setText('');
						this.plugin.settings.timeTracking[key] = v;
						await this.plugin.saveSettings();
					}),
			);
		};

		makeSetting('进行中状态', '(:{start})', 'progressTemplate');
		makeSetting('已完成状态', '(:{start} - {end})', 'completedTemplate');

		// 标识冲突检测
		const p = this.plugin.settings.timeTracking.progressTemplate;
		const c = this.plugin.settings.timeTracking.completedTemplate;
		if (p.includes('@') || c.includes('@')) {
			el.createEl('div', {
				cls: 'setting-item-description',
				text: '⚠️ 时间追踪模板含 @ 字符，可能与提醒标识 (@...) 冲突，建议改用 :',
			}).style.color = 'var(--text-warning)';
		}
	}

	// ==================== 提醒 ====================

	private renderReminderSection(el: HTMLElement): void {
		el.createEl('h2', { text: '⏰ 提醒' });

		new Setting(el)
			.setName('启用提醒')
			.setDesc('到期自动弹窗通知。在任务行添加 (@时间) 设置提醒')
			.addToggle(t =>
				t.setValue(this.plugin.settings.reminder.enabled).onChange(async v => {
					this.plugin.settings.reminder.enabled = v;
					await this.plugin.saveSettings();
					this.display();
					this.plugin.reminderScheduler?.rescan();
				}),
			);

		if (!this.plugin.settings.reminder.enabled) return;

		new Setting(el)
			.setName('默认提醒时间')
			.setDesc('仅写日期 (@2026-05-21) 时默认触发的小时:分钟')
			.addText(t =>
				t
					.setPlaceholder('09:00')
					.setValue(this.plugin.settings.reminder.defaultReminderTime)
					.onChange(async v => {
						if (/^\d{2}:\d{2}$/.test(v)) {
							this.plugin.settings.reminder.defaultReminderTime = v;
							await this.plugin.saveSettings();
						}
					}),
			);

		this.renderPresetSettings(el);

		new Setting(el)
			.setName('Obsidian 内置弹窗')
			.setDesc('到期弹出带操作按钮的提醒窗口')
			.addToggle(t =>
				t
					.setValue(this.plugin.settings.reminder.useBuiltinNotification)
					.onChange(async v => {
						this.plugin.settings.reminder.useBuiltinNotification = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(el)
			.setName('系统通知（Windows）')
			.setDesc('额外发送桌面系统通知，仅有文字，可与内置弹窗同时开启')
			.addToggle(t =>
				t
					.setValue(this.plugin.settings.reminder.useSystemNotification)
					.onChange(async v => {
						this.plugin.settings.reminder.useSystemNotification = v;
						await this.plugin.saveSettings();
					}),
			);
	}

	private renderPresetSettings(el: HTMLElement): void {
		el.createEl('h3', { text: '稍后提醒预设' });

		const list = el.createDiv();
		const render = () => {
			list.empty();
			const presets = this.plugin.settings.reminder.snoozePresets;
			if (presets.length === 0) {
				list.createEl('div', {
					cls: 'setting-item-description',
					text: '暂无预设',
				});
				return;
			}
			presets.forEach((min, i) => {
				const label = min >= 60 ? `${min / 60} 小时` : `${min} 分钟`;
				const item = list.createDiv();
				item.style.display = 'flex';
				item.style.alignItems = 'center';
				item.style.gap = '8px';
				item.style.padding = '6px 8px';
				item.style.marginBottom = '4px';
				item.style.backgroundColor = 'var(--background-secondary)';
				item.style.borderRadius = '4px';
				item.append(label);
				const del = item.createEl('button', { text: '✕' });
				del.style.marginLeft = 'auto';
				del.style.cursor = 'pointer';
				del.style.border = 'none';
				del.style.background = 'none';
				del.style.color = 'var(--text-muted)';
				del.addEventListener('click', async () => {
					this.plugin.settings.reminder.snoozePresets.splice(i, 1);
					await this.plugin.saveSettings();
					render();
				});
			});
		};
		render();

		let textComp: any;
		new Setting(el)
			.setName('添加预设')
			.setDesc('输入分钟数')
			.addText(t => {
				textComp = t;
				t.setPlaceholder('15');
				t.inputEl.type = 'number';
				t.inputEl.min = '1';
			})
			.addButton(b =>
				b.setButtonText('添加').onClick(async () => {
					const v = parseInt(textComp.getValue());
					if (!v || v <= 0) return new Notice('请输入有效分钟数');
					if (this.plugin.settings.reminder.snoozePresets.includes(v))
						return new Notice('已存在');
					this.plugin.settings.reminder.snoozePresets.push(v);
					this.plugin.settings.reminder.snoozePresets.sort((a, b) => a - b);
					await this.plugin.saveSettings();
					render();
					textComp.inputEl.value = '';
				}),
			);
	}

	// ==================== 扫描目录 ====================

	private renderScanSection(el: HTMLElement): void {
		el.createEl('h2', { text: '📁 扫描目录' });

		const listEl = el.createDiv();
		const renderList = () => {
			listEl.empty();
			const dirs = this.plugin.settings.scanDirectories;
			if (dirs.length === 0) {
				listEl.createEl('div', {
					cls: 'setting-item-description',
					text: '未设置白名单，将扫描 vault 内所有 Markdown 文件',
				});
				return;
			}
			dirs.forEach((dir, i) => {
				const item = listEl.createDiv();
				item.style.display = 'flex';
				item.style.alignItems = 'center';
				item.style.gap = '8px';
				item.style.padding = '6px 8px';
				item.style.marginBottom = '4px';
				item.style.backgroundColor = 'var(--background-secondary)';
				item.style.borderRadius = '4px';
				const input = item.createEl('input', { type: 'text', value: dir });
				input.style.flex = '1';
				input.style.background = 'transparent';
				input.style.border = 'none';
				input.style.padding = '4px';
				input.addEventListener('blur', async () => {
					if (input.value.trim()) {
						this.plugin.settings.scanDirectories[i] = input.value.trim();
						await this.plugin.saveSettings();
					}
				});
				const del = item.createEl('button', { text: '✕' });
				del.style.cursor = 'pointer';
				del.style.border = 'none';
				del.style.background = 'none';
				del.style.color = 'var(--text-muted)';
				del.addEventListener('click', async () => {
					this.plugin.settings.scanDirectories.splice(i, 1);
					await this.plugin.saveSettings();
					renderList();
				});
			});
		};
		renderList();

		new Setting(el)
			.setName('添加目录')
			.setDesc('限制只扫描指定文件夹（留白扫描全部）')
			.addButton(b =>
				b.setButtonText('+ 添加').onClick(() => {
					this.plugin.settings.scanDirectories.push('');
					renderList();
					setTimeout(() => {
						const inputs = listEl.querySelectorAll('input');
						inputs[inputs.length - 1]?.focus();
					});
				}),
			)
			.addButton(b =>
				b.setButtonText('清空').onClick(async () => {
					this.plugin.settings.scanDirectories = [];
					await this.plugin.saveSettings();
					renderList();
				}),
			);
	}
}
