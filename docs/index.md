---
title: BankFind MCP Server
nav_group: overview
kicker: MCP Documentation
summary: Connect to the BankFind MCP Server, use its search and analysis tools, and find the right setup, reference, or support docs.
body_class: overview-page
---
{% assign latest_release = site.data.latest_release %}

<div class="hero-grid">
  <section class="hero-panel hero-panel--accent">
    <h3>What this server does</h3>
    <p>
      The FDIC BankFind Suite API is public, but it is not packaged for MCP hosts in a way that is easy to use from prompts.
      This server turns those datasets into MCP tools, then adds built-in help for multi-bank comparison and peer benchmarking.
    </p>
  </section>
  <section class="hero-panel">
    <h3>What you can do with it</h3>
    <ul>
      <li>Search institutions, failures, branches, and historical changes.</li>
      <li>Pull quarterly financial and demographics records with explicit report dates.</li>
      <li>Compare institutions across two snapshots or a time series.</li>
      <li>Benchmark a bank against a generated peer group.</li>
    </ul>
  </section>
</div>

## What's included

<div class="hero-grid">
  <section class="hero-panel">
    <h3>MCP Tools</h3>
    <p>
      20+ tools that work in <strong>any MCP client</strong> — Claude Desktop, ChatGPT, Gemini CLI, GitHub Copilot CLI, and more.
      Search institutions, pull quarterly financials, run peer analysis, and detect risk signals.
    </p>
  </section>
  <section class="hero-panel">
    <h3>Claude Code Skills</h3>
    <p>
      Guided analyst workflows that run inside <strong>Claude Code only</strong>.
      <a href="{{ '/skills/bank-deep-dive/' | relative_url }}">Bank Deep Dive</a> chains nine tools into a ten-section institution report.
      <a href="{{ '/skills/examiner-support/' | relative_url }}">Examiner Support</a> layers qualitative examiner knowledge onto CAMELS proxy scores.
      <a href="{{ '/skills/portfolio-surveillance/' | relative_url }}">Portfolio Surveillance</a> screens a bank universe and produces a ranked watchlist.
      <a href="{{ '/skills/failure-forensics/' | relative_url }}">Failure Forensics</a> reconstructs pre-failure timelines for case-study review.
    </p>
  </section>
</div>

## Start here

<div class="card-grid">
  <a class="card" href="{{ '/setup/' | relative_url }}">
    <span class="card__eyebrow">Get Started</span>
    <h3>Choose the fastest setup path</h3>
    <p>Start with the hosted MCP URL when your host accepts remote servers. Use the local install path only when your host requires stdio.</p>
  </a>
  <a class="card" href="{{ '/choose-a-workflow/' | relative_url }}">
    <span class="card__eyebrow">Navigate</span>
    <h3>Choose a workflow</h3>
    <p>Decide whether to use an MCP tool or a Claude Code skill based on what you're analyzing and which client you're using.</p>
  </a>
  <a class="card" href="{{ '/clients/' | relative_url }}">
    <span class="card__eyebrow">Connect</span>
    <h3>Find your MCP host instructions</h3>
    <p>Use the right setup steps for Claude Code, Claude Desktop, ChatGPT, Gemini CLI, or GitHub Copilot CLI.</p>
  </a>
</div>

<div class="hosted-url-block doc-callout doc-callout--hero">
  <p class="doc-callout__eyebrow">Fastest path</p>
  <div class="doc-callout__title-row">
    <div>
      <h2>Use the live hosted MCP endpoint</h2>
      <p>When your MCP host accepts remote HTTP servers, this is the lowest-friction way to get started. Copy the endpoint, connect it in your host, then move to client setup or prompting guidance.</p>
    </div>
  </div>
  <pre><code>https://bankfind.jflamb.com/mcp</code></pre>
</div>

## Browse by need

<p class="section-intro">
  The site is organized around the jobs people typically need to do: get connected, use the server effectively, or find project and support information.
</p>

<div class="card-grid">
  <a class="card" href="{{ '/setup/' | relative_url }}">
    <span class="card__eyebrow">Setup</span>
    <h3>Install and configure</h3>
    <p>Installation, client setup for popular MCP hosts, and troubleshooting.</p>
  </a>
  <a class="card" href="{{ '/choose-a-workflow/' | relative_url }}">
    <span class="card__eyebrow">Navigate</span>
    <h3>Choose a workflow</h3>
    <p>Tool vs skill, single bank vs portfolio, active vs failed. Find the right path for your analysis goal.</p>
  </a>
  <a class="card" href="{{ '/tool-reference/' | relative_url }}">
    <span class="card__eyebrow">Reference</span>
    <h3>MCP Tool Reference</h3>
    <p>Quick reference for all 20+ MCP tools — what each does and when to use it. Works in any MCP client.</p>
  </a>
  <a class="card" href="{{ '/skills/' | relative_url }}">
    <span class="card__eyebrow">Claude Code</span>
    <h3>Skills</h3>
    <p>Bank Deep Dive, Examiner Support, Portfolio Surveillance, and Failure Forensics. Guided multi-tool workflows. Claude Code only.</p>
  </a>
  <a class="card" href="{{ '/prompting/' | relative_url }}">
    <span class="card__eyebrow">Prompting</span>
    <h3>Write effective prompts</h3>
    <p>Prompt patterns, copyable examples, and guidance on dates, metrics, and dataset boundaries.</p>
  </a>
  <a class="card" href="{{ '/project-information/' | relative_url }}">
    <span class="card__eyebrow">Project &amp; Support</span>
    <h3>Compatibility, releases, and support</h3>
    <p>Release notes, support expectations, compatibility guidance, contribution workflow, and security reporting.</p>
  </a>
</div>

## Common next steps

<div class="card-grid">
  <a class="card" href="{{ latest_release.url }}">
    <span class="card__eyebrow">Latest Release</span>
    <h3>{{ latest_release.display_name }}</h3>
    <p>{{ latest_release.summary }}</p>
  </a>
  <a class="card" href="{{ '/usage-examples/' | relative_url }}">
    <span class="card__eyebrow">Examples</span>
    <h3>Usage Examples</h3>
    <p>Copyable prompts with expected answer shapes for search, comparisons, and peer benchmarking.</p>
  </a>
  <a class="card" href="{{ '/support/' | relative_url }}">
    <span class="card__eyebrow">Support</span>
    <h3>Get Help</h3>
    <p>Find the issue-reporting path, the troubleshooting checklist, and the information to gather before escalating.</p>
  </a>
  <a class="card" href="{{ '/compatibility-matrix/' | relative_url }}">
    <span class="card__eyebrow">Hosts</span>
    <h3>Compatibility Matrix</h3>
    <p>See which MCP hosts are directly documented and what support level to expect.</p>
  </a>
</div>
