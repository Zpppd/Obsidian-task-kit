# TaskParser - 任务解析器

## 📖 概述

TaskParser 是 Task Master Pro 的核心组件，负责从 Markdown 文件中智能识别和提取任务信息。

## ✨ 功能特性

### 1. 任务状态识别

支持三种任务状态：
- `- [ ]` - 待办（Pending）
- `- [/]` - 进行中（Progress）
- `- [x]` - 已完成（Completed）

### 2. 标签提取

自动识别并提取所有 `#tag` 格式的标签：
```markdown
- [ ] 任务文本 #工作/文档 @重要
```
提取结果：`['#工作/文档', '#重要']`

支持多级标签：`#工作/项目/A组`

### 3. 提醒时间解析

支持多种时间格式：

**绝对时间**
```markdown
- [ ] 会议 (@2024-01-15 09:00)
- [ ] 提交报告 (@2024-01-15T14:00)
```

**相对时间**
```markdown
- [ ] 晨会 (@今天 09:00)
- [ ] 周报 (@明天 17:00)
- [ ] 复盘 (@后天 10:00)
```

**纯时间**（默认为今天）
```markdown
- [ ] 站会 (@14:30)
```

### 4. 时间追踪解析

**进行中任务**
```markdown
- [/] 代码审查 [开始：14:30]
```

**已完成任务**
```markdown
- [x] 产品设计 [10:00 - 11:30]
```

自动计算耗时：90 分钟

### 5. 内容清理

解析后会自动移除所有标记，保留纯净的任务文本：
```markdown
原始：- [ ] 写报告 (@今天 14:00) #工作/重要 [开始：14:30]
清理后：写报告
```

## 🔧 API 使用

### 基本用法

```typescript
import { TaskParser } from './parser/TaskParser';

// 创建解析器实例
const parser = new TaskParser(app);

// 解析单个文件
const tasks = await parser.parseFile(file);

// 解析所有文件
const allTasks = await parser.parseAllFiles();

// 解析单行
const result = parser.parseLine(line, file, lineNumber);
```

### 更新任务

```typescript
// 修改任务状态
task.status = TaskStatus.Completed;

// 构建新的任务行
const newLine = parser.buildTaskLine(task);

// 更新到文件
await parser.updateTaskLine(task, newLine);
```

### 查找任务

```typescript
// 根据 ID 查找任务
const task = parser.findTaskById(allTasks, 'file.md:15');
```

## 📊 数据结构

### Task 接口

```typescript
interface Task {
  id: string;                    // 唯一标识：`${filePath}:${lineNumber}`
  file: TFile;                   // 所在文件对象
  line: number;                  // 行号（0-based）
  status: TaskStatus;            // 任务状态
  content: string;               // 任务文本（不含标记）
  tags: string[];                // 标签列表
  reminderTime?: moment.Moment;  // 提醒时间
  timeTracking?: TimeTracking;   // 时间追踪信息
  originalLine: string;          // 原始行文本
  parsedAt: number;              // 最后解析时间戳
}
```

### TimeTracking 接口

```typescript
interface TimeTracking {
  startTime?: moment.Moment;     // 开始时间
  endTime?: moment.Moment;       // 结束时间
  durationMinutes?: number;      // 耗时（分钟）
}
```

## 🧪 测试

项目中包含测试文件 `test-tasks.md`，包含各种任务格式示例。

### 运行测试

1. 将 `test-tasks.md` 复制到你的 Obsidian Vault
2. 在 Obsidian 中打开该文件
3. 执行命令：`Task Master Pro: Parse Current File Tasks (Test)`
4. 查看控制台输出

### 预期输出

```
📄 test-tasks.md (15 tasks):
  Line 4: - [pending] 普通任务
  Line 5: - [completed] 已完成任务
  Line 6: - [progress] 进行中的任务
  Line 9: - [pending] 写项目报告
    Tags: #工作/文档, #重要
  ...
```

## ⚠️ 注意事项

1. **性能优化**：大量文件时使用 `parseAllFiles()` 可能较慢，建议添加缓存机制
2. **文件跳过**：自动跳过隐藏文件和系统文件夹（`.obsidian`, `.git` 等）
3. **错误处理**：解析失败时返回空数组，不会中断整个流程
4. **编码问题**：确保文件使用 UTF-8 编码

## 🚀 下一步

- [ ] 添加缓存机制，避免重复解析
- [ ] 实现增量解析（只解析变更的文件）
- [ ] 添加正则表达式自定义支持
- [ ] 支持更多时间格式（如"下周一"、"下周"等）

## 📝 示例

完整的任务格式示例：

```markdown
- [ ] 准备演讲 (@明天 10:00) #工作/重要 @紧急
- [/] 代码审查 [开始：14:30] #工作/技术
- [x] 产品设计 [10:00 - 11:30] #工作/设计
```

解析结果：
```typescript
{
  id: "test.md:0",
  status: TaskStatus.Pending,
  content: "准备演讲",
  tags: ["#工作/重要"],
  reminderTime: moment("2024-01-16 10:00"),
  timeTracking: undefined
}
```

---

**创建日期**: 2024-01-15  
**版本**: v0.1.0
