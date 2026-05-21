import { TFile, MarkdownView, Notice } from 'obsidian';
import moment from 'moment';
import { TaskStatus } from '../types/task';
import type { Task } from '../types/task';
import { ReminderModal } from '../ui/ReminderModal';
import type TaskMasterProPlugin from '../main';

const LOG = '[ReminderScheduler]';

export class ReminderScheduler {
	private timer: ReturnType<typeof setTimeout> | null = null;
	private notifiedKeys: Set<string> = new Set();

	constructor(private plugin: TaskMasterProPlugin) {}

	start() {
		this.scheduleNext();
		this.plugin.registerEvent(
			this.plugin.taskManagerService.on('cache-updated', () => {
				this.scheduleNext();
			}),
		);
	}

	stop() {
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
		this.scheduleNext();
	}

	scheduleNext() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (!this.plugin.settings.reminder.enabled) return;

		const tasks = this.plugin.taskManagerService.getAllTasksFromCache();
		this.cleanupNotifiedKeys(tasks);
		const nearest = this.findNearest(tasks);
		if (!nearest) return;

		const delayMs = nearest.time.diff(moment());
		if (delayMs <= 0) {
			this.doNotify(nearest.task);
			this.scheduleNext();
		} else {
			const safeDelay = Math.min(delayMs, 86_400_000);
			this.timer = setTimeout(() => {
				this.doNotify(nearest.task);
				this.scheduleNext();
			}, safeDelay);
		}
	}

	private cleanupNotifiedKeys(tasks: Task[]): void {
		const taskMap = new Map<string, Task>();
		for (const t of tasks) taskMap.set(t.id, t);
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
			if (task.status === TaskStatus.Progress && !this.plugin.settings.reminder.remindOnProgress)
				continue;
			const time = task.reminderTime;
			if (!nearest || time.isBefore(nearest.time)) nearest = { task, time };
		}
		return nearest;
	}

	private doNotify(task: Task) {
		this.notifiedKeys.add(task.id);
		const { useSystemNotification, useBuiltinNotification } = this.plugin.settings.reminder;
		if (useSystemNotification) this.trySystemNotification(task);
		if (useBuiltinNotification) this.showReminderModal(task);
		if (!useSystemNotification && !useBuiltinNotification) this.showReminderModal(task);
	}

	private trySystemNotification(task: Task): void {
		try {
			const win = window as any;
			const electron = win.require?.('electron');
			const ElectronNotification = electron?.remote?.Notification || electron?.Notification;
			if (ElectronNotification) {
				const n = new ElectronNotification({
					title: '⏰ Task Master Pro',
					body: `${task.content}\n${task.file.path}`,
				});
				n.on?.('click', () => { n.close(); this.showReminderModal(task); });
				n.show();
				return;
			}
			if (win.Notification && win.Notification.permission === 'granted') {
				const n = new win.Notification('⏰ Task Master Pro', {
					body: `${task.content}\n${task.file.path}`,
				});
				n.onclick = () => { n.close(); this.showReminderModal(task); };
				return;
			}
		} catch (e) {
			// fallback
		}
		this.showReminderModal(task);
	}

	private showReminderModal(task: Task) {
		new ReminderModal(
			this.plugin.app,
			task,
			{
				onDone: async () => await this.handleDone(task),
				onSnooze: async (minutes: number) => await this.handleSnooze(task, minutes),
				onMute: () => this.handleMute(task),
				onOpenFile: () => this.handleOpenFile(task),
			},
			this.plugin.settings.reminder.snoozePresets,
		).open();
	}

	private async handleDone(task: Task) {
		try {
			const fresh = await this.getFreshTask(task);
			if (!fresh) { new Notice('任务已不存在'); return; }
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
			new Notice('标记完成失败');
		}
		this.scheduleNext();
	}

	private async handleSnooze(task: Task, minutes: number) {
		try {
			if (!task.reminderTime) return;
			task.reminderTime = moment().add(minutes, 'minutes');
			this.notifiedKeys.delete(task.id);
			const newLine = this.plugin.taskParser.buildTaskLine(task);
			await this.plugin.taskParser.updateTaskLine(task, newLine);
			await this.plugin.taskManagerService.refreshSingleFile(task.file);
			new Notice(`⏰ 已推迟 ${minutes} 分钟`);
		} catch (error) {
			console.error(LOG, 'handleSnooze failed:', error);
			new Notice('稍后提醒失败');
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
					if (leaf?.editor) leaf.editor.setCursor(task.line, 0);
				}, 100);
			}
		} catch (error) {
			console.error(LOG, 'handleOpenFile failed:', error);
		}
	}

	private async getFreshTask(staleTask: Task): Promise<Task | null> {
		const file = staleTask.file;
		if (!file) return null;
		try {
			const tasks = await this.plugin.taskParser.parseFile(file);
			return tasks.find(t => t.line === staleTask.line) ?? null;
		} catch { return null; }
	}
}
