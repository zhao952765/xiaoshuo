import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 在此处暴露主进程与渲染进程的安全通信接口
})
