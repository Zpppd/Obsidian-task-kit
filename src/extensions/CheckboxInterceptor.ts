import { App } from 'obsidian';
import { TaskParser } from '../parser/TaskParser';
import { TimeTrackerService } from '../services/TimeTrackerService';

/**
 * 创建 Checkbox 拦截器扩展
 * 
 * ⚠️ 状态：已禁用
 * 原因：CodeMirror 依赖冲突
 * 计划：准备采用替代方案（如基于 DOM 事件监听的简化方案或其他非 CM6 Extension 方式）
 * 
 * ⚠️ 注意：此实现仅处理编辑器内的三态流转，不处理任务面板联动
 */
export function createCheckboxInterceptor(
	app: App,
	taskParser: TaskParser,
	timeTrackerService: TimeTrackerService
) {
	// ⚠️ 由于 CodeMirror 依赖冲突问题，暂时返回 null
	// TODO: 需要找到正确的 CodeMirror Extension 注册方式
	console.warn('[CheckboxInterceptor] Disabled due to CodeMirror dependency conflicts');
	return null as any;
	
	/* 原始实现（暂时禁用，等待解决依赖冲突问题）
	import { EditorView, ViewPlugin } from '@codemirror/view';
	import { MarkdownView } from 'obsidian';
	import moment from 'moment';

	return ViewPlugin.fromClass(
		class CheckboxInterceptor {
			private handleClick = async (event: MouseEvent) => {
				const target = event.target as HTMLElement;
				
				// 检查是否点击了 checkbox
				if (target.tagName !== 'INPUT' || target.type !== 'checkbox') {
					return;
				}
				
				// 检查是否是任务列表的 checkbox
				if (!target.classList.contains('task-list-item-checkbox')) {
					return;
				}
				
				console.log('[CheckboxInterceptor] Checkbox clicked, intercepting...');
				
				// 阻止默认行为（Obsidian 原生的 [ ] ↔ [x] 切换）
				event.preventDefault();
				event.stopPropagation();
				
				try {
					// 获取当前活动的 Markdown 视图
					const activeView = app.workspace.getActiveViewOfType(MarkdownView);
					if (!activeView) {
						console.warn('[CheckboxInterceptor] No active markdown view');
						return;
					}
					
					const editor = activeView.editor;
					
					// ✅ 关键：通过 DOM 元素获取准确的 CodeMirror 位置
					const pos = editor.posAtDOM(target);
					const line = editor.lineAt(pos);
					const lineText = line.text;
					
					console.log('[CheckboxInterceptor] Line:', line.number - 1, 'Text:', lineText);
					
					// 解析任务行
					const match = lineText.match(/^(\s*-\s*\[)(.)(\]\s*)(.*)$/);
					if (!match) {
						console.warn('[CheckboxInterceptor] Not a valid task line');
						return;
					}
					
					const indent = match[1];
					const statusChar = match[2];
					const rest = match[3];
					let content = match[4];
					
					console.log('[CheckboxInterceptor] Current status:', statusChar);
					
					const now = moment();
					const timeStr = now.format('HH:mm');
					let newLineText = '';
					
					// ✅ 状态流转逻辑（与 time-tracker-plugin 一致）
					if (statusChar === ' ') {
						// Pending → Progress
						newLineText = `${indent}/${rest}${content} [开始：${timeStr}]`;
						console.log('[CheckboxInterceptor] New line (Progress):', newLineText);
					} else if (statusChar === '/') {
						// Progress → Completed
						const startMatch = content.match(/ \[开始：(\d{2}:\d{2})\]$/);
						const startStr = startMatch ? startMatch[1] : timeStr;
						const cleanContent = startMatch 
							? content.replace(/ \[开始：\d{2}:\d{2}\]$/, '') 
							: content;
						
						const startTime = moment(startStr, 'HH:mm');
						const diffMins = now.diff(startTime, 'minutes');
						
						newLineText = `${indent}x${rest}${cleanContent}[开始：${startStr} - 结束：${timeStr}]`;
						console.log('[CheckboxInterceptor] New line (Completed):', newLineText);
					} else {
						// Completed → Pending
						const cleanContent = content.replace(/ \[(开始|结束|耗时).*?\]$/, '').trim();
						newLineText = `${indent} ${rest}${cleanContent}`;
						console.log('[CheckboxInterceptor] New line (Pending):', newLineText);
					}
					
					if (newLineText) {
						// ✅ 关键：使用 CodeMirror 6 Transaction API
						// 这会触发 Obsidian 自动同步到文件，不需要手动调用 vault.modify()
						const transaction = editor.cm.state.update({
							changes: { 
								from: line.from, 
								to: line.to, 
								insert: newLineText 
							}
						});
						editor.cm.dispatch(transaction);
						
						console.log('[CheckboxInterceptor] Transaction dispatched successfully');
					}
					
				} catch (error) {
					console.error('[CheckboxInterceptor] Failed to handle checkbox click:', error);
				}
			};
			
			constructor(view: EditorView) {
				// 绑定点击事件
				view.dom.addEventListener('click', this.handleClick);
			}
			
			destroy() {
				// 清理工作由 Obsidian 自动处理
			}
		}
	);
	*/
}
