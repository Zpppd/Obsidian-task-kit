import { ItemView, WorkspaceLeaf, TFile, MarkdownView, Notice, TAbstractFile } from 'obsidian';
import { mount, unmount } from 'svelte';
import type { Task } from '../types/task';
import { TaskParser } from '../parser/TaskParser';
import { TimeTrackerService } from '../services/TimeTrackerService';
import { TaskList } from './components';

export const TASK_PANEL_VIEW_TYPE = 'task-master-pro-panel';

export class TaskPanelView extends ItemView {
  private taskParser: TaskParser;
  private timeTrackerService: TimeTrackerService;
  private tasks: Task[] = [];
  private svelteComponent: any = null;
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(leaf: WorkspaceLeaf, taskParser: TaskParser, timeTrackerService: TimeTrackerService) {
    super(leaf);
    this.taskParser = taskParser;
    this.timeTrackerService = timeTrackerService;
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
          onFilterChange: this.handleFilterChange.bind(this)
        }
      });

      // 注册文件监听（带防抖）
      this.registerEvent(
        this.app.vault.on('modify', (file: TAbstractFile) => {
          if (file instanceof TFile) {
            this.handleFileModify(file);
          }
        })
      );
      
      this.registerEvent(
        this.app.vault.on('delete', (file: TAbstractFile) => {
          if (file instanceof TFile) {
            console.log(`[TaskPanelView] File deleted: ${file.path}`);
            // 从任务列表中移除该文件的所有任务
            const oldCount = this.tasks.length;
            this.tasks = this.tasks.filter(t => t.file.path !== file.path);
            const removedCount = oldCount - this.tasks.length;
            if (removedCount > 0) {
              console.log(`[TaskPanelView] Removed ${removedCount} tasks from deleted file`);
              this.updateView();
            }
          }
        })
      );
      
      this.registerEvent(
        this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
          if (file instanceof TFile) {
            console.log(`[TaskPanelView] File renamed: ${oldPath} -> ${file.path}`);
            // 更新该文件所有任务的 file 引用
            let updatedCount = 0;
            this.tasks.forEach(task => {
              if (task.file.path === oldPath) {
                // 注意：TFile 对象是不可变的，我们需要重新解析
                // 这里简单处理：标记需要刷新
                setTimeout(() => {
                  this.refreshSingleFile(file);
                }, 100);
              }
            });
          }
        })
      );

      console.log('[TaskPanelView] View opened successfully');
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
    
    // 清除防抖定时器
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  /**
   * 加载所有任务
   */
  async loadTasks(): Promise<void> {
    try {
      console.log('[TaskPanelView] Starting to load tasks...');
      const files = this.app.vault.getMarkdownFiles();
      console.log(`[TaskPanelView] Found ${files.length} markdown files`);
      
      const allTasks: Task[] = [];
      let processedFiles = 0;
      let failedFiles = 0;
      
      // ✅ 性能优化：过滤掉不需要处理的文件
      const validFiles = files.filter(file => !this.shouldSkipFile(file));
      console.log(`[TaskPanelView] Processing ${validFiles.length} valid files (skipped ${files.length - validFiles.length})`);

      // ✅ 性能优化：批量并行处理（限制并发数避免内存溢出）
      const batchSize = 50; // 每批处理 50 个文件
      for (let i = 0; i < validFiles.length; i += batchSize) {
        const batch = validFiles.slice(i, i + batchSize);
        const promises = batch.map(async (file) => {
          try {
            const tasks = await this.taskParser.parseFile(file);
            return { file, tasks, success: true };
          } catch (error) {
            console.error(`[TaskPanelView] Failed to parse file ${file.path}:`, error);
            return { file, tasks: [], success: false };
          }
        });
        
        const results = await Promise.all(promises);
        
        for (const result of results) {
          if (result.success) {
            allTasks.push(...result.tasks);
            processedFiles++;
          } else {
            failedFiles++;
          }
        }
        
        // 每批处理后更新一次进度（可选）
        if (i > 0 && i % 200 === 0) {
          console.log(`[TaskPanelView] Progress: ${i}/${validFiles.length} files processed`);
        }
      }

      this.tasks = allTasks;
      console.log(`[TaskPanelView] Loaded ${allTasks.length} tasks from ${processedFiles} files (${failedFiles} failed)`);
      this.updateView();
    } catch (error) {
      console.error('[TaskPanelView] Failed to load tasks:', error);
      throw error; // 重新抛出错误，让 onOpen 捕获
    }
  }

  /**
   * 判断是否应该跳过该文件
   */
  private shouldSkipFile(file: TFile): boolean {
    // 跳过隐藏文件
    if (file.path.startsWith('.')) {
      return true;
    }
    
    // 跳过系统文件夹
    const skipFolders = ['.obsidian', '.git', 'node_modules'];
    for (const folder of skipFolders) {
      if (file.path.includes(`/${folder}/`) || file.path.startsWith(`${folder}/`)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 刷新任务列表
   */
  async refreshTasks(): Promise<void> {
    await this.loadTasks();
  }

  /**
   * 处理文件修改事件（带防抖）
   */
  private handleFileModify(file: TFile): void {
    // 跳过不应该监听的文件
    if (this.shouldSkipFile(file)) {
      return;
    }
    
    console.log(`[TaskPanelView] File modified: ${file.path}`);
    
    // 清除之前的定时器
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    // 设置新的防抖定时器（1000ms，给用户更多编辑时间）
    this.refreshTimeout = setTimeout(async () => {
      console.log(`[TaskPanelView] Refreshing tasks after file change...`);
      await this.refreshSingleFile(file);  // ✅ 优化：只刷新单个文件
      this.refreshTimeout = null;
    }, 1000);
  }

  /**
   * 增量更新：只重新解析单个文件
   */
  private async refreshSingleFile(changedFile: TFile): Promise<void> {
    try {
      console.log(`[TaskPanelView] Refreshing single file: ${changedFile.path}`);
      
      // 从当前任务列表中移除该文件的旧任务
      const oldTaskCount = this.tasks.filter(t => t.file.path === changedFile.path).length;
      this.tasks = this.tasks.filter(t => t.file.path !== changedFile.path);
      
      console.log(`[TaskPanelView] Removed ${oldTaskCount} old tasks from ${changedFile.path}`);
      
      // 重新解析该文件
      const newTasks = await this.taskParser.parseFile(changedFile);
      this.tasks.push(...newTasks);
      
      console.log(`[TaskPanelView] Added ${newTasks.length} new tasks from ${changedFile.path}`);
      console.log(`[TaskPanelView] Total tasks: ${this.tasks.length}`);
      
      // 更新视图
      this.updateView();
    } catch (error) {
      console.error('[TaskPanelView] Failed to refresh single file:', error);
      // 如果增量更新失败，回退到全量刷新
      await this.refreshTasks();
    }
  }

  /**
   * 处理任务状态切换
   */
  async handleTaskToggle(task: Task): Promise<void> {
    try {
      console.log('[TaskPanelView] Toggling task:', task.content, 'Status:', task.status);
      
      // ⚠️ 关键：在切换前重新获取最新的任务引用
      // 因为文件可能被修改，旧的任务引用可能已失效
      const freshTask = await this.getFreshTask(task);
      
      if (!freshTask) {
        console.error('[TaskPanelView] Could not find fresh task reference');
        new Notice('无法找到任务，请刷新面板');
        return;
      }
      
      console.log('[TaskPanelView] Found fresh task, toggling status...');
      
      // 调用 TimeTrackerService 切换状态
      await this.timeTrackerService.toggleTaskStatus(freshTask);
      
      console.log('[TaskPanelView] Status toggled successfully, refreshing...');
      
      // 等待一小段时间确保文件写入完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 刷新任务列表以显示最新状态
      await this.refreshTasks();
      
      console.log('[TaskPanelView] Tasks refreshed');
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
      
      console.log('[TaskPanelView] Found fresh task at line', oldTask.line);
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
    console.log(`[TaskPanelView] Filter changed: ${filterType} = ${value}`);
  }

  /**
   * 更新视图（重新渲染 Svelte 组件）
   */
  private updateView(): void {
    if (!this.svelteComponent || !this.containerEl.children[1]) {
      console.warn('[TaskPanelView] Cannot update view: component or container not ready');
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
          onFilterChange: this.handleFilterChange.bind(this)
        }
      });
      
      console.log('[TaskPanelView] View updated successfully');
    } catch (error) {
      console.error('[TaskPanelView] Failed to update view:', error);
    }
  }
}
