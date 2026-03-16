import fs from "node:fs";
import semanticRelease from "semantic-release";

function appendOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

const result = await semanticRelease();

if (!result) {
  appendOutput("new_release_published", "false");
  process.exit(0);
}

appendOutput("new_release_published", "true");
appendOutput("new_release_version", result.nextRelease.version);
appendOutput("new_release_git_tag", result.nextRelease.gitTag);
