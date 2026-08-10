import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'copy-assets',
      closeBundle() {
        // 复制 manifest.json 到 dist 目录
        if (fs.existsSync('manifest.json')) {
          fs.copyFileSync('manifest.json', 'dist/manifest.json')
          console.log('✓ Copied manifest.json to dist/')
        }
        
        // ✅ 合并 Vite 生成的 CSS 和根目录 styles.css
        const generatedCssFile = resolve(__dirname, 'dist', 'task-kit.css')
        const rootStylesFile = resolve(__dirname, 'styles.css')
        const finalCssFile = resolve(__dirname, 'dist', 'styles.css')
        
        let finalCssContent = ''
        
        // 1. 读取 Vite 生成的 CSS（Svelte 组件样式）
        if (fs.existsSync(generatedCssFile)) {
          finalCssContent += fs.readFileSync(generatedCssFile, 'utf-8')
          fs.unlinkSync(generatedCssFile)
          console.log('✓ Read generated CSS from Svelte components')
        }
        
        // 2. 追加根目录 styles.css 的内容（自定义样式）
        if (fs.existsSync(rootStylesFile)) {
          const rootStyles = fs.readFileSync(rootStylesFile, 'utf-8')
          if (rootStyles.trim()) {
            finalCssContent += '\n\n/* Custom styles from root styles.css */\n' + rootStyles
            console.log('✓ Appended custom styles from root styles.css')
          }
        }
        
        // 3. 写入最终的 styles.css
        if (finalCssContent) {
          fs.writeFileSync(finalCssFile, finalCssContent)
          console.log('✓ Generated final styles.css')
        } else {
          console.warn('⚠ No CSS content found to write')
        }
      }
    }
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'TaskKit',
      fileName: () => 'main.js',
      formats: ['cjs']
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // ✅ 关键：将 CodeMirror 依赖标记为 external，使用 Obsidian 内部提供的版本
      external: [
        'obsidian',
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/search',
        '@codemirror/history'
      ],
      output: {
        globals: {
          obsidian: 'obsidian',
          '@codemirror/state': 'CodeMirrorState',
          '@codemirror/view': 'CodeMirrorView',
          '@codemirror/commands': 'CodeMirrorCommands',
          '@codemirror/language': 'CodeMirrorLanguage',
          '@codemirror/lint': 'CodeMirrorLint',
          '@codemirror/search': 'CodeMirrorSearch',
          '@codemirror/history': 'CodeMirrorHistory'
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
