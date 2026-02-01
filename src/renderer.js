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
  model: "gpt-4o-mini"
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
  console.log("handleSend triggered");
  if (!userInput) {
    console.error("userInput element not found");
    return;
  }
  const text = userInput.value.trim();
  if (!text && !pendingAttachment) return;

  console.log("Sending message:", text);
  userInput.value = "";
  addMessage(text || "[Image sent]", "user");

  messages.push({
    role: "user",
    content: text || "[Image]"
  });

  const loading = addLoading();

  try {
    console.log("Calling mnApi.chat...");
    const res = await window.mnApi.chat({
      model: appSettings.model,
      messages,
      image: pendingAttachment
    });

    console.log("Chat response received:", res);
    removeLoading(loading);

    if (!res || !res.ok) {
      addMessage("Error: " + (res?.error || "Unknown error"));
      return;
    }

    addMessage(res.reply, "assistant");
    messages.push({ role: "assistant", content: res.reply });
  } catch (err) {
    console.error("Error in handleSend:", err);
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
if (sendBtn) {
  sendBtn.onclick = handleSend;
}

if (userInput) {
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
}

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

// ================== GLOBAL SHORTCUT HANDLERS ==================
if (window.mnApi && window.mnApi.onShortcut) {
  window.mnApi.onShortcut((action) => {
    console.log("Global shortcut received:", action);
    switch (action) {
      case 'nextStep':
        handleScreenshotAnalysis();
        break;
      case 'scrollUp':
        chatWindow.scrollBy({ top: -200, behavior: 'smooth' });
        break;
      case 'scrollDown':
        chatWindow.scrollBy({ top: 200, behavior: 'smooth' });
        break;
      case 'previousResponse':
        // Optional: Scroll to previous assistant message
        const assistantMsgs = document.querySelectorAll('.message-bubble.bot');
        if (assistantMsgs.length > 0) {
          // Logic could be improved to find the one above current viewport
          assistantMsgs[0].scrollIntoView({ behavior: 'smooth' });
        }
        break;
      case 'nextResponse':
        // Optional: Scroll to next assistant message
        chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
        break;
    }
  });
}

// ================== LICENSE MANAGEMENT ==================
const SECRET_KEY = 'DESIER_AI_PREMIUM_LICENSE_SECRET_KEY_V1';

function getDeviceId() {
  let deviceId = localStorage.getItem("device-id");
  if (!deviceId) {
    // Generate a reasonably unique ID if none exists
    deviceId = 'MN-' + Math.random().toString(36).substring(2, 10).toUpperCase() +
      '-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    localStorage.setItem("device-id", deviceId);
  }
  return deviceId;
}

// SHA256 + HMAC implementation (Ported for independent usage)
var sha256 = function sha256(ascii) {
  function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); };
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var result = '';
  var words = [];
  var asciiBitLength = ascii.length * 8;
  var i, j;
  var k = sha256.k = sha256.k || [];
  var primeCounter = k.length;
  var isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) { isComposite[i] = candidate; }
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  // INITIAL HASH VALUES must be reset on every call
  var hash = [];
  var primeCounter2 = 0;
  var isComposite2 = {};
  for (var candidate = 2; primeCounter2 < 8; candidate++) {
    if (!isComposite2[candidate]) {
      for (i = 0; i < 313; i += candidate) { isComposite2[i] = candidate; }
      hash[primeCounter2++] = (mathPow(candidate, .5) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return;
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = ((asciiBitLength / maxWord) | 0);
  words[words.length] = (asciiBitLength);
  for (j = 0; j < words.length;) {
    var w = words.slice(j, j += 16);
    var oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var i2 = i + j;
      var w15 = w[i - 15], w2 = w[i - 2];
      var a = hash[0], e = hash[4];
      var temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) { hash[i] = (hash[i] + oldHash[i]) | 0; }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
  }
  return result;
};

function hmacSha256(key, message) {
  var b = 64;
  if (key.length > b) key = hexToAscii(sha256(key));
  while (key.length < b) key += '\x00';
  var ipad = '', opad = '';
  for (var i = 0; i < b; i++) {
    ipad += String.fromCharCode(key.charCodeAt(i) ^ 0x36);
    opad += String.fromCharCode(key.charCodeAt(i) ^ 0x5c);
  }
  return sha256(opad + hexToAscii(sha256(ipad + message)));
}

function hexToAscii(hex) {
  var str = '';
  for (var i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}

function verifyLicenseKey(key) {
  if (!key) return false;
  const cleanKey = key.replace(/-/g, '').toUpperCase();
  if (cleanKey.length !== 16) return false;

  const prefix = cleanKey.substring(0, 4);
  const type = cleanKey.substring(4, 5);
  const signature = cleanKey.substring(5);

  const deviceId = getDeviceId();
  const expectedData = deviceId + prefix + type;
  const expectedHash = hmacSha256(SECRET_KEY, expectedData);
  const expectedSignature = expectedHash.substring(0, 11).toUpperCase();

  if (signature !== expectedSignature) return false;

  // Check expiration
  if (prefix !== 'FFFF') {
    const epoch = new Date('2024-01-01T00:00:00Z');
    const expirationDays = parseInt(prefix, 16);
    const expirationDate = new Date(epoch.getTime() + expirationDays * 24 * 60 * 60 * 1000);
    if (new Date() > expirationDate) return false;
  }

  return true;
}

function updateLicenseUI() {
  const deviceId = getDeviceId();
  const displayIdElem = document.getElementById("display-device-id");
  if (displayIdElem) displayIdElem.textContent = deviceId;

  const lockIdElem = document.getElementById("lock-device-id");
  if (lockIdElem) lockIdElem.textContent = deviceId;

  const savedKey = localStorage.getItem("license-key");
  const isActivated = verifyLicenseKey(savedKey);
  const statusElem = document.getElementById("license-status");

  const lockScreen = document.getElementById("license-lock-screen");

  if (isActivated) {
    if (statusElem) {
      statusElem.textContent = "Activated (Premium)";
      statusElem.style.color = "#10b981";
    }
    if (lockScreen) lockScreen.style.display = "none";
  } else {
    if (statusElem) {
      statusElem.textContent = "Not Activated";
      statusElem.style.color = "#ef4444";
    }
    if (lockScreen) lockScreen.style.display = "flex";
  }

  const keyInput = document.getElementById("license-key-input");
  if (keyInput && savedKey) keyInput.value = savedKey;
}

// License event listeners
const copyIdBtn = document.getElementById("copy-device-id-btn");
if (copyIdBtn) {
  copyIdBtn.onclick = () => {
    const id = getDeviceId();
    navigator.clipboard.writeText(id).then(() => {
      copyIdBtn.textContent = "Copied!";
      setTimeout(() => copyIdBtn.textContent = "Copy", 2000);
    });
  };
}

const activateBtn = document.getElementById("activate-license-btn");
if (activateBtn) {
  activateBtn.onclick = () => {
    const key = document.getElementById("license-key-input").value.trim();
    if (verifyLicenseKey(key)) {
      localStorage.setItem("license-key", key);
      updateLicenseUI();
      alert("Application successfully activated!");
    } else {
      alert("Invalid or expired license key.");
    }
  };
}

const lockActivateBtn = document.getElementById("lock-activate-btn");
if (lockActivateBtn) {
  lockActivateBtn.onclick = () => {
    const key = document.getElementById("lock-license-key").value.trim();
    if (verifyLicenseKey(key)) {
      localStorage.setItem("license-key", key);
      updateLicenseUI();
      alert("Application successfully activated!");
    } else {
      alert("Invalid or expired license key.");
    }
  };
}

const masterResetBtn = document.getElementById("master-reset-btn");
if (masterResetBtn) {
  masterResetBtn.onclick = () => {
    if (confirm("CRITICAL WARNING: This will delete ALL your data, including your license and settings. The app will restart as a fresh installation. Are you sure?")) {
      localStorage.clear();
      alert("Data cleared. The app will now close. Please restart it manually.");
      if (window.mnApi && window.mnApi.quitApp) {
        window.mnApi.quitApp();
      }
    }
  };
}

// Initialize license on load
updateLicenseUI();

if (window.mnApi && window.mnApi.onClickThroughToggled) {
  window.mnApi.onClickThroughToggled((enabled) => {
    console.log("Click-through toggled:", enabled);
    if (enabled) {
      document.body.style.border = "2px solid var(--accent)";
      setTimeout(() => document.body.style.border = "none", 1000);
    }
  });
}

// ================== AUDIO CAPTURE ==================
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.05; // 50ms chunks
const BUFFER_SIZE = 2048;
let isAudioPaused = false;
let isMicActive = false;
let micAudioProcessor = null;
let audioCtx = null;
let micStreamSource = null;

const micBtn = document.getElementById("mic-btn");

async function startMicCapture() {
  try {
    micStreamSource = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    const source = audioCtx.createMediaStreamSource(micStreamSource);
    const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
    const samplesPerChunk = Math.floor(SAMPLE_RATE * AUDIO_CHUNK_DURATION);
    let currentChunk = new Float32Array(samplesPerChunk);
    let currentChunkIndex = 0;

    processor.onaudioprocess = (e) => {
      if (isAudioPaused || !isMicActive) return;
      const inputData = e.inputBuffer.getChannelData(0);
      for (let i = 0; i < inputData.length; i++) {
        if (currentChunkIndex < samplesPerChunk) {
          currentChunk[currentChunkIndex++] = inputData[i];
        }
        if (currentChunkIndex >= samplesPerChunk) {
          // Convert Float32 to Int16 PCM
          const pcmData16 = new Int16Array(currentChunk.length);
          for (let j = 0; j < currentChunk.length; j++) {
            const s = Math.max(-1, Math.min(1, currentChunk[j]));
            pcmData16[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          // Convert to Base64 and send via IPC
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData16.buffer)));
          window.mnApi.sendAudioChunk(base64Data);
          currentChunkIndex = 0;
        }
      }
    };
    source.connect(processor);
    processor.connect(audioCtx.destination);
    micAudioProcessor = processor;
    isMicActive = true;
    updateMicUI();
  } catch (err) {
    console.error('Mic capture failed:', err);
    alert('Failed to access microphone. Please check permissions.');
  }
}

function stopMicCapture() {
  isMicActive = false;
  if (micAudioProcessor) {
    micAudioProcessor.disconnect();
    micAudioProcessor = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(console.error);
    audioCtx = null;
  }
  if (micStreamSource) {
    micStreamSource.getTracks().forEach(track => track.stop());
    micStreamSource = null;
  }
  updateMicUI();
}

function updateMicUI() {
  if (micBtn) {
    if (isMicActive) {
      micBtn.classList.add("mic-active");
      micBtn.style.color = "#10b981"; // Green when active
      micBtn.title = "Turn Off Microphone";
    } else {
      micBtn.classList.remove("mic-active");
      micBtn.style.color = "";
      micBtn.title = "Turn On Microphone";
    }
  }
}

if (micBtn) {
  micBtn.onclick = () => {
    if (isMicActive) {
      stopMicCapture();
    } else {
      startMicCapture();
    }
  };
}

// Handle transcription results
if (window.mnApi && window.mnApi.onTranscriptionResult) {
  window.mnApi.onTranscriptionResult((text) => {
    if (text && text.trim()) {
      if (userInput) {
        userInput.value = text;
        userInput.focus();
        // Auto-trigger send
        handleSend();
      }
    }
  });
}
