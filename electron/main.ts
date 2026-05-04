import { app, BrowserWindow } from 'electron'
import path from 'node:path'

let mainWindow: BrowserWindow | null = null

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../../assets/123.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 窗口关闭时确保数据保存
  mainWindow.on('close', () => {
    mainWindow?.webContents.executeJavaScript(
      `(function() {
        try {
          const state = useStore ? useStore.getState() : null;
          if (state) {
            localStorage.setItem('private-novel-studio-pro-storage', JSON.stringify({
              state: {
                currentNovel: state.currentNovel,
                characters: state.characters,
                worldSettings: state.worldSettings,
                chapters: state.chapters,
                volumes: state.volumes,
                plotLines: state.plotLines,
                tags: state.tags,
                memories: state.memories,
                logs: state.logs,
                aiModels: state.aiModels,
                currentModel: state.currentModel,
                adultMode: state.adultMode,
                conversations: state.conversations,
                emotionEvents: state.emotionEvents,
                outlineNodes: state.outlineNodes,
                selectedTagIds: state.selectedTagIds,
                fontSize: state.fontSize,
                autoSaveInterval: state.autoSaveInterval,
                autoBackup: state.autoBackup,
                defaultTemperature: state.defaultTemperature,
                defaultMaxTokens: state.defaultMaxTokens,
                apiTimeout: state.apiTimeout,
                deduceTask: state.deduceTask,
              },
              version: 0,
            }));
          }
        } catch(e) { console.error('save error', e); }
      })()`
    ).catch(() => {})
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
