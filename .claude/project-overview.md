---
name: project-overview
description: TaskMasterPro Obsidian插件项目概述：任务面板、时间追踪、提醒通知三合一
metadata: 
  node_type: memory
  type: project
  originSessionId: 2596cad5-e1b1-4829-91f6-2e556fb6b166
---

# Task Master Pro (TaskKit) — 项目概述

**定位**: Obsidian 插件，集成任务面板、智能提醒、时间追踪的综合任务管理系统。

## 功能模块

1. **任务面板** — 右侧边栏展示所有 Markdown 文件任务，支持按状态筛选、搜索、按文件分组。点击跳转到对应行。
2. **三态流转与时间追踪** — `[ ] → [/] → [x]` 三态切换，点击 checkbox 自动记录起止时间。支持自定义时间标记格式，如 `(:{start})`、`(:{start} - {end})`。可关闭时间追踪恢复原生行为。
3. **提醒通知** — `(@时间)` 语法设置提醒，支持 `(@2026-05-21 14:05)`、`(@14:00)`、`(@2026-05-21)` 三种输入。支持内置弹窗和系统通知，含标记完成、稍后提醒、静音、打开文件四个操作。

## 开发信息

- **语言**: TypeScript + Svelte 5 + Vite 8
- **依赖**: obsidian API, moment.js
- **插件ID**: `task-kit`, 名称: TaskKit
- **版本**: 0.1.0 (开发中)
- **作者**: HHH

## 项目状态

活跃开发中，已基本完成核心功能，处于 Bug 修复和优化阶段。

**Why**: 核心开发阶段需要快速理解项目全景。
**How to apply**: 处理任何新需求或 Bug 前，先确认影响的功能模块。
