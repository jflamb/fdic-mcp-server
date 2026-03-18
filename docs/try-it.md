---
title: Try It
nav_group: user
kicker: Interactive Demo
summary: Ask the hosted demo assistant to explore FDIC bank data through the same MCP tools the server exposes to clients.
breadcrumbs:
  - title: Overview
    url: /
  - title: Use the Server
    url: /user-guide/
body_class: page-try-it
---

<div class="chatbot-demo" data-chatbot-root data-chat-endpoint="https://bankfind.jflamb.com/chat">
  <section class="chatbot-demo__intro">
    <p class="chatbot-demo__eyebrow">Hosted Demo</p>
    <h2>Try the MCP server without installing anything.</h2>
    <p>
      This demo stays scoped to FDIC BankFind data. It uses the hosted Cloud Run service, calls the registered MCP tools in-process,
      and returns a short conversational answer.
    </p>
    <p class="chatbot-demo__intro-note">
      Need prompt ideas for your own host instead? See the
      <a href="{{ '/prompting-guide/' | relative_url }}">Prompting Guide</a>.
    </p>
  </section>

  <section class="chatbot-demo__prompts" aria-label="Suggested prompts" data-chatbot-prompts>
    <button type="button" class="chatbot-demo__prompt" data-prompt="Find active banks in Texas with over $5 billion in assets">
      <span class="chatbot-demo__prompt-label">Institution Search</span>
      <strong>Find active banks in Texas with over $5 billion in assets</strong>
    </button>
    <button type="button" class="chatbot-demo__prompt" data-prompt="List the 10 costliest bank failures since 2000">
      <span class="chatbot-demo__prompt-label">Failures</span>
      <strong>List the 10 costliest bank failures since 2000</strong>
    </button>
    <button type="button" class="chatbot-demo__prompt" data-prompt="Show quarterly financials for Bank of America during 2024">
      <span class="chatbot-demo__prompt-label">Financials</span>
      <strong>Show quarterly financials for Bank of America during 2024</strong>
    </button>
    <button type="button" class="chatbot-demo__prompt" data-prompt="Compare North Carolina banks between 2021 and 2025 by deposit growth">
      <span class="chatbot-demo__prompt-label">Comparison</span>
      <strong>Compare North Carolina banks between 2021 and 2025 by deposit growth</strong>
    </button>
    <button type="button" class="chatbot-demo__prompt" data-prompt="Build a peer group for CERT 29846 and rank on ROA and efficiency ratio">
      <span class="chatbot-demo__prompt-label">Peer Analysis</span>
      <strong>Build a peer group for CERT 29846 and rank on ROA and efficiency ratio</strong>
    </button>
  </section>

  <section class="chatbot-demo__panel" aria-label="Chat demo">
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
        <button type="submit" class="chatbot-demo__send" data-chatbot-send>Send</button>
      </div>
    </form>
    <p class="chatbot-demo__fallback" data-chatbot-fallback hidden>
      The interactive demo is currently unavailable. See the
      <a href="{{ '/prompting-guide/' | relative_url }}">Prompting Guide</a>
      for example queries you can try in your own MCP client.
    </p>
  </section>

  <noscript>
    <p class="chatbot-demo__fallback-noscript">
      This demo requires JavaScript. See the <a href="{{ '/prompting-guide/' | relative_url }}">Prompting Guide</a> for copyable prompts.
    </p>
  </noscript>
</div>

<script defer src="{{ '/assets/js/chatbot.js' | relative_url }}"></script>
