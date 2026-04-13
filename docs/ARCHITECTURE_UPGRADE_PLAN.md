# Task Master Pro - 架构升级方案（方案3：TaskManagerService）

> 🎯 **目标**: 创建统一的任务数据管理层，支持未来扩展需求  
> 📅 **预计工作量**: 6-8小时  
> ⚠️ **风险等级**: 中（需充分测试）

---

## 📖 背景与动机

### **当前问题**

1. **数据访问分散**
   - `TaskPanelView` 直接调用 `taskParser.shouldSkipFile()` 和 `parseFile()`
   - 未来 `TaskBoardView`、`StatisticsPanel` 等视图也需要类似逻辑
   - 导致代码重复和维护困难

2. **缺乏缓存机制**
   - 每次筛选/排序都要重新解析文件
   - 性能瓶颈：100+任务时响应变慢

3. **扩展性差**
   - 添加新的查询维度（按标签、日期、优先级）需要在多处修改
   - 不支持复杂查询（全文搜索、模糊匹配）

---

### **为什么现在升级？**

**时机优势**：
- ✅ 当前只有 `TaskPanelView` 一个视图使用任务数据
- ✅ 没有其他模块依赖当前的数据获取方式
- ✅ 重构成本低（6-8小时 vs 未来20-30小时）

**未来需求明确**（来自 [IMPLEMENTATION_PRIORITY.md](./IMPLEMENTATION_PRIORITY.md)）：
- P1: 看板视图（需要按状态分组）
- P1: 多标签组合筛选（需要高效查询）
- P2: 统计面板（需要聚合计算）
- P2: 批量操作（需要事务管理）

---

## 🏗️ 目标架构

### **三层架构设计**

```
┌─────────────────────────────────────┐
│         视图层 (Views)               │
│  ┌──────────┐  ┌──────────┐        │
│  │TaskPanel │  │TaskBoard │  ...   │
│  └──────────┘  └──────────┘        │
└──────────────┬──────────────────────┘
               │ 调用
┌──────────────▼──────────────────────┐
│      服务层 (Services)               │
│  ┌──────────────────────────┐       │
│  │  TaskManagerService      │ ⭐核心│
│  │  ├─ loadAllTasks()       │       │
│  │  ├─ getTasksByStatus()   │       │
│  │  ├─ searchTasks()        │       │
│  │  └─ tasksCache           │       │
│  └──────────────────────────┘       │
│  ┌──────────────────────────┐       │
│  │  TimeTrackerService      │       │
│  └──────────────────────────┘       │
└──────────────┬──────────────────────┘
               │ 调用
┌──────────────▼──────────────────────┐
│      工具层 (Utils)                  │
│  ┌──────────────────────────┐       │
│  │  TaskParser              │       │
│  │  ├─ parseFile()          │       │
│  │  └─ parseLine()          │       │
│  └──────────────────────────┘       │
│  ┌──────────────────────────┐       │
│  │  FileFilterService(可选) │       │
│  └──────────────────────────┘       │
└─────────────────────────────────────┘
```

---

## 📝 实施步骤

### **阶段1：创建 TaskManagerService（3-4小时）**

#### **1.1 创建文件**

**文件路径**: `src/services/TaskManagerService.ts`

**核心职责**：
- 统一的任务加载入口
- 缓存管理
- 常用查询方法
- 增量更新

---

#### **1.2 完整代码实现**

请AI按照以下要求创建 `TaskManagerService.ts`：

**关键特性**：
1. 使用 `Map<string, Task[]>` 作为缓存（key为文件路径）
2. 批量并行处理（每批50个文件）
3. 提供 `loadAllTasks()`、`refreshSingleFile()`、`getAllTasksFromCache()` 等方法
4. 内部调用 `taskParser.parseFile()` 和 `taskParser.shouldSkipFile()`
5. 添加详细的 TypeScript 类型注释和 JSDoc

