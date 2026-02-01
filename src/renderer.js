// ================== MAIN ELEMENTS ==================
const chatWindow = document.getElementById("chat-window");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const newChatBtn = document.getElementById("new-chat-btn");
const stealthBtn = document.getElementById("stealth-btn");

// attachment / media elements
const attachmentTrigger = document.getElementById("attachment-trigger");
const attachmentMenu = document.getElementById("attachment-menu");

const imageInput = document.getElementById("image-input");
const cameraPreview = document.getElementById("camera-preview");

const addPhotoBtn = document.getElementById("menu-add-photo");
const cameraBtn = document.getElementById("menu-take-photo");
const screenshotBtn = document.getElementById("menu-screenshot");

// sidebar + navigation
const appShell = document.querySelector(".app-shell");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarFab = document.getElementById("sidebar-fab");

const navChat = document.getElementById("nav-chat");
const navHistory = document.getElementById("nav-history");
const navSettings = document.getElementById("nav-settings");

const panelChat = document.getElementById("panel-chat");
const panelHistory = document.getElementById("panel-history");
const panelSettings = document.getElementById("panel-settings");



// ================== PANEL NAVIGATION ==================
function showPanel(panel) {
  panelChat.classList.remove("panel-active");
  panelHistory.classList.remove("panel-active");
  panelSettings.classList.remove("panel-active");
  panel.classList.add("panel-active");
}

navChat.onclick = () => showPanel(panelChat);
navHistory.onclick = () => showPanel(panelHistory);
navSettings.onclick = () => showPanel(panelSettings);

// Settings close button
const closeSettingsBtn = document.getElementById("close-settings");
if (closeSettingsBtn) {
  closeSettingsBtn.onclick = () => showPanel(panelChat);
}

// Settings tab switching
const settingsTabs = document.querySelectorAll(".settings-tab");
const settingsPages = document.querySelectorAll(".settings-page");

settingsTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = tab.getAttribute("data-tab");

    // Remove active class from all tabs and pages
    settingsTabs.forEach((t) => t.classList.remove("settings-tab-active"));
    settingsPages.forEach((p) => p.classList.remove("settings-page-active"));

    // Add active class to clicked tab and corresponding page
    tab.classList.add("settings-tab-active");
    const activePage = document.getElementById(`settings-${tabName}`);
    if (activePage) {
      activePage.classList.add("settings-page-active");
    }
  });
});

// ================== SIDEBAR ==================
function setSidebarCollapsed(collapsed) {
  if (collapsed) {
    appShell.classList.add("sidebar-collapsed");
    sidebarFab.style.display = "flex";
  } else {
    appShell.classList.remove("sidebar-collapsed");
    sidebarFab.style.display = "none";
  }
}

sidebarToggle.onclick = () =>
  setSidebarCollapsed(!appShell.classList.contains("sidebar-collapsed"));

sidebarFab.onclick = () => setSidebarCollapsed(false);

// ================== SYSTEM PROMPT ==================
const DEFAULT_INTERVIEW_SCRIPT = `YOU ARE A DATA ENGINEER/DEVELOPER ANSWERING INTERVIEW QUESTIONS

ANSWER STRUCTURE (ALWAYS follow this order):

1. DIRECT SPOKEN ANSWER (1-2 lines)
- Plain, confident tone
- No explanation yet
- Sound natural and direct

Example: "Star schema is simpler and faster for reporting. Snowflake schema is more normalized and needs more joins."

2. PRACTICAL EXPLANATION (3-5 lines, project-based)
- Real work examples, no textbook tone
- Include what you actually did in projects
- Keep it practical and relatable

Example: "In my projects, star schema is used for BI dashboards because queries are straightforward and performance is better. Fact tables connect directly to dimensions, so analysts can write simple queries. Snowflake schema comes in when dimensions are large and need normalization, but it increases join complexity."

3. ONE-LINE INTERVIEW CLOSER (Optional, only if context allows)
- Use only to reinforce your preference
- Keep it direct

Example: "For analytics, I prefer star schema. For storage control, snowflake schema."

CRITICAL RULES - YOU MUST FOLLOW THESE:

❌ DO NOT:
- Use long paragraphs first
- Give textbook definitions
- Use marketing or formal language
- Say "According to..." or "Studies show..."
- Use bullet points for theory
- Sound like you're reading from documentation

✅ DO:
- Use spoken English (like you're talking to someone)
- Sound like one real person with actual experience
- Include real project context and examples
- Keep the same structure for EVERY answer
- Sound confident and natural
- Make it sound like you actually worked on this

IF ANSWERING WITH SCREENSHOTS:
- Apply the same structure
- Explain what you see in the screenshot
- Then relate it to your real experience
- Keep it conversational

TONE: Confident, experienced, practical, natural. Like talking to a colleague, not presenting.`;


