import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: {
    cssMinify: false,
    rollupOptions: {
      output: {
        // 代码分割：按路由拆分 chunk
        manualChunks(id: string) {
          if (id.includes('/pages/')) {
            const match = id.match(/\/pages\/([^/]+)\//)
            if (match) return `page-${match[1]}`
          }
          if (id.includes('node_modules')) {
            if (id.includes('reactflow') || id.includes('@xyflow')) return 'vendor-flow'
            if (id.includes('framer-motion')) return 'vendor-anim'
            if (id.includes('antd') || id.includes('@ant-design')) return 'vendor-antd'
            return 'vendor'
          }
        },
        // 拆分大 chunk（超过 300KB）
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    minify: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@main': resolve(__dirname, 'src/main'),
      '@prompts': resolve(__dirname, 'prompts'),
      '@cfg': resolve(__dirname, 'src/config'),
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              output: {
                entryFileNames: 'index.js',
              },
            },
          },
        },
      },
      preload: {
        input: 'src/main/preload.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              output: {
                entryFileNames: 'preload.mjs',
              },
            },
          },
        },
      },
    }),
  ],
})
