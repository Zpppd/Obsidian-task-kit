# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TaskKit (`task-kit`) — Obsidian 插件，集成任务面板、三态时间追踪、提醒通知、快捷添加。

- **Tech**: TypeScript + Svelte 5 + Vite 8, CSS via SASS
- **Deps**: `obsidian` ^1.12.3 (external), `moment` (bundled)
- **Entry**: [src/main.ts](src/main.ts) → Vite builds to `dist/main.js` (CJS)
- Plugin ID: `task-kit`, view type: `task-kit-panel`

## Commands

```bash
npm run build          # Production build (vite build)
npm run dev            # Watch mode build (vite build --watch)
npm run check          # Type-check (svelte-check + tsc)
```

No test framework is configured yet.

## Architecture: Three-Layer + Event-Driven

```
Parser Layer (pure parsing, no side effects)
  └─ TaskParser       → parseFile / parseAllFiles / parseLine / buildTaskLine / updateTaskLine
  └─ ReminderParser   → parseReminderTime / removeReminderTag
  └─ TimeTrackerParser → parseTimeTracking / removeTimeTrackingTag

Service Layer (business logic, data management)
  └─ TaskManagerService (extends Events) → loadAllTasks, cache, file watchers, emits 'cache-updated'
  └─ TimeTrackerService                  → toggleTaskStatus (three-state: pending→progress→completed)
  └─ ReminderScheduler                   → timer-based, subscribes to 'cache-updated', shows ReminderModal
  └─ QuickAddService                     → resolve target file, insert task under heading

View Layer (rendering only)
  └─ TaskPanelView (ItemView)   → mounts/unmounts Svelte components, subscribes to Service events
  └─ ReminderModal (Modal)      → native Obsidian Modal, no Svelte dependency
  └─ Svelte components: TaskList, TaskItem, FilterBar, QuickAddBar
```

**Key rules:**
- **No business logic in Views** — TaskPanelView reads from `TaskManagerService.getAllTasksFromCache()`, never parses files directly or re-implements `shouldSkipFile`
- **Event flow**: File change → Service debounce → cache update → `'cache-updated'` event → View re-renders
- **TaskParser.shouldSkipFile()** is the single source of truth for file filtering — use it, don't duplicate
- **Services are injected as props into Svelte components** (e.g. `timeTrackerService`), never created inside components

## Svelte 5 Notes

This project uses **Svelte 5** with the new `mount`/`unmount` API (not `new Component()`).

```typescript
// Mounting
import { mount, unmount } from 'svelte';
this.svelteComponent = mount(TaskList, {
  target: container,
  props: { tasks, onToggle, timeTrackerService }
});

// Unmounting (required on close/update)
unmount(this.svelteComponent);
```

- **SCSS in `<style>`**: Must use `lang="scss"`, comments use `/* */` (NOT `//`)
- Run `svelte-check` for type errors in `.svelte` files

## Task Status & Time Tracking

Three-state cycle: `[ ]` pending → `[/]` progress → `[x]` completed

- Time markers use `(:...)` format: `(:14:30)` for in-progress, `(:14:30 - 15:45)` for completed
- Templates configured in settings with variables: `{start}`, `{end}`, `{startDate}`, `{endDate}`, `{duration}`, `{durationDate}`
- **Surgical update**: `TimeTrackerService.buildSurgicalLine()` only changes the checkbox char and time marker, preserving reminder tags, content, and indentation

## Reminder Syntax

`(@YYYY-MM-DD HH:mm)` / `(@HH:mm)` / `(@YYYY-MM-DD)` appended to task line.
ReminderScheduler finds the nearest reminder, sets a timer, shows ReminderModal on trigger.

## Quick Add

Two modes: `daily-notes` (date-picker, resolves to daily note) or `specified-file` (fixed target file). Task inserted after configurable heading.

## Editor Checkbox Interceptor

`main.ts` intercepts checkbox clicks in MarkdownView via a `click` event listener (capture phase). It uses `cmView.posAtDOM()` to get the CodeMirror line, then delegates to `TimeTrackerService.toggleTaskStatus()`.

## Important Anti-Patterns

- ❌ View directly listening to `vault.on('modify')` — use the Service's `'cache-updated'` event
- ❌ Duplicating `shouldSkipFile` logic in views or services
- ❌ Calling `parseAllFiles()` directly from a view — go through `TaskManagerService`
- ❌ Auto-committing or auto-pushing without explicit user approval

## Documentation Index

- [docs/01-AI协作上下文指南.md](docs/01-AI协作上下文指南.md) — Architecture guide for AI agents
- [docs/03-功能规格说明书.md](docs/03-功能规格说明书.md) — Full functional specification
- [docs/04-实现优先级与路线图.md](docs/04-实现优先级与路线图.md) — Roadmap & priorities
- [docs/05-常见问题排查指南.md](docs/05-常见问题排查指南.md) — Troubleshooting
- [.claude/](.claude/) — Memory files (project overview, architecture, build config, bugfix history)
