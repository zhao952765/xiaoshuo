import { BrowserWindow, app, nativeImage } from "electron";
import path from "node:path";
//#region src/main/index.ts
var ICON_PATH = path.join(__dirname, "../../assets/123.ico");
var PRELOAD_PATH = path.join(__dirname, "../preload.mjs");
var PROD_HTML_PATH = path.join(__dirname, "../../dist/index.html");
var IS_DEV = !!process.env.VITE_DEV_SERVER_URL;
function createMainWindow() {
	const win = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 1200,
		minHeight: 800,
		icon: ICON_PATH,
		show: false,
		webPreferences: {
			preload: PRELOAD_PATH,
			nodeIntegration: true,
			contextIsolation: false
		}
	});
	if (IS_DEV) {
		win.loadURL(process.env.VITE_DEV_SERVER_URL);
		win.webContents.openDevTools();
	} else win.loadFile(PROD_HTML_PATH);
	win.once("ready-to-show", () => win.show());
	return win;
}
function setAppIcon() {
	try {
		const icon = nativeImage.createFromPath(ICON_PATH);
		if (icon.isEmpty()) return;
		if (process.platform === "darwin" && app.dock) app.dock.setIcon(icon);
		else if (process.platform === "win32") app.setUserTasks([]);
	} catch {}
}
app.whenReady().then(() => {
	setAppIcon();
	createMainWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
	});
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
//#endregion
