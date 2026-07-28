import { ItemView, WorkspaceLeaf, TFile, MarkdownView, Notice, TAbstractFile } from 'obsidian';
import { mount, unmount } from 'svelte';
import type { Task } from '../types/task';
import { TaskParser } from '../parser/TaskParser';
import { TimeTrackerService } from '../services/TimeTrackerService';
import { TaskManagerService } from '../services/TaskManagerService';
import { TaskList } from './components';
import type TaskMasterProPlugin from '../main';

export const TASK_PANEL_VIEW_TYPE = 'task-kit-panel';

export class TaskPanelView extends ItemView {
  private taskParser: TaskParser;
  private timeTrackerService: TimeTrackerService;
  private taskManagerService: TaskManagerService;
  private plugin: TaskMasterProPlugin;
  private tasks: Task[] = [];
  private svelteComponent: any = null;
  
  // ✅ 新增：保存用户的筛选状态（避免组件重建时丢失）
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
    plugin: TaskMasterProPlugin
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
    return 'Task Master Pro';
  }

  getIcon(): string {
    return 'list-todo';
  }

  async onOpen(): Promise<void> {
    try {
      // 加载初始任务
      await this.loadTasks();

      // 获取容器并挂载 Svelte 组件
      const container = this.containerEl.children[1];
      
      if (!container) {
        console.error('[TaskPanelView] Container element not found');
        new Notice('Task Panel: 容器初始化失败');
        return;
      }
      
      this.svelteComponent = mount(TaskList, {
        target: container as HTMLElement,
        props: {
          tasks: this.tasks,
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
      console.error('[TaskPanelView] Failed to open view:', error);
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
      this.taskManagerService.on('cache-updated', (...args: unknown[]) => {
        const file = args[0] as TFile;
        
        setTimeout(() => {
          try {
            const newTasks = this.taskManagerService.getAllTasksFromCache();
            
            // ✅ 优化：只有任务数据真正变化时才更新视图
            if (this.hasTasksChanged(newTasks)) {
              this.tasks = newTasks;
              this.updateView();
            }
          } catch (error) {
            console.error('[TaskPanelView] Failed to update view after cache update:', error);
          }
        }, 100); // ✅ 短暂延迟确保 Svelte 渲染完成
      })
    );

    // ⚠️ 注意：文件删除和重命名事件的监听是必要的例外
    // 原因：TaskManagerService 虽然会清理缓存，但无法主动通知 View 层"缓存已失效"
    // 解决方案：View 层监听这些事件后，从 Service 的缓存重新加载（而非全量刷新）
    
    this.plugin.registerEvent(
      this.app.vault.on('delete', (file: TAbstractFile) => {
        if (file instanceof TFile) {
          setTimeout(() => {
            try {
              // ✅ 从缓存重新加载，而不是调用 refreshTasks() 全量刷新
              this.tasks = this.taskManagerService.getAllTasksFromCache();
              this.updateView();
            } catch (error) {
              console.error('[TaskPanelView] Failed to update view after file delete:', error);
            }
          }, 100);
        }
      })
    );

    this.plugin.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) {
          setTimeout(() => {
            try {
              // ✅ 从缓存重新加载，而不是调用 refreshTasks() 全量刷新
              this.tasks = this.taskManagerService.getAllTasksFromCache();
              this.updateView();
            } catch (error) {
              console.error('[TaskPanelView] Failed to update view after file rename:', error);
            }
          }, 100);
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
      
      this.tasks = allTasks;
      // 注意：不在这里调用 updateView()，由调用方决定何时更新视图
    } catch (error) {
      console.error('[TaskPanelView] Failed to load tasks:', error);
      throw error;
    }
  }

  /**
   * 刷新任务列表
   */
  async refreshTasks(): Promise<void> {
    await this.loadTasks();
    this.updateView();
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
      // refreshAllTasks 会触发 'cache-updated' 事件，事件订阅自动调用 updateView()
    } catch (error) {
      console.error('[TaskPanelView] Failed to refresh:', error);
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
    // 数量不同，肯定变化了
    if (newTasks.length !== this.tasks.length) {
      return true;
    }
    
    // 数量相同，检查是否有任务的 ID、状态或内容变化
    const oldTaskIds = new Set(this.tasks.map(t => t.id));
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
      const oldTask = this.tasks.find(t => t.id === newTask.id);
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
        console.error('[TaskPanelView] Could not find fresh task reference');
        new Notice('无法找到任务，请刷新面板');
        return;
      }
      
      // 调用 TimeTrackerService 切换状态
      await this.timeTrackerService.toggleTaskStatus(freshTask);
      
      // 等待一小段时间确保文件写入完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 刷新任务列表以显示最新状态
      await this.refreshTasks();
      
    } catch (error) {
      console.error('[TaskPanelView] Failed to toggle task:', error);
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
        console.error('[TaskPanelView] File not found in task');
        return null;
      }
      
      const tasks = await this.taskParser.parseFile(file);
      const freshTask = tasks.find(t => t.line === oldTask.line);
      
      if (!freshTask) {
        console.error('[TaskPanelView] Task not found at line:', oldTask.line);
        return null;
      }
      
      return freshTask;
    } catch (error) {
      console.error('[TaskPanelView] Failed to get fresh task:', error);
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
      console.error('[TaskPanelView] Failed to open task location:', error);
      new Notice('无法打开任务位置');
    }
  }

  /**
   * 处理筛选条件变化
   * ✅ 保存用户的筛选状态到父组件，避免组件重建时丢失
   */
  handleFilterChange(filterType: string, value: any): void {
    // ✅ 保存筛选状态到父组件
    if (filterType === 'search') {
      this.filterState.searchText = value;
    } else if (filterType === 'status') {
      this.filterState.statusFilter = value;
    }
  }

  /**
   * 更新视图（重新渲染 Svelte 组件）
   * ✅ 修复：移除svelteComponent不存在时return的逻辑
   * ✅ 优化：传递筛选状态，避免组件重建时丢失用户选择
   */
  private updateView(): void {
    const container = this.containerEl.children[1];
    if (!container) {
      console.warn('[TaskPanelView] Container not found, skipping update');
      return;
    }

    try {
      // 如果组件已存在，先卸载
      if (this.svelteComponent) {
        unmount(this.svelteComponent);
        this.svelteComponent = null;
      }
      
      // ✅ 总是重新挂载组件（无论之前是否存在）
      // ✅ 传递筛选状态（组件重建时恢复用户选择）
      this.svelteComponent = mount(TaskList, {
        target: container as HTMLElement,
        props: {
          tasks: this.tasks,
          onToggle: this.handleTaskToggle.bind(this),
          onClick: this.handleTaskClick.bind(this),
          onFilterChange: this.handleFilterChange.bind(this),
          timeTrackerService: this.timeTrackerService,
          app: this.app,
          taskParser: this.taskParser,
          enableTimeTracking: this.plugin.settings.enableTimeTracking,
          reminderEnabled: this.plugin.settings.reminder.enabled,
          onRefresh: this.refreshTasks.bind(this),
          // ✅ 传递筛选状态
          initialSearchText: this.filterState.searchText,
          initialStatusFilter: this.filterState.statusFilter
        }
      });
    } catch (error) {
      console.error('[TaskPanelView] Failed to update view:', error);
    }
  }
}
