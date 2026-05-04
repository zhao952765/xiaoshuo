import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 保存所有数据（退出/刷新前调用）
  saveData: () => {
    // 由渲染进程在 beforeunload 中调用
  },
})
