import { App, Modal } from 'obsidian';
import moment from 'moment';
import type { Task } from '../types/task';
import type { TimeTrackerService } from '../services/TimeTrackerService';

/**
 * 时间追踪编辑弹窗
 *
 * 允许用户手动设置任务的开始/结束时间，自动计算耗时。
 * 用于事后补录时间记录的常见场景。
 */
export class TimeTrackingEditModal extends Modal {
	private errorEl!: HTMLElement;

	constructor(
		app: App,
		private task: Task,
		private timeTrackerService: TimeTrackerService,
	) {
		super(app);
	}

	override onOpen() {
		const { contentEl } = this;
		contentEl.addClass('time-tracking-edit-modal');
		contentEl.style.minWidth = '360px';

		// ── 标题 ──
		contentEl.createEl('h3', {
			text: '修改追踪时间',
			cls: 'time-tracking-edit-title',
		});

		// ── 任务内容 ──
		contentEl.createEl('div', {
			text: this.task.content,
			cls: 'time-tracking-edit-task-content',
		});

		// ── 错误提示区域 ──
		this.errorEl = contentEl.createDiv({
			cls: 'time-tracking-edit-error',
		});
		this.errorEl.style.display = 'none';
		this.errorEl.style.color = 'var(--text-error)';
		this.errorEl.style.marginBottom = '8px';
		this.errorEl.style.fontSize = 'var(--font-ui-smaller)';

		// ── 开始时间 ──
		const startSection = contentEl.createDiv({ cls: 'time-tracking-edit-section' });
		startSection.createEl('label', { text: '开始时间' });

		const startRow = startSection.createDiv({ cls: 'time-tracking-edit-row' });
		const startDateInput = startRow.createEl('input', {
			type: 'date',
			cls: 'time-tracking-edit-date',
		});
		const startTimeInput = startRow.createEl('input', {
			type: 'time',
			cls: 'time-tracking-edit-time',
		});
		startTimeInput.style.marginLeft = '8px';

		// ── 结束时间 ──
		const endSection = contentEl.createDiv({ cls: 'time-tracking-edit-section' });
		endSection.createEl('label', { text: '结束时间（可选）' });

		const endRow = endSection.createDiv({ cls: 'time-tracking-edit-row' });
		const endDateInput = endRow.createEl('input', {
			type: 'date',
			cls: 'time-tracking-edit-date',
		});
		const endTimeInput = endRow.createEl('input', {
			type: 'time',
			cls: 'time-tracking-edit-time',
		});
		endTimeInput.style.marginLeft = '8px';

		// ── 耗时显示 ──
		const durationSection = contentEl.createDiv({ cls: 'time-tracking-edit-section' });
		const durationLabel = durationSection.createEl('span', {
			text: '⏱ 耗时: ',
		});
		const durationValue = durationSection.createEl('span', {
			text: '—',
			cls: 'time-tracking-edit-duration',
		});
		durationValue.style.fontWeight = 'bold';

		// ── 预填现有时间 ──
		if (this.task.timeTracking?.startTime) {
			const st = this.task.timeTracking.startTime;
			startDateInput.value = st.format('YYYY-MM-DD');
			startTimeInput.value = st.format('HH:mm');
		} else {
			// 默认：当前时间
			const now = moment();
			startDateInput.value = now.format('YYYY-MM-DD');
			startTimeInput.value = now.format('HH:mm');
		}

		if (this.task.timeTracking?.endTime) {
			const et = this.task.timeTracking.endTime;
			endDateInput.value = et.format('YYYY-MM-DD');
			endTimeInput.value = et.format('HH:mm');
			this.updateDuration(startDateInput, startTimeInput, endDateInput, endTimeInput, durationValue);
		}

		// ── 实时计算耗时 ──
		const recalc = () =>
			this.updateDuration(startDateInput, startTimeInput, endDateInput, endTimeInput, durationValue);

		startDateInput.addEventListener('change', recalc);
		startTimeInput.addEventListener('change', recalc);
		endDateInput.addEventListener('change', recalc);
		endTimeInput.addEventListener('change', recalc);

		// ── 分隔线 ──
		contentEl.createEl('hr');

		// ── 按钮区 ──
		const btnRow = contentEl.createDiv({ cls: 'time-tracking-edit-actions' });
		btnRow.style.display = 'flex';
		btnRow.style.justifyContent = 'space-between';
		btnRow.style.gap = '8px';

		// 清除按钮（左侧）
		const clearBtn = btnRow.createEl('button', { text: '清除时间追踪' });
		clearBtn.style.color = 'var(--text-error)';
		clearBtn.addEventListener('click', async () => {
			try {
				await this.timeTrackerService.clearTrackingTime(this.task);
				this.close();
			} catch (error) {
				console.error('[TimeTrackingEditModal] Failed to clear tracking time:', error);
				this.showError('清除失败，请重试');
			}
		});

		// 右侧按钮组
		const rightBtns = btnRow.createDiv();
		rightBtns.style.display = 'flex';
		rightBtns.style.gap = '8px';

		const cancelBtn = rightBtns.createEl('button', { text: '取消' });
		cancelBtn.addEventListener('click', () => this.close());

		const confirmBtn = rightBtns.createEl('button', {
			text: '确定',
			cls: 'mod-cta',
		});
		confirmBtn.addEventListener('click', async () => {
			// ── 验证 ──
			const hasStart = startDateInput.value !== '' && startTimeInput.value !== '';
			const hasEnd = endDateInput.value !== '' && endTimeInput.value !== '';

			// 只填了结束时间但没填开始时间
			if (hasEnd && !hasStart) {
				this.showError('请先填写开始时间，不能只填写结束时间');
				return;
			}

			// 都没填 → 不做任何修改
			if (!hasStart) {
				this.close();
				return;
			}

			try {
				const startTime = moment(
					`${startDateInput.value} ${startTimeInput.value}`,
					'YYYY-MM-DD HH:mm',
				);

				if (!startTime.isValid()) {
					this.showError('开始时间格式无效');
					return;
				}

				let endTime: moment.Moment | undefined;
				if (hasEnd) {
					endTime = moment(
						`${endDateInput.value} ${endTimeInput.value}`,
						'YYYY-MM-DD HH:mm',
					);

					if (!endTime.isValid()) {
						this.showError('结束时间格式无效');
						return;
					}
				}

				await this.timeTrackerService.updateTrackingTime(this.task, startTime, endTime);
				this.close();
			} catch (error) {
				console.error('[TimeTrackingEditModal] Failed to update tracking time:', error);
				this.showError('更新失败，请重试');
			}
		});

		// ── 样式 ──
		this.applyStyles();
	}

