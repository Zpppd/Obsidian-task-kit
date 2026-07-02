import { App, Modal } from 'obsidian';
import type { Task } from '../types/task';

export interface ReminderCallbacks {
	onDone: () => Promise<void>;
	onSnooze: (minutes: number) => Promise<void>;
	onMute: () => void;
	onOpenFile: () => void;
	/** 弹窗关闭时回调（无论通过哪个按钮关闭） */
	onClose?: () => void;
}

/**
 * 提醒弹窗
 *
 * 使用 Obsidian 原生 Modal，不依赖 Svelte 构建。
 * 弹出时显示任务内容、来源文件，以及四个操作按钮。
 */
export class ReminderModal extends Modal {
	constructor(
		app: App,
		private task: Task,
		private callbacks: ReminderCallbacks,
		private snoozePresets: number[],
	) {
		super(app);
	}

	override onOpen() {
		const { contentEl } = this;
		contentEl.addClass('reminder-modal');

		// ── 任务内容 ──
		const titleEl = contentEl.createEl('h3', {
			text: this.task.content,
			cls: 'reminder-modal-title',
		});
		titleEl.style.marginTop = '0';

		// ── 来源文件 ──
		contentEl.createEl('div', {
			text: `📄 ${this.task.file.path}`,
			cls: 'reminder-modal-file',
		});

		// ── 分隔线 ──
		contentEl.createEl('hr');

		// ── 按钮区 ──
		const btnRow = contentEl.createDiv({
			cls: 'reminder-modal-actions',
		});
		btnRow.style.display = 'flex';
		btnRow.style.flexWrap = 'wrap';
		btnRow.style.gap = '8px';
		btnRow.style.alignItems = 'center';

		// 标记完成
		const doneBtn = btnRow.createEl('button', {
			text: '标记完成',
			cls: 'mod-cta',
		});
		doneBtn.addEventListener('click', async () => {
			await this.callbacks.onDone();
			this.close();
		});

		// 稍后提醒（下拉选择后自动触发）
		const select = btnRow.createEl('select', { cls: 'dropdown' });
		select.createEl('option', { text: '稍后提醒...', value: '' });
		this.snoozePresets.forEach(min => {
			const label = min >= 60 ? `${min / 60} 小时` : `${min} 分钟`;
			select.createEl('option', { text: label, value: String(min) });
		});
		select.addEventListener('change', async () => {
			if (select.value) {
				await this.callbacks.onSnooze(parseInt(select.value));
				this.close();
			}
		});

		// 今日静音
		const muteBtn = btnRow.createEl('button', { text: '今日静音' });
		muteBtn.addEventListener('click', () => {
			this.callbacks.onMute();
			this.close();
		});

		// 打开文件
		const openBtn = btnRow.createEl('button', { text: '打开文件' });
		openBtn.addEventListener('click', () => {
			this.callbacks.onOpenFile();
			this.close();
		});
	}

	override onClose() {
		const { contentEl } = this;
		contentEl.empty();
		// 通知调度器弹窗已关闭
		this.callbacks.onClose?.();
	}
}
