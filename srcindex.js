const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

if (require("electron-squirrel-startup")) {
  app.quit();
}

const OPENAI_API_KEY = ""; // <--- paste your key only on your machine

async function callChatGPT(messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages
    })
  });

  const json = await res.json();
  return json.choices?.[0]?.message?.content || "No response.";
}

ipcMain.handle("mn-gpt:chat", async (event, messages) => {
  try {
    const reply = await callChatGPT(messages);
    return { ok: true, reply };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    title: "MN-GPT",
    icon: path.join(__dirname, "assets", "logo.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
