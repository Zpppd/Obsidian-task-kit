---
name: quick-add-feature
description: 面板快捷添加任务功能的需求设计方案
metadata:
  type: project
  priority: p1
---

# 快捷添加任务功能（Quick Add）

## 概述
在任务面板顶部增加统一输入栏，同时支持搜索已有任务和快速添加新任务。参考 Obsidian-Memos 的插入逻辑和 obsidian-reminder 的日历弹窗实现。

## 两种工作模式
- **日记模式（默认）**: 点击 [+] 弹出日历弹窗选择日期，任务写入该日日记的 `## Tasks` 区域，格式为 `- [ ] 内容 (@日期)`
- **指定文件模式**: 点击 [+] 直接添加，任务写入指定文件（如 `Tasks/inbox.md`），不加日期标记

## 统一输入栏设计
```
📝 [输入新任务或搜索...                    ] [+] [全部]
```

## 插入逻辑（参考 Memos）
1. 查找目标标题 `## Tasks`（可配置）
2. 定位该区域末尾（下一个标题或文件末尾）
3. 清理多余空行后插入新任务行
4. 标题不存在时可选自动创建

## 关键参考项目
- Obsidian-Memos v1.9.7: `insertAfterHandler()` 定位插入逻辑
- obsidian-reminder: `DateTimeChooserModal` + `Calendar.svelte` 日历弹窗

## 设置项
| 设置 | 默认值 | 说明 |
|------|--------|------|
| 工作模式 | `daily-notes` | `daily-notes` / `specified-file` |
| 使用 Daily Notes 插件 | `true` | 日记模式定位文件 |
| 自定义目录模板 | `Daily/YYYY-MM-DD.md` | 不启用插件时使用 |
| 目标文件路径 | `Tasks/inbox.md` | 指定文件模式使用 |
| 插入位置标题 | `## Tasks` | 任务插入在此标题后 |
| 标题不存在时自动创建 | `true` | 找不到则创建 |
| 默认提醒时间 | `09:00` | 仅日期时默认时刻 |

## 相关文档
- [功能规格说明书](../../docs/06-快捷添加任务功能规格说明书.md)

**Why:** 用户需要在任务面板中直接创建新任务，支持日记流和收件箱两种工作流。
**How to apply:** 实现时保持三层架构，参考上述两个开源项目的实现模式。
