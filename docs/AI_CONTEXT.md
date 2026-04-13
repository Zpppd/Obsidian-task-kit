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