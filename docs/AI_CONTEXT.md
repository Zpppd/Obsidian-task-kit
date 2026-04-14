# AI 协作上下文指南

> 🎯 **目标**: 帮助AI更好地理解项目架构，提前识别潜在问题  
> 📅 **最后更新**: 2026-04-13

---

## 📖 如何使用本文档

当你向AI提出新功能需求时，请：

1. **引用相关文档**：提及 `FUNCTIONAL_SPECIFICATION.md`、`IMPLEMENTATION_PRIORITY.md` 等
2. **说明当前架构**：参考下方的"当前架构概览"
3. **明确扩展需求**：说明未来可能需要的功能
4. **要求架构评估**：让AI分析是否存在架构问题

---

## 🏗️ 当前架构概览

### **核心组件**

```
main.ts (插件入口)
├─ TaskParser (解析服务)
│   ├─ parseFile(file): 解析单个文件
│   ├─ parseAllFiles(): 解析所有文件
│   └─ shouldSkipFile(file): 判断是否跳过文件 ⭐ 公共方法
│
├─ TimeTrackerService (时间追踪服务)
│   ├─ toggleTaskStatus(task): 切换任务状态
│   └─ formatDisplayText(task): 格式化显示文本
│
├─ TaskManagerService (任务管理服务) ⭐ 计划中
│   ├─ loadAllTasks(): 加载所有任务
│   ├─ refreshSingleFile(file): 增量更新
│   └─ getTasksByStatus(status): 按状态查询
│
└─ TaskPanelView (列表视图)
    ├─ loadTasks(): 加载任务 → 调用 TaskManagerService
    ├─ handleFileModify(file): 文件变化监听
    └─ Svelte组件渲染
```

### **关键设计原则**

1. **单一职责**：
   - TaskParser 只负责解析，不负责UI
   - TaskPanelView 只负责显示，不负责业务逻辑
   - TaskManagerService 负责任数据管理（未来）

2. **依赖方向**：
   ```
   视图层 → 服务层 → 工具层
   (Views)  (Services) (Utils)
   ```

3. **数据流**：
   ```
   文件 → TaskParser.parseFile() → Task对象 → TaskManagerService缓存 → 视图渲染
   ```

---

## 🚀 未来扩展需求（来自 IMPLEMENTATION_PRIORITY.md）

### **Phase 2: 增强版（2周内）**

| 功能 | 对架构的影响 | 需要提前准备什么 |
|------|-------------|----------------|
| 看板视图 | 需要按状态分组任务 | TaskManagerService.getTasksByStatus() |
| 多标签筛选 | 需要高效标签查询 | TaskManagerService.getTasksByTags() |
| 右键菜单 | 需要任务编辑接口 | TimeTrackerService.updateTask() |

### **Phase 3: 稳定版（1个月内）**

| 功能 | 对架构的影响 | 需要提前准备什么 |
|------|-------------|----------------|
| 统计面板 | 需要聚合计算 | TaskManagerService.getStatistics() |
| 全文搜索 | 需要倒排索引 | TaskManagerService.searchTasks() |
| 批量操作 | 需要事务管理 | TaskManagerService.batchUpdate() |

---

## ⚠️ 常见架构陷阱

### **陷阱1：在视图层实现业务逻辑**

**错误示例** ❌：
```
// TaskPanelView.ts
private shouldSkipFile(file: TFile): boolean {
  // 实现了与 TaskParser 相同的逻辑
  if (file.name.startsWith('.')) return true;
  // ...
}
```

**正确做法** ✅：
```
// TaskPanelView.ts
async loadTasks(): Promise<void> {
  const validFiles = files.filter(file => !this.taskParser.shouldSkipFile(file));
  // ...
}
```

**原因**：避免代码重复，确保逻辑一致性

---

### **陷阱2：硬编码配置**

**错误示例** ❌：
```
const skipFolders = ['.obsidian', '.git', 'node_modules'];
```

**正确做法** ✅：
```
const settings = this.getSettings();
if (settings.scanDirectories.length > 0) {
  // 使用配置
}
```

**原因**：提高可配置性，便于测试

---

### **陷阱3：忽视缓存和性能**

**错误示例** ❌：
```
// 每次都重新解析所有文件
async filterTasks() {
  const allTasks = await this.parseAllFiles();
  return allTasks.filter(...);
}
```

**正确做法** ✅：
```
// 使用缓存
async filterTasks() {
  const allTasks = this.taskManagerService.getAllTasksFromCache();
  return allTasks.filter(...);
}
```

