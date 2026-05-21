import { TFile, MarkdownView, Notice } from 'obsidian';
import moment from 'moment';
import { TaskStatus } from '../types/task';
import type { Task } from '../types/task';
import { ReminderModal } from '../ui/ReminderModal';
import type TaskMasterProPlugin from '../main';

const LOG = '[ReminderScheduler]';

/**
 * 提醒调度器
 *
 * 核心策略：单定时器，指向下一个最近的提醒。
 * 不轮询、不周期扫描，定时器到期前 CPU 零占用。
 */
export class ReminderScheduler {
	private timer: ReturnType<typeof setTimeout> | null = null;

	/** 已弹窗提醒的任务 ID 集合，防止重复弹窗 */
	private notifiedKeys: Set<string> = new Set();

	constructor(private plugin: TaskMasterProPlugin) {}

	// ==================== 公开方法 ====================

	start() {
		console.log(LOG, 'Scheduler started');
		this.scheduleNext();

		this.plugin.registerEvent(
			this.plugin.taskManagerService.on('cache-updated', () => {
				console.log(LOG, 'Cache updated, rescheduling...');
				this.scheduleNext();
			}),
		);
	}

	stop() {
		console.log(LOG, 'Scheduler stopped');
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	getDiagnostics(): Record<string, unknown> {
		const tasks = this.plugin.taskManagerService.getAllTasksFromCache();
		const tasksWithReminder = tasks.filter(
			t => !!t.reminderTime && t.status !== TaskStatus.Completed && !t.isMuted,
		);
		const nearest = this.findNearest(tasks);

		return {
			enabled: this.plugin.settings.reminder.enabled,
			totalTasksInCache: tasks.length,
			tasksWithReminder: tasksWithReminder.length,
			notifiedKeysCount: this.notifiedKeys.size,
			timerActive: this.timer !== null,
			useSystemNotification: this.plugin.settings.reminder.useSystemNotification,
			nearestReminder: nearest
				? {
						content: nearest.task.content,
						file: nearest.task.file.path,
						time: nearest.time.format('YYYY-MM-DD HH:mm'),
						delayMs: nearest.time.diff(moment()),
					}
				: null,
		};
	}

	rescan() {
		console.log(LOG, 'Manual rescan triggered');
		this.scheduleNext();
	}

	// ==================== 调度核心 ====================

	scheduleNext() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		if (!this.plugin.settings.reminder.enabled) {
			console.log(LOG, 'Reminder disabled, skipping schedule');
			return;
		}

		const tasks = this.plugin.taskManagerService.getAllTasksFromCache();
		console.log(LOG, `Scanning ${tasks.length} tasks in cache...`);

		// 清理已失效的 notifiedKeys：任务已删除或提醒时间已被移除
		this.cleanupNotifiedKeys(tasks);

		const nearest = this.findNearest(tasks);

		if (!nearest) {
			console.log(LOG, 'No upcoming reminders found');
			return;
		}

		const delayMs = nearest.time.diff(moment());
		console.log(
			LOG,
			`Next reminder: "${nearest.task.content}" at ${nearest.time.format('YYYY-MM-DD HH:mm')}, delay=${Math.round(delayMs / 1000)}s`,
		);

		if (delayMs <= 0) {
			console.log(LOG, 'Reminder already expired, showing immediately');
			this.doNotify(nearest.task);
			this.scheduleNext();
		} else {
			const safeDelay = Math.min(delayMs, 86_400_000);
			this.timer = setTimeout(() => {
				console.log(LOG, 'Timer fired');
				this.doNotify(nearest.task);
				this.scheduleNext();
			}, safeDelay);
		}
	}

	/**
	 * 清理 notifiedKeys：如果任务已不存在、提醒时间被删除、或已完成，从集合中移除
	 */
	private cleanupNotifiedKeys(tasks: Task[]): void {
		const taskMap = new Map<string, Task>();
		for (const t of tasks) {
			taskMap.set(t.id, t);
		}
		for (const key of this.notifiedKeys) {
			const task = taskMap.get(key);
			if (!task || !task.reminderTime || task.status === TaskStatus.Completed) {
				this.notifiedKeys.delete(key);
			}
		}
	}

	private findNearest(tasks: Task[]): { task: Task; time: moment.Moment } | null {
		let nearest: { task: Task; time: moment.Moment } | null = null;

		for (const task of tasks) {
			if (!task.reminderTime) continue;
			if (task.isMuted) continue;
			if (this.notifiedKeys.has(task.id)) continue;
			if (task.status === TaskStatus.Completed) continue;
			if (
				task.status === TaskStatus.Progress &&
				!this.plugin.settings.reminder.remindOnProgress
			)
				continue;

			const time = task.reminderTime;
			if (!nearest || time.isBefore(nearest.time)) {
				nearest = { task, time };
			}
		}

		return nearest;
	}

	// ==================== 通知分发 ====================

	/**
	 * 根据用户设置分发通知（两个开关可同时开启）
	 */
	private doNotify(task: Task) {
		this.notifiedKeys.add(task.id);

		const { useSystemNotification, useBuiltinNotification } =
			this.plugin.settings.reminder;

		if (useSystemNotification) {
			this.trySystemNotification(task);
		}
		if (useBuiltinNotification) {
			this.showReminderModal(task);
		}
		// 至少弹一个
		if (!useSystemNotification && !useBuiltinNotification) {
			this.showReminderModal(task);
		}
	}

