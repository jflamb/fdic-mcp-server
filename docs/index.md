---
title: Documentation Overview
nav_group: overview
kicker: Documentation Home
summary: A starting point for users, maintainers, and evaluators who need to understand what the project solves and where to go next.
body_class: overview-page
---

<div class="hero-grid">
  <section class="hero-panel hero-panel--accent">
    <h2>What problem this project solves</h2>
    <p>
      The FDIC BankFind Suite API is public, but it is not packaged for MCP hosts in a way that is easy to use from prompts.
      This server turns those datasets into MCP tools with stable machine-readable output, then adds analysis helpers for multi-bank comparison and peer benchmarking.
    </p>
  </section>
  <section class="hero-panel">
    <h2>What you can do with it</h2>
    <ul>
      <li>Search institutions, failures, branches, and historical changes.</li>
      <li>Pull quarterly financial and demographics records with explicit report dates.</li>
      <li>Compare institutions across two snapshots or a time series.</li>
      <li>Benchmark a bank against a generated peer group.</li>
    </ul>
  </section>
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

## At a glance

<ul class="meta-list">
  <li><strong>Data source:</strong> FDIC BankFind Suite API</li>
  <li><strong>Protocol:</strong> MCP over stdio or streamable HTTP</li>
  <li><strong>Best for:</strong> LLM-hosted banking research and comparative analysis</li>
  <li><strong>Key caution:</strong> keep quarterly financial data and annual SOD data separate unless you state the date basis clearly</li>
</ul>

## Recommended starting points

<div class="card-grid">
  <a class="card" href="{{ '/getting-started/' | relative_url }}">
    <span class="card__eyebrow">Setup</span>
    <h3>Getting Started</h3>
    <p>Install the package, run the server, and verify a client can call it.</p>
  </a>
  <a class="card" href="{{ '/prompting-guide/' | relative_url }}">
    <span class="card__eyebrow">Prompting</span>
    <h3>Prompting Guide</h3>
    <p>Use clearer prompts for dates, datasets, peer groups, and rankings.</p>
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

<div class="callout">
  <strong>Note:</strong> the internal design notes under <code>docs/plans/</code> are intentionally excluded from the published site. The published docs are meant to be user-facing and maintainable, not a dump of every working note in the repository.
</div>
