const state = {
  characters: [],
  activeCharacterId: "",
  histories: loadHistories(),
  isReplying: false
};

const characterList = document.getElementById("characterList");
const characterCount = document.getElementById("characterCount");
const headerSigil = document.getElementById("headerSigil");
const headerName = document.getElementById("headerName");
const headerStatus = document.getElementById("headerStatus");
const chatMessages = document.getElementById("chatMessages");
const chatScroll = document.getElementById("chatScroll");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const clearButton = document.getElementById("clearButton");
const exportButton = document.getElementById("exportButton");
const menuButton = document.getElementById("menuButton");
const sidebar = document.getElementById("sidebar");

function loadHistories() {
  try {
    return JSON.parse(localStorage.getItem("voices-chat-cache")) || {};
  } catch {
    return {};
  }
}

function saveLocalState() {
  localStorage.setItem("voices-chat-cache", JSON.stringify(state.histories));
}

function getActiveCharacter() {
  return state.characters.find(character => character.id === state.activeCharacterId);
}

function getHistory(characterId) {
  if (!state.histories[characterId]) {
    const character = state.characters.find(item => item.id === characterId);
    state.histories[characterId] = [{
      role: "assistant",
      content: character.greeting,
      createdAt: new Date().toISOString()
    }];
    saveLocalState();
  }
  return state.histories[characterId];
}

function renderCharacterList() {
  characterCount.textContent = String(state.characters.length);
  characterList.replaceChildren();

  for (const character of state.characters) {
    const button = document.createElement("button");
    button.className = `character-card${character.id === state.activeCharacterId ? " active" : ""}`;
    button.dataset.characterId = character.id;

    const avatar = document.createElement("span");
    avatar.className = "character-avatar";
    avatar.textContent = character.sigil;

    const meta = document.createElement("span");
    meta.className = "character-meta";
    const name = document.createElement("span");
    name.className = "character-name";
    name.textContent = character.name;
    const role = document.createElement("span");
    role.className = "character-role";
    role.textContent = character.role;
    meta.append(name, role);

    const dot = document.createElement("span");
    dot.className = "online-dot";
    button.append(avatar, meta, dot);
    button.addEventListener("click", () => switchCharacter(character.id));
    characterList.appendChild(button);
  }
}

function renderHeader() {
  const character = getActiveCharacter();
  if (!character) return;
  headerSigil.textContent = character.sigil;
  headerName.textContent = character.name;
  headerStatus.textContent = character.status;
  messageInput.placeholder = `向${character.name}发送消息……`;
  document.title = `${character.name} · 万象会客厅`;
}

function renderMessages() {
  const character = getActiveCharacter();
  if (!character) return;
  chatMessages.replaceChildren(createSeparator());
  for (const message of getHistory(character.id)) {
    chatMessages.appendChild(createMessageElement(message, character));
  }
  requestAnimationFrame(scrollToBottom);
}

function createSeparator() {
  const separator = document.createElement("div");
  separator.className = "archive-separator";
  separator.textContent = "人物连接已建立 · 现在";
  return separator;
}

function createMessageElement(message, character) {
  const isUser = message.role === "user";
  const article = document.createElement("article");
  article.className = `message${isUser ? " user" : ""}`;
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = isUser ? "我" : character.sigil;
  const body = document.createElement("div");
  body.className = "message-body";
  const author = document.createElement("div");
  author.className = "message-author";
  const authorName = document.createElement("span");
  authorName.textContent = isUser ? "你" : character.name;
  const time = document.createElement("span");
  time.textContent = formatTime(message.createdAt);
  author.append(authorName, time);
  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = message.content;
  body.append(author, content);
  article.append(avatar, body);
  return article;
}

function switchCharacter(characterId) {
  if (state.isReplying || characterId === state.activeCharacterId) {
    sidebar.classList.remove("open");
    return;
  }
  state.activeCharacterId = characterId;
  renderCharacterList();
  renderHeader();
  renderMessages();
  sidebar.classList.remove("open");
  messageInput.focus();
}

function addMessage(message) {
  const character = getActiveCharacter();
  getHistory(character.id).push(message);
  saveLocalState();
  chatMessages.appendChild(createMessageElement(message, character));
  scrollToBottom();
}

function addTypingIndicator() {
  const character = getActiveCharacter();
  const article = document.createElement("article");
  article.className = "message";
  article.id = "typingIndicator";
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = character.sigil;
  const body = document.createElement("div");
  body.className = "message-body";
  const author = document.createElement("div");
  author.className = "message-author";
  const name = document.createElement("span");
  name.textContent = character.name;
  const status = document.createElement("span");
  status.textContent = "正在思考";
  author.append(name, status);
  const dots = document.createElement("div");
  dots.className = "message-content typing-dots";
  dots.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
  body.append(author, dots);
  article.append(avatar, body);
  chatMessages.appendChild(article);
  scrollToBottom();
}

async function handleSubmit(event) {
  event.preventDefault();
  const content = messageInput.value.trim();
  const character = getActiveCharacter();
  if (!content || !character || state.isReplying) return;

  const history = getHistory(character.id)
    .filter(message => message.role === "user" || message.role === "assistant")
    .slice(-20)
    .map(message => ({ role: message.role, content: message.content }));
  const userMessage = { role: "user", content, createdAt: new Date().toISOString() };
  addMessage(userMessage);
  messageInput.value = "";
  resizeInput();
  setReplying(true);
  addTypingIndicator();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        history,
        message: content
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "请求失败，请稍后重试");
    addMessage(result.message);
  } catch (error) {
    addMessage({
      role: "assistant",
      content: `连接失败：${error.message}`,
      createdAt: new Date().toISOString()
    });
  } finally {
    document.getElementById("typingIndicator")?.remove();
    setReplying(false);
    saveLocalState();
    messageInput.focus();
  }
}

async function clearConversation() {
  const character = getActiveCharacter();
  if (!character || !window.confirm(`确定清空与${character.name}的全部对话吗？`)) return;
  delete state.histories[character.id];
  saveLocalState();
  renderMessages();
}

function exportConversation() {
  const character = getActiveCharacter();
  if (!character) return;
  const lines = getHistory(character.id).map(message => {
    const author = message.role === "user" ? "你" : character.name;
    return `[${formatTime(message.createdAt)}] ${author}\n${message.content}`;
  });
  const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${character.name}-对话记录.txt`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setReplying(value) {
  state.isReplying = value;
  sendButton.disabled = value;
}

function resizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 138)}px`;
}

function scrollToBottom() {
  chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: "smooth" });
}

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

async function initialize() {
  try {
    const response = await fetch("/api/characters");
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.characters) || result.characters.length === 0) {
      throw new Error(result.error || "没有可用人物");
    }
    state.characters = result.characters;
    state.activeCharacterId = result.characters[0].id;
    renderCharacterList();
    renderHeader();
    renderMessages();
    messageInput.focus();
  } catch (error) {
    headerName.textContent = "服务未连接";
    headerStatus.textContent = error.message;
    messageInput.disabled = true;
    sendButton.disabled = true;
  }
}

chatForm.addEventListener("submit", handleSubmit);
messageInput.addEventListener("input", resizeInput);
messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});
clearButton.addEventListener("click", clearConversation);
exportButton.addEventListener("click", exportConversation);
menuButton.addEventListener("click", () => sidebar.classList.toggle("open"));
document.addEventListener("click", event => {
  if (window.innerWidth <= 760 && sidebar.classList.contains("open") && !sidebar.contains(event.target) && event.target !== menuButton) {
    sidebar.classList.remove("open");
  }
});

initialize();
