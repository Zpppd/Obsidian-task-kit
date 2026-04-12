import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'copy-manifest',
      closeBundle() {
        // 复制 manifest.json 到 dist 目录
        if (fs.existsSync('manifest.json')) {
          fs.copyFileSync('manifest.json', 'dist/manifest.json')
          console.log('✓ Copied manifest.json to dist/')
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