**原因**：避免重复I/O操作，提升性能

---

## 💡 AI协作最佳实践

### **1. 提供完整上下文**

**不好的提示** ❌：
```
请帮我实现白名单功能。
```

**好的提示** ✅：
```
背景：
- 当前 TaskParser 和 TaskPanelView 都有 shouldSkipFile() 方法（代码重复）
- 未来计划创建 TaskManagerService 统一管理任务数据
- 参考文档：IMPLEMENTATION_PRIORITY.md 中的 P1/P2 功能

需求：
实现白名单功能，允许用户配置需要扫描的目录

要求：
1. 考虑到未来的架构升级
2. 避免在 TaskPanelView 中实现独立的过滤逻辑
3. 优先使用 TaskParser 的统一接口

请分析：
- 这个实现是否会引入新的架构问题？
- 是否需要提前创建 TaskManagerService？
```

---

### **2. 要求架构评估**

在任务结束时，要求AI回答：

```
请评估本次实现：
1. 是否引入了新的代码重复？
2. 是否与未来扩展需求冲突？
3. 是否需要立即重构或可以延后？
4. 有哪些技术债务需要注意？
```

---

### **3. 分阶段确认**

对于复杂任务，采用分阶段确认：

```
我们将分3个阶段实施：

阶段1：创建 TaskManagerService 基础框架
- 请先实现这个，我确认后再继续

阶段2：迁移 TaskPanelView 使用新服务
- 等待阶段1确认后开始

阶段3：测试和优化
- 等待阶段2确认后开始
```

---

## 📝 架构决策记录（ADR）模板

当做出重要架构决策时，使用以下模板：

```
# ADR-XXX: [决策标题]

## 状态
[提议/已接受/已拒绝/已废弃]

## 背景
[描述问题和上下文]

## 决策
[描述做出的决策]

## 后果
### 优点
- ...

### 缺点
- ...

## 替代方案
[考虑过的其他方案及为何不选择]

## 相关链接
- [链接到相关文档或讨论]
```

---

## 🚀 新对话快速上手指南

### **标准提示词模板**

在新开对话时，使用以下模板让AI快速了解项目：

```
# 项目背景
我正在开发 "Task Master Pro" - 一个 Obsidian 任务管理插件。

# 技术栈
- TypeScript + Svelte 4+ + Vite
- Obsidian Plugin API

# 当前架构（三层设计）
```
视图层 (Views)
  └─ TaskPanelView.ts (纯UI渲染)

服务层 (Services) ⭐核心层
  ├─ TaskManagerService.ts (统一数据管理、缓存、增量更新)
  └─ TimeTrackerService.ts (时间追踪、三态切换)

工具层 (Utils)
  ├─ TaskParser.ts (纯解析器，shouldSkipFile已改为public)
  ├─ ReminderParser.ts
  └─ TimeTrackerParser.ts
```

# 刚完成的工作
- ✅ 引入 TaskManagerService，消除代码重复
- ✅ TaskPanelView 简化为纯视图层（减少~100行）
- ✅ 文件监听集中到服务层

# 开发规范（必须遵守）
1. **Git操作**：严禁自动执行 git commit/push
2. **复杂任务**：先分析→列计划→等确认→再执行
3. **架构原则**：
   - 视图层只负责UI，业务逻辑在服务层
   - 工具层只做纯函数式解析
   - 禁止在视图层实现 shouldSkipFile 等业务逻辑
4. **Svelte规范**：
   - 使用 mount/unmount API
   - 通过 Props 注入服务（如 TimeTrackerService）
   - 样式注释用 /* */，禁止 //
5. **类型安全**：访问嵌套属性前做空值检查

# 当前需求
[在这里描述你的具体需求]

# 参考资料
- docs/AI_CONTEXT.md（本文档）
- docs/FUNCTIONAL_SPECIFICATION.md（功能需求）
```

---

### **关键记忆点**

AI需要记住的核心概念：

1. **TaskManagerService 是数据唯一入口**
   ```typescript
   // ✅ 正确
   const tasks = await this.taskManagerService.loadAllTasks();
   
   // ❌ 错误
   const files = this.app.vault.getMarkdownFiles();
   const tasks = await Promise.all(files.map(f => this.taskParser.parseFile(f)));
   ```