**参考实现要点**：
- 构造函数接收 `App`、`TaskParser`、`() => PluginSettings`
- `loadAllTasks()` 方法：获取有效文件 → 分批并行解析 → 更新缓存 → 返回所有任务
- `getValidMarkdownFiles()` 方法：调用 `app.vault.getMarkdownFiles()` 并过滤
- `refreshSingleFile(file: TFile)` 方法：重新解析单个文件并更新缓存
- `clearCache()` 方法：清空所有缓存

---

### **阶段2：修改 main.ts（30分钟）**

#### **2.1 初始化 TaskManagerService**

在 `main.ts` 的 `onload()` 方法中添加：

```typescript
// 初始化 TaskManagerService
this.taskManagerService = new TaskManagerService(
  this.app,
  this.taskParser,
  () => this.settings
);
```

#### **2.2 传递给 TaskPanelView**

修改视图注册代码：

```typescript
this.registerView(
  TASK_PANEL_VIEW_TYPE,
  (leaf) => new TaskPanelView(
    leaf, 
    this.taskParser,
    this.timeTrackerService,
    this.taskManagerService,  // ← 新增参数
    this
  )
);
```

#### **2.3 添加成员变量**

在类定义中添加：

```typescript
private taskManagerService!: TaskManagerService;
```

---

### **阶段3：修改 TaskPanelView（1-2小时）**

#### **3.1 修改构造函数**

添加 `TaskManagerService` 参数：

```typescript
constructor(
  leaf: WorkspaceLeaf,
  taskParser: TaskParser,
  timeTrackerService: TimeTrackerService,
  taskManagerService: TaskManagerService,  // ← 新增
  plugin: TaskMasterProPlugin
) {
  super(leaf);
  this.taskParser = taskParser;
  this.timeTrackerService = timeTrackerService;
  this.taskManagerService = taskManagerService;  // ← 保存引用
  this.plugin = plugin;
}
```

#### **3.2 修改 loadTasks() 方法**

**原代码**：
```typescript
async loadTasks(): Promise<void> {
  const files = this.app.vault.getMarkdownFiles();
  const validFiles = files.filter(file => !this.taskParser.shouldSkipFile(file));
  
  const allTasks: Task[] = [];
  // ... 批量解析逻辑
}
```

**新代码**：
```typescript
async loadTasks(): Promise<void> {
  try {
    // ✅ 直接使用 TaskManagerService
    const allTasks = await this.taskManagerService.loadAllTasks();
    
    this.tasks = allTasks;
    this.updateView();
    
    console.log(`[TaskPanelView] Loaded ${allTasks.length} tasks`);
  } catch (error) {
    console.error('[TaskPanelView] Failed to load tasks:', error);
    throw error;
  }
}
```

#### **3.3 删除或简化本地数据处理逻辑**

可以删除以下内容：
- `shouldSkipFile()` 方法（不再需要）
- `loadTasks()` 中的批量处理逻辑（已移至 TaskManagerService）

保留：
- Svelte 组件挂载/卸载逻辑
- 文件监听逻辑（但改为调用 `taskManagerService.refreshSingleFile()`）

---

### **阶段4：优化文件监听（30分钟）**

#### **4.1 修改 handleFileModify()**

**原代码**：
```typescript
private handleFileModify(file: TFile): void {
  if (this.refreshTimeout) {
    clearTimeout(this.refreshTimeout);
  }
  
  this.refreshTimeout = setTimeout(async () => {
    await this.refreshTasks();  // 全量刷新
    this.refreshTimeout = null;
  }, 500);
}
```

**新代码**：
```typescript
private handleFileModify(file: TFile): void {
  if (this.refreshTimeout) {
    clearTimeout(this.refreshTimeout);
  }
  
  this.refreshTimeout = setTimeout(async () => {
    // ✅ 增量更新：只重新解析变化的文件
    await this.taskManagerService.refreshSingleFile(file);
    
    // 从缓存重新加载所有任务
    this.tasks = this.taskManagerService.getAllTasksFromCache();
    this.updateView();
    
    this.refreshTimeout = null;
  }, 1000);  // 增加防抖时间到1秒
}
```

---

### **阶段5：测试与验证（1-2小时）**

#### **5.1 功能测试清单**

