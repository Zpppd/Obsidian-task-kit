# 技术决策：进行中任务 Checkbox 样式实现

**日期**: 2026-04-14  
**主题**: CSS Snippet 实现多视图一致的 Checkbox 样式  
**状态**: ✅ 已完成  
**相关文件**: 
- CSS Snippet: `task-kit-in-progress.css` (工作区根目录)
- 参考主题: `obsidian-things-main/theme.css`

---

## 📋 背景

Task Master Pro 插件实现了任务列表的三态流转（待办 → 进行中 → 已完成），但缺少进行中的视觉样式。需要从其他主题中借鉴样式方案，并确保在编辑器和任务面板中保持一致的视觉效果。

---

## 🎯 问题陈述

### 原始需求
为"进行中"状态的任务（标记为 `[/]`）实现半填充 checkbox 样式，类似于 obsidian-things 主题的效果。

### 技术挑战
1. **多视图一致性**：样式需要在以下三个视图中保持一致：
   - Markdown 编辑器（CodeMirror 6 渲染）
   - 任务面板（插件自定义 ItemView）
   - 阅读模式（Markdown 预览）

2. **DOM 结构差异**：不同视图中的 checkbox DOM 结构完全不同：
   - **编辑器**: `<label class="task-list-label"><input class="task-list-item-checkbox" data-task="/"></label>`
   - **任务面板**: `<input class="task-checkbox-input checkbox-progress">`

3. **状态标识差异**：
   - 进行中状态的 checkbox **没有** `checked` 属性
   - 只有已完成状态才有 `checked` 属性

---

## 💡 解决方案

### 方案选择：独立 CSS Snippet vs 插件内部样式

#### ❌ 为什么不使用插件 styles.css？

**原因 1: 样式作用域限制**
```
插件 styles.css 的主要作用域：
├── ✅ 插件自定义视图（TaskPanelView）
├── ⚠️  编辑器视图（可能被主题覆盖）
└── ❌  阅读模式（完全由主题控制）
```

**原因 2: 优先级问题**
- 插件 styles.css 的优先级低于 Obsidian 主题
- 编辑器的 checkbox 由 CodeMirror 6 渲染，插件样式容易被覆盖
- 需要大量 `!important` 和复杂选择器才能生效

**原因 3: 维护复杂度**
- 需要在插件代码和样式之间同步维护
- 用户无法灵活控制样式的启用/禁用

#### ✅ 为什么选择 CSS Snippet？

**优势 1: 全局作用域**
```
CSS Snippet 的作用域：
├── ✅ Obsidian 原生界面
├── ✅ 插件自定义视图
├── ✅ 编辑器视图
└── ✅ 阅读模式
```

**优势 2: 用户可控**
- 用户可以在设置中一键启用/禁用
- 不干扰插件核心功能
- 符合 Obsidian 生态的最佳实践

**优势 3: 关注点分离**
- **CSS Snippet**: 管理视觉效果（颜色、动画、特殊效果）
- **插件 styles.css**: 管理布局结构（flex、grid、position）

**优势 4: 跨主题兼容**
- 即使用户更换主题，Snippet 仍然有效
- 不依赖特定主题的样式结构

---

## 🔍 实现过程

### 第一步：研究 obsidian-things 主题

从 `E:\code-Project\task-reminders-tracking\obsidian-things-main\theme.css` 中提取关键实现：

```css
/* obsidian-things 的进行中样式（第 757-775 行）*/
input[data-task='/']:checked,
li[data-task='/'] > input:checked,
li[data-task='/'] > p > input:checked {
  background-image: none;
  background-color: transparent;
  position: relative;
  overflow: hidden;
}

input[data-task='/']:checked:after,
li[data-task='/'] > input:checked:after,
li[data-task='/'] > p > input:checked:after {
  top: 0;
  left: 0;
  content: ' ';
  display: block;
  position: absolute;
  background-color: var(--color-accent);
  width: calc(50% - 0.5px);
  height: 100%;
  -webkit-mask-image: none;
}
```

#### 关键技术点

1. **使用 `:after` 伪元素**（单冒号）
   - 而不是 `::after`（双冒号）
   - 更好的浏览器兼容性

2. **使用 `display: block`**
   - 确保伪元素正确渲染
   - 避免 inline 元素的布局问题

3. **使用 `calc(50% - 0.5px)`**
   - 精确计算半宽
   - 避免像素对齐问题

