<script lang="ts">
  import { App, Menu } from 'obsidian';
  import moment from 'moment';
  import type { Task } from '../../types/task';
  import type { TimeTrackerService } from '../../services/TimeTrackerService';
  import { DateTimeEditModal } from '../../modals/DateTimeEditModal';
  import type { TaskParser } from '../../parser/TaskParser';

  export let task: Task;
  export let onToggle: (task: Task) => void;
  export let onClick: (task: Task) => void;
  export let timeTrackerService: TimeTrackerService;
  export let app: App;
  export let taskParser: TaskParser;
  export let enableTimeTracking: boolean;
  export let reminderEnabled: boolean;
  export let onRefresh: () => void;

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

  // ✅ 进行中状态用 inline style 实现半填充（不依赖外部 CSS 加载时序）

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

  // 处理右键菜单
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const menu = new Menu();

    // ── 设置提醒时间（仅提醒开启时显示） ──
    if (reminderEnabled) {
      menu.addItem(item => {
        item.setTitle('设置提醒时间')
          .setIcon('bell')
          .onClick(() => {
            new DateTimeEditModal(
              app, task, 'reminder',
              timeTrackerService, taskParser,
              () => setTimeout(onRefresh, 200),
            ).open();
          });
      });
    }

    // ── 修改追踪时间（仅时间追踪开启时显示） ──
    if (enableTimeTracking) {
      menu.addItem(item => {
        item.setTitle('修改追踪时间')
          .setIcon('clock')
          .onClick(() => {
            new DateTimeEditModal(
              app, task, 'tracking',
              timeTrackerService, taskParser,
              () => setTimeout(onRefresh, 200),
            ).open();
          });
      });

      // ── 完成任务（非 completed 状态时显示） ──
      if (task.status !== 'completed') {
        menu.addItem(item => {
          item.setTitle('完成任务')
            .setIcon('checkmark')
            .onClick(async () => {
              try {
                await timeTrackerService.completeTaskWithoutTracking(task);
                onRefresh();
              } catch (error) {
                console.error('[TaskKit] Failed to complete task without tracking:', error);
              }
            });
        });
      }
    }

    menu.showAtMouseEvent(event);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="task-item" on:click={handleTaskClick} on:contextmenu={handleContextMenu} on:keydown={(e) => { if (e.key === 'Enter') handleTaskClick(); }} role="button" tabindex="0" style="display: flex; align-items: center; gap: 8px;">
  <div class="task-checkbox" style="flex-shrink: 0; display: flex; align-items: center;">
    {#if task.status === 'progress'}
      <!-- 进行中：用 span 代替 input，避免 Electron 对 checkbox 上 appearance:none 的渲染 bug -->
      <span
        class="task-checkbox-progress"
        on:click={handleCheckboxClick}
        role="checkbox"
        aria-checked="false"
        aria-label="进行中"
        tabindex="0"
        on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(task); } }}
      ></span>
    {:else}
      <input
        type="checkbox"
        checked={task.status === 'completed'}
        on:click={handleCheckboxClick}
        class="task-checkbox-input {getCheckboxClass()}"
        style="width:16px;height:16px;margin:0;cursor:pointer"
      />
    {/if}
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

  /* Checkbox 状态样式
   * - pending/completed: 原生 <input type="checkbox">
   * - progress: <span> 模拟，避免 Electron 对 input 上 appearance:none 的渲染 bug
   */
  .task-checkbox-input {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
    flex-shrink: 0;
  }

  .checkbox-pending {
    opacity: 1;
  }

  .checkbox-completed {
    accent-color: var(--color-green);
    opacity: 0.6;
  }

  /* 进行中：span 模拟 checkbox，左半填充渐变 */
  .task-checkbox-progress {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--interactive-accent);
    border-radius: var(--checkbox-radius, 4px);
    background: linear-gradient(
      to right,
      var(--interactive-accent) 50%,
      transparent 50%
    );
    cursor: pointer;
    flex-shrink: 0;
    box-sizing: border-box;

    &:hover {
      border-color: var(--interactive-accent-hover, var(--interactive-accent));
      box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb, 0, 122, 255), 0.2);
    }
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
