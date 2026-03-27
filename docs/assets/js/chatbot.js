const CHATBOT_SESSION_KEY = "bankfind-chatbot-session-id";
const CHATBOT_THREAD_KEY = "bankfind-chatbot-thread";
const RELOAD_TYPE = "reload";

const SUGGESTED_PROMPTS = [
  "Find active banks in Texas with over $5 billion in assets",
  "List the 10 costliest bank failures since 2000",
  "Show quarterly financials for Bank of America during 2024",
  "Run a CAMELS-style health assessment for CERT 3511",
  "Scan Wyoming banks for risk signals and early warnings",
];

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const sanitizeHref = (value) => {
  const trimmed = value.trim();
  if (/^(https?:|mailto:|\/|#)/i.test(trimmed)) {
    return escapeHtml(trimmed);
  }

  return "#";
};

const preserveInlineTokens = (value, pattern, render) => {
  const tokens = [];
  const replaced = value.replace(pattern, (...args) => {
    const token = `@@CHATBOTTOKEN${tokens.length}@@`;
    tokens.push({ token, html: render(...args) });
    return token;
  });

  return { replaced, tokens };
};

const restoreInlineTokens = (value, tokens) =>
  tokens.reduce(
    (result, entry) => result.replaceAll(entry.token, entry.html),
    value,
  );

const formatInline = (value) => {
  const escaped = escapeHtml(value);
  const codeTokens = preserveInlineTokens(
    escaped,
    /`([^`]+)`/g,
    (_match, content) => `<code>${content}</code>`,
  );
  const linkTokens = preserveInlineTokens(
    codeTokens.replaced,
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label, href) =>
      `<a href="${sanitizeHref(href)}" target="_blank" rel="noreferrer">${label}</a>`,
  );

  const formatted = linkTokens.replaced
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\*])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_(?!\s)(.+?)(?<!\s)_(?!_)/g, "$1<em>$2</em>");

  return restoreInlineTokens(restoreInlineTokens(formatted, linkTokens.tokens), codeTokens.tokens);
};

const isTableSeparator = (line) =>
  /^\|?[\s:-]+\|[\s|:-]*$/.test(line.trim());

const isListLine = (line) =>
  /^([-*])\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim());

const getListIndent = (line) => {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
};

const isRawListLine = (line) =>
  /^\s*([-*])\s+/.test(line) || /^\s*\d+\.\s+/.test(line);

const parseListItems = (lines, startIndex) => {
  const items = [];
  let index = startIndex;
  const baseIndent = getListIndent(lines[index]);
  const firstTrimmed = lines[index].trim();
  const isOrdered = /^\d+\.\s+/.test(firstTrimmed);
  const listTag = isOrdered ? "ol" : "ul";
  const listPattern = isOrdered ? /^\d+\.\s+/ : /^[-*]\s+/;

  while (index < lines.length && isRawListLine(lines[index])) {
    const indent = getListIndent(lines[index]);
    const trimmed = lines[index].trim();

    if (indent < baseIndent) {
      break;
    }

    if (indent > baseIndent) {
      const nested = parseListItems(lines, index);
      if (items.length > 0) {
        items[items.length - 1].children = nested.html;
      }
      index = nested.endIndex;
      continue;
    }

    if (!listPattern.test(trimmed)) {
      break;
    }

    items.push({ text: trimmed.replace(listPattern, ""), children: "" });
    index += 1;
  }

  const html = `<${listTag}>${items
    .map((item) => `<li>${formatInline(item.text)}${item.children}</li>`)
    .join("")}</${listTag}>`;

  return { html, endIndex: index };
};

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

    if (line.startsWith("```")) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push(
        `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // Shift heading level down by 1 (h1→h2, etc.) to preserve semantic hierarchy inside chat bubbles
      const level = Math.min(headingMatch[1].length + 1, 6);
      blocks.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
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
          <thead><tr>${header
            .map((cell) => `<th>${formatInline(cell)}</th>`)
            .join("")}</tr></thead>
          <tbody>${rows
            .map(
              (row) =>
                `<tr>${row
                  .map((cell) => `<td>${formatInline(cell)}</td>`)
                  .join("")}</tr>`,
            )
            .join("")}</tbody>
        </table>
      `);
      continue;
    }

    if (isListLine(line)) {
      const result = parseListItems(lines, index);
      blocks.push(result.html);
      index = result.endIndex;
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("```") &&
      !/^(#{1,6})\s+/.test(lines[index].trim()) &&
      !isListLine(lines[index]) &&
      !(
        lines[index].includes("|") &&
        index + 1 < lines.length &&
        isTableSeparator(lines[index + 1])
      )
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(`<p>${formatInline(paragraph.join(" "))}</p>`);
  }

  return blocks.join("");
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
  try {
    window.sessionStorage.setItem(CHATBOT_THREAD_KEY, JSON.stringify(messages));
  } catch {
    // sessionStorage may be unavailable or full in private browsing
  }
};

