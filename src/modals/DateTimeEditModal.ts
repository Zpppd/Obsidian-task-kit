import { App, Modal } from 'obsidian';
import moment from 'moment';
import type { Task } from '../types/task';
import type { TimeTrackerService } from '../services/TimeTrackerService';
import type { TaskParser } from '../parser/TaskParser';
import { ReminderQuickSet } from '../utils/ReminderQuickSet';

/** 弹窗模式 */
export type DateTimeEditMode = 'reminder' | 'tracking';

/** 分段输入字段定义 */
interface SegFields {
	year: HTMLInputElement;
	month: HTMLInputElement;
	day: HTMLInputElement;
	hour: HTMLInputElement;
	minute: HTMLInputElement;
	/** 所有字段数组（按 Tab 序） */
	all: HTMLInputElement[];
}

/**
 * 统一时间编辑弹窗
 *
 * 使用分段日期时间输入（年-月-日 时:分），自动跳转，无需 Tab 切换。
 * 两个模式：
 * - reminder：设置提醒时间 (单行)
 * - tracking：修改追踪时间 (开始+结束双行，自动计算耗时)
 */
export class DateTimeEditModal extends Modal {
	private errorEl!: HTMLElement;

	constructor(
		app: App,
		private task: Task,
		private mode: DateTimeEditMode,
		private timeTrackerService: TimeTrackerService,
		private taskParser: TaskParser,
		private onDone?: () => void,
	) {
		super(app);
	}

	override onOpen() {
		const { contentEl } = this;
		contentEl.addClass('date-time-edit-modal');
		contentEl.style.minWidth = '340px';

		// ── 标题 ──
		contentEl.createEl('h3', {
			text: this.mode === 'reminder' ? '设置提醒时间' : '修改追踪时间',
			cls: 'dt-edit-title',
		});

		// ── 任务内容 ──
		contentEl.createEl('div', {
			text: this.task.content,
			cls: 'dt-edit-task-content',
		});

		// ── 错误提示 ──
		this.errorEl = contentEl.createDiv({ cls: 'dt-edit-error' });
		this.errorEl.style.display = 'none';

		if (this.mode === 'reminder') {
			this.renderReminderMode(contentEl);
		} else {
			this.renderTrackingMode(contentEl);
		}

		// ── 分隔线 ──
		contentEl.createEl('hr');

		// ── 按钮区 ──
		this.renderButtons(contentEl);

		// ── 样式 ──
		this.injectStyles();
	}

	// ==================== 提醒模式 ====================

	private renderReminderMode(el: HTMLElement): void {
		const section = el.createDiv({ cls: 'dt-edit-section' });
		section.createEl('label', { text: '提醒时间' });

		const seg = this.createSegmentedInput(section);

		// 预填
		const initial = this.task.reminderTime ?? moment();
		this.setSegFields(seg, initial);

		// 距现在时间
		const hintEl = section.createDiv({ cls: 'dt-edit-hint' });
		const updateHint = () => this.updateReminderHint(seg, hintEl);
		seg.all.forEach(inp => inp.addEventListener('input', updateHint));
		updateHint();

		// 存储引用供确认时使用（存在 section 上，与追踪模式一致；onReminderConfirm 从 section 读取）
		(section as any)._seg = seg;
		(section as any)._hintEl = hintEl;
	}

	private updateReminderHint(seg: SegFields, el: HTMLElement): void {
		const target = this.readSegFields(seg);
		if (!target) {
			el.textContent = '';
			return;
		}
		const now = moment();
		const diffMin = target.diff(now, 'minutes');
		const fmt = target.format('YYYY-MM-DD HH:mm');

		if (diffMin < 0) {
			el.innerHTML = `<span style="color:var(--text-error)">⚠️ ${fmt}（时间已过）</span>`;
			return;
		}

		const h = Math.floor(diffMin / 60);
		const m = diffMin % 60;
		let offset = '';
		if (h > 0 && m > 0) offset = `${h}小时${m}分钟后`;
		else if (h > 0) offset = `${h}小时后`;
		else offset = `${m}分钟后`;

		el.innerHTML = `<span style="color:var(--text-muted)">${fmt} · 将在 ${offset} 提醒</span>`;
	}

	// ==================== 追踪模式 ====================

