---
name: architecture-layers
description: 三层架构设计 — Parser(解析层) → Service(服务层) → View(视图层)
metadata: 
  node_type: memory
  type: reference
  originSessionId: 2596cad5-e1b1-4829-91f6-2e556fb6b166
---

# 三层架构设计

## 核心分层

```
main.ts (插件入口)
├── Parser 层
│   ├── TaskParser        — 主解析器，解析 Markdown 任务行
│   ├── ReminderParser    — 解析 (@时间) 提醒语法
│   └── TimeTrackerParser — 解析 (:时间) 追踪标记
│
├── Service 层
│   ├── TimeTrackerService  — 三态切换 + 时间追踪业务逻辑
│   ├── TaskManagerService  — 中心化任务数据管理、缓存、文件监听
│   │   └── extends Events  — 通过 'cache-updated' 事件通知订阅者
│   └── ReminderScheduler   — 定时器调度、到期通知分发
│
└── View 层
    ├── TaskPanelView (ItemView)   — 面板容器
    ├── TaskList.svelte            — 列表组件
    ├── TaskItem.svelte            — 任务项组件
    ├── FilterBar.svelte           — 筛选组件
    └── ReminderModal              — 提醒弹窗（原生 Modal）
```

## 设计原则

- **单一职责**: Parser 只解析、Service 只处理业务、View 只渲染
- **手术式更新**: TimeTrackerService 仅修改 checkbox 状态和时间标记，保留行内其他内容
- **事件驱动**: TaskManagerService 通过 Events 发布 'cache-updated'，View 层订阅
- **增量更新**: 文件修改触发单文件刷新，防抖 1 秒

**Why**: 架构清晰隔离关注点，利于扩展和 Bug 定位。
**How to apply**: 新增功能时遵循 "Parser 解析 → Service 处理 → View 渲染" 的流程，不要跨层调用。
