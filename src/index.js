// ================== LOAD ENV FIRST ==================
require("dotenv").config();

const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  globalShortcut
} = require("electron");
const path = require("path");

// ================== LOG ==================
console.log("✅ MN-GPT MAIN PROCESS LOADED");

// ================== WINDOWS INSTALLER ==================
if (require("electron-squirrel-startup")) {
  app.quit();
}

// ================== API KEY ==================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ================== KEY SHORTCUTS ==================
const isMac = process.platform === 'darwin';
const keybinds = {
  moveUp: isMac ? 'Alt+Up' : 'Ctrl+Up',
  moveDown: isMac ? 'Alt+Down' : 'Ctrl+Down',
  moveLeft: isMac ? 'Alt+Left' : 'Ctrl+Left',
  moveRight: isMac ? 'Alt+Right' : 'Ctrl+Right',
  toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
  toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
  nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
  previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
  nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
  scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
  scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
  emergencyErase: isMac ? 'Cmd+Shift+E' : 'Ctrl+Shift+E',
};

function registerShortcuts(mainWindow, keybinds) {
  // 1. Window Movement
  const moveIncrement = 50; // pixels
  const movementActions = {
    moveUp: () => {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x, y - moveIncrement);
    },
    moveDown: () => {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x, y + moveIncrement);
    },
    moveLeft: () => {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x - moveIncrement, y);
    },
    moveRight: () => {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x + moveIncrement, y);
    }
  };

  Object.keys(movementActions).forEach(action => {
    if (keybinds[action]) {
      globalShortcut.register(keybinds[action], movementActions[action]);
    }
  });

  // 2. Visibility Toggle
  globalShortcut.register(keybinds.toggleVisibility, () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  // 3. Click-Through Toggle
  let mouseEventsIgnored = false;
  globalShortcut.register(keybinds.toggleClickThrough, () => {
    mouseEventsIgnored = !mouseEventsIgnored;
    mainWindow.setIgnoreMouseEvents(mouseEventsIgnored, { forward: true });
    mainWindow.webContents.send('click-through-toggled', mouseEventsIgnored);
  });

  // 4. Renderer Actions
  const rendererActions = [
    'nextStep', 'previousResponse', 'nextResponse', 'scrollUp', 'scrollDown'
  ];

  rendererActions.forEach(action => {
    if (keybinds[action]) {
      globalShortcut.register(keybinds[action], () => {
        mainWindow.webContents.send('shortcut-event', action);
      });
    }
  });

  // 5. Emergency Erase / Quit
  globalShortcut.register(keybinds.emergencyErase, () => {
    mainWindow.hide();
    app.quit();
  });

  // 6. Zoom Shortcuts (Consolidated)
  globalShortcut.register("CommandOrControl+=", () => {
    const level = mainWindow.webContents.getZoomLevel();
    mainWindow.webContents.setZoomLevel(level + 0.5);
  });

  globalShortcut.register("CommandOrControl+-", () => {
    const level = mainWindow.webContents.getZoomLevel();
    mainWindow.webContents.setZoomLevel(level - 0.5);
  });

  globalShortcut.register("CommandOrControl+0", () => {
    mainWindow.webContents.setZoomLevel(0);
  });
}

console.log(
  "OPENAI KEY:",
  OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 6) + "..." : "NOT FOUND"
);

// ================== FETCH ==================
const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

// ================== OPENAI CALL (NO STREAMING) ==================
async function callChatGPT({ messages, image, model }) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing. Check .env file.");
  }

  if (!messages || !messages.length) {
    throw new Error("No messages provided to callChatGPT.");
  }

  // Build messages for standard OpenAI API
  const apiMessages = messages.map((msg, idx) => {
    // For first message (system), keep as is
    if (idx === 0) {
      return {
        role: msg.role,
        content: msg.content
      };
    }

    // For user messages with image (last message)
    if (msg.role === "user" && image && idx === messages.length - 1) {
      return {
        role: "user",
        content: [
          { type: "text", text: msg.content },
          {
            type: "image_url",
            image_url: {
              url: image.startsWith("data:") ? image : `data:image/png;base64,${image}`
            }
          }
        ]
      };
    }

    // For other messages, keep as text
    return {
      role: msg.role,
      content: msg.content
    };
  });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: apiMessages,
      temperature: 0.3,
      max_tokens: 350
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  const json = await res.json();

  return (
    json.choices?.[0]?.message?.content ||
    "No response"
  );
}

// ================== IPC: CHAT ==================
ipcMain.handle("mn-gpt:chat", async (_event, payload) => {
  try {
    const reply = await callChatGPT(payload || {});
    return { ok: true, reply };
  } catch (err) {
    console.error("Chat error:", err);
    return { ok: false, error: err.message || String(err) };
  }
});

// ================== IPC: SCREENSHOT (OUTSIDE APP) ==================
ipcMain.handle("mn-gpt:screenshot", async () => {
  const win = BrowserWindow.getFocusedWindow();

  if (win) win.hide();
  await new Promise((r) => setTimeout(r, 300));

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1920, height: 1080 }
  });

  const image = sources[0].thumbnail.toDataURL();

  if (win) win.show();
  return image;
});

// ================== IPC: SET WINDOW OPACITY ==================
ipcMain.handle("mn-gpt:set-opacity", (_event, opacity) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    const opacityValue = Math.max(0.3, Math.min(1, opacity / 100));
    win.setOpacity(opacityValue);
  }
  return true;
});

// ================== IPC: UPDATE CONTENT PROTECTION ==================
ipcMain.handle("mn-gpt:update-content-protection", (_event, enabled) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setContentProtection(enabled);
  }
  return true;
});

// ================== IPC: QUIT APP ==================
ipcMain.handle("mn-gpt:quit-app", () => {
  app.quit();
});

// ================== WINDOW ==================
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    title: "MN-GPT",
    alwaysOnTop: true, // Keep it visible even when clicking elsewhere
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
      // IMPORTANT: no zoomFactor here,
      // so Ctrl + +/- and Ctrl + wheel behave like ChatGPT
    }
  });

  // Keep visible on all workspaces/desktops
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // IMPORTANT: do not force setZoomFactor here
  // mainWindow.webContents.setZoomFactor(1.0);

  // HIDE MENU BAR (File, Edit, etc.)
  mainWindow.setMenu(null);

  // ISSE APP INVISIBLE HOTI HAI (Magic Line)
  // Zoom/Meet isko capture nahi kar paayenge (black box ya background dikhega)
  mainWindow.setContentProtection(true);

  // Windows ke liye Taskbar se hide karna
  if (process.platform === 'win32') {
    try {
      mainWindow.setSkipTaskbar(true); // Ye main line hai
      console.log('Hidden from Windows taskbar');
    } catch (error) {
      console.warn('Could not hide from taskbar:', error.message);
    }
  }
  // macOS ke liye Dock/Mission Control se hide karna
  if (process.platform === 'darwin') {
    try {
      mainWindow.setHiddenInMissionControl(true);
      // macOS pe dock icon hide karne ke liye app.dock.hide() bhi use hota hai main.js/index.js mein
    } catch (error) {
      console.warn('Could not hide from Mission Control:', error.message);
    }
  }

  return mainWindow;
}

// ================== APP LIFECYCLE ==================
app.whenReady().then(() => {
  const mainWindow = createWindow();
  registerShortcuts(mainWindow, keybinds);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// close app on all windows closed (except macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
