/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  FIVE_DOLLAR_API_KEY?: string;
  SYNC_TOKEN?: string;
  MODEL_CSV_URL?: string;
  FOOTBALL_API_BASE_URL?: string;
  FOOTBALL_API_LEAGUE_ID?: string;
  ENVIRONMENT?: string;
}

export type Market = "1x2" | "ou25";
export type Outcome = "home" | "draw" | "away" | "over" | "under";

export interface ModelFixture {
  marketId: string;
  kickoffUtc: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  predictions: Array<{ market: Market; outcome: Outcome; probability: number }>;
  fallbackPrices: Array<{ market: Market; outcome: Outcome; odds: number }>;
}

export interface ProviderFixture {
  id: number;
  kickoff_utc: string;
  status: string;
  league: { id: number; name: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
}

export interface PriceSet {
  market: Market;
  prices: Partial<Record<Outcome, number>>;
  line: number | null;
  source: "opening" | "latest" | "model_sheet";
}
