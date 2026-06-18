---
name: build-and-tools
description: 构建配置、工具链、开发命令、外部依赖说明
metadata: 
  node_type: memory
  type: reference
  originSessionId: 2596cad5-e1b1-4829-91f6-2e556fb6b166
---

# 构建与工具链

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | `vite build --watch` 监听模式构建 |
| `npm run build` | `vite build` 生产构建 |
| `npm run preview` | `vite preview` 预览构建结果 |
| `npm run check` | `svelte-check + tsc` 类型检查 |

## Vite 构建配置

- **入口**: `src/main.ts` → 输出 `dist/main.js` (CJS)
- **外部依赖**: obsidian + 所有 `@codemirror/*` 包（由 Obsidian 运行时提供）
- **CSS 合并**: Vite 生成的 Svelte CSS + 根目录 `styles.css` → 合并为 `dist/styles.css`
- **Assets**: 自动复制 `manifest.json` 到 `dist/`

## 项目工具

- TypeScript ~6.0.2
- Vite 8
- Svelte 5 + Svelte-Check 4
- SASS 1.99
- 无测试框架（当前阶段）

## 外部依赖

- `obsidian` ^1.12.3 — 核心 API
- `moment` — 时间处理（无版本声明，实际使用）

**Why**: 构建流程和依赖关系是开发调试的基础。
**How to apply**: 构建失败时先检查 Vite 配置中的 external 和 alias。
