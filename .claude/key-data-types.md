---
name: key-data-types
description: 核心类型定义 — Task、PluginSettings、TaskFilter、TimeTracking
metadata: 
  node_type: memory
  type: reference
  originSessionId: 2596cad5-e1b1-4829-91f6-2e556fb6b166
---

# 核心类型定义

## Task (task.ts)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 `${filePath}:${lineNumber}` |
| file | TFile | 所在文件对象 |
| line | number | 行号 (0-based) |
| status | TaskStatus | 'pending' \| 'progress' \| 'completed' |
| content | string | 任务文本（不含标记） |
| tags | string[] | 标签列表 |
| reminderTime | moment.Moment | 提醒时间 |
| timeTracking | TimeTracking | 时间追踪信息 |
| isRecurring | boolean | 是否来自重复模板 |
| originalLine | string | 原始行文本 |
| indentation | string | 缩进和前缀 |
| isMuted | boolean | 是否静音（UI 状态） |

## PluginSettings (settings.ts)

- `enableTimeTracking` — 是否启用时间追踪
- `timeTracking.progressTemplate` — 进行中模板 (默认 `(:{start})`)
- `timeTracking.completedTemplate` — 已完成模板 (默认 `(:{start} - {end})`)
- `scanDirectories` — 扫描目录白名单
- `reminder.enabled` — 启用提醒
- `reminder.remindOnProgress` — 提醒进行中任务
- `reminder.snoozePresets` — 稍后提醒预设 [5,10,30,60]
- `reminder.defaultReminderTime` — 默认提醒时间 "09:00"

## TaskFilter

- `searchText`, `status`, `filePath`, `tags`, `dateFilter`

## TimeTracking

- `startTime`, `endTime`, `durationMinutes`, `displayFormat`, `usedTemplate`

**Why**: 理解类型定义是修改代码的前提。
**How to apply**: 修改或新增功能时参考已有类型定义，保持一致性。