	private renderTrackingMode(el: HTMLElement): void {
		// ── 开始时间 ──
		const startSection = el.createDiv({ cls: 'dt-edit-section' });
		startSection.createEl('label', { text: '开始时间' });
		const startSeg = this.createSegmentedInput(startSection);
		const startInitial = this.task.timeTracking?.startTime ?? moment();
		this.setSegFields(startSeg, startInitial);

		const startHint = startSection.createDiv({ cls: 'dt-edit-hint' });
		(startSection as any)._seg = startSeg;
		(startSection as any)._hintEl = startHint;

		// ── 结束时间 ──
		const endSection = el.createDiv({ cls: 'dt-edit-section' });
		endSection.createEl('label', { text: '结束时间（可选）' });
		const endSeg = this.createSegmentedInput(endSection);
		if (this.task.timeTracking?.endTime) {
			this.setSegFields(endSeg, this.task.timeTracking.endTime);
		}
		const endHint = endSection.createDiv({ cls: 'dt-edit-hint' });
		(endSection as any)._seg = endSeg;
		(endSection as any)._hintEl = endHint;

		// ── 耗时显示 ──
		const durSection = el.createDiv({ cls: 'dt-edit-section' });
		const durEl = durSection.createDiv({ cls: 'dt-edit-duration' });
		durEl.style.fontWeight = 'bold';

		const updateDurations = () => {
			this.updateTrackingHint(startSeg, startHint);
			this.updateTrackingHint(endSeg, endHint);
			this.updateDurationDisplay(startSeg, endSeg, durEl);
		};

		startSeg.all.forEach(inp => inp.addEventListener('input', updateDurations));
		endSeg.all.forEach(inp => inp.addEventListener('input', updateDurations));
		updateDurations();

		(el as any)._startSeg = startSeg;
		(el as any)._endSeg = endSeg;
		(el as any)._durEl = durEl;
	}

	private updateTrackingHint(seg: SegFields, el: HTMLElement): void {
		const val = this.readSegFields(seg);
		el.textContent = val ? val.format('YYYY-MM-DD HH:mm') : '';
	}

	private updateDurationDisplay(
		startSeg: SegFields,
		endSeg: SegFields,
		el: HTMLElement,
	): void {
		const start = this.readSegFields(startSeg);
		const end = this.readSegFields(endSeg);

		if (!start || !end) {
			el.textContent = '⏱ 耗时: —';
			return;
		}

		let adjustedEnd = end.clone();
		if (adjustedEnd.isBefore(start)) adjustedEnd.add(1, 'day');

		const minutes = adjustedEnd.diff(start, 'minutes');
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;

		if (h > 0 && m > 0) el.textContent = `⏱ 耗时: ${h}小时${m}分钟`;
		else if (h > 0) el.textContent = `⏱ 耗时: ${h}小时`;
		else el.textContent = `⏱ 耗时: ${m}分钟`;
	}

	// ==================== 分段输入 ====================

	/**
	 * 创建分段日期时间输入行
	 *
	 * 渲染效果：┌────┐ ┌──┐ ┌──┐   ┌──┐ ┌──┐
	 *           │YYYY│-│MM│-│DD│   │HH│:│mm│
	 *           └────┘ └──┘ └──┘   └──┘ └──┘
	 *
	 * 连续输入数字自动跨字段跳转，Backspace 空字段时回跳到前一字段。
	 */
	private createSegmentedInput(parent: HTMLElement): SegFields {
		const container = parent.createDiv({ cls: 'dt-seg-container' });

		const mkField = (placeholder: string, maxLen: number, width: string): HTMLInputElement => {
			const inp = container.createEl('input', {
				type: 'text',
				cls: 'dt-seg-field',
				attr: {
					placeholder,
					maxlength: String(maxLen),
					inputmode: 'numeric',
					autocomplete: 'off',
				},
			});
			inp.style.width = width;
			inp.style.textAlign = 'center';
			return inp;
		};

		const year = mkField('YYYY', 4, '56px');
		const sep1 = container.createEl('span', { text: '-', cls: 'dt-seg-sep' });
		const month = mkField('MM', 2, '36px');
		const sep2 = container.createEl('span', { text: '-', cls: 'dt-seg-sep' });
		const day = mkField('DD', 2, '36px');
		const spacer = container.createEl('span', { cls: 'dt-seg-spacer' });
		const hour = mkField('HH', 2, '36px');
		const sep3 = container.createEl('span', { text: ':', cls: 'dt-seg-sep' });
		const minute = mkField('mm', 2, '36px');

		const fields: HTMLInputElement[] = [year, month, day, hour, minute];

			// 各字段的合法范围
			const ranges: Array<{ min: number; max: number }> = [
				{ min: 2000, max: 2099 }, // year
				{ min: 1, max: 12 },     // month
				{ min: 1, max: 31 },     // day
				{ min: 0, max: 23 },     // hour
				{ min: 0, max: 59 },     // minute
			];

		// ── 自动跳转逻辑 ──
		fields.forEach((field, i) => {
			field.addEventListener('input', () => {
				const maxLen = field.maxLength;
				let val = field.value.replace(/\D/g, ''); // 只保留数字
				if (val.length > maxLen) {
					// 溢出：当前字段截断，多余部分填入后续字段
					const overflow = val.slice(maxLen);
					field.value = val.slice(0, maxLen);
					this.pushOverflow(overflow, fields, i + 1);
				} else {
					field.value = val;
					// 填满后自动跳到下一个字段
					if (val.length === maxLen && i < fields.length - 1) {
						fields[i + 1].focus();
						fields[i + 1].select();
					}
				}
			});

			field.addEventListener('keydown', (e) => {
				if (e.key === 'Backspace' && field.value === '' && i > 0) {
					// 空字段回退 → 删前一个字段的最后一位
					const prev = fields[i - 1];
					prev.value = prev.value.slice(0, -1);
					prev.focus();
					e.preventDefault();
				}
				if (e.key === 'ArrowRight' && field.selectionStart === field.value.length && i < fields.length - 1) {
					fields[i + 1].focus();
					fields[i + 1].select();
					e.preventDefault();
				}
				if (e.key === 'ArrowLeft' && field.selectionStart === 0 && i > 0) {
					fields[i - 1].focus();
					// 光标放到末尾
					const len = fields[i - 1].value.length;
					fields[i - 1].setSelectionRange(len, len);
					e.preventDefault();
				}
			});

			// 点击全选
			field.addEventListener('focus', () => field.select());

				// 失焦时校验并修正数值范围
				field.addEventListener('blur', () => {
					const val = field.value.trim();
					if (!val) return;
					const range = ranges[i];
					let num = parseInt(val, 10);
					if (isNaN(num)) return;
					num = Math.max(range.min, Math.min(range.max, num));
					field.value = String(num).padStart(field.maxLength, '0');
				});
		});

		return { year, month, day, hour, minute, all: fields };
	}

