import { ItemView, WorkspaceLeaf, TFile, MarkdownView, Notice, TAbstractFile } from 'obsidian';
import { mount, unmount } from 'svelte';
import { writable, get } from 'svelte/store';
import type { Task } from '../types/task';
import { TaskParser } from '../parser/TaskParser';
import { TimeTrackerService } from '../services/TimeTrackerService';
import { TaskManagerService } from '../services/TaskManagerService';
import { TaskList } from './components';
import type TaskKitPlugin from '../main';

export const TASK_PANEL_VIEW_TYPE = 'task-kit-panel';

export class TaskPanelView extends ItemView {
  private taskParser: TaskParser;
  private timeTrackerService: TimeTrackerService;
  private taskManagerService: TaskManagerService;
  private plugin: TaskKitPlugin;
  private tasksStore = writable<Task[]>([]);
  private svelteComponent: ReturnType<typeof mount> | null = null;
  
  // ✅ 保存筛选状态，供面板重新打开时恢复（组件不再重建，此值仅在首次挂载时传入）
  private filterState: {
    searchText: string;
    statusFilter: 'all' | 'pending' | 'progress' | 'completed' | 'incomplete';
  } = {
    searchText: '',
    statusFilter: 'all'
  };

  constructor(
    leaf: WorkspaceLeaf, 
    taskParser: TaskParser, 
    timeTrackerService: TimeTrackerService, 
    taskManagerService: TaskManagerService,
    plugin: TaskKitPlugin
  ) {
    super(leaf);
    this.taskParser = taskParser;
    this.timeTrackerService = timeTrackerService;
    this.taskManagerService = taskManagerService;
    this.plugin = plugin;
  }

  getViewType(): string {
    return TASK_PANEL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'TaskKit';
  }

  getIcon(): string {
    return 'list-todo';
  }

  async onOpen(): Promise<void> {
    try {
      // 加载初始任务
      await this.loadTasks();

      // 获取容器并挂载 Svelte 组件
      const container = this.contentEl;

      if (!container) {
        console.error('[TaskKit:TaskPanelView] Container element not found');
        new Notice('Task Panel: 容器初始化失败');
        return;
      }
      
      this.svelteComponent = mount(TaskList, {
        target: container as HTMLElement,
        props: {
          tasks: this.tasksStore,
          onToggle: this.handleTaskToggle.bind(this),
          onClick: this.handleTaskClick.bind(this),
          onFilterChange: this.handleFilterChange.bind(this),
          timeTrackerService: this.timeTrackerService,
          app: this.app,
          taskParser: this.taskParser,
          enableTimeTracking: this.plugin.settings.enableTimeTracking,
          reminderEnabled: this.plugin.settings.reminder.enabled,
          onRefresh: this.refreshTasks.bind(this),
          // ✅ 传递初始筛选状态
          initialSearchText: this.filterState.searchText,
          initialStatusFilter: this.filterState.statusFilter
        }
      });

      // ✅ 订阅 TaskManagerService 的缓存更新事件（符合架构规范）
      this.registerEventSubscription();

    } catch (error) {
      console.error('[TaskKit:TaskPanelView] Failed to open view:', error);
      new Notice('Task Panel: 打开失败，请查看控制台');
    }
  }

  async onClose(): Promise<void> {
    // 必须卸载 Svelte 组件以清理资源
    if (this.svelteComponent) {
      unmount(this.svelteComponent);
      this.svelteComponent = null;
    }
  }

