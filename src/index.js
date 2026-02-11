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
const { setupGroqIpcHandlers } = require("./groq");

// Initialize Groq handlers
setupGroqIpcHandlers();

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
  openAdmin: isMac ? 'Cmd+Shift+G' : 'Ctrl+Shift+G',
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

  // 7. Admin Panel
  globalShortcut.register(keybinds.openAdmin, () => {
    createAdminWindow();
  });
}

console.log(
  "OPENAI KEY:",
  OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 6) + "..." : "NOT FOUND"
);

// ================== FETCH ==================
const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

// ================== OPENAI CALL (WITH STREAMING) ==================
async function callChatGPT({ messages, image, model }, event = null) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing. Check .env file.");
  }

  if (!messages || !messages.length) {
    throw new Error("No messages provided to callChatGPT.");
  }

  const apiMessages = messages.map((msg, idx) => {
    if (idx === 0) return { role: msg.role, content: msg.content };
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
    return { role: msg.role, content: msg.content };
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
      max_tokens: 1024,
      stream: true
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  let fullText = "";
  let isFirstChunk = true;
  let partialLine = "";

  return new Promise((resolve, reject) => {
    res.body.on('data', (chunk) => {
      const combined = partialLine + chunk.toString();
      const lines = combined.split('\n');
      partialLine = lines.pop(); // Save partial line for next chunk

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        const message = trimmed.replace(/^data: /, '');
        try {
          const parsed = JSON.parse(message);
          const delta = parsed.choices[0].delta?.content;
          if (delta) {
            fullText += delta;
            if (event) {
              if (isFirstChunk) {
                event.sender.send('new-response', delta);
                isFirstChunk = false;
              } else {
                event.sender.send('update-response', delta);
              }
            }
          }
        } catch (error) {
          // Ignore parsing errors for non-JSON lines or incomplete data
        }
      }
    });

    res.body.on('error', (err) => {
      console.error('Streaming error:', err);
      reject(err);
    });

    res.body.on('end', () => {
      if (fullText) {
        resolve(fullText);
      } else {
        resolve("No response content");
      }
    });
  });
}

// ================== IPC: CHAT ==================
ipcMain.handle("mn-gpt:chat", async (event, payload) => {
  try {
    const reply = await callChatGPT(payload || {}, event);
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

// ================== IPC: OPEN ADMIN ==================
ipcMain.handle("mn-gpt:open-admin", () => {
  createAdminWindow();
});

// ================== IPC: GET SOURCES ==================
ipcMain.handle("mn-gpt:get-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 0, height: 0 } // No thumbnails needed for audio source selection
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name
  }));
});

// ================== IPC: RESUME PROCESS ==================
ipcMain.handle('resume:process', async (event, { name, data, type }) => {
  try {
    const buffer = Buffer.from(data, 'base64');
    const extension = (name.split('.').pop() || '').toLowerCase();
    console.log(`[Resume Process] Processing ${name} (${extension}), Buffer size: ${buffer.length}`);

    let text = '';
    if (extension === 'pdf') {
      try {
        console.log('[Resume Process] Requiring pdf-parse...');

        // POLYFILL: pdf-parse (pdf.js) uses DOMMatrix which is not available in Node.js
        if (typeof DOMMatrix === 'undefined') {
          global.DOMMatrix = class DOMMatrix {
            constructor() {
              this.m11 = 1; this.m12 = 0;
              this.m21 = 0; this.m22 = 1;
              this.m41 = 0; this.m42 = 0;
            }
          };
        }

        const pdf = require('pdf-parse');
        console.log('[Resume Process] Parsing PDF buffer...');
        const result = await pdf(buffer);
        text = result.text;
        console.log(`[Resume Process] PDF parsed successfully. Text length: ${text.length}`);
      } catch (pdfError) {
        console.error('[Resume Process] PDF Parse Error:', pdfError);
        throw new Error(`PDF parsing failed: ${pdfError.message}`);
      }
    } else if (['txt', 'md', 'rtf'].includes(extension)) {
      // Parse text files
      text = buffer.toString('utf-8');
      console.log(`[Resume Process] Text file parsed. Length: ${text.length}`);
    } else {
      console.warn(`[Resume Process] Unsupported file type: ${extension}`);
      return { success: false, error: `Unsupported file type: ${extension}` };
    }
    if (!text || text.trim().length === 0) {
      console.warn('[Resume Process] No text content found');
      return { success: false, error: 'No text content found in the file' };
    }
    // Note: We don't have src/utils/gemini.js context updating logic here as per user snippet
    // The user snippet implies we should just return the text, and the frontend handles storage/context.
    // However, the user snippet ALSO showed:
    // const { updateSessionContext } = require('./utils/gemini');
    // ... updateSessionContext(...)
    // Since src/utils/gemini.js DOES NOT EXIST in the file list I saw, I will OMIT calling it
    // and rely on the frontend to store the text and pass it to getSystemPrompt.

    return { success: true, text: text };
  } catch (error) {
    console.error('Error processing resume:', error);
    return { success: false, error: `Failed to process file: ${error.message}` };
  }
});

// ================== IPC: GET SYSTEM PROMPT ==================
ipcMain.handle('mn-gpt:get-system-prompt', async (event, { profile, customPrompt, googleSearchEnabled, options, resumeContent }) => {
  try {
    const { getSystemPrompt } = require('./prompts');
    const prompt = getSystemPrompt(profile || 'interview', customPrompt, googleSearchEnabled, options, resumeContent);
    return prompt;
  } catch (error) {
    console.error('Error generating system prompt:', error);
    return ''; // Fallback or error handling
  }
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

  // THIS MAKES THE APP INVISIBLE (Magic Line)
  // Zoom/Meet won't be able to capture this (shows as a black box or background)
  mainWindow.setContentProtection(true);

  // Windows ke liye Taskbar se hide karna
  if (process.platform === 'win32') {
    try {
      mainWindow.setSkipTaskbar(true); // This is the main line
      console.log('Hidden from Windows taskbar');
    } catch (error) {
      console.warn('Could not hide from taskbar:', error.message);
    }
  }
  // macOS ke liye Dock/Mission Control se hide karna
  if (process.platform === 'darwin') {
    try {
      mainWindow.setHiddenInMissionControl(true);
      // app.dock.hide() is also used in main.js/index.js to hide the dock icon on macOS
    } catch (error) {
      console.warn('Could not hide from Mission Control:', error.message);
    }
  }

  return mainWindow;
}

function createAdminWindow() {
  const adminWindow = new BrowserWindow({
    width: 450,
    height: 700,
    title: "DesireAI Admin",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // Since it's an internal admin tool, simplifying here
    }
  });

  adminWindow.loadFile(path.join(__dirname, "../admin/index.html"));
  adminWindow.setMenu(null);
  return adminWindow;
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
