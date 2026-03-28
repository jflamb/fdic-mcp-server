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

  it("documents tangible-equity gap in capital classification data gaps", () => {
    const result = assembleProxyAssessment({
      rawFinancials: healthyBank,
      repdte: "20241231",
    });
    const tangibleGap = result.capital_classification.dataGaps.find(
      (g) => g.includes("tangibleEquity"),
    );
    expect(tangibleGap).toBeDefined();
    expect(tangibleGap).toContain("critically_undercapitalized");
  });

  it("capital component score is anchored to PCA classification, not legacy thresholds", () => {
    // Bank that is well_capitalized by PCA thresholds but would get a weaker
    // legacy rating due to equity_ratio being below the legacy "Strong" threshold of 10%
    const pcaStrongLegacyWeak: Record<string, unknown> = {
      ASSET: 500000, DEP: 400000, DEPDOM: 380000,
      EQTOT: 35000, NETINC: 5000,
      // PCA: all four ratios above well-capitalized thresholds
      IDT1CER: 6.0, IDT1RWAJR: 9.0, RBCT1J: 7.0, RBCRWAJ: 11.0,
      // Legacy: EQV below "Strong" (10) and "Satisfactory" (8) thresholds → legacy would rate 3 or 4
      EQV: 7.0,
      ROA: 1.0, ROAPTX: 1.2, ROE: 10.0, NIMY: 3.5, EEFFR: 58.0,
      LNLSDEPR: 78.0, DEPDASTR: 76.0,
      COREDEP: 350000, BROR: 3.0, CHBALR: 8.0,
      NCLNLSR: 0.8, NTLNLSR: 0.2, NPERFV: 0.3, LNRESNCR: 150.0, ELNATRY: 0.3,
      SC: 80000,
    };
    const result = assembleProxyAssessment({
      rawFinancials: pcaStrongLegacyWeak,
      repdte: "20241231",
    });
    expect(result.capital_classification.category).toBe("well_capitalized");
    expect(result.component_assessment.capital.score).toBe(4.0);
    expect(result.component_assessment.capital.label).toBe("Strong");
    expect(result.component_assessment.capital.legacy_rating).toBeGreaterThanOrEqual(1);
    expect(result.component_assessment.capital.legacy_rating).toBeLessThanOrEqual(5);
  });

  it("undercapitalized PCA produces weak capital component regardless of legacy score", () => {
    const undercap: Record<string, unknown> = {
      ASSET: 500000, DEP: 400000, DEPDOM: 380000,
      EQTOT: 20000, NETINC: 2000,
      IDT1CER: 3.5, IDT1RWAJR: 5.5, RBCT1J: 4.0, RBCRWAJ: 7.5,
      EQV: 4.0,
      ROA: 1.0, ROAPTX: 1.2, ROE: 10.0, NIMY: 3.5, EEFFR: 58.0,
      LNLSDEPR: 78.0, DEPDASTR: 76.0,
      COREDEP: 350000, BROR: 3.0, CHBALR: 8.0,
      NCLNLSR: 0.8, NTLNLSR: 0.2, NPERFV: 0.3, LNRESNCR: 150.0, ELNATRY: 0.3,
      SC: 80000,
    };
    const result = assembleProxyAssessment({
      rawFinancials: undercap,
      repdte: "20241231",
    });
    expect(result.capital_classification.category).toBe("undercapitalized");
    expect(result.component_assessment.capital.score).toBe(2.0);
    expect(result.component_assessment.capital.label).toBe("Weak");
  });

  it("PCA-anchored capital score feeds into overall weighted average", () => {
    const result = assembleProxyAssessment({
      rawFinancials: {
        ASSET: 500000, DEP: 400000, DEPDOM: 380000,
        EQTOT: 50000, NETINC: 5000,
        IDT1CER: 9.5, IDT1RWAJR: 14.2, RBCT1J: 8.0, RBCRWAJ: 15.0, EQV: 10.0,
        ROA: 1.0, ROAPTX: 1.2, ROE: 10.0, NIMY: 3.5, EEFFR: 58.0,
        LNLSDEPR: 78.0, DEPDASTR: 76.0,
        COREDEP: 350000, BROR: 3.0, CHBALR: 8.0,
        NCLNLSR: 0.8, NTLNLSR: 0.2, NPERFV: 0.3, LNRESNCR: 150.0, ELNATRY: 0.3,
        SC: 80000,
      },
      repdte: "20241231",
    });
    const capitalContribution = result.component_assessment.capital.score * 0.30;
    expect(capitalContribution).toBeCloseTo(1.2, 1);
  });

  it("does not emit merger_distorted_trend for events outside the trend window", () => {
    const prior = [
      { ...healthyBank, REPDTE: "20240930" },
      { ...healthyBank, REPDTE: "20240630" },
    ];
    const result = assembleProxyAssessment({
      rawFinancials: healthyBank,
      priorQuarters: prior,
      repdte: "20241231",
      historyEvents: [{ repdte: "20200315", event_type: "merger", description: "Old merger" }],
    });
    expect(result.risk_signals.some(s => s.code === "merger_distorted_trend")).toBe(false);
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