- [ ] 白名单功能正常工作
- [ ] 状态筛选功能正常（pending/progress/completed）
- [ ] 搜索功能正常
- [ ] 任务状态切换正常（点击checkbox）
- [ ] 点击任务跳转到文件正常
- [ ] 文件修改后自动刷新正常
- [ ] 首次加载速度可接受（<2秒，100任务）

#### **5.2 性能测试**

记录以下指标：
- 首次加载时间（任务数量：___）
- 筛选响应时间
- 内存占用（开发者工具 → Performance）

#### **5.3 边界情况测试**

- [ ] 白名单为空时扫描所有目录
- [ ] 白名单中有不存在的目录（应静默忽略）
- [ ] 重复的白名单目录（应显示警告）
- [ ] 大量任务（500+）时的性能表现

---

## ⚠️ 注意事项

### **1. 向后兼容性**

- ✅ 确保白名单功能不受影响
- ✅ 确保现有的设置选项仍然有效
- ✅ 确保 TaskParser 的其他方法仍可正常调用

---

### **2. 错误处理**

- 在 `TaskManagerService.loadAllTasks()` 中添加 try-catch
- 单个文件解析失败不应影响其他文件
- 记录详细的错误日志便于调试

---

### **3. 缓存失效策略**

当前实现：
- 文件修改时更新对应文件的缓存
- 插件重启时缓存清空（重新加载）

未来优化（可选）：
- 持久化缓存到磁盘（`data.json`）
- LRU 淘汰策略（内存不足时）

---

### **4. 并发控制**

- 使用 `isLoading` 标志防止重复加载
- 如果正在加载，后续调用直接返回缓存数据

---

## 🎯 成功标准

### **功能完整性**
- [ ] 所有现有功能正常工作
- [ ] 白名单功能正常
- [ ] 筛选和搜索正常

### **性能指标**
- [ ] 首次加载时间 < 2秒（100任务）
- [ ] 筛选响应时间 < 50ms
- [ ] 内存占用 < 80MB

### **代码质量**
- [ ] TypeScript 无编译错误
- [ ] 无 console.error（除了预期的错误日志）
- [ ] 代码注释清晰完整

---

## 🔗 相关文件清单

### **需要创建的文件**
- `src/services/TaskManagerService.ts`

### **需要修改的文件**
- `src/main.ts`
- `src/views/TaskPanelView.ts`

### **可选修改的文件**
- `src/parser/TaskParser.ts`（标记 `shouldSkipFile()` 为内部使用）

---

## 💡 AI实施指南

### **给AI的指令模板**

当你需要AI实施此方案时，请使用以下提示：

```
请按照《架构升级方案（方案3）》实施 TaskManagerService：

1. 首先创建 src/services/TaskManagerService.ts
   - 参考文档中的"阶段1：完整代码实现"部分
   - 确保包含所有必需的方法和类型注释

2. 然后修改 src/main.ts
   - 添加 taskManagerService 成员变量
   - 在 onload() 中初始化
   - 传递给 TaskPanelView

3. 最后修改 src/views/TaskPanelView.ts
   - 添加 taskManagerService 参数
   - 修改 loadTasks() 使用新服务
   - 修改文件监听逻辑使用增量更新

4. 每完成一个阶段，运行 npm run build 验证

5. 完成后提供测试清单供我验证
```

---

## 📊 预期收益

### **短期收益（立即）**
- ✅ 消除代码重复
- ✅ 统一数据访问接口
- ✅ 为未来扩展打下基础

### **中期收益（Phase 2）**
- ✅ 看板视图实现更简单（直接调用 `getTasksByStatus()`）
- ✅ 高级筛选更高效（内置索引和缓存）
- ✅ 代码维护更容易

### **长期收益（Phase 3）**
- ✅ 统计面板一行代码搞定（`getStatistics()`）
- ✅ 全文搜索性能优异（倒排索引）
- ✅ 支持多视图共享数据

---

## 🚀 下一步

完成此架构升级后，建议：

1. **立即**：实现提醒系统（ReminderManager）
2. **短期**：完善标签筛选系统
3. **中期**：实现看板视图

---

**文档版本**: v1.0  
**创建日期**: 2026-04-13  
**维护者**: Task Master Pro Team