	/** 将溢出的数字递归填入后续字段 */
	private pushOverflow(digits: string, fields: HTMLInputElement[], startIndex: number): void {
		if (!digits || startIndex >= fields.length) return;
		const field = fields[startIndex];
		const maxLen = field.maxLength;
		field.value = digits.slice(0, maxLen);
		const rest = digits.slice(maxLen);
		if (rest) {
			this.pushOverflow(rest, fields, startIndex + 1);
		}
		// 触发一次 input 以保证填满也自动跳转
		field.dispatchEvent(new Event('input', { bubbles: true }));
		if (field.value.length === maxLen && startIndex < fields.length - 1) {
			fields[startIndex + 1].focus();
			fields[startIndex + 1].select();
		}
	}

	/** 设置分段字段的值 */
	private setSegFields(seg: SegFields, m: moment.Moment): void {
		seg.year.value = m.format('YYYY');
		seg.month.value = m.format('MM');
		seg.day.value = m.format('DD');
		seg.hour.value = m.format('HH');
		seg.minute.value = m.format('mm');
	}

	/** 读取分段字段的值，解析失败或全空返回 null */
	private readSegFields(seg: SegFields): moment.Moment | null {
		const y = seg.year.value.trim();
		const mo = seg.month.value.trim();
		const d = seg.day.value.trim();
		const h = seg.hour.value.trim();
		const mi = seg.minute.value.trim();

		// 全空
		if (!y && !mo && !d && !h && !mi) return null;

		// 缺少年份 → 用今天的年份
		const year = y || String(moment().year());
		// 缺少月日 → 补今天
		const month = mo || moment().format('MM');
		const day = d || moment().format('DD');
		// 缺少时分 → 补 0
		const hour = h || '00';
		const minute = mi || '00';

		const m = moment(`${year}-${month}-${day} ${hour}:${minute}`, 'YYYY-MM-DD HH:mm', true);
		return m.isValid() ? m : null;
	}

	// ==================== 按钮 ====================

	private renderButtons(el: HTMLElement): void {
		const btnRow = el.createDiv({ cls: 'dt-edit-actions' });

		// 清除按钮（左）
		const clearLabel = this.mode === 'reminder' ? '清除提醒' : '清除时间追踪';
		const clearBtn = btnRow.createEl('button', { text: clearLabel });
		clearBtn.addEventListener('click', async () => {
			try {
				if (this.mode === 'reminder') {
					await ReminderQuickSet.setReminderTime(this.task, null, this.taskParser);
				} else {
					await this.timeTrackerService.clearTrackingTime(this.task);
				}
				this.close();
			} catch (error) {
				console.error('[TaskKit:DateTimeEditModal] Failed to clear:', error);
				this.showError('操作失败，请重试');
			}
		});

		// 右侧按钮组
		const rightBtns = btnRow.createDiv({ cls: 'dt-edit-right-btns' });

		const cancelBtn = rightBtns.createEl('button', { text: '取消' });
		cancelBtn.addEventListener('click', () => this.close());

		const confirmBtn = rightBtns.createEl('button', {
			text: '确定',
			cls: 'mod-cta',
		});
		confirmBtn.addEventListener('click', async () => {
			if (this.mode === 'reminder') {
				await this.onReminderConfirm();
			} else {
				await this.onTrackingConfirm();
			}
		});
	}