2. **TaskParser.shouldSkipFile() 是公共方法**
   ```typescript
   // ✅ 正确
   if (this.taskParser.shouldSkipFile(file)) return;
   
   // ❌ 错误：不要自己实现过滤逻辑
   if (file.name.startsWith('.')) return;
   ```

3. **Svelte组件必须通过Props注入服务**
   ```typescript
   // ✅ 正确
   mount(TaskList, {
     props: { timeTrackerService: this.timeTrackerService }
   });
   
   // ❌ 错误：不要在组件内硬编码
   const service = new TimeTrackerService(...);
   ```

4. **文件监听已在 TaskManagerService 内部处理**
   ```typescript
   // ✅ 正确：视图层无需关心
   this.tasks = this.taskManagerService.getAllTasksFromCache();
   
   // ❌ 错误：不要重新注册监听器
   this.app.vault.on('modify', ...);
   ```

---

### **常见问题速查**

| 问题 | 解决方案 |
|------|---------|
| 如何获取所有任务？ | `taskManagerService.loadAllTasks()` |
| 如何按状态筛选？ | 从缓存获取后在前端过滤（Phase 2会提供API） |
| 如何实现看板视图？ | 创建新 View，调用 `taskManagerService.getAllTasksFromCache()` |
| 文件修改后如何同步？ | TaskManagerService 自动监听并更新缓存 |
| 如何避免代码重复？ | 检查 TaskParser 和 TaskManagerService 是否已有类似方法 |

---

## 🤝 AI协作决策规范（重要）

> ⚠️ **核心原则**：AI是辅助工具，用户是决策者。严禁擅自决定技术方案或实现细节。

### **1. 发现问题时的处理流程**

当发现架构问题、技术债务或潜在风险时，必须遵循以下流程：

```
发现问题 → 分析根因 → 提供多方案对比 → 等待用户确认 → 执行选定方案
```

**禁止行为** ❌：
- 擅自选择临时方案而非根本解决方案
- 自行决定具体实现细节（如标识符、配置项名称等）
- 在未征得用户同意的情况下实施架构调整

**正确做法** ✅：
- 清晰说明问题的根本原因
- 提供至少2个可行方案（包括优缺点、工作量、风险）
- 明确推荐方案及理由
- 等待用户明确指示后再执行

---

### **2. 方案对比模板**

提供方案时，使用以下格式：

```
## 问题分析
[清晰描述问题及其影响]

## 解决方案

### 方案A：[方案名称]（推荐/不推荐）
**实现方式**：
- [简要说明实现步骤]

**优点**：
- ✅ ...
- ✅ ...

**缺点**：
- ❌ ...
- ❌ ...

**工作量**：约 X 小时
**风险等级**：低/中/高

### 方案B：[方案名称]
...

### 方案C：[方案名称]
...

## 我的建议
推荐方案 [X]，理由是：[具体原因]

## 请您决策
请告诉我您的选择：A / B / C，或者提出其他想法。
```

---

### **3. 用户体验相关决策**

对于涉及用户体验的细节（如符号、格式、交互方式），必须主动询问用户偏好：

**示例场景**：

#### **场景1：选择特殊标识符**
❌ **错误做法**：
```
我将使用 ⏰ 作为时间标记的前缀标识符。
// 直接实施
```

✅ **正确做法**：
```
关于前缀标识符，我有以下选项供您选择：

选项1：ASCII字符（键盘友好）
  - [T 14:30] 或 [#time 14:30]
  - 优点：无需切换输入法，编辑快速
  
选项2：Emoji图标（视觉辨识度高）
  - [⏰ 14:30] 或 [🕐 14:30]
  - 优点：醒目，但需要特殊输入方式
  
选项3：不使用前缀
  - 使用新格式 (:14:30)
  - 避免与 Markdown 链接语法冲突

您的偏好是？或者您有其他想法？
```

#### **场景2：选择延迟时间**
❌ **错误做法**：
```
我将延迟时间设置为1500ms。
```

✅ **正确做法**：
```
关于文件监听的延迟时间，我分析了以下选项：

选项1：1000ms（与TaskManagerService防抖时间相同）
  - 风险：可能仍有竞态条件
  
选项2：1500ms（推荐）
  - 平衡实时性和稳定性
  
选项3：2000ms（保守）
  - 更稳定，但用户体验稍差

建议选择1500ms，您同意吗？
```

---

### **4. 架构规范遵守**

当发现代码违反架构规范时，必须明确指出并提供重构方案：

**示例**：