const appSettings = {
  model: "gpt-4.1-mini"
};

function buildSystemMessage() {
  // Use custom prompt if saved, otherwise use default
  const customPrompt = localStorage.getItem("custom-system-prompt");
  return customPrompt || DEFAULT_INTERVIEW_SCRIPT;
}

// ================== CHAT STATE ==================
let messages = [{ role: "system", content: buildSystemMessage() }];
let pendingAttachment = null;

// ================== UI HELPERS ==================
function addMessage(text, sender = "assistant") {
  const row = document.createElement("div");
  row.className = "message-row";

  const avatar = document.createElement("div");
  avatar.className = `message-avatar ${sender === "user" ? "user" : "bot"}`;
  avatar.textContent = sender === "user" ? "U" : "MN";

  const bubble = document.createElement("div");
  bubble.className = `message-bubble ${sender === "user" ? "user" : "bot"}`;
  bubble.textContent = text;

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addLoading() {
  const row = document.createElement("div");
  row.className = "message-row";
  row.dataset.loading = "1";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar bot";
  avatar.textContent = "MN";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble bot";
  bubble.textContent = "Thinking...";

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return row;
}

function removeLoading(row) {
  if (row) row.remove();
}

// ================== ATTACHMENT PREVIEW ==================
function showAttachmentPreview(src) {
  removeAttachmentPreview();

  const preview = document.createElement("div");
  preview.id = "attachment-preview";
  preview.style.position = "absolute";
  preview.style.bottom = "5.5rem";
  preview.style.left = "1rem";
  preview.style.maxWidth = "240px";
  preview.style.borderRadius = "12px";
  preview.style.border = "1px solid #333";
  preview.style.background = "#000";
  preview.style.padding = "6px";
  preview.style.zIndex = "100";

  const img = document.createElement("img");
  img.src = src;
  img.style.width = "100%";
  img.style.borderRadius = "8px";

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "✕";
  removeBtn.style.position = "absolute";
  removeBtn.style.top = "4px";
  removeBtn.style.right = "6px";
  removeBtn.style.background = "#111";
  removeBtn.style.color = "#fff";
  removeBtn.style.border = "none";
  removeBtn.style.cursor = "pointer";

  removeBtn.onclick = () => {
    pendingAttachment = null;
    preview.remove();
  };

  preview.appendChild(img);
  preview.appendChild(removeBtn);
  document.body.appendChild(preview);
}

function removeAttachmentPreview() {
  const existing = document.getElementById("attachment-preview");
  if (existing) existing.remove();
}

// ================== SEND ==================
async function handleSend() {
  const text = userInput.value.trim();
  if (!text && !pendingAttachment) return;

  userInput.value = "";
  addMessage(text || "[Image sent]", "user");

  messages.push({
    role: "user",
    content: text || "[Image]"
  });

  const loading = addLoading();

  try {
    const res = await window.mnApi.chat({
      model: appSettings.model,
      messages,
      image: pendingAttachment
    });

    removeLoading(loading);

    if (!res || !res.ok) {
      addMessage("Error: " + (res?.error || "Unknown error"));
      return;
    }

    addMessage(res.reply, "assistant");
    messages.push({ role: "assistant", content: res.reply });
  } catch (err) {
    removeLoading(loading);
    addMessage("Error: " + err.message);
  }

  pendingAttachment = null;
  removeAttachmentPreview();
}

// ================== SCREENSHOT ANALYSIS (Ctrl+Enter) ==================
async function handleScreenshotAnalysis() {
  try {
    // Take screenshot
    const screenshot = await window.mnApi.takeScreenshot();

    // Add loading message
    addMessage("[Screenshot captured - Analyzing...]", "user");
    const loading = addLoading();

    // Create minimal message array with only system + current user message
    const minimalMessages = [
      messages[0], // System prompt
      { role: "user", content: "Analyze this screenshot. If it contains code, explain it. If it's a question, answer it." }
    ];

    // Send screenshot to API for analysis
    const res = await window.mnApi.chat({
      model: appSettings.model,
      messages: minimalMessages,
      image: screenshot
    });

    removeLoading(loading);

    if (!res || !res.ok) {
      addMessage("Error: " + (res?.error || "Unknown error"));
      return;
    }

    // Update full message history for context
    messages.push({
      role: "user",
      content: "[Screenshot analyzed]"
    });

    addMessage(res.reply, "assistant");
    messages.push({ role: "assistant", content: res.reply });
  } catch (err) {
    addMessage("Error taking screenshot: " + err.message);
  }
}

// ================== ATTACHMENT MENU (UPLOAD / CAMERA / SCREENSHOT) ==================

// open / close menu
if (attachmentTrigger && attachmentMenu) {
  attachmentTrigger.addEventListener("click", () => {
    attachmentMenu.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (
      !attachmentMenu.contains(e.target) &&
      e.target !== attachmentTrigger
    ) {
      attachmentMenu.classList.add("hidden");
    }
  });
}

// ----- Add photo (file upload) -----
if (addPhotoBtn && imageInput) {
  addPhotoBtn.onclick = () => {
    attachmentMenu.classList.add("hidden");
    imageInput.click();
  };

  imageInput.onchange = () => {
    const file = imageInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      pendingAttachment = reader.result;
      showAttachmentPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };
}

// ----- Take photo (camera) -----
if (cameraBtn) {
  cameraBtn.onclick = async () => {
    attachmentMenu.classList.add("hidden");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraPreview.srcObject = stream;
    cameraPreview.hidden = false;

    setTimeout(() => {
      const canvas = document.createElement("canvas");
      canvas.width = cameraPreview.videoWidth;
      canvas.height = cameraPreview.videoHeight;
      canvas.getContext("2d").drawImage(cameraPreview, 0, 0);

      pendingAttachment = canvas.toDataURL("image/png");
      showAttachmentPreview(pendingAttachment);

      stream.getTracks().forEach((t) => t.stop());
      cameraPreview.hidden = true;
    }, 1500);
  };
}

// ----- Screenshot -----
if (screenshotBtn) {
  screenshotBtn.onclick = async () => {
    attachmentMenu.classList.add("hidden");
    const img = await window.mnApi.takeScreenshot();
    pendingAttachment = img;
    showAttachmentPreview(img);
  };
}

// ================== EVENTS ==================
sendBtn.onclick = handleSend;

userInput.onkeydown = (e) => {
  if (e.key === "Enter" && e.ctrlKey) {
    // Ctrl+Enter: Take screenshot and analyze
    e.preventDefault();
    handleScreenshotAnalysis();
  } else if (e.key === "Enter") {
    // Enter: Normal send
    e.preventDefault();
    handleSend();
  }
};

newChatBtn.onclick = () => {
  messages = [{ role: "system", content: buildSystemMessage() }];
  chatWindow.innerHTML = "";
  addMessage("Hi, I'm MN-GPT. Ask interview questions.", "assistant");
};

// ================== INIT ==================
addMessage("Hi, I'm MN-GPT. Ask interview questions.", "assistant");

// ================== SETTINGS: TRANSPARENCY ==================
const transparencySlider = document.getElementById("setting-transparency");
const transparencyValue = document.getElementById("transparency-value");

if (transparencySlider) {
  // Load saved transparency value
  const savedTransparency = localStorage.getItem("app-transparency") || "100";
  transparencySlider.value = savedTransparency;
  transparencyValue.textContent = savedTransparency + "%";
  setWindowTransparency(parseInt(savedTransparency));

  // Update on slider change
  transparencySlider.addEventListener("input", (e) => {
    const value = e.target.value;
    transparencyValue.textContent = value + "%";
    setWindowTransparency(parseInt(value));
    localStorage.setItem("app-transparency", value);
  });
}

// Function to set window transparency
async function setWindowTransparency(opacity) {
  try {
    await window.mnApi.setWindowOpacity(opacity);
  } catch (err) {
    console.error("Failed to set window opacity:", err);
  }
}

// ================== SETTINGS: THEME ==================
const themeSelect = document.getElementById("setting-theme");

if (themeSelect) {
  // Load saved theme preference
  const savedTheme = localStorage.getItem("app-theme") || "dark";
  themeSelect.value = savedTheme;
  applyTheme(savedTheme);

  // Listen for theme changes
  themeSelect.addEventListener("change", (e) => {
    const theme = e.target.value;
    localStorage.setItem("app-theme", theme);
    applyTheme(theme);
  });
}

// Function to apply theme
function applyTheme(theme) {
  const html = document.documentElement;

  if (theme === "system") {
    // Detect system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    html.setAttribute("data-theme", prefersDark ? "dark" : "light");

    // Listen for system theme changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (localStorage.getItem("app-theme") === "system") {
        html.setAttribute("data-theme", e.matches ? "dark" : "light");
      }
    });
  } else {
    // Apply selected theme
    html.setAttribute("data-theme", theme);
  }
}

