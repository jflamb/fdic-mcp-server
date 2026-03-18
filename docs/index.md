---
title: FDIC BankFind MCP Server
nav_group: overview
kicker: MCP Documentation
summary: Connect to the FDIC BankFind MCP Server, use its search and analysis tools, and find the right setup, reference, or support docs.
body_class: overview-page
---
{% assign latest_release = site.data.latest_release %}

<div class="hero-grid">
  <section class="hero-panel hero-panel--accent">
    <h3>What this server does</h3>
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
    <span class="card__eyebrow">Get Started</span>
    <h3>Choose the fastest setup path</h3>
    <p>Start with the hosted MCP URL when your host accepts remote servers. Use the local install path only when your host requires stdio.</p>
  </a>
  <a class="card" href="{{ '/clients/' | relative_url }}">
    <span class="card__eyebrow">Connect</span>
    <h3>Find your MCP host instructions</h3>
    <p>Use the right setup steps for Claude Desktop, ChatGPT, Gemini CLI, or GitHub Copilot CLI.</p>
  </a>
  <a class="card" href="{{ '/prompting-guide/' | relative_url }}">
    <span class="card__eyebrow">Use It Well</span>
    <h3>Learn the prompting patterns</h3>
    <p>Use copy-pasteable prompt patterns that stay explicit about dates, metrics, and dataset boundaries.</p>
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
  The site is organized around the jobs people typically need to do: get connected, use the server effectively, inspect the technical contract, or find project and support information.
</p>

<div class="card-grid">
  <a class="card" href="{{ '/user-guide/' | relative_url }}">
    <span class="card__eyebrow">Use the Server</span>
    <h3>Setup, prompting, and examples</h3>
    <p>Installation, client setup, prompting guidance, practical examples, and troubleshooting.</p>
  </a>
  <a class="card" href="{{ '/technical/' | relative_url }}">
    <span class="card__eyebrow">Technical Reference</span>
    <h3>Architecture, contracts, and tools</h3>
    <p>Architecture, contracts, implementation boundaries, and the reasoning behind key design decisions.</p>
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
