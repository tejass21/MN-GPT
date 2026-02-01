const chatWindow = document.getElementById("chat-window");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const newChatBtn = document.getElementById("new-chat-btn");

let messages = [
  { role: "system", content: "You are MN-GPT, an AI assistant styled like MN-AI and optimized for interviews and coding help." }
];

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

async function handleSend() {
  const text = userInput.value.trim();
  if (!text) return;
  userInput.value = "";

  addMessage(text, "user");
  messages.push({ role: "user", content: text });

  const loadingId = addLoading();

  const res = await window.mnGpt.chat(messages);
  removeLoading(loadingId);

  if (!res.ok) {
    addMessage("Error: " + res.error, "assistant");
    return;
  }

  addMessage(res.reply, "assistant");
  messages.push({ role: "assistant", content: res.reply });
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
  if (row && row.parentNode) {
    row.parentNode.removeChild(row);
  }
}

sendBtn.addEventListener("click", handleSend);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

newChatBtn.addEventListener("click", () => {
  messages = [messages[0]];
  chatWindow.innerHTML = "";
});

addMessage("Hi, I'm MN-GPT. Ask me anything about interviews, resumes or code.", "assistant");
