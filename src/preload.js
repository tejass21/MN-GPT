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
  quitApp: () => ipcRenderer.invoke("mn-gpt:quit-app")
});