  /**
   * 订阅 TaskManagerService 的缓存更新事件
   * ✅ 符合架构规范：View层不直接监听底层文件系统事件
   * 
   * 架构说明：
   * - 文件修改：由 TaskManagerService 监听 → 更新缓存 → 触发 'cache-updated' 事件 → View层响应
   * - 文件删除/重命名：由 TaskManagerService 监听并清理缓存 → View层需要重新从缓存加载
   */
  private registerEventSubscription(): void {
    // ✅ 订阅 TaskManagerService 的缓存更新事件（文件修改时触发）
    this.plugin.registerEvent(
      this.taskManagerService.on('cache-updated', () => {
        try {
          const newTasks = this.taskManagerService.getAllTasksFromCache();
          // ✅ 只有任务数据真正变化时才更新 store（触发组件重渲染）
          if (this.hasTasksChanged(newTasks)) {
            this.tasksStore.set(newTasks);
          }
        } catch (error) {
          console.error('[TaskKit:TaskPanelView] Failed to sync view after cache update:', error);
        }
      })
    );

    // ⚠️ 注意：文件删除和重命名事件的监听是必要的例外
    // 原因：TaskManagerService 虽然会清理缓存，但无法主动通知 View 层"缓存已失效"
    // 解决方案：View 层监听这些事件后，从 Service 的缓存重新加载（而非全量刷新）

    this.plugin.registerEvent(
      this.app.vault.on('delete', (file: TAbstractFile) => {
        if (file instanceof TFile) {
          try {
            // ✅ 从缓存重新加载，而不是调用 refreshTasks() 全量刷新
            this.tasksStore.set(this.taskManagerService.getAllTasksFromCache());
          } catch (error) {
            console.error('[TaskKit:TaskPanelView] Failed to sync view after file delete:', error);
          }
        }
      })
    );

    this.plugin.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) {
          try {
            // ✅ 从缓存重新加载，而不是调用 refreshTasks() 全量刷新
            this.tasksStore.set(this.taskManagerService.getAllTasksFromCache());
          } catch (error) {
            console.error('[TaskKit:TaskPanelView] Failed to sync view after file rename:', error);
          }
        }
      })
    );
  }

  /**
   * 加载所有任务
   */
  async loadTasks(): Promise<void> {
    try {
      // ✅ 直接使用 TaskManagerService
      const allTasks = await this.taskManagerService.loadAllTasks();

      this.tasksStore.set(allTasks);
      // 组件通过 store 订阅自动更新，无需手动同步
    } catch (error) {
      console.error('[TaskKit:TaskPanelView] Failed to load tasks:', error);
      throw error;
    }
  }

  /**
   * 刷新任务列表（loadTasks 更新 store 后组件自动响应）
   */
  async refreshTasks(): Promise<void> {
    await this.loadTasks();
  }

  /**
   * 手动刷新（供子组件按钮调用）
   * 强制从磁盘重新加载所有任务，适用于：
   * - 用户点击刷新按钮
   * - 白名单修改后的强制同步
   */
  handleRefresh = async (): Promise<void> => {
    try {
      await this.taskManagerService.refreshAllTasks();
      // refreshAllTasks 会触发 'cache-updated' 事件，事件订阅自动更新 store
    } catch (error) {
      console.error('[TaskKit:TaskPanelView] Failed to refresh:', error);
      new Notice('刷新失败，请查看控制台');
    }
  };

  /**
   * 检查任务数据是否真正发生变化
   * ✅ 优化：避免不必要的视图重建，提升性能
   * 
   * @param newTasks 新的任务列表
   * @returns 如果任务数据有实质性变化则返回 true
   */
  private hasTasksChanged(newTasks: Task[]): boolean {
    const oldTasks = get(this.tasksStore);

    // 数量不同，肯定变化了
    if (newTasks.length !== oldTasks.length) {
      return true;
    }

    // 数量相同，检查是否有任务的 ID、状态或内容变化
    const oldTaskIds = new Set(oldTasks.map(t => t.id));
    const newTaskIds = new Set(newTasks.map(t => t.id));
    
    // ID 集合不同，说明有增删
    if (oldTaskIds.size !== newTaskIds.size) {
      return true;
    }
    
    for (const id of oldTaskIds) {
      if (!newTaskIds.has(id)) {
        return true;
      }
    }
    
    // 检查每个任务的状态和内容是否变化
    for (const newTask of newTasks) {
      const oldTask = oldTasks.find(t => t.id === newTask.id);
      if (!oldTask) {
        return true;
      }
      // ✅ 检查状态、内容、时间追踪等关键字段
      if (oldTask.status !== newTask.status) {
        return true;
      }
      if (oldTask.content !== newTask.content) {
        return true;
      }
      if (JSON.stringify(oldTask.timeTracking) !== JSON.stringify(newTask.timeTracking)) {
        return true;
      }
      if ((oldTask.reminderTime?.valueOf() ?? 0) !== (newTask.reminderTime?.valueOf() ?? 0)) {
        return true;
      }
      if (JSON.stringify(oldTask.tags) !== JSON.stringify(newTask.tags)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 处理任务状态切换
   */
  async handleTaskToggle(task: Task): Promise<void> {
    try {
      // ⚠️ 关键：在切换前重新获取最新的任务引用
      // 因为文件可能被修改，旧的任务引用可能已失效
      const freshTask = await this.getFreshTask(task);

      if (!freshTask) {
        console.error('[TaskKit:TaskPanelView] Could not find fresh task reference');
        new Notice('无法找到任务，请刷新面板');
        return;
      }

      // 调用 TimeTrackerService 切换状态（写回文件）
      await this.timeTrackerService.toggleTaskStatus(freshTask);

      // 增量刷新该文件：触发 cache-updated → 视图自动同步，避免全量重扫
      await this.taskManagerService.refreshSingleFile(freshTask.file);

    } catch (error) {
      console.error('[TaskKit:TaskPanelView] Failed to toggle task:', error);
      new Notice('切换任务状态失败，请查看控制台');
    }
  }

  /**
   * 获取最新的任务引用
   * 通过 filePath 和 line 重新查找任务
   */
  private async getFreshTask(oldTask: Task): Promise<Task | null> {
    try {
      // 重新解析该文件
      const file = oldTask.file;
      
      if (!file) {
        console.error('[TaskKit:TaskPanelView] File not found in task');
        return null;
      }
      
      const tasks = await this.taskParser.parseFile(file);
      const freshTask = tasks.find(t => t.line === oldTask.line);
      
      if (!freshTask) {
        console.error('[TaskKit:TaskPanelView] Task not found at line:', oldTask.line);
        return null;
      }
      
      return freshTask;
    } catch (error) {
      console.error('[TaskKit:TaskPanelView] Failed to get fresh task:', error);
      return null;
    }
  }

  /**
   * 处理任务点击（跳转到文件）
   */
  handleTaskClick(task: Task): void {
    try {
      const file = task.file;
      
      if (file instanceof TFile) {
        // 打开文件
        this.app.workspace.openLinkText('', file.path);
        
        // 等待一下确保文件已打开
        setTimeout(() => {
          const leaf = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (leaf && leaf.editor) {
            // 跳转到对应行并设置光标
            leaf.editor.setCursor(task.line, 0);
          }
        }, 100);
      }
    } catch (error) {
      console.error('[TaskKit:TaskPanelView] Failed to open task location:', error);
      new Notice('无法打开任务位置');
    }
  }

  /**
   * 处理筛选条件变化
   * ✅ 保存筛选状态，供面板重新打开时恢复
   */
  handleFilterChange(filterType: string, value: any): void {
    if (filterType === 'search') {
      this.filterState.searchText = value;
    } else if (filterType === 'status') {
      this.filterState.statusFilter = value;
    }
  }

}
