import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import packageJson from "../package.json";

const repoRoot = path.resolve(import.meta.dirname, "..");
const ciWorkflowPath = path.join(repoRoot, ".github/workflows/ci.yml");

function parseMinimumNodeMajor(range: string) {
  const match = range.match(/^>=(\d+)(?:\.\d+\.\d+)?$/);
  if (!match) {
    throw new Error(`Unsupported Node engine range: ${range}`);
  }

  return Number.parseInt(match[1], 10);
}

function getValidateMatrixNodeMajors() {
  const workflowText = fs.readFileSync(ciWorkflowPath, "utf8");
  const validateMatrixMatch = workflowText.match(
    /validate:\s*\n(?:[ \t].*\n)*?[ \t]+node:\s*\n((?:[ \t]+-\s+"[^"]+"\s*\n)+)/,
  );

  if (!validateMatrixMatch) {
    throw new Error("Expected validate job Node matrix in .github/workflows/ci.yml");
  }

  return Array.from(
    validateMatrixMatch[1].matchAll(/-\s+"([^"]+)"/g),
    ([, version]) => Number.parseInt(version.split(".")[0], 10),
  );
}

describe("runtime support policy", () => {
  it("keeps the package engine minimum aligned with the CI validate matrix", () => {
    const engineMinimum = parseMinimumNodeMajor(packageJson.engines.node);
    const validateMajors = getValidateMatrixNodeMajors();

    expect(engineMinimum).toBe(Math.min(...validateMajors));
  });
});
