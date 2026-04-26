import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const BankDeepDiveArgs = {
  bank: z
    .string()
    .min(1)
    .describe("Bank name or FDIC Certificate Number (CERT)."),
  repdte: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe(
      "Optional quarter-end report date in YYYYMMDD format (0331, 0630, 0930, or 1231).",
    ),
};

const FailureForensicsArgs = {
  bank: z
    .string()
    .min(1)
    .describe("Failed bank name or FDIC Certificate Number (CERT)."),
  lookback_quarters: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe(
      "Number of pre-failure quarters to reconstruct (default 12 if omitted).",
    ),
};

const PortfolioSurveillanceArgs = {
  scope: z
    .string()
    .min(1)
    .describe(
      "Universe to screen — e.g., 'state:NC', 'asset_min:1000000,asset_max:10000000', or a comma-separated CERT list ('certs:3511,29846,...').",
    ),
  repdte: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe("Optional quarter-end report date in YYYYMMDD format."),
};

const ExaminerOverlayArgs = {
  bank: z
    .string()
    .min(1)
    .describe("Bank name or FDIC Certificate Number (CERT)."),
  qualitative_notes: z
    .string()
    .optional()
    .describe(
      "Optional qualitative analyst inputs (management quality, governance, exam findings) to overlay onto the public proxy assessment.",
    ),
};

function userText(text: string) {
  return {
    role: "user" as const,
    content: { type: "text" as const, text },
  };
}

export function registerWorkflowPrompts(server: McpServer): void {
  server.registerPrompt(
    "bank_deep_dive",
    {
      title: "Comprehensive Bank Deep Dive",
      description:
        "Produce a comprehensive single-institution analysis report (health, financials, peer benchmarking, credit concentration, funding profile, securities, franchise footprint, regional context).",
      argsSchema: BankDeepDiveArgs,
    },
    ({ bank, repdte }) => ({
      messages: [
        userText(
          [
            `Run a comprehensive FDIC bank deep dive for "${bank}"${repdte ? ` as of ${repdte}` : ""}.`,
            "",
            "Steps:",
            "1. If a CERT was not given, call fdic_search_institutions to resolve the bank to a CERT.",
            "2. Call fdic_analyze_bank_health and fdic_ubpr_analysis for the resolved CERT.",
            "3. Call fdic_peer_group_analysis to benchmark the institution against peers.",
            "4. Call fdic_analyze_credit_concentration, fdic_analyze_funding_profile, and fdic_analyze_securities_portfolio.",
            "5. Call fdic_franchise_footprint for branch/deposit geography and fdic_regional_context for the home market.",
            "6. Synthesize into a narrative report with: identity & footprint, health summary, financial performance, peer position, credit concentration, funding profile, securities portfolio, regional context, and a public-data caveat.",
            "",
            "All output must be grounded in tool results. Treat any CAMELS-style scoring as a public off-site analytical proxy — not an official supervisory rating. Note unit conventions ($thousands) where relevant.",
          ].join("\n"),
        ),
      ],
    }),
  );

  server.registerPrompt(
    "failure_forensics",
    {
      title: "Failed Bank Forensics",
      description:
        "Reconstruct the pre-failure financial timeline of a failed FDIC institution and identify the earliest visible warning signals.",
      argsSchema: FailureForensicsArgs,
    },
    ({ bank, lookback_quarters }) => ({
      messages: [
        userText(
          [
            `Run a failure-forensics post-mortem for "${bank}" using the FDIC tools.`,
            "",
            "Steps:",
            "1. Resolve the bank to a CERT via fdic_search_institutions or fdic_search.",
            "2. Call fdic_get_institution_failure to confirm failure date, resolution type, and cost.",
            `3. Call fdic_search_financials with CERT and a sort_by:REPDTE DESC ordering to pull the prior ${lookback_quarters ?? "12"} quarters before the failure date.`,
            "4. Call fdic_analyze_credit_concentration, fdic_analyze_funding_profile, and fdic_analyze_securities_portfolio at the latest available pre-failure quarter.",
            "5. Call fdic_search_history for structural-change events (mergers, charter conversions, assistance) leading up to the failure.",
            "6. Synthesize a forensic timeline with: failure facts, the deterioration arc (capital, asset quality, earnings, liquidity), the earliest warning signals visible in public data, and likely drivers.",
            "",
            "Highlight inflection points (e.g. quarter ROA turned negative, when noncurrent loans exceeded reserves). Reference each finding to the report date that supports it.",
          ].join("\n"),
        ),
      ],
    }),
  );

  server.registerPrompt(
    "portfolio_surveillance",
    {
      title: "Portfolio Surveillance Watchlist",
      description:
        "Screen a universe of FDIC institutions and produce a decision-ready watchlist tiered Escalate / Monitor / No Immediate Concern.",
      argsSchema: PortfolioSurveillanceArgs,
    },
    ({ scope, repdte }) => ({
      messages: [
        userText(
          [
            `Run portfolio surveillance over scope: "${scope}"${repdte ? ` as of ${repdte}` : ""}.`,
            "",
            "Steps:",
            "1. Build the institution roster:",
            "   - state:<XX> → fdic_search_institutions filters STALP:<XX> AND ACTIVE:1",
            "   - asset_min:<n>,asset_max:<n> → ASSET range",
            "   - certs:<csv> → use the comma-separated list directly",
            "2. Call fdic_detect_risk_signals across the roster.",
            "3. Call fdic_compare_peer_health to rank by composite proxy band.",
            "4. For the highest-risk subset, call fdic_analyze_bank_health for full proxy assessments.",
            "5. Tier institutions:",
            "   - Escalate: critical risk signals or proxy band 'unsatisfactory'.",
            "   - Monitor: warning signals or 'fair' band, especially deteriorating trends.",
            "   - No Immediate Concern: no critical signals, satisfactory or strong band.",
            "6. Produce a watchlist table per tier (CERT, name, key signals, rationale).",
            "",
            "Treat all scoring as a public off-site analytical proxy. Surface data caveats explicitly.",
          ].join("\n"),
        ),
      ],
    }),
  );

  server.registerPrompt(
    "examiner_overlay",
    {
      title: "Examiner Overlay Assessment",
      description:
        "Layer qualitative analyst/examiner inputs on top of the public CAMELS proxy and produce a blended assessment with explicit provenance.",
      argsSchema: ExaminerOverlayArgs,
    },
    ({ bank, qualitative_notes }) => ({
      messages: [
        userText(
          [
            `Produce an examiner-overlay assessment for "${bank}".`,
            "",
            "Steps:",
            "1. Resolve to a CERT via fdic_search_institutions if needed.",
            "2. Call fdic_analyze_bank_health to get the public_camels_proxy_v1 baseline (capital, asset quality, earnings, liquidity, sensitivity).",
            "3. Call fdic_ubpr_analysis for performance ratios and fdic_analyze_funding_profile / fdic_analyze_credit_concentration for sub-component depth.",
            "4. Combine the public baseline with qualitative analyst inputs:",
            qualitative_notes
              ? `   Analyst notes: ${qualitative_notes}`
              : "   (No qualitative inputs provided — produce the public baseline and clearly mark which factors would benefit from qualitative overlay.)",
            "5. Produce a blended assessment with two columns labeled exactly: 'Public-data finding' and 'Examiner overlay'. Never present overlay inputs as if they came from public data.",
            "6. Final composite must reconcile both columns and call out any divergence.",
            "",
            "Disclaimer: this overlay is not an official CAMELS rating or confidential supervisory conclusion.",
          ].join("\n"),
        ),
      ],
    }),
  );
}
