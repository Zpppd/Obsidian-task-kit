import { ItemView, WorkspaceLeaf, TFile, MarkdownView, Notice, TAbstractFile } from 'obsidian';
import { mount, unmount } from 'svelte';
import type { Task } from '../types/task';
import { TaskParser } from '../parser/TaskParser';
import { TimeTrackerService } from '../services/TimeTrackerService';
import { TaskManagerService } from '../services/TaskManagerService';
import { TaskList } from './components';
import type TaskMasterProPlugin from '../main';

export const TASK_PANEL_VIEW_TYPE = 'task-master-pro-panel';

export class TaskPanelView extends ItemView {
  private taskParser: TaskParser;
  private timeTrackerService: TimeTrackerService;
  private taskManagerService: TaskManagerService;
  private plugin: TaskMasterProPlugin; // ✅ 添加插件实例引用
  private tasks: Task[] = [];
  private svelteComponent: any = null;

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
    return 'checklist';
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
          timeTrackerService: this.timeTrackerService
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
   * 注册文件监听器（实现实时更新）
   */
  private registerFileListener(): void {
    // 监听文件修改事件
    this.plugin.registerEvent(
      this.app.vault.on('modify', (file: TAbstractFile) => {
        if (file instanceof TFile && !this.taskParser.shouldSkipFile(file)) {
          this.handleFileModify(file);
        }
      })
    );

    // 监听文件删除事件
    this.plugin.registerEvent(
      this.app.vault.on('delete', (file: TAbstractFile) => {
        if (file instanceof TFile) {
          setTimeout(async () => {
            await this.refreshTasks();
          }, 1500); // ✅ 增加延迟，确保缓存清理完成
        }
      })
    );

    // 监听文件重命名事件
    this.plugin.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) {
          setTimeout(async () => {
            await this.refreshTasks();
          }, 1500); // ✅ 增加延迟，确保缓存迁移完成
        }
      })
    );
  }

  /**
   * 订阅 TaskManagerService 的缓存更新事件
   * ✅ 符合架构规范：View层不直接监听底层文件系统事件
   */
  private registerEventSubscription(): void {
    this.plugin.registerEvent(
      this.taskManagerService.on('cache-updated', (file: TFile) => {
        // 从缓存获取最新数据并更新视图
        setTimeout(() => {
          try {
            this.tasks = this.taskManagerService.getAllTasksFromCache();
            this.updateView();
          } catch (error) {
            console.error('[TaskPanelView] Failed to update view after cache update:', error);
          }
        }, 100); // ✅ 短暂延迟确保 Svelte 渲染完成
      })
    );

    // ✅ 监听文件删除和重命名事件（这些事件不会触发 cache-updated）
    this.plugin.registerEvent(
      this.app.vault.on('delete', (file: TAbstractFile) => {
        if (file instanceof TFile) {
          setTimeout(async () => {
            await this.refreshTasks();
          }, 100);
        }
      })
    );

    this.plugin.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) {
          setTimeout(async () => {
            await this.refreshTasks();
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
      this.updateView();
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
  }

  /**
   * 处理文件修改事件（已废弃，改用事件订阅）
   * @deprecated 此方法已被 registerEventSubscription 替代
   */
  private handleFileModify(file: TFile): void {
    // 此方法不再使用，保留仅为向后兼容
    // 实际逻辑已迁移到 registerEventSubscription 中
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
   */
  handleFilterChange(filterType: string, value: any): void {
    // 筛选逻辑在 Svelte 组件内部处理
    // 这里可以添加额外的处理逻辑（如统计、日志等）
  }

  /**
   * 更新视图（重新渲染 Svelte 组件）
   */
  private updateView(): void {
    if (!this.svelteComponent || !this.containerEl.children[1]) {
      return;
    }

    try {
      // ✅ Svelte 4+ mount API 不支持动态更新 props
      // 解决方案：卸载旧组件，重新挂载新组件
      unmount(this.svelteComponent);
      
      const container = this.containerEl.children[1];
      this.svelteComponent = mount(TaskList, {
        target: container as HTMLElement,
        props: {
          tasks: this.tasks,
          onToggle: this.handleTaskToggle.bind(this),
          onClick: this.handleTaskClick.bind(this),
          onFilterChange: this.handleFilterChange.bind(this),
          timeTrackerService: this.timeTrackerService // ✅ 添加 timeTrackerService
        }
      });
    } catch (error) {
      console.error('[TaskPanelView] Failed to update view:', error);
    }
  }
}