```
⚠️ 发现架构违规：

问题：TaskPanelView 直接监听 vault.modify 事件
违反规范：严禁在视图层直接监听底层文件系统事件
记忆引用：user_preference_memory - "严禁在视图层重复实现shouldSkipFile等本地过滤逻辑"

根本解决方案：
TaskManagerService 应暴露事件通知机制，TaskPanelView 订阅该事件。

临时方案（不推荐）：
增加 setTimeout 延迟时间，但这只是治标不治本。

我建议立即实施根本解决方案，预计工作量2-3小时。
您是否同意？
```

---

### **5. 代码清理与验证规范**

在执行代码清理后，必须进行全局验证：

```
## 清理完成验证

### 已清理内容
- 移除 console.log: X 条
- 删除废弃方法: Y 个
- 简化注释: Z 处

### 全局验证结果
```
grep "console\.log(" src/**/*.ts
# 结果: Found 0 matches ✅
```

### 构建验证
```
✓ Built in XXXms
✓ dist/main.js: XX.XX kB (gzip: XX.XX kB)
```

### 二次确认
若用户对清理结果存疑，我已通过全局搜索确认无残留。
```

---

### **6. 实际案例回顾**

#### **案例1：任务面板更新延迟问题**

**错误做法** ❌：
```
我发现 TaskPanelView 和 TaskManagerService 同时监听 vault.modify 会导致竞态条件。
我将 TaskPanelView 的延迟时间从1200ms增加到1500ms。
// 直接实施，未征求用户意见
```

**正确做法** ✅：
```
我发现了任务面板更新延迟的根本原因：

问题分析：
TaskPanelView 和 TaskManagerService 同时监听 vault.modify，导致竞态条件。
当用户快速连续修改文件时，TaskManagerService 的防抖会被重置，而 TaskPanelView 
可能在缓存更新前就读取了旧数据。

根本原因：
违反了架构规范："严禁在视图层直接监听底层文件系统事件"。

解决方案：

方案A：事件驱动架构重构（推荐）
  - TaskManagerService 继承 Events 类，触发 'cache-updated' 事件
  - TaskPanelView 订阅该事件，移除 vault 监听
  - 优点：彻底解决问题，符合架构规范
  - 缺点：需要修改 Service 和 View 两层代码
  - 工作量：2-3小时
  - 风险：低

方案B：临时方案（不推荐）
  - 增加 TaskPanelView 的延迟时间到1500ms
  - 优点：快速实施，5分钟完成
  - 缺点：治标不治本，仍有竞态风险
  - 风险：中

我建议实施方案A，从根本上解决问题。您同意吗？
```

#### **案例2：时间标记格式冲突**

**错误做法** ❌：
```
为避免与链接语法冲突，我将使用前缀标识符 ⏰。
// 擅自决定，未考虑用户输入便利性
```

**正确做法** ✅：
```
关于时间标记与链接语法的潜在冲突，我分析了以下方案：

方案1：使用 (:...) 格式（已实施）
  - 新格式：(:14:30) 或 (:14:30 - 15:45)
  - 优点：完全避免与 Markdown 语法冲突，键盘友好
  - 缺点：需要用户适应新格式

方案2：添加可配置的前缀标识符
  - 允许用户选择：无前缀 / ASCII前缀 / Emoji前缀
  - 优点：灵活，满足不同偏好
  - 缺点：增加配置复杂度

最终决策：采用方案1，固定使用 (:...) 格式。
```

---

### **7. 检查清单**

在每次任务开始前，AI应自检：

- [ ] 我是否提供了多个方案供用户选择？
- [ ] 我是否说明了各方案的优缺点和工作量？
- [ ] 我是否等待了用户的明确指示？
- [ ] 我是否擅自决定了用户体验相关的细节？
- [ ] 我是否指出了违反架构规范的问题？
- [ ] 我是否在代码清理后进行了全局验证？

如果以上任何一项为"否"，请立即纠正。

---

## 🔗 相关文档

### **核心文档（当前有效）**
- [功能规格说明书](./FUNCTIONAL_SPECIFICATION.md) - 完整的功能需求定义
- [实现优先级](./IMPLEMENTATION_PRIORITY.md) - 开发路线图和优先级
- [架构升级方案](./ARCHITECTURE_UPGRADE_PLAN.md) - TaskManagerService架构设计

### **历史归档**
- [归档目录](./archive/README.md) - Bug修复记录、实现报告等历史文档（仅供参考）

---

**维护者**: Task Master Pro Team  
**更新频率**: 每次重大架构变更后更新