// ================== STEALTH MODE ==================
let isStealthMode = true; // Default is ON (invisible)

if (stealthBtn) {
  // Initialize UI
  updateStealthUI();

  stealthBtn.onclick = async () => {
    isStealthMode = !isStealthMode;
    try {
      await window.mnApi.setContentProtection(isStealthMode);
      updateStealthUI();
    } catch (err) {
      console.error("Failed to toggle stealth mode:", err);
    }
  };
}

function updateStealthUI() {
  if (isStealthMode) {
    stealthBtn.textContent = "🕶️"; // Stealth ON
    stealthBtn.title = "Stealth Mode ON (Invisible to Zoom)";
    stealthBtn.style.color = "var(--accent)";
    stealthBtn.style.opacity = "1";
  } else {
    stealthBtn.textContent = "👁️"; // Stealth OFF (Visible)
    stealthBtn.title = "Stealth Mode OFF (Visible to Zoom)";
    stealthBtn.style.color = "var(--text-muted)";
    stealthBtn.style.opacity = "0.7";
  }
}

// ================== SETTINGS: DATA CONTROLS ==================
const clearHistoryBtn = document.getElementById("clear-history-btn");
const archiveAllBtn = document.getElementById("archive-all-btn");
const manageSharedBtn = document.getElementById("manage-shared-btn");
const manageArchivedBtn = document.getElementById("manage-archived-btn");
const exportDataBtn = document.getElementById("export-data-btn");
const improveModelToggle = document.getElementById("setting-improve-model");
const systemPromptTextarea = document.getElementById("setting-system-prompt");

