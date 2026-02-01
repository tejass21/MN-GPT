const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mnApi", {
  // TEXT + IMAGE CHAT
  chat: (payload) => ipcRenderer.invoke("mn-gpt:chat", payload),

  // SCREENSHOT
  takeScreenshot: () => ipcRenderer.invoke("mn-gpt:screenshot"),

  // WINDOW OPACITY
  setWindowOpacity: (opacity) => ipcRenderer.invoke("mn-gpt:set-opacity", opacity),

  // TOGGLE INCOGNITO/STEALTH
  setContentProtection: (enabled) => ipcRenderer.invoke("mn-gpt:update-content-protection", enabled),

  // QUIT APP
  quitApp: () => ipcRenderer.invoke("mn-gpt:quit-app"),

  // ADMIN
  openAdmin: () => ipcRenderer.invoke("mn-gpt:open-admin"),

  // SHORTCUT LISTENERS
  onShortcut: (callback) => ipcRenderer.on('shortcut-event', (_event, action) => callback(action)),
  onClickThroughToggled: (callback) => ipcRenderer.on('click-through-toggled', (_event, enabled) => callback(enabled))
});
