# Obsidian Task Master Pro - 功能规格说明书

> 📋 **项目定位**: 集成任务面板、智能提醒、时间追踪的综合性 Obsidian 任务管理系统
> 
> 🎯 **核心目标**: 整合三个独立插件的优势，打造一站式任务管理解决方案

---

## 📖 目录

1. [项目概述](#项目概述)
2. [核心功能模块](#核心功能模块)
3. [高优先级扩展功能](#高优先级扩展功能)
4. [技术架构](#技术架构)
5. [实现计划](#实现计划)
6. [用户使用指南](#用户使用指南)

---

## 项目概述

### 背景

当前工作区有三个独立的 Obsidian 插件：
- **checklist**: 全局任务面板，但无提醒功能
- **reminder**: 强大的日期提醒，但缺少任务视图
- **time-tracker**: 好用的时间追踪，但功能单一

### 整合价值

1. **统一入口**: 一个插件解决所有任务管理需求
2. **数据互通**: 任务状态、提醒时间、耗时统计无缝联动
3. **体验优化**: 避免多个插件冲突，减少配置复杂度

### 核心理念

- ✨ **简单优先**: 不增加用户负担，保持 Markdown 原生体验
- 🔔 **智能提醒**: 只在合适的时间提醒合适的任务
- ⏱️ **自动追踪**: 无感记录任务耗时，无需手动操作
- 📊 **可视化**: 列表 + 看板双视图，清晰掌握任务全貌

---

## 核心功能模块

### 模块一：任务解析引擎

#### 功能描述
从 Markdown 文件中智能识别和提取任务信息，是整个系统的数据基础。

#### 支持的任务格式

```
<!-- 基础格式 -->
- [ ] 普通任务
- [x] 已完成任务

<!-- 带标签 -->
- [ ] 写项目报告 #工作/文档 @重要

<!-- 带提醒时间 -->
- [ ] 晨会 (@2024-01-15 09:00)
- [ ] 提交周报 (@今天 17:00)

<!-- 进行中状态 -->
- [/] 代码审查 [开始：14:30]

<!-- 已完成 + 时间追踪 -->
- [x] 产品设计 [2024-01-15 10:00 - 11:30]

<!-- 组合使用 -->
- [ ] 准备演讲 (@明天 10:00) #工作/重要 @紧急
```

#### 元数据提取

每个任务提取以下信息：

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `id` | string | 唯一标识 | `file.md:15` |
| `status` | enum | 任务状态 | `pending` \| `progress` \| `completed` |
| `content` | string | 任务文本（清理标记后） | `写项目报告` |
| `tags` | string[] | 所有标签 | `['#工作/文档', '#重要']` |
| `reminderTime` | DateTime | 提醒时间 | `2024-01-15 09:00` |
| `timeTracking` | object | 时间追踪信息 | `{start: '14:30', end: '15:45'}` |
| `filePath` | string | 所在文件路径 | `journals/2024-01-15.md` |
| `lineNumber` | number | 行号（0-based） | `15` |

#### 特殊处理规则

✅ **重复任务模板识别**
- `_recurring-tasks/*.md` 中的任务视为模板
- 不直接显示在面板中
- 用于自动生成每日任务

✅ **已完成任务排除**
- 已完成任务的提醒时间不加入提醒队列
- 但仍显示在"已完成"看板列

✅ **标签层级解析**
- 支持 `#工作/项目/A 组` 多级标签
- 分隔符可配置（默认 `/`）

---

### 模块二：任务状态管理

#### 三态流转机制

```
stateDiagram-v2
    [*] --> Pending: 初始状态
    Pending --> Progress: 点击 checkbox
    Progress --> Completed: 再次点击
    Completed --> Pending: 回退（清除时间）
    
    note right of Pending
        - [ ]
        未开始
    end note
    
    note right of Progress
        - [/]
        [开始：HH:mm]
    end note
    
    note right of Completed
        - [x]
        [开始 - 结束]
    end note
```

#### 状态切换详情

**1. Pending → Progress（未开始 → 进行中）**

```
切换前：- [ ] 写报告
切换后：- [/] 写报告 [开始：14:30]

操作：
1. 状态改为 `/`
2. 追加 `[开始：当前时间]`
3. 触发面板刷新
```

**2. Progress → Completed（进行中 → 已完成）**

```
切换前：- [/] 写报告 [开始：14:30]
切换后：- [x] 写报告 [14:30 - 15:45]

操作：
1. 状态改为 `x`
2. 计算耗时：75 分钟
3. 替换为 `[开始时间 - 结束时间]` 格式
4. 可选：显示 AI 总结
```

**3. Completed → Pending（已完成 → 未开始 - 回退）**

```
切换前：- [x] 写报告 [14:30 - 15:45]
切换后：- [ ] 写报告

操作：
1. 状态改回 ` `（空格）
2. 清除所有时间标记
3. 清除提醒时间（可选配置）
4. 触发面板刷新
```

⚠️ **关键点**: 回退时必须完整清理时间标记，避免残留数据混乱。

#### 时间格式配置

用户可在设置中选择三种显示模式：

**模式 A: 起止时间**（默认）
```
- [x] 任务 [14:30 - 15:45]
```

**模式 B: 总耗时**
```
- [x] 任务 [⏱️ 75 分钟]
```

**模式 C: AI 总结**（需配置 API）
```
- [x] 任务 [📝 深度工作 1 小时 15 分]
```

---

### 模块三：日期提醒系统

#### 提醒触发条件

只有同时满足以下条件才会触发提醒：

```
interface ReminderCondition {
  hasReminderTag: true;      // ✅ 包含 (@日期时间)
  isNotCompleted: true;      // ✅ 状态不是 [x]
  timeIsExpired: true;       // ✅ 当前时间 >= 提醒时间
  notMuted: true;            // ✅ 未被静音
}
```

❌ **不提醒的情况**:
- 任务已完成（`- [x]`）
- 提醒时间未到
- 用户手动静音了该提醒
- 提醒已被处理过（防止重复弹窗）

#### 提醒执行流程

```
flowchart TD
    A[定时扫描 30s] --> B{获取过期提醒}
    B --> C{过滤已完成}
    C --> D{检查是否静音}
    D --> E[显示通知]
    E --> F{用户操作}
    
    F -->|标记完成 | G[改为 x 移除提醒]
    F -->|稍后提醒 | H[延后 N 分钟]
    F -->|静音 | I[不再提醒此条]
    F -->|打开文件 | J[跳转到任务行]
    
    G --> K[结束]
    H --> K
    I --> K
    J --> K
```

#### 通知方式

**方式 1: Obsidian 内部通知**（默认）

优点：
- 跨平台一致体验
- 模态对话框，强制用户注意
- 提供丰富操作按钮

实现：
```
new Notice(`⏰ 提醒：${task.content}`, 10000);
// 配合 Modal 显示详情和操作按钮
```

**方式 2: Windows 系统通知**（可选）

优点：
- 后台通知，不打断当前操作
- 即使 Obsidian  minimized 也能看到
- 符合系统通知规范

实现：
```
const Notification = require('electron').remote.Notification;
const notification = new Notification({
  title: 'Obsidian Reminder',
  body: task.content,
});
notification.show();
```

#### 稍后提醒预设

默认选项（用户可自定义）：

```
⏰ 稍后提醒...
├─ 5 分钟后
├─ 10 分钟后
├─ 30 分钟后
├─ 1 小时后
├─ 今天下午 17:00
├─ 明天 09:00
└─ 下周
```

---

### 模块四：任务面板视图

#### 侧边栏面板

**位置**: 默认右侧边栏（可拖动）

**访问方式**:
- 点击右侧边栏图标
- 命令面板：`Task Master: Open Panel`
- 快捷键：`Ctrl/Cmd + Shift + T`

#### 任务扫描目录白名单 ⭐ 新增

**功能描述**：
允许用户配置需要扫描任务的目录列表，实现精确控制哪些目录下的任务会出现在任务面板中。

**使用场景**：
- 知识库中有大量临时性、草稿性的任务列表，不希望出现在正式的任务管理面板中
- 只关注特定项目或工作流中的任务
- 提升性能：减少需要解析的文件数量

**配置方式**：
1. 打开设置 → Task Master Pro → "任务扫描设置"
2. 点击"+ 添加目录"按钮
3. 输入目录路径（相对于仓库根目录），例如：
   - `日记` - 扫描日记文件夹
   - `Projects/Tasks` - 扫描 Projects/Tasks 及其子目录
   - `Work/2024` - 扫描 Work/2024 及其子目录
4. 按回车或失去焦点自动保存

**工作原理**：
```
// 白名单检查逻辑
if (settings.scanDirectories.length > 0) {
  // 文件必须在白名单目录或其子目录中
  const isInWhitelist = settings.scanDirectories.some(dir => {
    return file.path.startsWith(dir + '/') || file.path === dir;
  });
  
  if (!isInWhitelist) {
    return true; // 跳过该文件
  }
}
```

**注意事项**：
- ✅ 白名单为空时，扫描所有目录（保持向后兼容）
- ✅ 支持递归子目录匹配（添加 `Projects` 会自动包含 `Projects/SubFolder`）
- ✅ 路径标准化处理（Windows `\` 和 Unix `/` 兼容）
- ❌ 不验证目录存在性（不存在的目录静默忽略）
- ❌ 实时去重检测（重复目录显示红色边框警告）

**与其他过滤共存**：
- 仍然会跳过隐藏文件（以 `.` 开头）
- 仍然会跳过系统文件夹（`.obsidian`, `.git`, `node_modules`）
- 白名单过滤优先级最高

---

#### 列表视图（默认）

**筛选器区域**:

```
┌──────────────────────────────────────┐
| 🔍 搜索：[输入关键字...]             |
|                                      |
| 📅 日期过滤器：                      |
| [今天 ▼] [明天] [本周] [全部] [过期] |
|                                      |
| 📁 文件过滤器：                      |
| [全部文件 ▼] [当前文件] [日记] [...] |
|                                      |
| 🏷️ 标签过滤器：                      |
| [#全部] [#工作] [#学习] [#生活] [+]  |
└──────────────────────────────────────┘
```

**任务列表区域**:

```
📅 今天 (2024-01-15) — 8 个任务
├─ 📄 日记/2024-01-15.md
│  ├─ ⏰ [ ] 晨间反思 (@09:00)     ← 已过时，红色高亮
│  ├─ ▶️  [/] 写项目报告 [开始：14:30]
│  ├─ ✓ [x] 回复邮件 [10:00 - 10:30]
│  └─ [ ] 下午站会 (@16:00) #工作/会议
│
├─ 📄 工作/项目计划.md
│  ├─ [ ] 需求评审 (@明天 10:00)
│  └─ [x] 技术方案 [已完成]
│
📅 明天 (2024-01-16) — 3 个任务
└─ ...
```

**任务项操作**:

| 操作 | 效果 |
|------|------|
| 点击 checkbox | 切换任务状态 |
| 右键任务 | 弹出菜单（编辑/删除/设置优先级/稍后提醒） |
| 双击任务 | 打开源文件并定位到该行 |
| 拖拽任务 | 调整顺序（需启用手动排序） |
| Hover 任务 | 显示操作按钮（编辑/完成/删除） |

#### 看板视图

**三列布局**:

```
┌────────────────┬────────────────┬────────────────┐
│   待 办        │   进行中       │   已完成       │
│   (12)         │   (3)          │   (8)          │
├────────────────┼────────────────┼────────────────┤
│ ┌────────────┐ │ ┌────────────┐ │ ┌────────────┐ │
│ │ [ ] 任务 1  │ │ │ [/] 任务 4  │ │ │ [x] 任务 7  │ │
│ │ #工作 ⏰9点│ │ │ #学习      │ │ │ #工作 ✓    │ │
│ └────────────┘ │ │ [开始：14:30]│ │ └────────────┘ │
│ ┌────────────┐ │ └────────────┘ │ ┌────────────┐ │
│ │ [ ] 任务 2  │ │ ┌────────────┐ │ │ [x] 任务 8  │ │
│ │ #生活      │ │ │ [/] 任务 5  │ │ │ #学习      │ │
│ └────────────┘ │ │ #工作/重要  │ │ └────────────┘ │
│ ...            │ │ [开始：15:00]│ │ ...          │
│                │ └────────────┘ │                │
└────────────────┴────────────────┴────────────────┘
```

**看板特性**:

✅ 拖拽卡片切换列 → 自动更新任务状态  
✅ 拖拽卡片调整顺序 → 保存排序位置  
✅ 点击卡片 → 编辑详情（标题、标签、提醒时间）  
✅ 列头数字 → 显示该列任务数量  
✅ 颜色边框 → 表示优先级（红/黄/灰）

---

## 高优先级扩展功能

### 模块五：标签与分类系统

#### 标签识别

自动提取任务中的所有 `#tag`:

```
- [ ] 任务文本 #工作/项目 #重要 @老板
```

提取结果：`['#工作/项目', '#重要', '@老板']`

#### 标签层级

支持嵌套标签结构：

```
#工作
├─ #工作/项目
│  ├─ #工作/项目/A 组
│  └─ #工作/项目/B 组
├─ #工作/会议
└─ #工作/文档
```

#### 多标签组合筛选

**与关系** (AND):
```
筛选器：#工作 #重要
结果：同时包含两个标签的任务
```

**或关系** (OR):
```
筛选器：#工作 OR #学习
结果：包含任一标签的任务
```

**非关系** (NOT):
```
筛选器：#工作 -#会议
结果：包含"工作"但不包含"会议"的任务
```

#### 快速筛选按钮

用户可配置常用标签按钮：

```
快速筛选：[全部] [🔥重要] [💼工作] [📚学习] [🏠生活] [🛒购物]
```

点击按钮立即筛选，再次点击取消。

#### 通过标签实现优先级

推荐标签约定（用户可自定义）：

| 标签 | 含义 | 看板边框颜色 |
|------|------|--------------|
| `#重要` `@紧急` | 高优先级 | 🔴 红色 |
| `#普通` | 中优先级 | 🟡 黄色 |
| 无标签 | 低优先级 | ⚪ 灰色 |

---

### 模块六：重复任务系统

#### 存储结构

```
vault/
├── _recurring-tasks/          # 重复任务模板目录
│   ├── daily-tasks.md         # 每日任务模板
│   ├── weekly-meetings.md     # 每周会议模板
│   └── monthly-review.md      # 每月复盘模板
│
├── journals/                  # 日记目录
│   ├── 2024-01-15.md
│   ├── 2024-01-16.md
│   └── ...
│
└── _templates/                # Daily Notes 模板（可选）
    └── daily-note-template.md
```

#### 模板文件格式

```
---
recurring:
  frequency: daily             # daily | weekly | monthly
  interval: 1                  # 每隔 N 个周期
  weekdays: [1, 3, 5]          # 每周几 (1=周一，仅 weekly 需要)
  dayOfMonth: 15               # 每月几号 (仅 monthly 需要)
  startDate: 2024-01-01        # 开始日期
  endDate: 2024-12-31          # 结束日期 (可选)
  targetFolder: journals       # 生成到哪个文件夹
  useTemplate: true            # 是否使用 Daily Notes 模板
---

## 每日任务模板

- [ ] 晨间反思 @早晨 #生活/健康
- [ ] 运动 30 分钟 #生活/健康
- [ ] 阅读 30 分钟 #学习
- [ ] 写日记 #复盘

## 每周会议

- [ ] 周一站会 (@09:00) #工作/会议
- [ ] 周三技术分享 (@15:00) #工作/学习
- [ ] 周五周报 (@17:00) #工作/文档

## 每月复盘

- [ ] 月度目标回顾 (@月初) #复盘
- [ ] 财务整理 (@月末) #生活
```

#### 自动生成逻辑

**触发时机**:

1. ✅ Obsidian 启动时
2. ✅ 切换到新日期的日记时
3. ✅ 手动刷新任务面板时
4. ⚙️ 每小时检查一次（可选配置）

**生成流程**:

```
flowchart TD
    A[当前日期：2024-01-15 周一] --> B[扫描模板文件夹]
    B --> C{遍历每个模板}
    C --> D{匹配重复规则}
    
    D -->|daily 每天 | E[✓ 应该生成]
    D -->|weekly 周一 | E
    D -->|monthly 15 号 | E
    D -->|不匹配 | F[✗ 跳过]
    
    E --> G[检查目标文件]
    G --> H{journals/2024-01-15.md 存在？}
    
    H -->|否 | I[创建文件<br/>使用 Daily 模板]
    H -->|是 | J[读取文件内容]
    
    I --> J
    J --> K{检查任务是否存在}
    
    K -->|已存在 | L[跳过该任务]
    K -->|不存在 | M[复制任务到文件]
    
    M --> N[记录生成日志]
    N --> O[下一个模板]
    
    L --> O
    O --> C
    
    C -->|所有模板处理完 | P[完成]
```

**关键问题解答**:

❓ **Q: 明天的日记还没创建，怎么添加任务？**

✅ **A: 采用"动态创建"策略**

1. 检测到重复任务需要添加到未来日期
2. 检查该日期的日记文件是否存在
3. 如果不存在：
   - 使用 Periodic Notes 的模板创建空白日记
   - 或者使用用户配置的默认模板
4. 将重复任务复制到新创建的日记中

这样确保**任务总有地方安放**，即使用户还没有创建那天的日记。

#### 逾期任务处理

**策略选择**（用户可在设置中选择）：

**策略 A: 保留在原日期**（推荐，默认）
```
昨天的任务留在昨天日记中（状态：未完成）
今天生成新的副本（状态：待办）
面板中昨天的任务标记为"逾期"（红色）
```

优点：
- 历史记录清晰，知道昨天确实没完成
- 数据不混乱，每天的任务独立

缺点：
- 需要手动处理昨天的逾期任务
- 可能积累很多逾期任务

**策略 B: 自动顺延**
```
检测昨天未完成的重复任务
自动复制到今天日记（状态：待办）
昨天的保留原样
```

优点：
- 不会遗漏任务
- 主动推送给用户

缺点：
- 昨天和今天都有相同任务，可能混淆
- 可能导致任务"永远做不完"的错觉

**策略 C: 合并显示**
```
面板中显示"逾期任务"分区
实际任务仍在昨天文件中
点击跳转到昨天日记
```

优点：
- 面板信息完整
- 数据一致性最好

缺点：
- 实现复杂
- 用户体验不够直观

**最终推荐**: **策略 A** + 面板显示"逾期"标记

---

### 模块七：统计面板（P2 低优先级）

#### 基础统计

**今日概览**:

```
📊 今日统计 (2024-01-15)
├─ 完成任务：8 / 12 (67%)
├─ 进行中：2
├─ 未完成：2
├─ 逾期：1
└─ 总耗时：4 小时 35 分钟
```

**周统计**:

```
📈 本周统计 (W3: Jan 15-21)
├─ 完成率趋势:
│   周一 ████████░░ 80%  (8/10)
│   周二 ██████░░░░ 60%  (6/10)
│   周三 █████████░ 90%  (9/10)
│   周四 ███████░░░ 70%  (7/10)
│   周五 ████░░░░░░ 40%  (4/10) ← Today
│
├─ 总完成任务：34
├─ 平均每天：6.8 个
└─ 总耗时：28 小时 30 分钟
```

#### 标签分布

```
🏷️ 标签分布（本周）
├─ #工作     ████████████ 25 个 (44%)
├─ #学习     ██████░░░░░░ 12 个 (21%)
├─ #生活     ████░░░░░░░░  8 个 (14%)
├─ #健康     ██░░░░░░░░░░  4 个 (7%)
└─ 其他      ███░░░░░░░░░  8 个 (14%)
```

#### 时间追踪 TOP5

```
⏱️ 耗时最长的任务（本周）

1. 写项目报告
   └─ 3 小时 20 分钟  (#工作/文档)

2. 代码审查
   └─ 2 小时 45 分钟  (#工作/技术)

3. 产品设计
   └─ 2 小时 10 分钟  (#工作/设计)

4. 客户会议
   └─ 1 小时 50 分钟  (#工作/会议)

5. 文档编写
   └─ 1 小时 30 分钟  (#工作/文档)
```

---

## 技术架构

### 核心类设计

```
// ========== 主插件入口 ==========
class TaskMasterProPlugin extends Plugin {
  // 核心服务
  taskParser: TaskParser;
  reminderManager: ReminderManager;
  timeTrackerService: TimeTrackerService;
  
  // 扩展功能
  recurringTaskEngine: RecurringTaskEngine;
  tagFilterService: TagFilterService;
  
  // 视图管理
  viewManager: ViewManager;
  settingsTab: SettingsTab;
  
  async onload() {
    // 初始化服务
    this.taskParser = new TaskParser(this);
    this.reminderManager = new ReminderManager(this);
    this.timeTrackerService = new TimeTrackerService(this);
    
    // 注册视图
    this.registerView(TASK_PANEL_VIEW, (leaf) => 
      new TaskPanelView(leaf, this)
    );
    
    // 注册命令
    this.addCommand({
      id: 'open-panel',
      name: 'Open Task Panel',
      callback: () => this.openPanel(),
    });
    
    // 启动定时任务
    this.startPeriodicTasks();
  }
}

// ========== 任务模型 ==========
interface Task {
  // 基础信息
  id: string;                    // 唯一标识：`${filePath}:${lineNumber}`
  file: TFile;                   // 所在文件对象
  line: number;                  // 行号（0-based）
  
  // 状态
  status: TaskStatus;            // pending | progress | completed
  content: string;               // 任务文本（不含标记）
  
  // 元数据
  tags: string[];                // 标签列表 ['#工作', '#重要']
  reminderTime?: DateTime;       // 提醒时间
  timeTracking?: TimeTracking;   // 时间追踪信息
  
  // 重复任务
  isRecurring?: boolean;         // 是否来自重复模板
  recurringRuleId?: string;      // 关联的重复规则 ID
  
  // 缓存（避免重复解析）
  originalLine: string;          // 原始行文本
  parsedAt: number;              // 最后解析时间戳
}

enum TaskStatus {
  Pending = 'pending',           // - [ ]
  Progress = 'progress',         // - [/]
  Completed = 'completed'        // - [x]
}

interface TimeTracking {
  startTime?: moment.Moment;     // 开始时间
  endTime?: moment.Moment;       // 结束时间
  durationMinutes?: number;      // 耗时（分钟）
  displayFormat?: string;        // 显示格式配置
}

// ========== 任务解析器 ==========
class TaskParser {
  // 解析单个文件
  async parseFile(file: TFile): Promise<Task[]> {
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    
    return lines
      .map((line, index) => this.parseLine(line, file, index))
      .filter(task => task !== null);
  }
  
  // 解析所有文件
  async parseAllFiles(): Promise<Map<TFile, Task[]>> {
    const files = this.app.vault.getMarkdownFiles();
    const result = new Map<TFile, Task[]>();
    
    for (const file of files) {
      const tasks = await this.parseFile(file);
      if (tasks.length > 0) {
        result.set(file, tasks);
      }
    }
    
    return result;
  }
  
  // 解析单行
  private parseLine(line: string, file: TFile, lineNum: number): Task | null {
    // 1. 检查是否是任务格式 - [ ]
    const taskMatch = line.match(/^(\s*-\s*\[)(.)(\]\s*)(.*)$/);
    if (!taskMatch) return null;
    
    const statusChar = taskMatch[2];
    const content = taskMatch[4];
    
    // 2. 提取状态
    const status = this.parseStatus(statusChar);
    
    // 3. 提取标签
    const tags = this.extractTags(content);
    
    // 4. 提取提醒时间
    const reminderTime = this.extractReminderTime(content);
    
    // 5. 提取时间追踪标记
    const timeTracking = this.extractTimeTracking(content);
    
    // 6. 清理内容（移除标签和提醒标记）
    const cleanContent = this.cleanContent(content);
    
    return {
      id: `${file.path}:${lineNum}`,
      file,
      line: lineNum,
      status,
      content: cleanContent,
      tags,
      reminderTime,
      timeTracking,
      originalLine: line,
      parsedAt: Date.now(),
    };
  }
}

// ========== 提醒管理器 ==========
class ReminderManager {
  private checkInterval: number;
  
  constructor(private plugin: TaskMasterProPlugin) {
    // 每 30 秒检查一次
    this.checkInterval = window.setInterval(
      () => this.checkExpiredReminders(),
      30000
    );
  }
  
  // 检查过期提醒
  private checkExpiredReminders() {
    const now = moment();
    const allTasks = this.plugin.taskParser.getAllTasks();
    
    // 过滤出需要提醒的任务
    const toRemind = allTasks.filter(task => 
      task.reminderTime &&                          // 有提醒时间
      task.status !== 'completed' &&               // 未完成
      task.reminderTime.isSameOrBefore(now) &&     // 时间已到
      !task.isMuted                                // 未静音
    );
    
    // 显示提醒
    toRemind.forEach(task => this.showReminder(task));
  }
  
  // 显示单个提醒
  private showReminder(task: Task) {
    // 标记为正在显示，防止重复弹窗
    task.isDisplaying = true;
    
    // 根据设置选择通知方式
    if (this.plugin.settings.useSystemNotification) {
      this.showSystemNotification(task);
    } else {
      this.showBuiltinModal(task);
    }
  }
  
  // 稍后提醒
  snooze(task: Task, minutes: number) {
    task.reminderTime = moment().add(minutes, 'minutes');
    task.isMuted = false;
    this.updateTaskInFile(task);
  }
  
  // 静音提醒
  mute(task: Task) {
    task.isMuted = true;
  }
}

// ========== 时间追踪服务 ==========
class TimeTrackerService {
  // 切换任务状态（核心方法）
  async toggleTaskStatus(task: Task) {
    switch (task.status) {
      case 'pending':
        return this.startTask(task);
      case 'progress':
        return this.completeTask(task);
      case 'completed':
        return this.resetTask(task);
    }
  }
  
  // 开始任务
  private async startTask(task: Task) {
    const now = moment();
    const timeStr = now.format('HH:mm');
    
    // 构建新行内容
    const newLine = `- [/] ${task.content} [开始：${timeStr}]`;
    
    // 写入文件
    await this.updateTaskLine(task, newLine);
    
    // 更新任务对象
    task.status = 'progress';
    task.timeTracking = {
      startTime: now,
      displayFormat: this.plugin.settings.timeFormat,
    };
  }
  
  // 完成任务
  private async completeTask(task: Task) {
    const now = moment();
    const startTime = task.timeTracking?.startTime;
    
    if (!startTime) {
      // 没有开始时间，直接使用当前时间
      await this.completeWithoutStart(task, now);
      return;
    }
    
    const startStr = startTime.format('HH:mm');
    const endStr = now.format('HH:mm');
    
    // 计算耗时
    const duration = now.diff(startTime, 'minutes');
    
    // 根据设置选择显示格式
    let timeMark: string;
    switch (this.plugin.settings.timeFormat) {
      case 'from-to':
        timeMark = `[${startStr} - ${endStr}]`;
        break;
      case 'total':
        timeMark = `[⏱️ ${duration}分钟]`;
        break;
      case 'ai':
        timeMark = await this.generateAISummary(task, duration);
        break;
    }
    
    const newLine = `- [x] ${task.content} ${timeMark}`;
    await this.updateTaskLine(task, newLine);
    
    task.status = 'completed';
    task.timeTracking.endTime = now;
    task.timeTracking.durationMinutes = duration;
  }
  
  // 重置任务（回退）
  private async resetTask(task: Task) {
    // 清除所有时间标记
    const cleanContent = task.content.replace(/\s*\[.*?\]$/, '');
    const newLine = `- [ ] ${cleanContent}`;
    
    await this.updateTaskLine(task, newLine);
    
    task.status = 'pending';
    task.timeTracking = undefined;
  }
}

// ========== 重复任务引擎 ==========
class RecurringTaskEngine {
  // 加载所有模板
  async loadTemplates(): Promise<RecurringTemplate[]> {
    const folder = this.plugin.settings.recurringTaskFolder;
    const files = await this.app.vault.getFolderByPath(folder);
    
    const templates: RecurringTemplate[] = [];
    for (const file of files.children) {
      if (file instanceof TFile && file.extension === 'md') {
        const template = await this.parseTemplate(file);
        if (template) {
          templates.push(template);
        }
      }
    }
    
    return templates;
  }
  
  // 为指定日期生成任务
  async generateForDate(date: moment.Moment) {
    const templates = await this.loadTemplates();
    const dateStr = date.format('YYYY-MM-DD');
    
    for (const template of templates) {
      // 检查该模板是否应该在今天生成
      if (!this.shouldGenerateToday(template, date)) {
        continue;
      }
      
      // 确定目标文件
      const targetFile = await this.getTargetFile(date);
      
      // 读取目标文件内容
      const content = await this.app.vault.read(targetFile);
      
      // 检查任务是否已存在
      const existingTasks = this.extractTasksFromContent(content);
      const newTasks = template.tasks.filter(
        task => !existingTasks.some(exist => exist.content === task.content)
      );
      
      // 添加新任务
      if (newTasks.length > 0) {
        const updatedContent = this.appendTasks(content, newTasks);
        await this.app.vault.modify(targetFile, updatedContent);
        
        // 记录生成日志
        this.logGeneration(template, date, newTasks.length);
      }
    }
  }
  
  // 检查是否应该今天生成
  private shouldGenerateToday(template: RecurringTemplate, date: moment.Moment): boolean {
    const rule = template.recurringRule;
    
    // 检查日期范围
    if (rule.startDate && date.isBefore(rule.startDate)) return false;
    if (rule.endDate && date.isAfter(rule.endDate)) return false;
    
    // 检查频率
    switch (rule.frequency) {
      case 'daily':
        return true; // 每天都生成
        
      case 'weekly':
        const weekday = date.weekday(); // 0=周日, 1=周一...
        return rule.weekdays?.includes(weekday);
        
      case 'monthly':
        return date.date() === rule.dayOfMonth;
    }
    
    return false;
  }
}
```

---

## 实现计划

### Phase 1: MVP（最小可行产品）- 2 周

**Week 1: 核心引擎**

| 任务 | 优先级 | 预计时间 | 说明 |
|------|--------|----------|------|
| 项目脚手架 | P0 | 4h | TypeScript + Svelte + Vite |
| TaskParser | P0 | 8h | 整合 checklist + reminder 解析逻辑 |
| TimeTrackerService | P0 | 6h | 三态切换核心逻辑 |
| 基础设置界面 | P0 | 4h | 基础配置项 UI |
| **小计** | | **22h** | |

**Week 2: 基础 UI**

| 任务 | 优先级 | 预计时间 | 说明 |
|------|--------|----------|------|
| TaskPanelView | P0 | 8h | 列表视图 + 筛选器 |
| ReminderManager | P0 | 6h | 提醒通知系统 |
| 标签提取 | P1 | 4h | 自动识别 #tag |
| 测试修复 | - | 4h | Bug 修复 + 优化 |
| **小计** | | **22h** | |

**交付物**: v0.1.0 Alpha  
**特点**: 可日常使用的基础功能

---

### Phase 2: 功能完善 - 2 周

**Week 3: 高级功能**

| 任务 | 优先级 | 预计时间 | 说明 |
|------|--------|----------|------|
| TaskBoardView | P1 | 10h | 看板视图（三列布局） |
| 拖拽功能 | P1 | 6h | dnd-kit 集成 |
| TagFilter | P1 | 6h | 多标签组合筛选 |
| 右键菜单 | P1 | 4h | 任务快捷操作 |
| **小计** | | **26h** | |

**Week 4: 重复任务**

| 任务 | 优先级 | 预计时间 | 说明 |
|------|--------|----------|------|
| RecurringTaskEngine | P1 | 8h | 重复任务核心逻辑 |
| 模板解析 | P1 | 4h | Frontmatter 解析 |
| 自动生成 | P1 | 6h | 定时检查 + 生成 |
| 统计面板基础版 | P2 | 4h | 简单文字统计 |
| **小计** | | **22h** | |

**交付物**: v0.2.0 Beta  
**特点**: 功能完整，可推广测试

---

### Phase 3: 稳定版 - 1 周

**Week 5: 优化发布**

| 任务 | 优先级 | 预计时间 | 说明 |
|------|--------|----------|------|
| 性能优化 | P0 | 8h | 虚拟滚动 + 防抖 |
| Bug 修复 | P0 | 8h | 收集反馈修复问题 |
| UX 优化 | P1 | 6h | 细节体验提升 |
| 文档编写 | P1 | 6h | README + 使用指南 |
| 社区测试 | - | 4h | 发布到论坛收集反馈 |
| **小计** | | **32h** | |

**交付物**: v1.0.0 Release  
**特点**: 生产就绪，稳定可靠

---

## 用户使用指南

### 快速开始（3 分钟上手）

#### 1. 安装与激活

1. 在 Obsidian 设置 → 第三方插件 → 浏览
2. 搜索 "Task Master Pro"
3. 点击安装并启用
4. 重启 Obsidian

#### 2. 打开任务面板

三种方式：
- 点击右侧边栏的 📋 图标
- 快捷键 `Ctrl/Cmd + Shift + T`
- 命令面板 `Ctrl/Cmd + P` → "Task Master: Open Panel"

#### 3. 创建第一个任务

在任意 Markdown 文件中输入：

```
- [ ] 买咖啡 (@10:00) #生活
```

任务会自动出现在面板中。

#### 4. 开始任务

点击任务前的 checkbox：

```
<!-- 点击后 -->
- [/] 买咖啡 [开始：09:30] #生活
```

#### 5. 完成任务

再次点击 checkbox：

```
<!-- 再次点击后 -->
- [x] 买咖啡 [09:30 - 09:45] #生活
```

自动记录耗时：15 分钟。

---

### 高级用法

#### 设置任务提醒

```
- [ ] 下午站会 (@今天 16:00) #工作/会议
- [ ] 提交周报 (@周五 17:00) #工作/重要
```

到点会自动弹窗提醒。

#### 使用标签分类

```
- [ ] 写项目报告 #工作/文档 @重要
- [ ] 看书 30 分钟 #学习
- [ ] 跑步 #生活/健康
```

在面板中点击标签按钮快速筛选。

#### 查看看板视图

点击面板右上角的 📊 图标，切换到看板视图：

```
┌──────────┬──────────┬──────────┐
│  待 办    │ 进行中    │ 已完成    │
│  (5)     │  (2)     │  (8)     │
├──────────┼──────────┼──────────┤
│ [ ] 任务  │ [/] 任务  │ [x] 任务  │
│ [ ] 任务  │ [/] 任务  │ [x] 任务  │
└──────────┴──────────┴──────────┘
```

拖拽卡片即可切换状态。

#### 配置重复任务

1. 创建文件 `_recurring-tasks/daily.md`
2. 输入以下内容：

```
---
recurring:
  frequency: daily
  targetFolder: journals
---

- [ ] 晨间反思 #生活
- [ ] 运动 30 分钟 #生活/健康
- [ ] 写日记 #复盘
```

每天早上自动出现在当天的日记中。

---

### 常见问题

**Q: 任务面板没有显示任务？**

A: 检查以下几点：
1. 任务格式是否正确（`- [ ]` 前后都要有空格）
2. 是否在筛选器中隐藏了该文件
3. 点击面板的刷新按钮
4. 检查任务是否被标签筛选过滤了
5. **检查是否配置了任务扫描白名单**：如果设置了白名单，只有白名单目录中的任务会显示

**Q: 如何配置任务扫描白名单？**

A: 白名单功能允许你精确控制哪些目录的任务会被扫描：
1. 打开设置 → Task Master Pro → "任务扫描设置"
2. 点击"+ 添加目录"按钮
3. 输入目录路径（相对于仓库根目录），例如：
   - `日记` - 只扫描日记文件夹
   - `Projects/Tasks` - 扫描 Projects/Tasks 及其子目录
4. 按回车自动保存
5. 刷新任务面板查看效果

**注意**：
- 白名单为空时，扫描所有目录
- 支持递归子目录匹配
- 不验证目录存在性（不存在的目录静默忽略）
- 重复目录会显示红色边框警告

**Q: 提醒没有按时触发？**

A: 可能的原因：
1. 任务已完成（已完成不提醒）
2. 提醒时间设置的是过去时间
3. 手动静音了该提醒
4. Obsidian 在后台运行，定时器不准（解决：重启 Obsidian）

**Q: 重复任务没有自动生成？**

A: 检查：
1. 模板文件的 Frontmatter 格式是否正确
2. `targetFolder` 路径是否正确
3. 今天的日记文件是否已存在
4. 查看开发者控制台是否有报错（`Ctrl/Cmd + Shift + I`）

**Q: 时间追踪标记格式不喜欢？**

A: 在设置中修改：
1. 打开设置 → Task Master Pro
2. 找到"时间追踪显示格式"
3. 选择喜欢的格式（起止时间 / 总耗时 / AI 总结）

---

### 最佳实践

#### 1. 标签体系建议

```
#工作
├─ #工作/项目
├─ #工作/会议
└─ #工作/文档

#学习
├─ #学习/课程
└─ #学习/阅读

#生活
├─ #生活/健康
├─ #生活/购物
└─ #生活/社交
```

保持 2-3 级即可，不要太复杂。

#### 2. 每日工作流

```
早上 09:00
├─ 打开任务面板
├─ 查看今天的任务
├─ 开始第一个任务
└─ 专注工作

中午 12:00
├─ 完成上午的任务
├─ 查看下午的安排
└─ 休息

下午 14:00
├─ 继续完成任务
├─ 处理临时插入的任务
└─ 更新任务状态

晚上 18:00
├─ 检查完成情况
├─ 未完成的任务安排到明天
└─ 写日记复盘
```

#### 3. 每周复盘

周末花 15 分钟：
1. 查看本周完成的任务
2. 统计完成率
3. 分析时间分配
4. 制定下周计划

---

## 附录

### A. 键盘快捷键

| 快捷键 | 功能 | 场景 |
|--------|------|------|
| `Ctrl/Cmd + Shift + T` | 打开任务面板 | 快速访问 |
| `Ctrl/Cmd + P` → "Refresh" | 刷新任务列表 | 手动刷新 |
| `Delete` | 删除选中任务 | 右键菜单后按 Delete |

### B. 配置文件位置

```
vault/.obsidian/plugins/task-master-pro/
├── data.json          # 用户配置
├── manifest.json      # 插件清单
└── main.js            # 插件代码
```

### C. 开发资源

- **GitHub 仓库**: https://github.com/your-name/task-master-pro
- **问题反馈**: https://github.com/your-name/task-master-pro/issues
- **讨论区**: https://forum.obsidian.md/c/plugins/

### D. 致谢

本项目整合了以下优秀插件的代码和思路：
- [obsidian-checklist-plugin](https://github.com/obhal/obsidian-checklist-plugin)
- [obsidian-reminder-plugin](https://github.com/uphy/obsidian-reminder)
- [time-tracker-plugin](https://github.com/...)

感谢原作者们的开源贡献！

---

**文档版本**: v1.0  
**最后更新**: 2024-01-15  
**维护者**: Task Master Pro Team

---

*如果您觉得这个插件有用，请给个 ⭐ Star 支持一下！*