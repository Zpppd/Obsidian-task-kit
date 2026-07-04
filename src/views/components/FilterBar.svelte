<script lang="ts">
  export let searchText: string = '';
  export let statusFilter: 'all' | 'pending' | 'progress' | 'completed' | 'incomplete' = 'all';

  // 定义事件派发器
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    dispatch('filter-change', {
      type: 'search',
      value: target.value
    });
  }

  function handleStatusChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    dispatch('filter-change', {
      type: 'status',
      value: target.value
    });
  }
</script>

<div class="filter-bar">
  <div class="filter-search">
    <input
      type="text"
      placeholder="搜索任务..."
      value={searchText}
      on:input={handleSearchInput}
      class="search-input"
    />
  </div>

  <div class="filter-status">
    <select value={statusFilter} on:change={handleStatusChange} class="status-select">
      <option value="all">全部状态</option>
      <option value="pending">待办</option>
      <option value="progress">进行中</option>
      <option value="completed">已完成</option>
      <option value="incomplete">未完成</option>
    </select>
  </div>
</div>

<style lang="scss">
  .filter-bar {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--background-modifier-border);
    background-color: var(--background-secondary);
  }

  .filter-search {
    flex: 1;
  }

  .search-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background-color: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small);

    &:focus {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 2px var(--color-accent-tint);
    }

    &::placeholder {
      color: var(--text-muted);
    }
  }

  .filter-status {
    flex-shrink: 0;
  }

  .status-select {
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background-color: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    cursor: pointer;

    &:focus {
      outline: none;
      border-color: var(--color-accent);
    }
  }
</style>