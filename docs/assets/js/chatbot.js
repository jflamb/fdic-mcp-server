const CHATBOT_SESSION_KEY = "bankfind-chatbot-session-id";
const CHATBOT_THREAD_KEY = "bankfind-chatbot-thread";
const RELOAD_TYPE = "reload";

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const formatInline = (value) =>
  escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

const isTableSeparator = (line) =>
  /^\|?[\s:-]+\|[\s|:-]*$/.test(line.trim());

const parseMarkdown = (source) => {
  const lines = source.replace(/\r\n/g, "\n").trim().split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const header = line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(
          lines[index]
            .split("|")
            .map((cell) => cell.trim())
            .filter(Boolean),
        );
        index += 1;
      }

      blocks.push(`
        <table>
          <thead><tr>${header.map((cell) => `<th>${formatInline(cell)}</th>`).join("")}</tr></thead>
          <tbody>${rows
            .map(
              (row) =>
                `<tr>${row.map((cell) => `<td>${formatInline(cell)}</td>`).join("")}</tr>`,
            )
            .join("")}</tbody>
        </table>
      `);
      continue;
    }

    if (line.startsWith("- ")) {
      const items = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim()) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(`<p>${formatInline(paragraph.join(" "))}</p>`);
  }

  return blocks.join("");
};

const createMessageElement = (message) => {
  const article = document.createElement("article");
  article.className = `chatbot-demo__message chatbot-demo__message--${message.role}`;
  if (message.error) {
    article.classList.add("chatbot-demo__message--error");
  }

  const bubble = document.createElement("div");
  bubble.className = "chatbot-demo__bubble";

  if (message.loading) {
    bubble.innerHTML = `
      <span class="chatbot-demo__loading" aria-label="Loading response">
        <span></span><span></span><span></span>
      </span>
    `;
  } else if (message.role === "assistant") {
    bubble.innerHTML = parseMarkdown(message.content);
  } else {
    bubble.textContent = message.content;
  }

  article.appendChild(bubble);
  return article;
};

const readStoredThread = () => {
  try {
    const raw = window.sessionStorage.getItem(CHATBOT_THREAD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const storeThread = (messages) => {
  window.sessionStorage.setItem(CHATBOT_THREAD_KEY, JSON.stringify(messages));
};

const clearSessionOnReload = () => {
  const navigation = performance.getEntriesByType?.("navigation")?.[0];
  if (navigation && navigation.type === RELOAD_TYPE) {
    window.sessionStorage.removeItem(CHATBOT_SESSION_KEY);
    window.sessionStorage.removeItem(CHATBOT_THREAD_KEY);
  }
};

const initChatbot = async () => {
  const root = document.querySelector("[data-chatbot-root]");
  if (!root) {
    return;
  }

  clearSessionOnReload();

  const thread = root.querySelector("[data-chatbot-thread]");
  const prompts = Array.from(root.querySelectorAll("[data-prompt]"));
  const form = root.querySelector("[data-chatbot-form]");
  const input = root.querySelector("[data-chatbot-input]");
  const sendButton = root.querySelector("[data-chatbot-send]");
  const fallback = root.querySelector("[data-chatbot-fallback]");
  const promptSection = root.querySelector("[data-chatbot-prompts]");
  const endpoint = root.dataset.chatEndpoint;

  if (!thread || !form || !input || !sendButton || !fallback || !promptSection || !endpoint) {
    return;
  }

  const normalizeEndpoint = endpoint.replace(/\/+$/, "");
  const statusEndpoint = `${normalizeEndpoint}/status`;
  let sessionId = window.sessionStorage.getItem(CHATBOT_SESSION_KEY) || "";
  let messages = readStoredThread();

  const renderThread = () => {
    thread.innerHTML = "";

    if (messages.length === 0) {
      messages = [
        {
          role: "assistant",
          content:
            "Ask about active banks, failures, quarterly financials, annual branch deposits, demographics, or peer groups.",
        },
      ];
    }

    messages.forEach((message) => {
      thread.appendChild(createMessageElement(message));
    });
    thread.scrollTop = thread.scrollHeight;
    thread.setAttribute("aria-busy", "false");
    storeThread(messages);
  };

  const setComposerState = (enabled) => {
    input.disabled = !enabled;
    sendButton.disabled = !enabled;
    prompts.forEach((prompt) => {
      prompt.disabled = !enabled;
    });
  };

  const setUnavailable = () => {
    setComposerState(false);
    promptSection.hidden = true;
    form.hidden = true;
    fallback.hidden = false;
  };

  const addMessage = (message) => {
    messages.push(message);
    renderThread();
  };

  renderThread();

  try {
    const statusResponse = await fetch(statusEndpoint, { credentials: "omit" });
    const statusPayload = await statusResponse.json();
    if (!statusResponse.ok || statusPayload.available !== true) {
      setUnavailable();
      return;
    }
  } catch {
    setUnavailable();
    return;
  }

  const sendMessage = async (content) => {
    addMessage({ role: "user", content });
    thread.setAttribute("aria-busy", "true");
    messages.push({ role: "assistant", content: "", loading: true });
    renderThread();
    setComposerState(false);

    try {
      const response = await fetch(normalizeEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          messages: [{ role: "user", content }],
        }),
      });

      messages = messages.filter((message) => !message.loading);

      if (response.status === 429) {
        addMessage({
          role: "assistant",
          content: "Rate limit reached. Wait a minute, then try again.",
          error: true,
        });
        return;
      }

      if (!response.ok) {
        addMessage({
          role: "assistant",
          content: "The demo could not process that request right now.",
          error: true,
        });
        return;
      }

      const payload = await response.json();
      if (typeof payload.sessionId === "string" && payload.sessionId) {
        sessionId = payload.sessionId;
        window.sessionStorage.setItem(CHATBOT_SESSION_KEY, sessionId);
      }

      addMessage({ role: "assistant", content: payload.reply || "No reply returned." });
    } catch {
      messages = messages.filter((message) => !message.loading);
      addMessage({
        role: "assistant",
        content: "The demo request failed before a response was returned.",
        error: true,
      });
    } finally {
      setComposerState(true);
      thread.setAttribute("aria-busy", "false");
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      return;
    }

    input.value = "";
    await sendMessage(value);
  });

  input.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  prompts.forEach((prompt) => {
    prompt.addEventListener("click", async () => {
      const value = prompt.dataset.prompt;
      if (!value) {
        return;
      }

      input.value = value;
      form.requestSubmit();
    });
  });
};

window.addEventListener("DOMContentLoaded", () => {
  void initChatbot();
});