const clearSessionOnReload = () => {
  const navigation = performance.getEntriesByType?.("navigation")?.[0];
  if (navigation && navigation.type === RELOAD_TYPE) {
    window.sessionStorage.removeItem(CHATBOT_SESSION_KEY);
    window.sessionStorage.removeItem(CHATBOT_THREAD_KEY);
  }
};

const isEditableTarget = (target) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable=''], [contenteditable='true']",
    ),
  );
};

const createLauncherMarkup = (promptingGuideUrl) => {
  const shell = document.createElement("div");
  shell.className = "chatbot-shell";
  shell.innerHTML = `
    <button
      type="button"
      class="chatbot-launcher"
      data-chatbot-launcher
      aria-label="Open the FDIC BankFind chat demo. Keyboard shortcut: question mark."
      title="Try it!"
    >
      <span class="chatbot-launcher__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M4 5.5C4 4.12 5.12 3 6.5 3h11C18.88 3 20 4.12 20 5.5v7C20 13.88 18.88 15 17.5 15H10l-4.4 4.12A.75.75 0 0 1 4.35 18.6V15.1A2.5 2.5 0 0 1 4 13.82V5.5Z"></path>
        </svg>
      </span>
    </button>

    <div class="chatbot-overlay" data-chatbot-overlay hidden>
      <div class="chatbot-overlay__backdrop" data-chatbot-close></div>
      <section
        class="chatbot-overlay__panel"
        data-chatbot-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="chatbot-title"
      >
        <header class="chatbot-overlay__header">
          <div>
            <p class="chatbot-overlay__eyebrow">Try it!</p>
            <h2 id="chatbot-title">FDIC BankFind chat</h2>
            <p class="chatbot-overlay__summary">Ask about institutions, failures, financials, deposits, demographics, and peer groups.</p>
          </div>
          <button type="button" class="chatbot-overlay__close" data-chatbot-close aria-label="Close chat demo">Close</button>
        </header>

        <section class="chatbot-overlay__prompts" aria-label="Suggested prompts" data-chatbot-prompts></section>

        <div class="chatbot-demo__thread" data-chatbot-thread aria-live="polite" aria-busy="false"></div>

        <form class="chatbot-demo__composer" data-chatbot-form>
          <label class="chatbot-demo__composer-label" for="chatbot-input">Ask about FDIC bank data</label>
          <div class="chatbot-demo__composer-row">
            <textarea
              id="chatbot-input"
              name="message"
              rows="3"
              maxlength="500"
              placeholder="Type a question about banks, failures, deposits, financials, or peer groups..."
              data-chatbot-input
            ></textarea>
            <button type="submit" class="chatbot-demo__send" data-chatbot-send aria-label="Send message">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.993.993 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/>
              </svg>
            </button>
          </div>
        </form>

        <p class="chatbot-demo__fallback" data-chatbot-fallback hidden>
          The interactive demo is currently unavailable. See the
          <a href="${promptingGuideUrl}">Prompting Guide</a>
          for example queries you can try in your own MCP client.
        </p>
      </section>
    </div>
  `;

  return shell;
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

const initChatbot = async () => {
  const endpoint = document.body?.dataset.chatEndpoint;
  const promptingGuideUrl =
    document.body?.dataset.chatPromptingGuideUrl || "/prompting-guide/";
  if (!endpoint) {
    return;
  }

  clearSessionOnReload();

  const shell = createLauncherMarkup(promptingGuideUrl);
  document.body.appendChild(shell);

  const launcher = shell.querySelector("[data-chatbot-launcher]");
  const overlay = shell.querySelector("[data-chatbot-overlay]");
  const panel = shell.querySelector("[data-chatbot-panel]");
  const thread = shell.querySelector("[data-chatbot-thread]");
  const promptsRoot = shell.querySelector("[data-chatbot-prompts]");
  const form = shell.querySelector("[data-chatbot-form]");
  const input = shell.querySelector("[data-chatbot-input]");
  const sendButton = shell.querySelector("[data-chatbot-send]");
  const fallback = shell.querySelector("[data-chatbot-fallback]");
  const closeButtons = shell.querySelectorAll("[data-chatbot-close]");

  if (
    !launcher ||
    !overlay ||
    !panel ||
    !thread ||
    !promptsRoot ||
    !form ||
    !input ||
    !sendButton ||
    !fallback
  ) {
    return;
  }

  const normalizeEndpoint = endpoint.replace(/\/+$/, "");
  const statusEndpoint = `${normalizeEndpoint}/status`;
  let sessionId = window.sessionStorage.getItem(CHATBOT_SESSION_KEY) || "";
  let messages = readStoredThread();
  let statusLoaded = false;
  let available = true;
  let lastActiveElement = null;

  promptsRoot.innerHTML = SUGGESTED_PROMPTS.map(
    (prompt) => `
      <button type="button" class="chatbot-demo__prompt" data-prompt="${prompt.replaceAll('"', "&quot;")}">
        <strong>${prompt}</strong>
      </button>
    `,
  ).join("");
  const prompts = Array.from(promptsRoot.querySelectorAll("[data-prompt]"));

  const GREETING = {
    role: "assistant",
    content:
      "Ask about active banks, failures, quarterly financials, annual branch deposits, demographics, or peer groups.",
  };

  const renderThread = () => {
    thread.innerHTML = "";

    const display = messages.length === 0 ? [GREETING] : messages;

    display.forEach((message) => {
      thread.appendChild(createMessageElement(message));
    });

    thread.scrollTop = thread.scrollHeight;
    thread.setAttribute("aria-busy", "false");
    storeThread(messages);
  };

  const setComposerState = (enabled) => {
    input.disabled = !enabled || !available;
    sendButton.disabled = !enabled || !available;
    prompts.forEach((prompt) => {
      prompt.disabled = !enabled || !available;
    });
  };

  const applyAvailabilityState = () => {
    promptsRoot.hidden = !available;
    form.hidden = !available;
    fallback.hidden = available;
    setComposerState(true);
  };

  const loadAvailability = async () => {
    if (statusLoaded) {
      return;
    }

    statusLoaded = true;

    try {
      const statusResponse = await fetch(statusEndpoint, { credentials: "omit" });
      const statusPayload = await statusResponse.json();
      available = Boolean(statusResponse.ok && statusPayload.available === true);
    } catch {
      available = false;
    }

    applyAvailabilityState();
  };

  const addMessage = (message) => {
    messages.push(message);
    renderThread();
  };

  const getFocusableElements = () =>
    Array.from(
      panel.querySelectorAll(
        'button:not([disabled]), textarea:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

  const closeOverlay = () => {
    overlay.classList.remove("is-visible");
    overlay.addEventListener("transitionend", function onEnd() {
      overlay.removeEventListener("transitionend", onEnd);
      overlay.hidden = true;
    });
    document.body.classList.remove("chatbot-open");
    document.body.style.overflow = "";
    lastActiveElement?.focus?.();
  };

  const openOverlay = async () => {
    lastActiveElement = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("chatbot-open");
    document.body.style.overflow = "hidden";
    renderThread();
    await loadAvailability();
    window.requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      (available ? input : panel.querySelector("[data-chatbot-close]"))?.focus();
    });
  };

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

      addMessage({
        role: "assistant",
        content: payload.reply || "No reply returned.",
      });
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

  renderThread();
  applyAvailabilityState();

  launcher.addEventListener("click", () => {
    void openOverlay();
  });

  document.querySelectorAll("[data-chatbot-open]").forEach((button) => {
    button.addEventListener("click", () => {
      void openOverlay();
    });
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeOverlay);
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (overlay.hidden !== true && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeOverlay();
      return;
    }

    if (
      overlay.hidden === true &&
      (event.key === "?" || (event.key === "/" && event.shiftKey))
    ) {
      if (isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      void openOverlay();
    }
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
      return;
    }

    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value || !available) {
      return;
    }

    input.value = "";
    await sendMessage(value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  prompts.forEach((prompt) => {
    prompt.addEventListener("click", () => {
      const value = prompt.dataset.prompt;
      if (!value) {
        return;
      }

      input.value = value;
      form.requestSubmit();
    });
  });
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    void initChatbot();
  });
} else {
  void initChatbot();
}
