const conversation = document.querySelector("#conversation");
const chatForm = document.querySelector("#chat-form");
const messageInput = document.querySelector("#message-input");
const characterCount = document.querySelector("#character-count");
const promptArea = document.querySelector("#prompt-area");
const subjectButtons = document.querySelectorAll(".subject-link");
const focusSubject = document.querySelector("#focus-subject");
const breadcrumbSubject = document.querySelector("#breadcrumb-subject");
const menuButton = document.querySelector("#mobile-menu");
const sidebar = document.querySelector("#app-sidebar");
const storageKey = "studybuddy-demo-conversation";
let currentSubject = "Mathematics";
let isReplying = false;
let pendingReplyTimeout = null;

const starterMessage = {
  role: "tutor",
  text: "Hey! I’m here whenever you need a hand. What are you working on today?\n\nNo need to have the perfect question—just tell me where you got stuck. 🌱",
};

function addMessage(role, text, time = "Just now", persist = true) {
  const message = document.createElement("div");
  message.className = `message ${role === "user" ? "user-message" : "tutor-message"}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "S" : "✳";

  const content = document.createElement("div");
  content.className = "message-content";

  const author = document.createElement("span");
  author.className = "message-author";
  const name = document.createElement("span");
  name.textContent = role === "user" ? "You" : "StudyBuddy";
  const timestamp = document.createElement("time");
  timestamp.textContent = time;
  author.append(name, timestamp);

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  text.split("\n").filter(Boolean).forEach((line) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    bubble.append(paragraph);
  });

  content.append(author, bubble);
  message.append(avatar, content);
  conversation.append(message);
  conversation.scrollTop = conversation.scrollHeight;

  if (persist) {
    saveConversation();
  }
}

function saveConversation() {
  const messages = [...conversation.querySelectorAll(".message:not(.is-typing)")].map((message) => ({
    role: message.classList.contains("user-message") ? "user" : "tutor",
    text: [...message.querySelectorAll(".message-bubble p")].map((paragraph) => paragraph.textContent).join("\n"),
  }));
  try {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  } catch (error) {
    console.warn("StudyBuddy could not save this session in this browser.", error);
  }
}

function restoreConversation() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!Array.isArray(saved) || !saved.every((message) =>
      message && ["user", "tutor"].includes(message.role) && typeof message.text === "string"
    )) {
      addMessage(starterMessage.role, starterMessage.text, "Just now", false);
      return;
    }

    saved.forEach((message, index) => {
      addMessage(message.role, message.text, index === 0 ? "Just now" : "Saved", false);
    });
  } catch (error) {
    console.warn("StudyBuddy could not restore this session from this browser.", error);
    addMessage(starterMessage.role, starterMessage.text, "Just now", false);
  }
}

function makeTutorReply(question) {
  const normalized = question.toLowerCase();

  if (/how do i use|how to use|how does this work|help me get started/.test(normalized)) {
    return "Just type a question or tap one of the suggestions to get started. Pick a subject from the sidebar, or use the quick tools to ask for a simpler explanation, a mini quiz, or a study plan. You can ask follow-up questions whenever you like.";
  }
  if (/quiz|practice|test me/.test(normalized)) {
    return `Let’s do a quick check-in for ${currentSubject.toLowerCase()}! Try this: explain one idea from today’s lesson in your own words. What would you say?`;
  }
  if (/plan|study plan|organize|schedule/.test(normalized)) {
    return "Here’s a gentle plan to get started:\n1. Pick one small topic to focus on.\n2. Study it for 20 minutes, then take a 5-minute break.\n3. Try one practice question and note anything you want to revisit.";
  }
  if (/digital logic|logic gate|boolean|truth table|flip.?flop|karnaugh|k-map/.test(normalized) || currentSubject === "Digital Logic Design") {
    return "Let’s break digital logic down into small pieces. Digital circuits use binary values—0 and 1—and logic gates transform those inputs into outputs. For example, an AND gate outputs 1 only when both inputs are 1. Which gate, truth table, or circuit are you working on?";
  }
  if (/explain|simple|simply|what is|how does/.test(normalized) && /photo|plant|sunlight|chlorophyll/.test(normalized)) {
    return "Plants make their own food through photosynthesis. Their leaves use sunlight to turn water and carbon dioxide into sugar for energy, releasing oxygen along the way. Think of a leaf as a tiny solar-powered kitchen!";
  }
  if (/\d|equation|solve|math|fraction|algebra|x\s*[=+*-]/.test(normalized)) {
    if (/2\s*x|2x/.test(normalized) && /13|solve/.test(normalized)) {
      return "Let’s solve 2x + 5 = 13 together:\n1. Subtract 5 from both sides: 2x = 8.\n2. Divide both sides by 2: x = 4.\nCheck: 2 × 4 + 5 = 13. Want to try a similar one?";
    }
    return "Let’s take it one step at a time. First, tell me what you already know and where you got stuck. We can break the problem into smaller pieces and work through them together.";
  }
  if (/essay|writing|paragraph|thesis|write/.test(normalized)) {
    return "A good first step is to jot down your main idea without worrying about perfect wording. What do you want your reader to understand? Share your topic, and we can shape that into an opening together.";
  }
  if (/science|water cycle|photosynthesis|gravity|atom|cell/.test(normalized)) {
    return "Let’s make that idea less mysterious. Tell me which part feels confusing, and we’ll connect it to something familiar, then work through a simple example together.";
  }
  return `I’m glad you asked. Let’s work through ${currentSubject.toLowerCase()} together. What have you tried so far, or which part feels trickiest? I’ll help you find the next step.`;
}

function sendMessage(text) {
  const question = text.trim();
  if (!question || isReplying) return;

  addMessage("user", question);
  promptArea.hidden = true;
  messageInput.value = "";
  updateCharacterCount();
  setComposerDisabled(true);

  const typing = document.createElement("div");
  typing.className = "message tutor-message is-typing";
  typing.setAttribute("aria-label", "StudyBuddy is thinking");
  typing.innerHTML = '<div class="message-avatar" aria-hidden="true">✳</div><div class="message-content"><span class="message-author">StudyBuddy</span><div class="message-bubble">Thinking it through…</div></div>';
  conversation.append(typing);
  conversation.scrollTop = conversation.scrollHeight;
  isReplying = true;

  pendingReplyTimeout = window.setTimeout(() => {
    typing.remove();
    addMessage("tutor", makeTutorReply(question));
    isReplying = false;
    pendingReplyTimeout = null;
    setComposerDisabled(false);
    messageInput.focus();
  }, 450);
}

function setComposerDisabled(disabled) {
  chatForm.querySelector('button[type="submit"]').disabled = disabled;
  messageInput.disabled = disabled;
}

function updateCharacterCount() {
  characterCount.textContent = `${messageInput.value.length}/1000`;
}

function resetConversation() {
  if (pendingReplyTimeout !== null) {
    window.clearTimeout(pendingReplyTimeout);
    pendingReplyTimeout = null;
  }
  isReplying = false;
  setComposerDisabled(false);
  conversation.replaceChildren();
  addMessage(starterMessage.role, starterMessage.text, "Just now", false);
  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn("StudyBuddy could not clear the saved session from this browser.", error);
  }
  promptArea.hidden = false;
  messageInput.value = "";
  updateCharacterCount();
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(messageInput.value);
});

messageInput.addEventListener("input", updateCharacterCount);
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

document.querySelectorAll(".prompt-chip").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.textContent));
});

document.querySelector("#clear-chat").addEventListener("click", resetConversation);
document.querySelector("#new-chat").addEventListener("click", resetConversation);
document.querySelector("#help-button").addEventListener("click", () => sendMessage("How do I use StudyBuddy?"));

subjectButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentSubject = button.dataset.subject;
    subjectButtons.forEach((subjectButton) => subjectButton.classList.toggle("selected", subjectButton === button));
    focusSubject.textContent = currentSubject;
    breadcrumbSubject.textContent = currentSubject;
    document.querySelector(".focus-icon").textContent = currentSubject === "Mathematics" ? "＋" : currentSubject === "Science" ? "◉" : currentSubject === "Writing" ? "Aa" : "✳";
    if (window.innerWidth <= 780) {
      sidebar.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
});

document.querySelector("#explain-button").addEventListener("click", () => sendMessage(`Can you explain ${currentSubject.toLowerCase()} simply?`));
document.querySelector("#quiz-button").addEventListener("click", () => sendMessage(`Can you quiz me on ${currentSubject.toLowerCase()}?`));
document.querySelector("#steps-button").addEventListener("click", () => sendMessage("Can you help me make a study plan?"));

document.querySelectorAll(".recent-session").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt));
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    resetConversation();
    messageInput.focus();
  }
});

menuButton.addEventListener("click", () => {
  const isExpanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isExpanded));
  menuButton.setAttribute("aria-label", isExpanded ? "Open menu" : "Close menu");
  sidebar.classList.toggle("is-open", !isExpanded);
});

restoreConversation();
