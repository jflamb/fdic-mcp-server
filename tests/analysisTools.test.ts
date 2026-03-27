import { describe, expect, it } from "vitest";
import {
  formatCreditSummaryText,
  type CreditConcentrationSummary,
} from "../src/tools/creditConcentration.js";
import {
  formatFundingSummaryText,
  type FundingProfileSummary,
} from "../src/tools/fundingProfile.js";
import {
  formatSecuritiesSummaryText,
  type SecuritiesPortfolioSummary,
} from "../src/tools/securitiesPortfolio.js";

describe("formatCreditSummaryText", () => {
  const baseSummary: CreditConcentrationSummary = {
    institution: {
      cert: 12345,
      name: "First National Bank",
      city: "Springfield",
      state: "IL",
      total_assets: 500000,
      report_date: "20240331",
    },
    metrics: {
      total_loans: 350000,
      cre_to_total_loans: 28.5,
      cre_to_capital: 180.0,
      construction_to_capital: 45.0,
      ci_share: 22.0,
      consumer_share: 12.0,
      residential_re_share: 25.0,
      ag_share: 5.0,
      loans_to_assets: 70.0,
    },
    signals: [],
  };

  it("includes institution header with name, location, and CERT", () => {
    const text = formatCreditSummaryText(baseSummary);
    expect(text).toContain("Credit Concentration Analysis: First National Bank");
    expect(text).toContain("Springfield, IL");
    expect(text).toContain("CERT 12345");
    expect(text).toContain("Report Date: 20240331");
  });

  it("includes loan portfolio composition metrics", () => {
    const text = formatCreditSummaryText(baseSummary);
    expect(text).toContain("Total Loans:");
    expect(text).toContain("$350,000K");
    expect(text).toContain("Loans / Assets:");
    expect(text).toContain("70.0%");
    expect(text).toContain("CRE / Capital:");
    expect(text).toContain("180.0%");
    expect(text).toContain("C&I Share:");
    expect(text).toContain("22.0%");
  });

  it("shows n/a for null metrics", () => {
    const summary: CreditConcentrationSummary = {
      ...baseSummary,
      metrics: {
        total_loans: null,
        cre_to_total_loans: null,
        cre_to_capital: null,
        construction_to_capital: null,
        ci_share: null,
        consumer_share: null,
        residential_re_share: null,
        ag_share: null,
        loans_to_assets: null,
      },
    };
    const text = formatCreditSummaryText(summary);
    expect(text).toContain("n/a");
  });

  it("includes concentration signals when present", () => {
    const summary: CreditConcentrationSummary = {
      ...baseSummary,
      signals: [
        {
          severity: "warning",
          category: "credit_concentration",
          message: "CRE concentration at 350% of capital exceeds 300% interagency guidance threshold",
        },
      ],
    };
    const text = formatCreditSummaryText(summary);
    expect(text).toContain("Concentration Signals");
    expect(text).toContain("CRE concentration at 350%");
  });

  it("omits signals section when no signals", () => {
    const text = formatCreditSummaryText(baseSummary);
    expect(text).not.toContain("Concentration Signals");
  });
});

describe("formatFundingSummaryText", () => {
  const baseSummary: FundingProfileSummary = {
    institution: {
      cert: 67890,
      name: "Community Savings Bank",
      city: "Portland",
      state: "OR",
      total_assets: 800000,
      report_date: "20240331",
    },
    metrics: {
      core_deposit_ratio: 75.0,
      brokered_deposit_ratio: 8.0,
      wholesale_funding_ratio: 18.0,
      fhlb_to_assets: 5.0,
      foreign_deposit_share: 2.0,
      deposits_to_assets: 82.0,
      cost_of_funds: null,
      cash_ratio: 10.0,
    },
    signals: [],
  };

  it("includes institution header", () => {
    const text = formatFundingSummaryText(baseSummary);
    expect(text).toContain("Funding Profile Analysis: Community Savings Bank");
    expect(text).toContain("Portland, OR");
    expect(text).toContain("CERT 67890");
  });

  it("includes deposit composition metrics", () => {
    const text = formatFundingSummaryText(baseSummary);
    expect(text).toContain("Core Deposit Ratio:");
    expect(text).toContain("75.0%");
    expect(text).toContain("Brokered Deposit Ratio:");
    expect(text).toContain("8.0%");
    expect(text).toContain("Foreign Deposit Share:");
    expect(text).toContain("2.0%");
  });

  it("includes wholesale funding and liquidity metrics", () => {
    const text = formatFundingSummaryText(baseSummary);
    expect(text).toContain("Wholesale Funding Ratio:");
    expect(text).toContain("18.0%");
    expect(text).toContain("FHLB / Assets:");
    expect(text).toContain("5.0%");
    expect(text).toContain("Cash Ratio:");
    expect(text).toContain("10.0%");
  });

  it("includes funding risk signals when present", () => {
    const summary: FundingProfileSummary = {
      ...baseSummary,
      signals: [
        {
          severity: "warning",
          category: "funding_risk",
          message: "Brokered deposits at 20.0% exceed 15% threshold, indicating potential funding volatility",
        },
      ],
    };
    const text = formatFundingSummaryText(summary);
    expect(text).toContain("Funding Risk Signals");
    expect(text).toContain("Brokered deposits at 20.0%");
  });

  it("omits signals section when no signals", () => {
    const text = formatFundingSummaryText(baseSummary);
    expect(text).not.toContain("Funding Risk Signals");
  });
});

describe("formatSecuritiesSummaryText", () => {
  const baseSummary: SecuritiesPortfolioSummary = {
    institution: {
      cert: 11111,
      name: "Heritage Trust Bank",
      city: "Austin",
      state: "TX",
      total_assets: 1200000,
      report_date: "20240331",
    },
    metrics: {
      securities_to_assets: 25.0,
      securities_to_capital: 200.0,
      mbs_share: 40.0,
      afs_share: null,
      htm_share: null,
    },
    signals: [],
  };

  it("includes institution header", () => {
    const text = formatSecuritiesSummaryText(baseSummary);
    expect(text).toContain("Securities Portfolio Analysis: Heritage Trust Bank");
    expect(text).toContain("Austin, TX");
    expect(text).toContain("CERT 11111");
  });

  it("includes portfolio overview metrics", () => {
    const text = formatSecuritiesSummaryText(baseSummary);
    expect(text).toContain("Securities / Assets:");
    expect(text).toContain("25.0%");
    expect(text).toContain("Securities / Capital:");
    expect(text).toContain("200.0%");
  });

  it("includes composition metrics", () => {
    const text = formatSecuritiesSummaryText(baseSummary);
    expect(text).toContain("MBS Concentration:");
    expect(text).toContain("40.0%");
    expect(text).toContain("AFS Share:");
    expect(text).toContain("n/a");
    expect(text).toContain("HTM Share:");
  });

  it("includes securities risk signals when present", () => {
    const summary: SecuritiesPortfolioSummary = {
      ...baseSummary,
      signals: [
        {
          severity: "warning",
          category: "securities_risk",
          message: "Securities at 350% of capital exceeds 300% threshold",
        },
      ],
    };
    const text = formatSecuritiesSummaryText(summary);
    expect(text).toContain("Securities Risk Signals");
    expect(text).toContain("Securities at 350%");
  });

  it("omits signals section when no signals", () => {
    const text = formatSecuritiesSummaryText(baseSummary);
    expect(text).not.toContain("Securities Risk Signals");
  });
});
