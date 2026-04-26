import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const BANK_DEEP_DIVE_WIDGET_URI =
  "ui://widget/fdic-bank-deep-dive-v1.html";

export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

const BANK_DEEP_DIVE_WIDGET_HTML = String.raw`
<div id="root" class="fdic-app">
  <section class="empty">Loading bank dashboard...</section>
</div>
<style>
  :root {
    color-scheme: light dark;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  body {
    margin: 0;
    background: Canvas;
    color: CanvasText;
  }

  .fdic-app {
    box-sizing: border-box;
    min-height: 100%;
    padding: 16px;
  }

  .empty,
  .panel {
    border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
    border-radius: 8px;
    padding: 14px;
  }

  .header {
    display: grid;
    gap: 6px;
    margin-bottom: 14px;
  }

  .eyebrow {
    color: color-mix(in srgb, CanvasText 58%, transparent);
    font-size: 12px;
    font-weight: 650;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    font-size: 20px;
    line-height: 1.25;
    letter-spacing: 0;
  }

  h2 {
    font-size: 14px;
    line-height: 1.35;
    letter-spacing: 0;
  }

  .subtle {
    color: color-mix(in srgb, CanvasText 64%, transparent);
    font-size: 13px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
    gap: 8px;
    margin: 12px 0;
  }

  .metric {
    border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
    border-radius: 8px;
    padding: 10px;
  }

  .metric dt {
    color: color-mix(in srgb, CanvasText 62%, transparent);
    font-size: 12px;
    margin: 0 0 6px;
  }

  .metric dd {
    font-size: 16px;
    font-weight: 680;
    margin: 0;
  }

  .section {
    margin-top: 14px;
  }

  .list {
    display: grid;
    gap: 6px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  .list li {
    border-left: 3px solid color-mix(in srgb, CanvasText 24%, transparent);
    padding: 4px 0 4px 8px;
    font-size: 13px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }

  button {
    border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
    border-radius: 8px;
    background: Canvas;
    color: CanvasText;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    padding: 8px 10px;
  }
</style>
<script type="module">
  const root = document.getElementById("root");

  function formatMoney(value) {
    if (typeof value !== "number") return "n/a";
    if (Math.abs(value) >= 1000000) return "$" + (value / 1000000).toFixed(1) + "B";
    if (Math.abs(value) >= 1000) return "$" + (value / 1000).toFixed(1) + "M";
    return "$" + value.toLocaleString() + "k";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function render(data) {
    const institution = data?.institution ?? {};
    const assessment = data?.assessment ?? {};
    const metrics = data?.metrics ?? {};
    const signals = data?.risk_signals ?? [];
    const warnings = data?.warnings ?? [];
    const sources = data?.sources ?? [];
    const title = institution.name || "FDIC bank dashboard";

    const signalItems = signals.length
      ? signals.map((signal) => "<li>" + escapeHtml(signal) + "</li>").join("")
      : "<li>No risk signals returned for this dashboard.</li>";
    const warningSection = warnings.length
      ? '<section class="section"><h2>Warnings</h2><ul class="list">' +
        warnings.map((warning) => "<li>" + escapeHtml(warning) + "</li>").join("") +
        "</ul></section>"
      : "";
    const sourceItems = sources
      .map((source) => '<li><a href="' + escapeHtml(source.url) + '" target="_blank" rel="noreferrer">' + escapeHtml(source.title) + "</a></li>")
      .join("");

    root.innerHTML = [
      '<article class="panel">',
      '<header class="header">',
      '<p class="eyebrow">FDIC BankFind</p>',
      "<h1>" + escapeHtml(title) + "</h1>",
      '<p class="subtle">' + escapeHtml(institution.city) + ", " + escapeHtml(institution.state) + " · CERT " + escapeHtml(institution.cert) + " · " + escapeHtml(institution.active ? "Active" : "Inactive or unknown") + "</p>",
      '<p class="subtle">Report date: ' + escapeHtml(institution.report_date ?? "latest available") + " · Public analytical proxy, not an official CAMELS rating.</p>",
      "</header>",
      '<dl class="grid">',
      '<div class="metric"><dt>Assets</dt><dd>' + formatMoney(institution.asset_thousands) + "</dd></div>",
      '<div class="metric"><dt>Deposits</dt><dd>' + formatMoney(institution.deposit_thousands) + "</dd></div>",
      '<div class="metric"><dt>Offices</dt><dd>' + escapeHtml(institution.offices ?? "n/a") + "</dd></div>",
      '<div class="metric"><dt>Proxy band</dt><dd>' + escapeHtml(assessment.proxy_band ?? "n/a") + "</dd></div>",
      '<div class="metric"><dt>ROA</dt><dd>' + escapeHtml(metrics.roa ?? "n/a") + "</dd></div>",
      '<div class="metric"><dt>Tier 1 leverage</dt><dd>' + escapeHtml(metrics.tier1_leverage ?? "n/a") + "</dd></div>",
      "</dl>",
      '<section class="section"><h2>Risk Signals</h2><ul class="list">' + signalItems + "</ul></section>",
      warningSection,
      '<section class="section"><h2>Sources</h2><ul class="list">' + sourceItems + "</ul></section>",
      '<div class="actions">',
      '<button type="button" data-message="Compare CERT ' + escapeHtml(institution.cert) + ' with peers.">Compare peers</button>',
      '<button type="button" data-message="Show the branch footprint for CERT ' + escapeHtml(institution.cert) + '.">Branch footprint</button>',
      '<button type="button" data-message="Analyze the funding profile for CERT ' + escapeHtml(institution.cert) + '.">Funding profile</button>',
      "</div>",
      "</article>",
    ].join("");
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.method === "ui/notifications/tool-result") {
      render(message.params?.structuredContent);
    }
  });

  root.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-message]");
    if (!button) return;
    const text = button.getAttribute("data-message");
    window.parent.postMessage({
      jsonrpc: "2.0",
      method: "ui/message",
      params: { role: "user", content: [{ type: "text", text }] },
    }, "*");
  });

  const initial = window.openai?.toolOutput ?? window.openai?.toolResponse?.structuredContent;
  if (initial) {
    render(initial);
  }
</script>
`.trim();

export function registerChatGptAppResources(server: McpServer): void {
  server.registerResource(
    "fdic-bank-deep-dive-widget",
    BANK_DEEP_DIVE_WIDGET_URI,
    {
      title: "FDIC Bank Deep Dive Widget",
      description:
        "Interactive ChatGPT widget for a public FDIC bank deep-dive dashboard.",
      mimeType: MCP_APP_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: BANK_DEEP_DIVE_WIDGET_URI,
          mimeType: MCP_APP_MIME_TYPE,
          text: BANK_DEEP_DIVE_WIDGET_HTML,
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
            },
            "openai/widgetDescription":
              "Renders an FDIC bank deep-dive dashboard from public BankFind data.",
            "openai/widgetPrefersBorder": true,
            "openai/widgetCSP": {
              connect_domains: [],
              resource_domains: [],
            },
          },
        },
      ],
    }),
  );
}
