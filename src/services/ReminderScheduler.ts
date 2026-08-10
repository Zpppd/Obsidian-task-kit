import { TFile, MarkdownView, Notice } from 'obsidian';
import moment from 'moment';
import { TaskStatus } from '../types/task';
import type { Task } from '../types/task';
import { ReminderModal } from '../ui/ReminderModal';
import type TaskMasterProPlugin from '../main';

const LOG = '[ReminderScheduler]';

export class ReminderScheduler {
	private timer: ReturnType<typeof setTimeout> | null = null;
	/** 已通知的任务追踪：key=taskId, value={content} 用于行号变化后的内容匹配 */
	private notifiedKeys: Map<string, { content: string }> = new Map();
	private activeModalTaskId: string | null = null;

	constructor(private plugin: TaskMasterProPlugin) {}

	/** 诊断日志：仅在调试模式下输出 */
	private debugLog(...args: unknown[]): void {
		if (this.plugin.settings.debug) {
			console.log(LOG, ...args);
		}
	}

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

		// [DIAGNOSTIC] 记录每次扫描结果
		const tasksWithReminder = tasks.filter(t => !!t.reminderTime && t.status !== TaskStatus.Completed).length;
		this.debugLog(
			`🔍 scheduleNext | cache:${tasks.length} tasks | withReminder:${tasksWithReminder} | notified:${this.notifiedKeys.size} | nearest:${nearest ? `${nearest.task.content.slice(0, 30)} @ ${nearest.time.format('HH:mm')}` : 'none'}`,
		);

		if (!nearest) return;

		const delayMs = nearest.time.diff(moment());
		if (delayMs <= 0) {
			this.doNotify(nearest.task);
			// 延迟再扫描下一个，给移动端渲染缓冲（避免多 Modal 瞬间堆叠）
			setTimeout(() => this.scheduleNext(), 300);
		} else {
			this.debugLog(`⏱️ Next reminder in ${Math.round(delayMs / 1000)}s: ${nearest.task.content.slice(0, 30)}`);
			// ✅ 定时器回调改为重新扫描，而非直接通知陈旧闭包数据
			this.timer = setTimeout(() => {
				this.scheduleNext();
			}, delayMs);
		}
	}

	private cleanupNotifiedKeys(tasks: Task[]): void {
		const taskMap = new Map<string, Task>();
		for (const t of tasks) taskMap.set(t.id, t);

		for (const [key, info] of this.notifiedKeys) {
			let task = taskMap.get(key);

			// ✅ 精确 ID 匹配失败 → 尝试按文件+内容匹配（行号变化导致 ID 改变）
			if (!task) {
				const filePath = key.substring(0, key.lastIndexOf(':'));
				task = tasks.find(t => t.file.path === filePath && t.content === info.content);
				if (task) {
					// 找到同一任务（新行号）→ 更新 notifiedKeys 中的 key
					this.notifiedKeys.delete(key);
					this.notifiedKeys.set(task.id, info);
					this.debugLog(`🔧 Updated notified key (line changed): ${key} → ${task.id}`);
				}
			}

			if (!task || !task.reminderTime || task.status === TaskStatus.Completed) {
				// [DIAGNOSTIC] 记录防重键被清除的原因
				const reason = !task ? 'task gone' : !task.reminderTime ? 'no reminder' : 'completed';
				this.debugLog(`🔴 NOTIFIED KEY REMOVED [${reason}]: ${key}`);
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
		// ✅ 时效性校验：从缓存重新获取最新数据，避免陈旧闭包/行号变化等问题
		const freshTasks = this.plugin.taskManagerService.getAllTasksFromCache();
		const fresh = freshTasks.find(t => t.id === task.id);

		if (!fresh) {
			this.debugLog(`⏭️ SKIP notify (task no longer exists): ${task.id}`);
			return;
		}
		if (!fresh.reminderTime) {
			this.debugLog(`⏭️ SKIP notify (reminder removed): ${task.id}`);
			return;
		}
		if (fresh.status === TaskStatus.Completed) {
			this.debugLog(`⏭️ SKIP notify (already completed): ${task.id}`);
			return;
		}
		if (fresh.isMuted) {
			this.debugLog(`⏭️ SKIP notify (muted): ${task.id}`);
			return;
		}
		if (fresh.reminderTime.isAfter(moment())) {
			this.debugLog(`⏭️ SKIP notify (not yet due, ${fresh.reminderTime.format('HH:mm')} > ${moment().format('HH:mm')}): ${task.id}`);
			return;
		}

		// [DIAGNOSTIC] 记录实际通知触发
		this.debugLog(`🔔 NOTIFYING: ${fresh.id} | ${fresh.content.slice(0, 40)}`);
		this.notifiedKeys.set(fresh.id, { content: fresh.content });
		const { useSystemNotification, useBuiltinNotification } = this.plugin.settings.reminder;
		if (useSystemNotification) this.trySystemNotification(fresh);
		if (useBuiltinNotification) this.showReminderModal(fresh);
		if (!useSystemNotification && !useBuiltinNotification) this.showReminderModal(fresh);
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
		// 同一任务的弹窗已存在 → 跳过
		if (this.activeModalTaskId === task.id) {
			this.debugLog(`⏭️ SKIP modal (already shown for this task): ${task.id}`);
			return;
		}

		// [DIAGNOSTIC] 记录 Modal 创建
		this.debugLog(`🪟 Showing modal for: ${task.id}`);
		this.activeModalTaskId = task.id;
		const modal = new ReminderModal(
			this.plugin.app,
			task,
			{
				onDone: async () => await this.handleDone(task),
				onSnooze: async (minutes: number) => await this.handleSnooze(task, minutes),
				onMute: () => this.handleMute(task),
				onOpenFile: () => this.handleOpenFile(task),
				onClose: () => {
					this.activeModalTaskId = null;
				},
			},
			this.plugin.settings.reminder.snoozePresets,
		);
		modal.open();
	}

	private async handleDone(task: Task) {
		try {
			const fresh = await this.getFreshTask(task);
			if (!fresh) {
				new Notice('任务已不存在');
				this.scheduleNext();
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
			// refreshSingleFile 已触发 cache-updated → scheduleNext()，无需显式调用
			new Notice(`✅ 已完成: ${fresh.content}`);
		} catch (error) {
			console.error(LOG, 'handleDone failed:', error);
			new Notice('标记完成失败');
			this.scheduleNext();
		}
	}

	private async handleSnooze(task: Task, minutes: number) {
		try {
			if (!task.reminderTime) {
				this.scheduleNext();
				return;
			}
			task.reminderTime = moment().add(minutes, 'minutes');
			this.notifiedKeys.delete(task.id);
			const newLine = this.plugin.taskParser.buildTaskLine(task);
			await this.plugin.taskParser.updateTaskLine(task, newLine);
			await this.plugin.taskManagerService.refreshSingleFile(task.file);
			// refreshSingleFile 已触发 cache-updated → scheduleNext()，无需显式调用
			new Notice(`⏰ 已推迟 ${minutes} 分钟`);
		} catch (error) {
			console.error(LOG, 'handleSnooze failed:', error);
			new Notice('稍后提醒失败');
			this.scheduleNext();
		}
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
