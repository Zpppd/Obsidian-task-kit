# 📋 Task Master Pro

> **Obsidian 一站式任务管理系统**  
> 集成任务面板、智能提醒、时间追踪于一个强大的插件

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/your-name/task-master-pro/releases)
[![Obsidian](https://img.shields.io/badge/Obsidian-v1.4+-purple)](https://obsidian.md)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## ✨ 特性亮点

### 🎯 核心功能

- **📊 任务面板**: 全局视图查看所有任务，支持列表和看板两种模式
- **⏰ 智能提醒**: 到期自动弹窗提醒，支持 Obsidian 通知和 Windows 系统通知
- **⏱️ 时间追踪**: 自动记录任务开始/结束时间，统计耗时
- **🏷️ 标签管理**: 多级标签分类，组合筛选，快速定位任务
- **🔄 重复任务**: 模板化配置，自动生成每日/每周/每月任务

### 🚀 独特优势

1. **三态切换**: `- [ ]` → `- [/]` → `- [x]`，清晰掌握任务进度
2. **无感追踪**: 点击 checkbox 自动记录时间，无需手动操作
3. **智能过滤**: 按日期、文件、标签多维度筛选
4. **可视化**: 看板视图拖拽管理任务状态
5. **高度可配**: 所有功能都可根据个人习惯定制

---

## 📦 安装

<!-- ### 方式一：社区插件市场（推荐）

1. 打开 Obsidian 设置
2. 进入 **第三方插件** → **浏览**
3. 搜索 **"Task Master Pro"**
4. 点击 **安装**，然后启用 -->

### 方式二：手动安装

1. 从 [Releases](https://github.com/your-name/task-master-pro/releases) 下载最新版
2. 解压到 `vault/.obsidian/plugins/` 目录
3. 在 Obsidian 设置中启用插件

---

## 🎯 快速上手

### 1️⃣ 打开任务面板

- 快捷键：`Ctrl/Cmd + Shift + T`
- 或点击右侧边栏的 📋 图标

### 2️⃣ 创建任务

在任意 Markdown 文件中输入：

```
- [ ] 买咖啡 (@10:00) #生活
- [ ] 写项目报告 (@今天 14:00) #工作/重要
- [ ] 下午站会 (@16:00) #工作/会议
```

### 3️⃣ 管理任务

**开始任务** → 点击 checkbox  
```
- [/] 写项目报告 (:14:30)
```

**完成任务** → 再次点击  
```
- [x] 写项目报告 (:14:30 - 15:45)
```

自动记录耗时：**75 分钟**

### 4️⃣ 查看提醒

到点自动弹窗：
```
⏰ 提醒：下午站会
📄 日记/2024-01-15.md
[@16:00]

[标记完成] [稍后提醒] [静音] [打开文件]
```

---

## 📖 详细文档

请查看 [`docs/FUNCTIONAL_SPECIFICATION.md`](docs/FUNCTIONAL_SPECIFICATION.md) 了解：

- ✅ 完整功能说明
- ✅ 高级用法指南
- ✅ 配置选项详解
- ✅ 最佳实践建议
- ✅ 常见问题解答

---

## 🎨 使用示例

### 列表视图

```
┌──────────────────────────────────────┐
| 🔍 搜索：[项目...]                   |
| 📅 日期：[今天 ▼]                    |
| 🏷️ 标签：[#工作] [#重要]            |
├──────────────────────────────────────┤
| 📅 今天 (2024-01-15)                 |
| ├─ 📄 日记/2024-01-15.md             |
| │  ├─ ⏰ [ ] 晨会 (@09:00)           |
| │  ├─ ▶️  [/] 写报告 (:14:30)       |
| │  └─ ✓ [x] 回复邮件 (:10:00-10:30) |
| └─ 📄 工作/项目.md                   |
│    └─ [ ] 需求评审 (@明天 10:00)     |
└──────────────────────────────────────┘
```

### 看板视图

```
┌──────────────┬──────────────┬──────────────┐
│  待 办       │  进行中      │  已完成      │
│  (12)        │  (3)         │  (8)         │
├──────────────┼──────────────┼──────────────┤
│ - [ ] 任务 1  │ - [/] 任务 4  │ - [x] 任务 7  │
│ - [ ] 任务 2  │ - [/] 任务 5  │ - [x] 任务 8  │
│ - [ ] 任务 3  │ - [/] 任务 6  │              │
└──────────────┴──────────────┴──────────────┘
```

### 重复任务模板

创建 `_recurring-tasks/daily.md`:

```
---
recurring:
  frequency: daily
  targetFolder: journals
---

## 每日任务

- [ ] 晨间反思 #生活/健康
- [ ] 运动 30 分钟 #生活/健康
- [ ] 阅读 30 分钟 #学习
- [ ] 写日记 #复盘
```

每天早上自动出现在日记中。

---

## ⚙️ 配置选项

在 **设置** → **Task Master Pro** 中可配置：

### 常规设置
- [x] 自动刷新任务面板
- [x] 刷新间隔：30 秒
- [x] 默认视图模式：列表 / 看板

### 提醒设置
- [x] 启用提醒：是
- [x] 检查间隔：30 秒
- [x] 使用系统通知：否
- [x] 稍后提醒预设：5 分钟、10 分钟、30 分钟...

### 时间追踪
- [x] **启用时间追踪与三态流转**：控制是否开启高级任务管理功能
  - ✅ **开启时**：支持 `[ ]` → `[/]` → `[x]` 三态流转，自动记录时间
  - ❌ **关闭时**：使用 Obsidian 原生二态切换 `[ ]` ↔ `[x]`
- [x] 时间标记格式配置（仅在功能开启时显示）
  - 进行中状态模板：默认 `(:{start})`
  - 已完成状态模板：默认 `(:{start} - {end})`
- [x] 显示格式：起止时间 / 总耗时 / AI 总结
- [x] AI API 配置（仅 AI 总结需要）

⚠️ **注意**：关闭时间追踪功能后，之前已存在的时间标记仍会被正确解析和显示，但不会再添加新的时间标记。

### 重复任务
- [x] 模板文件夹：`_recurring-tasks`
- [x] 日记文件夹：`journals`
- [x] 自动生成时机：启动时 / 切换日期时

### 标签筛选
- [x] 快速筛选按钮：`#工作` `#学习` `#生活`
- [x] 优先级标签映射：`#重要` = 高优先级

---

## 🔧 开发指南

### 环境要求

- Node.js >= 18
- npm >= 9
- Obsidian >= 1.4

### 本地开发

```
# 克隆项目
git clone https://github.com/your-name/task-master-pro.git
cd task-master-pro

# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run type-check

# 代码格式化
npm run lint
```

### 项目结构

```
task-master-pro/
├── src/
│   ├── main.ts              # 插件入口
│   ├── types/               # TypeScript 类型定义
│   ├── parser/              # 任务解析器
│   ├── services/            # 业务逻辑服务
│   ├── views/               # 视图组件
│   ├── ui/                  # UI 组件
│   └── settings/            # 设置界面
├── styles/
│   └── main.css             # 样式文件
├── docs/                    # 文档目录
├── manifest.json            # 插件清单
├── package.json             # 依赖配置
└── tsconfig.json            # TS 配置
```

---

## 🗺️ 路线图

### v0.1.0 Alpha（当前版本）
- ✅ 任务面板列表视图
- ✅ 三态切换 + 时间追踪
- ✅ 日期提醒系统
- ✅ 基础标签筛选

### v0.2.0 Beta（开发中）
- 🚧 看板视图
- 🚧 拖拽功能
- 🚧 多标签组合筛选
- 🚧 重复任务系统

### v1.0.0 Release（计划中）
- ⏳ 性能优化
- ⏳ 统计面板
- ⏳ 移动端适配
- ⏳ 主题定制

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献方式

1. **报告 Bug**: [GitHub Issues](https://github.com/your-name/task-master-pro/issues)
2. **功能建议**: [Discussions](https://github.com/your-name/task-master-pro/discussions)
3. **代码贡献**: [Pull Requests](https://github.com/your-name/task-master-pro/pulls)
4. **文档改进**: 帮助完善文档和翻译

### 开发规范

- 遵循 ESLint 规则
- 编写单元测试
- 更新相关文档
- Commit message 清晰规范

---

## 🙏 致谢

本项目整合了以下优秀插件的代码和思路：

- **[obsidian-checklist-plugin](https://github.com/obhal/obsidian-checklist-plugin)** - 任务面板灵感来源
- **[obsidian-reminder-plugin](https://github.com/uphy/obsidian-reminder)** - 提醒功能核心逻辑
- **[time-tracker-plugin](https://github.com/...)** - 时间追踪实现参考

感谢原作者们的开源精神！

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 📬 联系方式

- **GitHub**: [@your-name](https://github.com/your-name)
- **Twitter**: [@your-handle](https://twitter.com/your-handle)
- **Obsidian Forum**: [用户主页](https://forum.obsidian.md/u/your-name)

---

## 💖 支持项目

如果您觉得这个插件有用，可以通过以下方式支持：

1. ⭐ **Star 这个项目** - 在 GitHub 上给个 Star
2. 📢 **推荐给朋友** - 分享给需要的同事或朋友
3. 💻 **贡献代码** - 提交 Bug 报告或功能建议
4. ☕ **赞助开发** - （未来会开放 Sponsor 链接）

---

**Made with ❤️ by Task Master Pro Team**

*Last Updated: 2024-01-15*
