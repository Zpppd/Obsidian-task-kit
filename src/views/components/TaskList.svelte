<script lang="ts">
  import { App } from 'obsidian';
  import type { Task } from '../../types/task';
  import type { TimeTrackerService } from '../../services/TimeTrackerService';
  import type { TaskParser } from '../../parser/TaskParser';
  import TaskItem from './TaskItem.svelte';
  import FilterBar from './FilterBar.svelte';

  export let tasks: Task[] = [];
  export let onToggle: (task: Task) => void;
  export let onClick: (task: Task) => void;
  export let onFilterChange: (filterType: string, value: any) => void;
  export let timeTrackerService: TimeTrackerService;
  export let app: App;
  export let taskParser: TaskParser;
  export let enableTimeTracking: boolean;
  export let reminderEnabled: boolean;
  export let onRefresh: () => void;
  
  // ✅ 支持从父组件传入初始筛选状态
  export let initialSearchText: string = '';
  export let initialStatusFilter: 'all' | 'pending' | 'progress' | 'completed' | 'incomplete' = 'all';

  // 筛选状态 - 使用父组件传入的初始值
  let searchText = initialSearchText;
  let statusFilter: 'all' | 'pending' | 'progress' | 'completed' | 'incomplete' = initialStatusFilter;
  
  // ✅ 声明filteredTasks变量
  let filteredTasks: Task[] = [];
  // ✅ 声明groupedTasks变量
  let groupedTasks: Map<string, Task[]> = new Map();

  // 处理筛选变化
  function handleFilterChange(event: CustomEvent) {
    const { type, value } = event.detail;
    
    if (type === 'search') {
      searchText = value;
    } else if (type === 'status') {
      statusFilter = value;
    }
    
    // 通知父组件筛选条件变化
    onFilterChange(type, value);
  }

  // 计算筛选后的任务
  $: {
    filteredTasks = tasks.filter(task => {
      // 状态筛选
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && task.status !== 'pending') return false;
        if (statusFilter === 'progress' && task.status !== 'progress') return false;
        if (statusFilter === 'completed' && task.status !== 'completed') return false;
        if (statusFilter === 'incomplete' && task.status === 'completed') return false;
      }
      
      // 搜索筛选
      if (searchText.trim()) {
        const searchLower = searchText.toLowerCase();
        const contentMatch = task.content.toLowerCase().includes(searchLower);
        const tagsMatch = task.tags?.some(tag => tag.toLowerCase().includes(searchLower));
        
        if (!contentMatch && !tagsMatch) return false;
      }
      
      return true;
    });
    
  }

  // 按文件分组
  $: {
    groupedTasks = groupByFile(filteredTasks);
  }

  function groupByFile(tasks: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();
    
    for (const task of tasks) {
      const fileName = getFileName(task.file.path);
      if (!groups.has(fileName)) {
        groups.set(fileName, []);
      }
      groups.get(fileName)!.push(task);
    }
    
    return groups;
  }

  function getFileName(filePath: string): string {
    if (!filePath) {
      return 'Unknown';
    }
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  }
</script>

<div class="task-list-container">
  <FilterBar
    {searchText}
    {statusFilter}
    on:filter-change={handleFilterChange}
  />
  
  <div class="task-list-content">
    {#if filteredTasks.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">
          {tasks.length === 0 ? '暂无任务' : '没有符合条件的任务'}
        </div>
      </div>
    {:else}
      {#each Array.from(groupedTasks.entries()) as [fileName, fileTasks]}
        <div class="file-group">
          <div class="file-group-header">
            <span class="file-name">📄 {fileName}</span>
            <span class="task-count">{fileTasks.length}</span>
          </div>
          
          <div class="file-tasks">
            {#each fileTasks as task}
              <TaskItem
                {task}
                {onToggle}
                {onClick}
                {timeTrackerService}
                {app}
                {taskParser}
                {enableTimeTracking}
                {reminderEnabled}
                {onRefresh}
              />
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style lang="scss">
  .task-list-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--background-primary);
  }

  .task-list-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    position: relative; /* 确保子元素的定位相对于此容器 */
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px; /* 改为最小高度，而不是100%，防止覆盖FilterBar */
    color: var(--text-muted);
    gap: 12px;
  }

  .empty-icon {
    font-size: 48px;
    opacity: 0.5;
  }

  .empty-text {
    font-size: var(--font-ui-small);
  }

  .file-group {
    margin-bottom: 16px;
  }

  .file-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background-color: var(--background-secondary);
    border-radius: 4px;
    margin-bottom: 4px;
    font-weight: 500;
  }

  .file-name {
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }

  .task-count {
    background-color: var(--color-accent-tint);
    color: var(--color-accent);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: var(--font-ui-smaller);
    font-weight: 600;
  }

  .file-tasks {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
</style>
