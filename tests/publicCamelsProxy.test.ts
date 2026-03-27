import { describe, expect, it } from "vitest";
import { assembleProxyAssessment, type ProxyAssessment } from "../src/tools/shared/publicCamelsProxy.js";

describe("assembleProxyAssessment", () => {
  const healthyBank: Record<string, unknown> = {
    ASSET: 500000, DEP: 400000, DEPDOM: 380000,
    EQTOT: 50000, NETINC: 5000,
    IDT1CER: 9.5, IDT1RWAJR: 14.2, RBCT1J: 8.0, RBCRWAJ: 15.0, EQV: 10.0,
    ROA: 1.0, ROAPTX: 1.2, ROE: 10.0, NIMY: 3.5, EEFFR: 58.0,
    LNLSDEPR: 78.0, DEPDASTR: 76.0,
    COREDEP: 350000, BROR: 3.0, CHBALR: 8.0,
    NCLNLSR: 0.8, NTLNLSR: 0.2, NPERFV: 0.3, LNRESNCR: 150.0, ELNATRY: 0.3,
    SC: 80000,
  };

  it("produces a complete proxy assessment for a healthy bank", () => {
    const result = assembleProxyAssessment({
      rawFinancials: healthyBank,
      repdte: "20241231",
    });
    expect(result.model).toBe("public_camels_proxy_v1");
    expect(result.official_status).toContain("not official CAMELS");
    expect(result.overall.band).toBe("strong");
    expect(result.overall.score).toBeGreaterThanOrEqual(3.25);
    expect(result.capital_classification.category).toBe("well_capitalized");
    expect(result.management_overlay.level).toBe("normal");
    expect(result.key_metrics.totalAssets).toBe(500000);
    expect(result.provenance).toBeDefined();
    expect(result.data_quality.gaps_count).toBeGreaterThanOrEqual(0);
  });

  it("produces component assessments with both new and legacy scores", () => {
    const result = assembleProxyAssessment({
      rawFinancials: healthyBank,
      repdte: "20241231",
    });
    expect(result.component_assessment.capital.score).toBeGreaterThanOrEqual(1);
    expect(result.component_assessment.capital.score).toBeLessThanOrEqual(4);
    expect(result.component_assessment.capital.legacy_rating).toBeGreaterThanOrEqual(1);
    expect(result.component_assessment.capital.legacy_rating).toBeLessThanOrEqual(5);
    expect(result.component_assessment.capital.label).toBeDefined();
    expect(result.component_assessment.earnings.key_metrics).toBeDefined();
  });

  it("detects risk signals for a stressed bank", () => {
    const stressed = {
      ...healthyBank,
      ROA: -0.5, ROE: -5.0, NIMY: 1.8, EEFFR: 90.0,
      IDT1CER: 4.5, EQV: 5.0, IDT1RWAJR: 5.5,
      LNRESNCR: 40.0, NCLNLSR: 4.0,
    };
    const result = assembleProxyAssessment({
      rawFinancials: stressed,
      repdte: "20241231",
    });
    expect(result.risk_signals.length).toBeGreaterThan(0);
    expect(result.risk_signals.some(s => s.code === "earnings_loss")).toBe(true);
    expect(result.overall.band).not.toBe("strong");
  });

  it("management overlay caps band when elevated_concern", () => {
    // Create a bank with multiple weak components to trigger elevated_concern
    const weak = {
      ...healthyBank,
      ROA: -0.2, ROE: -2.0, NIMY: 1.8, EEFFR: 90.0, // terrible earnings
      NCLNLSR: 5.0, NTLNLSR: 2.5, LNRESNCR: 40.0, // terrible asset quality
      IDT1CER: 4.2, EQV: 4.5, IDT1RWAJR: 5.5, RBCRWAJ: 7.0, // weak capital
      LNLSDEPR: 110.0, BROR: 20.0, CHBALR: 1.5, COREDEP: 150000, // stressed liquidity
    };
    const result = assembleProxyAssessment({
      rawFinancials: weak,
      repdte: "20241231",
    });
    // Should be high_risk or at least weak
    expect(["weak", "high_risk"]).toContain(result.overall.band);
  });

  it("computes trend insights when prior quarters provided", () => {
    const prior = [
      { ...healthyBank, REPDTE: "20240930", NIMY: 3.4, ROA: 0.95 },
      { ...healthyBank, REPDTE: "20240630", NIMY: 3.3, ROA: 0.90 },
      { ...healthyBank, REPDTE: "20240331", NIMY: 3.2, ROA: 0.85 },
      { ...healthyBank, REPDTE: "20231231", NIMY: 3.0, ROA: 0.80 },
    ];
    const result = assembleProxyAssessment({
      rawFinancials: healthyBank,
      priorQuarters: prior,
      repdte: "20241231",
    });
    expect(result.trend_insights.length).toBeGreaterThan(0);
    // NIM improving from 3.0 to 3.5
    const nimTrend = result.trend_insights.find(t => t.metric === "nim");
    expect(nimTrend?.direction).toBe("improving");
  });

  it("handles empty financials gracefully", () => {
    const result = assembleProxyAssessment({
      rawFinancials: {},
      repdte: "20241231",
    });
    expect(result.model).toBe("public_camels_proxy_v1");
    expect(result.data_quality.gaps_count).toBeGreaterThan(0);
    expect(result.key_metrics.totalAssets).toBeNull();
  });

  it("annotates history events in trend insights", () => {
    const prior = [
      { ...healthyBank, REPDTE: "20240930" },
      { ...healthyBank, REPDTE: "20240630" },
    ];
    const result = assembleProxyAssessment({
      rawFinancials: healthyBank,
      priorQuarters: prior,
      repdte: "20241231",
      historyEvents: [{ repdte: "20240630", event_type: "merger", description: "Acquired XYZ" }],
    });
    // The merger_distorted_trend signal should be present
    expect(result.risk_signals.some(s => s.code === "merger_distorted_trend")).toBe(true);
  });
});
