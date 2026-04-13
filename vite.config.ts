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
        
        // ✅ 重命名 Vite 生成的 CSS 文件为标准名称（Obsidian 要求 styles.css）
        const generatedCssFile = resolve(__dirname, 'dist', 'task-master-pro.css')
        const standardCssFile = resolve(__dirname, 'dist', 'styles.css')
        if (fs.existsSync(generatedCssFile)) {
          // 如果已存在 styles.css（从根目录复制的），先删除
          if (fs.existsSync(standardCssFile)) {
            fs.unlinkSync(standardCssFile)
            console.log('✓ Removed existing styles.css from root copy')
          }
          // 重命名生成的 CSS 文件
          fs.renameSync(generatedCssFile, standardCssFile)
          console.log('✓ Renamed task-master-pro.css to styles.css')
        } else if (fs.existsSync('styles.css')) {
          // 如果没有生成 CSS 文件，但根目录有 styles.css，则复制
          fs.copyFileSync('styles.css', 'dist/styles.css')
          console.log('✓ Copied styles.css to dist/')
        }
      }
    }
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'TaskMasterPro',
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
