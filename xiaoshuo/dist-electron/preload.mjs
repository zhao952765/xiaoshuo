//#region electron/preload.ts
require("electron").contextBridge.exposeInMainWorld("electronAPI", {});
//#endregion
