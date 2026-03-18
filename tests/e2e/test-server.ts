import path from "node:path";
import express from "express";

const app = express();
const repoRoot = process.cwd();

function renderPage(endpoint: string): string {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Try It</title>
      <link rel="stylesheet" href="/assets/css/docs.css">
      <script defer src="/assets/js/chatbot.js"></script>
    </head>
    <body data-chat-endpoint="${endpoint}">
      <main class="page-shell">
        <div class="page-frame">
          <article class="doc-content">
            <p>Docs page content.</p>
          </article>
        </div>
      </main>
    </body>
  </html>`;
}

app.use(express.json());
app.use("/assets", express.static(path.join(repoRoot, "docs/assets")));

app.get("/prompting-guide/", (_req, res) => {
  res.type("html").send("<!doctype html><title>Prompting Guide</title>");
});

app.get("/", (_req, res) => {
  res.type("html").send(renderPage("/chat"));
});

app.get("/unavailable/", (_req, res) => {
  res.type("html").send(renderPage("/chat-unavailable"));
});

app.get("/rate-limit/", (_req, res) => {
  res.type("html").send(renderPage("/chat-rate-limit"));
});

app.get("/chat/status", (_req, res) => {
  res.json({ available: true });
});

app.post("/chat", (req, res) => {
  const prompt = req.body?.messages?.[0]?.content ?? "";
  const isPromptClick = prompt.includes("Texas");
  const reply = isPromptClick
    ? "**Texas results**\n\n- Bank A\n- Bank B"
    : "| Bank | State |\n| --- | --- |\n| First Demo Bank | NC |";

  setTimeout(() => {
    res.json({
      sessionId: req.body?.sessionId || "demo-session",
      reply,
    });
  }, 150);
});

app.get("/chat-unavailable/status", (_req, res) => {
  res.json({ available: false });
});

app.post("/chat-unavailable", (_req, res) => {
  res.status(503).json({ error: "Chat unavailable" });
});

app.get("/chat-rate-limit/status", (_req, res) => {
  res.json({ available: true });
});

app.post("/chat-rate-limit", (_req, res) => {
  setTimeout(() => {
    res.status(429).json({ error: "Rate limit exceeded" });
  }, 150);
});

const port = 4173;
app.listen(port, "127.0.0.1", () => {
  console.log(`Playwright test server listening on http://127.0.0.1:${port}`);
});
