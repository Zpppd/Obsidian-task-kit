# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TaskKit (`task-kit`) — Obsidian 插件，集成任务面板、三态时间追踪、提醒通知、编辑器集成。

- **Tech**: TypeScript + Svelte 5 + Vite 8, CSS via SASS
- **Deps**: `obsidian` ^1.12.3 (external, plus all `@codemirror/*` marked external in vite.config.ts), `moment` (imported directly, undeclared in package.json)
- **Entry**: [src/main.ts](src/main.ts) → Vite builds to `dist/main.js` (CJS)
- **Build extra**: Vite `closeBundle` copies `manifest.json` into `dist/` and merges Svelte-generated CSS + root `styles.css` into `dist/styles.css`
- **Path alias**: `@` → `src/` (vite.config.ts)
- Plugin ID: `task-kit`, view type: `task-kit-panel`

## Commands

```bash
npm run build          # Production build (vite build)
npm run dev            # Watch mode build (vite build --watch)
npm run preview        # Preview the built bundle (vite preview)
npm run check          # Type-check (svelte-check --tsconfig ./tsconfig.app.json && tsc -p tsconfig.node.json)
```

No test framework is configured yet.

## Architecture: Three-Layer + Event-Driven

```
Parser Layer (pure parsing, no side effects)  — src/parser/ (index.ts re-exports)
  └─ TaskParser         → parseFile / parseAllFiles / parseLine / buildTaskLine / updateTaskLine / shouldSkipFile
  └─ ReminderParser     → parseReminderTime / removeReminderTag
  └─ TimeTrackerParser  → parseTimeTracking / removeTimeTrackingTag

Service Layer (business logic, data management)  — src/services/ (index.ts re-exports)
  └─ TaskManagerService (extends Events) → loadAllTasks, tasksCache (Map<path, Task[]>), debounced file watchers,
  │                                        getAllTasksFromCache, refreshAllTasks, emits 'cache-updated'
  └─ TimeTrackerService                  → toggleTaskStatus (three-state), buildSurgicalLine, updateTrackingTime,
  │                                        clearTrackingTime, completeTaskWithoutTracking, formatDisplayText
  └─ ReminderScheduler                   → timer-based, subscribes to 'cache-updated', shows ReminderModal

View Layer (rendering only)  — src/views/ + src/ui/ + src/modals/
  └─ TaskPanelView (ItemView)   → mounts/unmounts Svelte components, subscribes to 'cache-updated'
  └─ ReminderModal (Modal)      → native Obsidian Modal (src/ui/ReminderModal.ts), no Svelte
  └─ DateTimeEditModal (Modal)  → src/modals/DateTimeEditModal.ts, opened from editor context menu
  └─ Svelte components: TaskList, TaskItem, FilterBar (src/views/components/)
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
- Templates configured in settings (`progressTemplate` / `completedTemplate`) with variables: `{start}`, `{end}`, `{startDate}`, `{endDate}`, `{duration}`, `{durationDate}` — rendered by `src/utils/TimeTemplateRenderer.ts`
- **Surgical update**: `TimeTrackerService.buildSurgicalLine()` only changes the checkbox char and time marker, preserving reminder tags, content, and indentation
- **Panel status filter** options: `all` / `pending` / `progress` / `completed` / `incomplete` (incomplete = pending + progress)
- Direct time edits: `updateTrackingTime(task, start, end?)` — backfill or correct tracking times (sets completed if `end` given, else progress); `completeTaskWithoutTracking(task)` — mark `[x]` without a time marker

## Reminder Syntax

`(@YYYY-MM-DD HH:mm)` / `(@HH:mm)` / `(@YYYY-MM-DD)` appended to task line.
ReminderScheduler finds the nearest reminder, sets a timer, shows ReminderModal on trigger.
ReminderModal actions: mark complete, snooze (preset durations, configurable), mute for today, open file.

## Editor Integration (main.ts)

- **Checkbox interceptor**: `registerEditorCheckboxInterceptor()` adds a capture-phase `click` listener on the active MarkdownView's contentEl. It uses `cmView.posAtDOM()` (CodeMirror 6 internal API, via `editor.cm`) to resolve the clicked checkbox to a line, then delegates to `TimeTrackerService.toggleTaskStatus()`. Only active when `settings.enableTimeTracking`.
- **Context menu**: `registerEditorContextMenu()` hooks the `editor-menu` event. On a task line it appends: 设置提醒时间 (DateTimeEditModal, reminder mode), 修改追踪时间 (DateTimeEditModal, tracking mode → `updateTrackingTime`), 完成任务 (`completeTaskWithoutTracking`). Items are gated by `settings.reminder.enabled` / `settings.enableTimeTracking`.

## Quick Add — NOT yet implemented

Quick Add (a panel input bar to create tasks into a daily note or an inbox file) is a **planned P1 feature only**. `QuickAddService` / `QuickAddBar` do **not** exist in the code. See [docs/06-快捷添加任务功能规格说明书.md](docs/06-快捷添加任务功能规格说明书.md) and `.claude/quick-add-feature.md` for the design; do not treat it as implemented.

## Important Anti-Patterns

- ❌ View directly listening to `vault.on('modify')` — use the Service's `'cache-updated'` event
- ⚠️ Exception: the View **may** listen to `vault.on('delete')` / `vault.on('rename')` — the Service clears its cache but cannot signal invalidation for those events, so TaskPanelView reloads from cache. Keep this exception; don't add `modify` back.
- ❌ Duplicating `shouldSkipFile` logic in views or services
- ❌ Calling `parseAllFiles()` directly from a view — go through `TaskManagerService`
- ❌ Auto-committing or auto-pushing without explicit user approval

## Documentation Index

- [docs/01-AI协作上下文指南.md](docs/01-AI协作上下文指南.md) — Architecture guide for AI agents (includes mandatory AI collaboration decision rules: propose options, wait for confirmation)
- [docs/02-架构升级方案.md](docs/02-架构升级方案.md) — TaskManagerService architecture design
- [docs/03-功能规格说明书.md](docs/03-功能规格说明书.md) — Full functional specification
- [docs/04-实现优先级与路线图.md](docs/04-实现优先级与路线图.md) — Roadmap & priorities
- [docs/05-常见问题排查指南.md](docs/05-常见问题排查指南.md) — Troubleshooting
- [docs/06-快捷添加任务功能规格说明书.md](docs/06-快捷添加任务功能规格说明书.md) — Quick Add spec (planned, not implemented)
- [.claude/](.claude/) — Memory files (project overview, architecture, build config, bugfix history, quick-add design)
