/**
 * Electron 主进程 - 启动优化版
 * - show: false + ready-to-show 减少白屏时间
 * - 错误处理
 */
import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PRELOAD_PATH = path.join(__dirname, 'preload.mjs')
const PROD_HTML_PATH = path.join(__dirname, '../index.html')
const IS_DEV = !!process.env.VITE_DEV_SERVER_URL

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false, // 先隐藏，ready 后再显示
    backgroundColor: '#0f0f0f', // 背景色匹配应用，避免白屏闪烁
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (IS_DEV) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!)
    win.webContents.openDevTools()
  } else {
    win.loadFile(PROD_HTML_PATH)
  }

  // ready-to-show 时显示窗口（减少白屏）
  win.once('ready-to-show', () => {
    win.show()
    if (!IS_DEV) {
      // 生产环境聚焦窗口
      win.focus()
    }
  })

  return win
}

app.whenReady().then(() => {
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
