const CATEGORY_DEFINITIONS = [
  {
    key: "analysis",
    title: "Analysis and ranking bugs",
    rationale:
      "These issues affect comparison logic, peer-group semantics, or timeseries analysis behavior and should be validated together.",
    keywords: [
      "analysis",
      "peer group",
      "peer-group",
      "ranking",
      "rank",
      "percentile",
      "timeseries",
      "time series",
      "cagr",
      "compare",
      "comparison",
      "snapshot",
    ],
    labels: ["analysis", "peer-group", "ranking"],
  },
  {
    key: "http",
    title: "HTTP transport and protocol bugs",
    rationale:
      "These issues touch MCP session handling, transport behavior, or HTTP protocol compliance and usually share validation paths.",
    keywords: [
      "mcp http",
      "http",
      "transport",
      "session",
      "sse",
      "origin",
      "localhost",
      "streamablehttp",
      "streamable http",
      "protocol",
    ],
    labels: ["http", "transport", "protocol", "mcp"],
  },
  {
    key: "fdic-data",
    title: "FDIC data and query contract bugs",
    rationale:
      "These issues involve dataset semantics, query composition, or response-shape correctness against the upstream FDIC API.",
    keywords: [
      "fdic",
      "bankfind",
      "schema",
      "endpoint",
      "financial",
      "demographic",
      "history",
      "failures",
      "locations",
      "institutions",
      "sod",
      "repdte",
      "year",
      "query",
      "filter",
    ],
    labels: ["fdic", "data", "api", "schema", "financials", "sod"],
  },
  {
    key: "docs",
    title: "Docs and onboarding bugs",
    rationale:
      "These issues change end-user or maintainer guidance and are efficient to review as one documentation pass.",
    keywords: [
      "docs",
      "documentation",
      "readme",
      "guide",
      "page",
      "pages",
      "onboarding",
      "prompting",
      "support",
      "troubleshooting",
      "jekyll",
    ],
    labels: ["docs", "documentation"],
  },
  {
    key: "release",
    title: "CI, release, and deployment bugs",
    rationale:
      "These issues affect automation, packaging, or deployment workflows and benefit from shared workflow validation.",
    keywords: [
      "ci",
      "workflow",
      "actions",
      "release",
      "publish",
      "registry",
      "deploy",
      "deployment",
      "cloud run",
      "docker",
      "package",
    ],
    labels: ["ci", "release", "deploy", "workflow"],
  },
  {
    key: "tooling",
    title: "Tooling and test harness bugs",
    rationale:
      "These issues are local tooling, test, or developer-experience fixes that can usually be handled in one maintenance batch.",
    keywords: [
      "test",
      "tests",
      "vitest",
      "tooling",
      "script",
      "scripts",
      "devx",
      "developer experience",
      "lint",
      "build",
    ],
    labels: ["test", "tooling", "dx"],
  },
];

const DEFAULT_BATCH_SIZE = 4;

export function classifyIssue(issue) {
  const labelNames = (issue.labels ?? []).map((label) =>
    typeof label === "string" ? label.toLowerCase() : String(label.name ?? "").toLowerCase(),
  );
  const haystack = `${issue.title ?? ""}\n${issue.body ?? ""}`.toLowerCase();

  let bestMatch = CATEGORY_DEFINITIONS[CATEGORY_DEFINITIONS.length - 1];
  let bestScore = -1;

  for (const category of CATEGORY_DEFINITIONS) {
    let score = 0;

    for (const label of category.labels) {
      if (labelNames.some((name) => name.includes(label))) {
        score += 3;
      }
    }

    for (const keyword of category.keywords) {
      if (haystack.includes(keyword)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestMatch = category;
      bestScore = score;
    }
  }

  return bestScore > 0
    ? bestMatch
    : {
        key: "general",
        title: "General bug triage",
        rationale:
          "These issues do not cluster cleanly by subsystem, so they should be reviewed manually before batching.",
      };
}

export function buildIssueBatches(issues, options = {}) {
  const maxBatchSize = Number(options.maxBatchSize ?? DEFAULT_BATCH_SIZE);
  const grouped = new Map();

  for (const issue of [...issues].sort((a, b) => a.number - b.number)) {
    const category = classifyIssue(issue);
    const existing = grouped.get(category.key) ?? {
      category,
      issues: [],
    };

    existing.issues.push(issue);
    grouped.set(category.key, existing);
  }

  const batches = [];

  for (const group of grouped.values()) {
    for (let index = 0; index < group.issues.length; index += maxBatchSize) {
      const chunk = group.issues.slice(index, index + maxBatchSize);
      const sequence = Math.floor(index / maxBatchSize) + 1;
      const needsSequence = group.issues.length > maxBatchSize;

      batches.push({
        id: `${group.category.key}-${sequence}`,
        title: needsSequence
          ? `${group.category.title} ${sequence}`
          : group.category.title,
        rationale: group.category.rationale,
        category: group.category.key,
        issues: chunk,
      });
    }
  }

  return batches.sort((a, b) => {
    if (a.issues.length !== b.issues.length) {
      return b.issues.length - a.issues.length;
    }

    return a.issues[0].number - b.issues[0].number;
  });
}

export function renderIssueBatchBrief({
  repo,
  label,
  state = "open",
  maxBatchSize = DEFAULT_BATCH_SIZE,
  batches,
}) {
  const totalIssues = batches.reduce((sum, batch) => sum + batch.issues.length, 0);
  const generatedAt = new Date().toISOString();
  const lines = [
    "# Issue Batch Brief",
    "",
    `- Repository: \`${repo}\``,
    `- Filter: label \`${label}\`, state \`${state}\``,
    `- Issues matched: ${totalIssues}`,
    `- Recommended batches: ${batches.length}`,
    `- Max batch size: ${maxBatchSize}`,
    `- Generated at: ${generatedAt}`,
    "",
    "## Working Norms",
    "",
    "- Restate acceptance criteria before editing and preserve MCP tool contracts unless a breaking change is intentional.",
    "- Create or update `tasks/todo.md` for non-trivial batches, fix root causes, and add or update tests with the implementation.",
    "- Work from fresh `main` on a dedicated branch, use conventional commits, and validate with `npm run typecheck`, `npm test`, and `npm run build` unless a narrower suite is clearly justified.",
    "- Open a PR for each coherent batch and watch required checks rather than stopping at local edits.",
    "",
    "## Recommended Batches",
    "",
  ];

  if (batches.length === 0) {
    lines.push("No matching issues were found.");
    return `${lines.join("\n")}\n`;
  }

  for (const [index, batch] of batches.entries()) {
    lines.push(`### Batch ${index + 1}: ${batch.title}`);
    lines.push("");
    lines.push(batch.rationale);
    lines.push("");
    for (const issue of batch.issues) {
      lines.push(`- #${issue.number}: ${issue.title} (${issue.url})`);
    }
    lines.push("");
    lines.push("Suggested execution flow:");
    lines.push(
      `1. Review issue #${batch.issues[0].number} through issue #${batch.issues[batch.issues.length - 1].number} together and confirm the shared root-cause area.`,
    );
    lines.push(
      "2. Create one dedicated branch and one PR scoped to this batch unless the issues prove unrelated on inspection.",
    );
    lines.push(
      "3. Capture the batch goals and acceptance criteria in `tasks/todo.md` before implementation if the work is more than a trivial fix.",
    );
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