// Load and save custom system prompt
if (systemPromptTextarea) {
  // Load saved prompt or use default
  const savedPrompt = localStorage.getItem("custom-system-prompt");
  if (savedPrompt) {
    systemPromptTextarea.value = savedPrompt;
  } else {
    systemPromptTextarea.value = buildSystemMessage();
  }

  // Save on change
  systemPromptTextarea.addEventListener("change", () => {
    localStorage.setItem("custom-system-prompt", systemPromptTextarea.value);
  });

  // Also save on input for auto-save
  systemPromptTextarea.addEventListener("input", () => {
    localStorage.setItem("custom-system-prompt", systemPromptTextarea.value);
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete all chats? This cannot be undone.")) {
      messages = [{ role: "system", content: buildSystemMessage() }];
      chatWindow.innerHTML = "";
      localStorage.removeItem("chat-messages");
      addMessage("All conversations have been deleted. Starting fresh!", "assistant");
    }
  });
}

if (archiveAllBtn) {
  archiveAllBtn.addEventListener("click", () => {
    alert("Archive feature coming soon!");
  });
}

if (manageSharedBtn) {
  manageSharedBtn.addEventListener("click", () => {
    alert("Shared links management coming soon!");
  });
}

if (manageArchivedBtn) {
  manageArchivedBtn.addEventListener("click", () => {
    alert("Archived chats management coming soon!");
  });
}

if (exportDataBtn) {
  exportDataBtn.addEventListener("click", () => {
    const dataToExport = {
      messages: messages,
      exportedAt: new Date().toISOString(),
      appVersion: "1.0.0"
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mn-gpt-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

if (improveModelToggle) {
  const savedImproveModel = localStorage.getItem("improve-model") !== "false";
  improveModelToggle.checked = savedImproveModel;

  improveModelToggle.addEventListener("change", (e) => {
    localStorage.setItem("improve-model", e.target.checked ? "true" : "false");
  });
}