	private async onReminderConfirm(): Promise<void> {
		const section = this.contentEl.querySelector('.dt-edit-section');
		const seg: SegFields = (section as any)?._seg;
		if (!seg) { this.close(); return; }

		const target = this.readSegFields(seg);
		if (!target) {
			this.showError('请填写提醒时间');
			return;
		}

		try {
			await ReminderQuickSet.setReminderTime(this.task, target, this.taskParser);
			this.close();
		} catch (error) {
			console.error('[TaskKit:DateTimeEditModal] Failed to set reminder:', error);
			this.showError('设置失败，请重试');
		}
	}

	private async onTrackingConfirm(): Promise<void> {
		const sections = this.contentEl.querySelectorAll('.dt-edit-section');
		const startSeg: SegFields = (sections[0] as any)?._seg;
		const endSeg: SegFields = (sections[1] as any)?._seg;

		if (!startSeg) { this.close(); return; }

		const startTime = this.readSegFields(startSeg);
		if (!startTime) {
			this.showError('请填写开始时间');
			return;
		}

		const endTime = this.readSegFields(endSeg) || undefined;

		// 只填了结束时间没填开始时间
		if (endTime && !startTime) {
			this.showError('请先填写开始时间，不能只填写结束时间');
			return;
		}

		try {
			await this.timeTrackerService.updateTrackingTime(this.task, startTime, endTime);
			this.close();
		} catch (error) {
			console.error('[TaskKit:DateTimeEditModal] Failed to update tracking time:', error);
			this.showError('更新失败，请重试');
		}
	}

	// ==================== 工具 ====================

	private showError(message: string): void {
		this.errorEl.textContent = message;
		this.errorEl.style.display = 'block';
		setTimeout(() => { this.errorEl.style.display = 'none'; }, 3000);
	}

	private injectStyles(): void {
		const style = document.createElement('style');
		style.textContent = `
			/* ── 标题 & 任务预览 ── */
			.dt-edit-title {
				margin: 0 0 4px;
			}
			.dt-edit-task-content {
				color: var(--text-muted);
				margin-bottom: 12px;
				font-size: var(--font-ui-smaller);
				padding: 4px 8px;
				background: var(--background-secondary);
				border-radius: var(--radius-s, 4px);
				word-break: break-word;
			}

			/* ── 区块 ── */
			.dt-edit-section {
				margin-bottom: 12px;
			}
			.dt-edit-section label {
				display: block;
				margin-bottom: 4px;
				font-weight: 500;
				font-size: var(--font-ui-small);
			}

			/* ── 分段输入容器（模拟一个完整输入框） ── */
			.dt-seg-container {
				display: inline-flex;
				align-items: center;
				gap: 0;
				padding: 2px 4px;
				background: var(--background-modifier-form-field);
				border: 1px solid var(--background-modifier-border);
				border-radius: var(--input-radius, 4px);
				transition: border-color 0.15s;
			}
			.dt-seg-container:focus-within {
				border-color: var(--interactive-accent);
				box-shadow: 0 0 0 1px var(--interactive-accent);
			}

			/* ── 分段字段 ── */
			.dt-seg-field {
				border: none !important;
				background: transparent !important;
				outline: none !important;
				box-shadow: none !important;
				padding: 2px 0 !important;
				font-size: var(--font-ui-small);
				font-family: var(--font-monospace);
				color: var(--text-normal);
				line-height: 1.4;
			}
			.dt-seg-field::placeholder {
				color: var(--text-faint);
			}

			/* ── 分隔符 ── */
			.dt-seg-sep {
				color: var(--text-faint);
				font-size: var(--font-ui-small);
				user-select: none;
				padding: 0 1px;
			}

			/* ── 日期与时间之间的小间隙 ── */
			.dt-seg-spacer {
				width: 8px;
				flex-shrink: 0;
			}

			/* ── 提示文字 ── */
			.dt-edit-hint {
				margin-top: 4px;
				font-size: var(--font-ui-smaller);
				min-height: 1.3em;
			}

			/* ── 耗时 ── */
			.dt-edit-duration {
				font-size: var(--font-ui-small);
			}

			/* ── 错误 ── */
			.dt-edit-error {
				color: var(--text-error);
				margin-bottom: 8px;
				font-size: var(--font-ui-smaller);
			}

			/* ── 按钮区 ── */
			.dt-edit-actions {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 8px;
			}
			.dt-edit-right-btns {
				display: flex;
				gap: 8px;
			}

			/* ── Obsidian 按钮覆写（让清除按钮看起来是危险操作） ── */
			.dt-edit-actions > button:first-child {
				color: var(--text-error);
			}
		`;
		this.contentEl.appendChild(style);
	}

	override onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.onDone?.();
	}
}
