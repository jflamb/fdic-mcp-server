---
title: Technical Docs
nav_group: technical
kicker: Maintainer Guide
summary: Architecture, tool contracts, and design decisions for contributors working inside the codebase.
breadcrumbs:
  - title: Overview
    url: /
---

The technical docs are aimed at maintainers and advanced contributors who need to understand how the server is wired, where responsibilities live, and which design choices are deliberate.

<div class="card-grid">
  <a class="card" href="{{ '/technical/specification/' | relative_url }}">
    <span class="card__eyebrow">Contract</span>
    <h3>Technical Specification</h3>
    <p>Transport support, tool surface, output contracts, FDIC data constraints, and explicit non-goals.</p>
  </a>
  <a class="card" href="{{ '/technical/architecture/' | relative_url }}">
    <span class="card__eyebrow">Structure</span>
    <h3>Architecture</h3>
    <p>Request flow, code layout, and the boundaries between transport, tools, and FDIC API integration.</p>
  </a>
  <a class="card" href="{{ '/technical/decisions/' | relative_url }}">
    <span class="card__eyebrow">Rationale</span>
    <h3>Key Decisions</h3>
    <p>The design choices that shape tool contracts, server-side analysis, and data time-basis handling.</p>
  </a>
</div>
