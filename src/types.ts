export type Market = "1x2" | "ou25";
export type Mode = "value" | "probability";

export interface OutcomeComparison {
  outcome: string;
  modelProbability: number;
  modelOdds: number;
  marketOdds: number | null;
  marketProbability: number | null;
  edge: number | null;
  expectedReturn: number | null;
  classification: string | null;
  observedAt: string | null;
}

export interface FixtureView {
  id: string;
  providerFixtureId: number | null;
  kickoffUtc: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  matchState: "matched" | "unmatched";
  markets: Record<Market, OutcomeComparison[]>;
}

export interface DashboardPayload {
  generatedAt: string;
  lastModelSync: string | null;
  lastOddsSync: string | null;
  bookmaker: string;
  competition: string;
  fixtures: FixtureView[];
  diagnostics: { fixtureCount: number; matchedCount: number; comparisonCount: number };
}