	/**
	 * 尝试通过 Electron/Web 系统通知（仅桌面端）
	 * 系统通知只显示内容，点击后打开内置弹窗获得完整操作按钮
	 *
	 * 参考 obsidian-reminder-plugin 的实现：
	 * - 优先 electron.remote.Notification（旧版 Obsidian）
	 * - 其次 electron.Notification（新版）
	 * - 最后 Web Notification API 降级
	 */
	private trySystemNotification(task: Task): void {
		try {
			const win = window as any;

			// ---- 方式 1：Electron Notification ----
			const electron = win.require?.('electron');
			const ElectronNotification =
				electron?.remote?.Notification || electron?.Notification;

			if (ElectronNotification) {
				const n = new ElectronNotification({
					title: '⏰ Task Master Pro',
					body: `${task.content}\n${task.file.path}`,
				});
				n.on?.('click', () => {
					n.close();
					this.showReminderModal(task);
				});
				n.show();
				console.log(LOG, 'Electron system notification sent');
				return;
			}

			// ---- 方式 2：Web Notification API ----
			if (win.Notification && win.Notification.permission === 'granted') {
				const n = new win.Notification('⏰ Task Master Pro', {
					body: `${task.content}\n${task.file.path}`,
				});
				n.onclick = () => {
					n.close();
					this.showReminderModal(task);
				};
				console.log(LOG, 'Web API notification sent');
				return;
			}

			console.warn(LOG, 'No notification API available');
		} catch (e) {
			console.warn(LOG, 'System notification failed:', e);
		}
		// 降级到内置弹窗
		this.showReminderModal(task);
	}

	// ==================== 提醒弹窗 ====================

	private showReminderModal(task: Task) {
		console.log(LOG, `Showing modal for: "${task.content}"`);

		new ReminderModal(
			this.plugin.app,
			task,
			{
				onDone: async () => {
					console.log(LOG, `Done: "${task.content}"`);
					await this.handleDone(task);
				},
				onSnooze: async (minutes: number) => {
					console.log(LOG, `Snooze ${minutes}min: "${task.content}"`);
					await this.handleSnooze(task, minutes);
				},
				onMute: () => {
					console.log(LOG, `Mute: "${task.content}"`);
					this.handleMute(task);
				},
				onOpenFile: () => {
					console.log(LOG, `Open file: "${task.content}"`);
					this.handleOpenFile(task);
				},
			},
			this.plugin.settings.reminder.snoozePresets,
		).open();
	}

	// ==================== 按钮回调 ====================

	private async handleDone(task: Task) {
		try {
			const fresh = await this.getFreshTask(task);
			if (!fresh) {
				new Notice('任务已不存在，无法标记完成');
				return;
			}

			if (fresh.status === TaskStatus.Progress) {
				await this.plugin.timeTrackerService.toggleTaskStatus(fresh);
			} else if (fresh.status === TaskStatus.Pending) {
				fresh.status = TaskStatus.Completed;
				fresh.timeTracking = undefined;
				const newLine = this.plugin.taskParser.buildTaskLine(fresh);
				await this.plugin.taskParser.updateTaskLine(fresh, newLine);
			}

			await this.plugin.taskManagerService.refreshSingleFile(fresh.file);
			new Notice(`✅ 已完成: ${fresh.content}`);
		} catch (error) {
			console.error(LOG, 'handleDone failed:', error);
			new Notice('标记完成失败，请查看控制台');
		}
		this.scheduleNext();
	}

	private async handleSnooze(task: Task, minutes: number) {
		try {
			if (!task.reminderTime) return;

			const newTime = moment().add(minutes, 'minutes');
			task.reminderTime = newTime;
			this.notifiedKeys.delete(task.id);

			const newLine = this.plugin.taskParser.buildTaskLine(task);
			await this.plugin.taskParser.updateTaskLine(task, newLine);
			await this.plugin.taskManagerService.refreshSingleFile(task.file);
			new Notice(`⏰ 已推迟 ${minutes} 分钟`);
		} catch (error) {
			console.error(LOG, 'handleSnooze failed:', error);
			new Notice('稍后提醒失败，请查看控制台');
		}
		this.scheduleNext();
	}

	private handleMute(task: Task) {
		task.isMuted = true;
		this.notifiedKeys.delete(task.id);
		new Notice(`🔇 今日不再提醒: ${task.content}`);
		this.scheduleNext();
	}

	private handleOpenFile(task: Task) {
		try {
			const file = task.file;
			if (file instanceof TFile) {
				this.plugin.app.workspace.openLinkText('', file.path);
				setTimeout(() => {
					const leaf = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
					if (leaf?.editor) {
						leaf.editor.setCursor(task.line, 0);
					}
				}, 100);
			}
		} catch (error) {
			console.error(LOG, 'handleOpenFile failed:', error);
		}
	}

	// ==================== 辅助方法 ====================

	private async getFreshTask(staleTask: Task): Promise<Task | null> {
		const file = staleTask.file;
		if (!file) return null;
		try {
			const tasks = await this.plugin.taskParser.parseFile(file);
			return tasks.find(t => t.line === staleTask.line) ?? null;
		} catch {
			return null;
		}
	}
}
