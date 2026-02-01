const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mnGpt", {
  chat: (messages) => ipcRenderer.invoke("mn-gpt:chat", messages)
});
