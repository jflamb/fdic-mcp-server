import type { FredObservation } from "../../services/fredClient.js";

export interface MacroInputs {
  state_unemployment: FredObservation[];
  national_unemployment: FredObservation[];
  fed_funds: FredObservation[];
}

export interface MacroContext {
  unemployment_trend: "rising" | "falling" | "stable";
  state_vs_national_unemployment: "above" | "below" | "at_parity";
  rate_environment: "low" | "moderate" | "elevated";
  latest_state_unemployment: number | null;
  latest_national_unemployment: number | null;
  latest_fed_funds: number | null;
  narrative: string;
}

function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}

function latestValue(obs: FredObservation[]): number | null {
  if (obs.length === 0) return null;
  return obs[obs.length - 1].value;
}

/**
 * Assess macro/regional economic context from FRED time series data.
 *
 * - unemployment_trend: compare last 3 state observations; >0.3pp diff = rising/falling
 * - state_vs_national_unemployment: compare latest values; within 0.3pp = at_parity
 * - rate_environment: latest fed funds; <2% low, 2-4% moderate, >4% elevated
 */
export function assessMacroContext(inputs: MacroInputs): MacroContext {
  const stateUnemp = inputs.state_unemployment;
  const natUnemp = inputs.national_unemployment;
  const fedFunds = inputs.fed_funds;

  const latestStateUnemp = latestValue(stateUnemp);
  const latestNatUnemp = latestValue(natUnemp);
  const latestFedFunds = latestValue(fedFunds);

  // Unemployment trend from last 3 state observations
  let unemployment_trend: MacroContext["unemployment_trend"] = "stable";
  const recentState = lastN(stateUnemp, 3);
  if (recentState.length >= 2) {
    const earliest = recentState[0].value;
    const latest = recentState[recentState.length - 1].value;
    const diff = latest - earliest;
    if (diff > 0.3) unemployment_trend = "rising";
    else if (diff < -0.3) unemployment_trend = "falling";
  }

  // State vs national
  let state_vs_national_unemployment: MacroContext["state_vs_national_unemployment"] =
    "at_parity";
  if (latestStateUnemp !== null && latestNatUnemp !== null) {
    const gap = latestStateUnemp - latestNatUnemp;
    if (gap > 0.3) state_vs_national_unemployment = "above";
    else if (gap < -0.3) state_vs_national_unemployment = "below";
  }

  // Rate environment
  let rate_environment: MacroContext["rate_environment"] = "moderate";
  if (latestFedFunds !== null) {
    if (latestFedFunds < 2) rate_environment = "low";
    else if (latestFedFunds > 4) rate_environment = "elevated";
  }

  // Build narrative
  const narrative = buildNarrative({
    latestStateUnemp,
    latestNatUnemp,
    latestFedFunds,
    unemployment_trend,
    state_vs_national_unemployment,
    rate_environment,
  });

  return {
    unemployment_trend,
    state_vs_national_unemployment,
    rate_environment,
    latest_state_unemployment: latestStateUnemp,
    latest_national_unemployment: latestNatUnemp,
    latest_fed_funds: latestFedFunds,
    narrative,
  };
}

function buildNarrative(params: {
  latestStateUnemp: number | null;
  latestNatUnemp: number | null;
  latestFedFunds: number | null;
  unemployment_trend: MacroContext["unemployment_trend"];
  state_vs_national_unemployment: MacroContext["state_vs_national_unemployment"];
  rate_environment: MacroContext["rate_environment"];
}): string {
  const {
    latestStateUnemp,
    latestNatUnemp,
    latestFedFunds,
    unemployment_trend,
    state_vs_national_unemployment,
    rate_environment,
  } = params;

  // If all data missing, return generic
  if (
    latestStateUnemp === null &&
    latestNatUnemp === null &&
    latestFedFunds === null
  ) {
    return "Economic data is unavailable. Consider manually reviewing state unemployment trends, federal funds rate environment, and regional housing and employment conditions.";
  }

  const parts: string[] = [];

  // Unemployment sentence
  if (latestStateUnemp !== null) {
    let sentence = `The state unemployment rate is ${latestStateUnemp.toFixed(1)}%`;
    if (latestNatUnemp !== null) {
      const compWord =
        state_vs_national_unemployment === "above"
          ? "above"
          : state_vs_national_unemployment === "below"
            ? "below"
            : "in line with";
      sentence += `, ${compWord} the national rate of ${latestNatUnemp.toFixed(1)}%`;
    }
    const trendWord =
      unemployment_trend === "rising"
        ? " and rising over the past three quarters"
        : unemployment_trend === "falling"
          ? " and falling over the past three quarters"
          : " and stable over the past three quarters";
    sentence += `${trendWord}.`;
    parts.push(sentence);
  }

  // Fed funds sentence
  if (latestFedFunds !== null) {
    const envWord =
      rate_environment === "low"
        ? "a low"
        : rate_environment === "elevated"
          ? "an elevated"
          : "a moderate";
    let impact =
      rate_environment === "elevated"
        ? "which may pressure bank net interest margins and borrower repayment capacity"
        : rate_environment === "low"
          ? "which supports borrower affordability but may compress bank net interest margins"
          : "which provides a balanced environment for bank lending and deposit pricing";
    parts.push(
      `The federal funds rate at ${latestFedFunds.toFixed(2)}% indicates ${envWord} rate environment, ${impact}.`,
    );
  }

  return parts.join(" ");
}