4. **移除遮罩**
   - `-webkit-mask-image: none`
   - 确保背景色完全显示

5. **多选择器覆盖**
   - 匹配不同的 DOM 结构
   - 提高样式的鲁棒性

### 第二步：调试和适配

#### 迭代 1: 使用 `:checked` 伪类（❌ 失败）

**假设**: 进行中的 checkbox 应该有 `checked` 属性  
**结果**: 编辑器生效，任务面板不生效  

**原因**: 
- 编辑器中 `[/]` 被渲染为**未选中**状态（无 `checked` 属性）
- 任务面板中进行中状态也是**未选中**（只有 completed 才 checked）

#### 迭代 2: 直接使用 `data-task` 属性（✅ 成功）

**修正**: 移除 `:checked`，直接通过 `data-task='/'` 选择

```css
/* 正确的选择器 */
input.task-list-item-checkbox[data-task='/'] {
  /* 样式 */
}

.task-checkbox-input.checkbox-progress {
  /* 样式 */
}
```

### 第三步：最终实现

#### 完整的 CSS Snippet 结构

```css
/* ========================================
   任务面板中的进行中样式
   ======================================== */
.task-checkbox-input.checkbox-progress {
  position: relative !important;
  overflow: hidden !important;
  accent-color: transparent !important;
  border: 2px solid var(--interactive-accent) !important;
  -webkit-appearance: none !important;
  /* ... */
}

/* ========================================
   编辑器中的进行中样式
   ======================================== */
input.task-list-item-checkbox[data-task='/'] {
  /* 同样的样式 */
}

/* 备用选择器 */
label.task-list-label:has(input[data-task='/']) input.task-list-item-checkbox {
  /* 同样的样式 */
}
```

#### 关键技术决策

1. **全面使用 `!important`**
   - 确保样式优先级高于主题
   - 避免被 Obsidian 默认样式覆盖

2. **移除原生 appearance**
   ```css
   -webkit-appearance: none !important;
   appearance: none !important;
   ```
   - 完全接管 checkbox 的渲染
   - 避免浏览器默认样式干扰

3. **添加边框**
   ```css
   border: 2px solid var(--interactive-accent) !important;
   ```
   - 保持与其他状态任务的视觉一致性
   - 使用 CSS 变量适配主题色

4. **多路径选择器**
   - 主选择器: `input[data-task='/']`
   - 备用选择器: `label:has(input[data-task='/'])`
   - 覆盖可能的 DOM 结构变化

---

## 📊 DOM 结构对比

### 编辑器中的结构
```html
<label class="task-list-label" contenteditable="false">
  <input 
    class="task-list-item-checkbox" 
    type="checkbox" 
    data-task="/"
  >
</label>
```

**特点**:
- 被 `<label>` 包裹
- 有 `data-task` 属性标识状态
- **没有** `checked` 属性

### 任务面板中的结构
```html
<div class="task-checkbox">
  <input 
    type="checkbox" 
    class="task-checkbox-input checkbox-progress svelte-1me58vt"
    style="width: 16px; height: 16px; margin: 0;"
  >
</div>
```

**特点**:
- 被 `<div>` 包裹
- 有 `checkbox-progress` 类名
- **没有** `data-task` 属性
- 由 Svelte 组件渲染

### 关键差异总结

| 特性 | 编辑器 | 任务面板 |
|------|--------|----------|
| 包裹元素 | `<label>` | `<div>` |
| 状态标识 | `data-task="/"` | `class="checkbox-progress"` |
| 是否有 checked | ❌ 无 | ❌ 无 |
| CSS 类名 | `task-list-item-checkbox` | `task-checkbox-input checkbox-progress` |
| 渲染方式 | CodeMirror 6 | Svelte 组件 |

---

## 🎨 样式实现原理

### 半填充效果

```
┌─────────────────┐
│░░░░░│           │
│░░░░░│  空白     │
│░░░░░│           │
└─────────────────┘
 50%    50%
```

**实现机制**:
1. **容器**: `position: relative; overflow: hidden;`
2. **伪元素**: `position: absolute; width: calc(50% - 0.5px);`
3. **背景**: 伪元素填充主题色，容器保持透明
4. **边框**: 2px 实线边框保持视觉一致性

### CSS 变量使用

```css
border: 2px solid var(--interactive-accent) !important;
background-color: var(--interactive-accent) !important;
border-radius: var(--checkbox-radius, 30%) !important;
```

