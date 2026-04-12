<script lang="ts">
  import type { Task } from '../../types/task';
  import type { TimeTrackerService } from '../../services/TimeTrackerService';
  
  export let task: Task;
  export let onToggle: (task: Task) => void;
  export let onClick: (task: Task) => void;
  export let timeTrackerService: TimeTrackerService; // ✅ 添加 TimeTrackerService prop

  // ✅ 根据任务状态返回 checkbox 的 CSS 类
  function getCheckboxClass(): string {
    switch (task.status) {
      case 'pending':
        return 'checkbox-pending';
      case 'progress':
        return 'checkbox-progress';
      case 'completed':
        return 'checkbox-completed';
      default:
        return '';
    }
  }

  // ✅ 获取状态文本
  function getStatusText(): string {
    switch (task.status) {
      case 'pending':
        return '待办';
      case 'progress':
        return '进行中';
      case 'completed':
        return '已完成';
      default:
        return '';
    }
  }

  // ✅ 获取状态 CSS 类
  function getStatusClass(): string {
    switch (task.status) {
      case 'pending':
        return 'status-pending';
      case 'progress':
        return 'status-progress';
      case 'completed':
        return 'status-completed';
      default:
        return '';
    }
  }

  // ✅ 格式化时间追踪信息（使用 TimeTrackerService）
  function formatTimeTracking(): string {
    if (!task.timeTracking) {
      return '';
    }
    // ✅ 使用 TimeTrackerService 的 formatDisplayText 方法，支持自定义模板
    return timeTrackerService.formatDisplayText(task, 'range');
  }

  // ✅ 格式化提醒时间
  function formatReminderTime(): string {
    if (!task.reminderTime) {
      return '';
    }
    return task.reminderTime.format('YYYY-MM-DD HH:mm');
  }

  // 处理 checkbox 点击
  function handleCheckboxClick(event: MouseEvent) {
    event.stopPropagation();
    onToggle(task);
  }

  // 处理任务项点击
  function handleTaskClick() {
    onClick(task);
  }
</script>

<div class="task-item" on:click={handleTaskClick} style="display: flex; align-items: center; gap: 8px;">
  <div class="task-checkbox" style="flex-shrink: 0; display: flex; align-items: center;">
    <input
      type="checkbox"
      checked={task.status === 'completed'}
      on:click={handleCheckboxClick}
      class="task-checkbox-input {getCheckboxClass()}"
      style="width: 16px; height: 16px; margin: 0;"
    />
  </div>
  
  <div class="task-content" style="flex: 1; min-width: 0;">
    <div class="task-text">{task.content}</div>
    
    <div class="task-meta">
      <!-- ✅ 可选：显示状态标签（如果不需要可以注释掉） -->
      <!-- <span class="task-status {getStatusClass()}">
        {getStatusText()}
      </span> -->
      
      {#if task.timeTracking}
        <span class="task-time-tracking">
          ⏱️ {formatTimeTracking()}
        </span>
      {/if}
      
      {#if task.reminderTime}
        <span class="task-reminder">
          🔔 {formatReminderTime()}
        </span>
      {/if}
      
      {#if task.tags && task.tags.length > 0}
        <span class="task-tags">
          {#each task.tags as tag}
            <span class="tag">#{tag}</span>
          {/each}
        </span>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .task-item {
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    min-height: 32px;

    &:hover {
      background-color: var(--background-modifier-hover);
    }
  }

  /* Checkbox 状态样式 */
  .checkbox-pending {
    opacity: 1;
  }

  .checkbox-progress {
    accent-color: var(--color-blue);  /* 进行中的 checkbox 显示蓝色 */
  }

  .checkbox-completed {
    accent-color: var(--color-green);  /* 已完成的 checkbox 显示绿色 */
    opacity: 0.6;  /* 稍微透明，表示已完成 */
  }

  .task-text {
    font-size: var(--font-ui-small);
    line-height: 1.4;
    color: var(--text-normal);
    word-break: break-word;
  }

  .task-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: var(--font-ui-smaller);
    margin-top: 2px;
  }

  .task-time-tracking,
  .task-reminder {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .task-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .tag {
    color: var(--color-accent);
    background-color: var(--color-accent-tint);
    padding: 1px 6px;
    border-radius: 3px;
    font-size: var(--font-ui-smaller);
  }
</style>
