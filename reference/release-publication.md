# Recovering release publication

The Release workflow normally runs after successful main CI. npm and GitHub
release creation remain owned by semantic-release. Downstream publication waits
for npm visibility with three checks, 60 seconds apart, before consuming the
published package. Authentication and identity failures are not retried.

When npm/GitHub succeeded but MCP Registry or GitHub Packages failed, dispatch
the existing workflow with the exact published version:

```sh
gh workflow run publish.yml --ref main -f recover_version=2.0.0
```

Recovery validates the published GitHub release, tag ancestry, and npm `gitHead`.
It reuses the npm archive and the tag's registry metadata. It never invokes
semantic-release, publishes npm again, or changes tags. Existing downstream
versions are checked before publishing; conflicting registry metadata fails
closed. Each destination is read back afterward. An MCP Registry failure does
not prevent GitHub Packages publication, but the run still fails and summarizes
both outcomes. Fix the reported cause before dispatching another recovery.

Task-local `.tmp-publication-*` directories are disposable artifacts derived
from the validated npm version; they contain no authoritative release state.
Recovery uses the existing single Ubuntu release job with a 15-minute timeout,
and skips dependency installation and rebuilding. No additional PR jobs are
introduced. Reverting the workflow and helper scripts restores the previous
publishing behavior without modifying published releases.
