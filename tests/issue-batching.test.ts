import { describe, expect, it, vi } from "vitest";

const issueBatchingModule = () => import("../scripts/lib/issue-batching.mjs");
const prepareIssueBatchesModule = () =>
  import("../scripts/prepare-issue-batches.mjs");

describe("issue batching helper", () => {
  it("classifies documentation-focused issues into a docs batch", async () => {
    const { classifyIssue } = await issueBatchingModule();
    const category = classifyIssue({
      number: 12,
      title: "README onboarding bug for remote HTTP setup",
      body: "The docs page still points users to the wrong hosted URL.",
      labels: [{ name: "bug" }, { name: "docs" }],
      url: "https://github.com/example/repo/issues/12",
    });

    expect(category.key).toBe("docs");
    expect(category.title).toBe("Docs and onboarding bugs");
  });

  it("splits large categories into multiple batches", async () => {
    const { buildIssueBatches } = await issueBatchingModule();
    const issues = [1, 2, 3, 4, 5].map((number) => ({
      number,
      title: `Analysis ranking bug ${number}`,
      body: "Peer group percentile output regressed.",
      labels: [{ name: "bug" }, { name: "analysis" }],
      url: `https://github.com/example/repo/issues/${number}`,
    }));

    const batches = buildIssueBatches(issues, { maxBatchSize: 2 });

    expect(batches).toHaveLength(3);
    expect(batches.map((batch) => batch.issues.length)).toEqual([2, 2, 1]);
    expect(batches[0].title).toBe("Analysis and ranking bugs 1");
  });

  it("renders a codex-ready markdown brief", async () => {
    const { renderIssueBatchBrief } = await issueBatchingModule();
    const brief = renderIssueBatchBrief({
      repo: "example/repo",
      label: "bug",
      state: "open",
      maxBatchSize: 4,
      batches: [
        {
          id: "docs-1",
          title: "Docs and onboarding bugs",
          rationale: "These issues share one docs validation pass.",
          category: "docs",
          issues: [
            {
              number: 12,
              title: "README onboarding bug",
              url: "https://github.com/example/repo/issues/12",
            },
          ],
        },
      ],
    });

    expect(brief).toContain("# Issue Batch Brief");
    expect(brief).toContain("label `bug`");
    expect(brief).toContain("## Working Norms");
    expect(brief).toContain("#12: README onboarding bug");
    expect(brief).toContain("Open a PR for each coherent batch");
  });

  it("prefers the current git remote before package metadata", async () => {
    const { getRepositorySlug } = await prepareIssueBatchesModule();
    const execFile = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("gh unavailable");
      })
      .mockImplementationOnce(() => "git@github.com:fork-owner/forked-repo.git\n");

    const repositorySlug = getRepositorySlug({
      env: {},
      execFile,
      readPackageJson: () => ({
        repository: {
          url: "git+https://github.com/jflamb/fdic-mcp-server.git",
        },
      }),
    });

    expect(repositorySlug).toBe("fork-owner/forked-repo");
  });
});
