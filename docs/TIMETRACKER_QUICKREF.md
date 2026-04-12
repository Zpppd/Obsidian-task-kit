# TimeTrackerService 快速参考

## 📍 文件位置
- **服务类**: `src/services/TimeTrackerService.ts`
- **导出**: `src/services/index.ts`
- **测试命令**: `Test Time Tracker Service` (在 main.ts 中)

## 🔑 核心 API

### 主入口
```typescript
await timeTrackerService.toggleTaskStatus(task);
```

### 格式化显示
```typescript
const text = timeTrackerService.formatDisplayText(task, 'range');
// 或 'duration', 'ai'
```

## 🔄 三态流转

| 当前状态 | 调用后状态 | 文件变化 |
|---------|-----------|---------|
| `- [ ]` | `- [/]` | 添加 `[开始：HH:mm]` |
| `- [/]` | `- [x]` | 替换为 `[开始 - 结束]` |
| `- [x]` | `- [ ]` | **清除所有时间标记** ⚠️ |

## ⚠️ 关键注意事项

1. **回退必须清除时间标记**
   ```typescript
   task.timeTracking = undefined; // ✅ 正确
   ```

2. **依赖 TaskParser**
   ```typescript
   const service = new TimeTrackerService(app, taskParser);
   ```

3. **支持跨天计算**
   ```typescript
   // 23:00 - 01:00 = 120 分钟（自动加 1 天）
   ```

## 🧪 快速测试

1. 打开 `test-tasks.md`
2. 确保第一行是 `- [ ] 任务`
3. 运行命令：`Test Time Tracker Service`
4. 查看控制台验证三个测试场景

## 📊 显示格式示例

```typescript
// range (默认)
[14:30 - 15:45]

// duration
[⏱️ 75 分钟]

// ai
[📝 1 小时 15 分]
```

## 🔗 相关文档

- 详细实现: `docs/TIMETRACKER_IMPLEMENTATION.md`
- 功能规格: `docs/FUNCTIONAL_SPECIFICATION.md` - 模块二
- 优先级: `docs/IMPLEMENTATION_PRIORITY.md` - P0 功能 #2