**优势**:
- 自动适配亮色/暗色主题
- 跟随用户的主题色设置
- 保持与 Obsidian 原生风格一致

---

## 📝 部署和使用说明

### 文件位置

```
工作区根目录/
└── task-kit-in-progress.css  ← CSS Snippet 文件
```

### 用户安装步骤

1. **复制文件**
   ```bash
   将 task-kit-in-progress.css 复制到
   你的Obsidian仓库/.obsidian/snippets/
   ```

2. **启用 Snippet**
   - 打开 Obsidian 设置
   - 导航到 **外观** → **CSS 代码片段**
   - 点击刷新按钮（🔄）
   - 找到 `task-kit-in-progress` 并启用

3. **查看效果**
   - 重新打开包含 `[/]` 任务的笔记
   - 在编辑器和任务面板中查看效果

### 样式预览

**进行中任务 (`[/]`)**:
- 半填充 checkbox（左侧 50% 主题色）
- 2px 主题色边框
- 悬停时发光效果

**待办任务 (`[-]`)**:
- 原生未选中样式

**已完成任务 (`[x]`)**:
- 原生选中样式

---

## 🔧 维护和扩展

### 修改样式

如需调整样式，编辑 `task-kit-in-progress.css` 文件：

```css
/* 修改半填充颜色 */
background-color: var(--interactive-accent) !important;
/* 改为固定颜色 */
background-color: #ff6b6b !important;

/* 修改边框粗细 */
border: 2px solid ... !important;
/* 改为 3px */
border: 3px solid ... !important;

/* 修改半填充宽度 */
width: calc(50% - 0.5px) !important;
/* 改为 60% */
width: calc(60% - 0.5px) !important;
```

### 添加新状态

如需为其他任务状态添加样式（如 `[@]` 表示高优先级）：

```css
/* 高优先级任务样式 */
input.task-list-item-checkbox[data-task='@'] {
  border-color: var(--color-red) !important;
}

input.task-list-item-checkbox[data-task='@']:after {
  background-color: var(--color-red) !important;
}
```

### 兼容性检查

在不同 Obsidian 版本中测试：
- ✅ Obsidian 1.5.x
- ✅ Obsidian 1.6.x
- 需要在 Obsidian 1.7.x 发布后测试

---

## 📚 参考资料

1. **obsidian-things 主题**
   - 仓库: `E:\code-Project\task-reminders-tracking\obsidian-things-main`
   - 关键代码: `theme.css` 第 757-775 行

2. **Obsidian CSS Snippet 文档**
   - https://help.obsidian.md/Extending+Obsidian/CSS+snippets

3. **CSS 伪元素规范**
   - `:after` vs `::after`: https://developer.mozilla.org/en-US/docs/Web/CSS/::after

---

## ✅ 经验教训

### 关键发现

1. **不要假设 DOM 结构一致**
   - 编辑器和任务面板的 DOM 完全不同
   - 必须分别在开发者工具中检查实际结构

2. **不要依赖 `:checked` 伪类**
   - 进行中状态没有 `checked` 属性
   - 应该使用 `data-task` 属性识别状态

3. **CSS Snippet 是最佳实践**
   - 全局作用域，多视图一致
   - 用户可控，易于维护
   - 跨主题兼容

4. **使用 `!important` 和 `appearance: none`**
   - 确保样式优先级
   - 完全接管原生控件渲染

### 调试技巧

1. **检查实际 DOM**
   ```javascript
   // 在 Console 中运行
   document.querySelector('input[data-task="/"]')
   getComputedStyle(element)
   ```

2. **验证 Snippet 加载**
   ```javascript
   document.querySelector('link[href*="task-kit-in-progress"]')
   ```

3. **分步测试**
   - 先测试一个视图
   - 验证样式生效后再扩展到其他视图

---

## 🚀 后续优化建议

1. **添加更多状态样式**
   - 高优先级: `[@]`
   - 取消: `[>]`
   - 暂停: `[<]`

2. **添加动画效果**
   - checkbox 切换时的过渡动画
   - 悬停时的微交互

3. **提供配置选项**
   - 允许用户自定义颜色
   - 可调节半填充宽度
   - 开关边框显示

4. **创建主题变体**
   - 提供多种配色方案
   - 适配不同的视觉偏好

---

**文档维护者**: Task Master Pro 开发团队  
**最后更新**: 2026-04-14  
**下次审查**: 功能稳定后