	/**
	 * 计算并显示耗时
	 */
	private updateDuration(
		startDateInput: HTMLInputElement,
		startTimeInput: HTMLInputElement,
		endDateInput: HTMLInputElement,
		endTimeInput: HTMLInputElement,
		durationEl: HTMLElement,
	): void {
		const hasStart = startDateInput.value !== '' && startTimeInput.value !== '';
		const hasEnd = endDateInput.value !== '' && endTimeInput.value !== '';

		if (!hasStart || !hasEnd) {
			durationEl.textContent = '—';
			return;
		}

		const startStr = `${startDateInput.value} ${startTimeInput.value}`;
		const endStr = `${endDateInput.value} ${endTimeInput.value}`;

		const start = moment(startStr, 'YYYY-MM-DD HH:mm');
		const end = moment(endStr, 'YYYY-MM-DD HH:mm');

		if (!start.isValid() || !end.isValid()) {
			durationEl.textContent = '—';
			return;
		}

		// 如果结束早于开始，假定跨天
		let adjustedEnd = end.clone();
		if (adjustedEnd.isBefore(start)) {
			adjustedEnd.add(1, 'day');
		}

		const minutes = adjustedEnd.diff(start, 'minutes');
		const hours = Math.floor(minutes / 60);
		const remainMin = minutes % 60;

		if (hours > 0 && remainMin > 0) {
			durationEl.textContent = `${hours}小时${remainMin}分钟`;
		} else if (hours > 0) {
			durationEl.textContent = `${hours}小时`;
		} else {
			durationEl.textContent = `${remainMin}分钟`;
		}
	}

	/**
	 * 显示错误消息（弹窗不关闭）
	 */
	private showError(message: string): void {
		this.errorEl.textContent = message;
		this.errorEl.style.display = 'block';

		// 3秒后自动隐藏
		setTimeout(() => {
			this.errorEl.style.display = 'none';
		}, 3000);
	}

	/**
	 * 应用内联样式
	 */
	private applyStyles(): void {
		const style = document.createElement('style');
		style.textContent = `
			.time-tracking-edit-title {
				margin-top: 0;
				margin-bottom: 4px;
			}
			.time-tracking-edit-task-content {
				color: var(--text-muted);
				margin-bottom: 12px;
				font-size: var(--font-ui-smaller);
				padding: 4px 8px;
				background: var(--background-secondary);
				border-radius: 4px;
				word-break: break-word;
			}
			.time-tracking-edit-section {
				margin-bottom: 12px;
			}
			.time-tracking-edit-section label {
				display: block;
				margin-bottom: 4px;
				font-weight: 500;
				font-size: var(--font-ui-small);
			}
			.time-tracking-edit-row {
				display: flex;
				align-items: center;
			}
			.time-tracking-edit-date {
				flex: 1;
			}
			.time-tracking-edit-time {
				flex: 1;
			}
		`;
		this.contentEl.appendChild(style);
	}

	override onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
