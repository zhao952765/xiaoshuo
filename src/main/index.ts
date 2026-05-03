import { app, BrowserWindow, nativeImage } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ICON_PATH = path.join(__dirname, '../../assets/123.ico')
const PRELOAD_PATH = path.join(__dirname, 'preload.mjs')
const PROD_HTML_PATH = path.join(__dirname, '../index.html')

const IS_DEV = !!process.env.VITE_DEV_SERVER_URL

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: ICON_PATH,
    show: false,
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

  win.once('ready-to-show', () => win.show())

  return win
}

function setAppIcon(): void {
  try {
    const icon = nativeImage.createFromPath(ICON_PATH)
    if (icon.isEmpty()) return

    if (process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(icon)
    } else if (process.platform === 'win32') {
      app.setUserTasks([])
    }
  } catch {
    // 图标设置失败不影响主流程
  }
}

app.whenReady().then(() => {
  setAppIcon()
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
