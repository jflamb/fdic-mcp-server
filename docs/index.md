---
title: Documentation Overview
nav_group: overview
kicker: Documentation Home
summary: A starting point for users, maintainers, and evaluators who need to understand what the project solves and where to go next.
body_class: overview-page
---
{% assign latest_release = site.data.latest_release %}

<div class="hero-grid">
  <section class="hero-panel hero-panel--accent">
    <h3>What problem this project solves</h3>
    <p>
      The FDIC BankFind Suite API is public, but it is not packaged for MCP hosts in a way that is easy to use from prompts.
      This server turns those datasets into MCP tools with stable machine-readable output, then adds analysis helpers for multi-bank comparison and peer benchmarking.
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

## Start here

<div class="card-grid">
  <a class="card" href="{{ '/getting-started/' | relative_url }}">
    <span class="card__eyebrow">First Step</span>
    <h3>Connect to the live endpoint</h3>
    <p>Start with the hosted MCP URL when your host accepts remote servers. Use the local install path only when your host requires stdio.</p>
  </a>
  <a class="card" href="{{ latest_release.url }}">
    <span class="card__eyebrow">Latest Release</span>
    <h3>{{ latest_release.display_name }}</h3>
    <p>{{ latest_release.summary }}</p>
  </a>
  <a class="card" href="{{ '/prompting-guide/' | relative_url }}">
    <span class="card__eyebrow">Best Next Read</span>
    <h3>Prompting Guide</h3>
    <p>Use copy-pasteable prompt patterns that are explicit about dates, metrics, and dataset boundaries.</p>
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

## Choose your path

<p class="section-intro">
  The docs are organized by audience so you can start from the right level of detail instead of scanning every page.
</p>

<div class="card-grid">
  <a class="card" href="{{ '/user-guide/' | relative_url }}">
    <span class="card__eyebrow">For Users</span>
    <h3>User Docs</h3>
    <p>Installation, client setup, prompting guidance, practical examples, and troubleshooting.</p>
  </a>
  <a class="card" href="{{ '/technical/' | relative_url }}">
    <span class="card__eyebrow">For Maintainers</span>
    <h3>Technical Docs</h3>
    <p>Architecture, contracts, implementation boundaries, and the reasoning behind key design decisions.</p>
  </a>
  <a class="card" href="{{ '/project-information/' | relative_url }}">
    <span class="card__eyebrow">For Evaluators</span>
    <h3>Project Info</h3>
    <p>Release notes, support expectations, compatibility guidance, contribution workflow, and security reporting.</p>
  </a>
</div>

## Recommended starting points

<div class="card-grid">
  <a class="card" href="{{ '/clients/' | relative_url }}">
    <span class="card__eyebrow">Connect</span>
    <h3>Client Setup</h3>
    <p>Find the right MCP host setup for Claude Desktop, ChatGPT, Gemini CLI, or GitHub Copilot CLI.</p>
  </a>
  <a class="card" href="{{ '/usage-examples/' | relative_url }}">
    <span class="card__eyebrow">Examples</span>
    <h3>Usage Examples</h3>
    <p>Use narrower prompts and expected tool shapes for search, comparisons, and peer benchmarking.</p>
  </a>
  <a class="card" href="{{ '/technical/specification/' | relative_url }}">
    <span class="card__eyebrow">Contract</span>
    <h3>Technical Specification</h3>
    <p>Understand the supported transports, tool surface, and output expectations.</p>
  </a>
  <a class="card" href="{{ '/compatibility-matrix/' | relative_url }}">
    <span class="card__eyebrow">Hosts</span>
    <h3>Compatibility Matrix</h3>
    <p>See which MCP hosts are directly documented and what support level to expect.</p>
  </a>
</div>
