import Papa from "papaparse";
import { modelKickoff, parseProbability } from "./normalize";
import type { ModelFixture, Outcome } from "./types";

export const DEFAULT_MODEL_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_1dSqKC6BUuykrL9QA5_fwiIEodU3jXBCskHCA7uVU-EYnHusQWZhMFwZXNvk2bFlElmsQHZ3b4n2/pub?gid=2036795967&single=true&output=csv";

const COL = { marketId: 9, date: 14, time: 15, home: 16, away: 17, bookmakerOverOdds: 21, bookmakerUnderOdds: 22, league: 60, homeProbability: 44, drawProbability: 45, awayProbability: 46, underProbability: 61, overProbability: 62 } as const;

function parseOdds(value: unknown): number | null {
  const odds = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(odds) && odds > 1 ? odds : null;
}

export function parseModelCsv(csv: string): ModelFixture[] {
  const result = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  if (result.errors.length && !result.data.length) throw new Error(`Model CSV could not be parsed: ${result.errors[0].message}`);
  const fixtures: ModelFixture[] = [];
  for (const row of result.data) {
    const league = String(row[COL.league] ?? "").trim();
    if (!(league.toUpperCase() === "E0" || league.toLowerCase().includes("premier league"))) continue;
    const marketId = String(row[COL.marketId] ?? "").trim();
    const homeTeam = String(row[COL.home] ?? "").trim();
    const awayTeam = String(row[COL.away] ?? "").trim();
    const kickoffUtc = modelKickoff(String(row[COL.date] ?? ""), String(row[COL.time] ?? ""));
    if (!marketId || !homeTeam || !awayTeam || !kickoffUtc) continue;
    const probabilities: Array<["1x2" | "ou25", Outcome, number | null]> = [
      ["1x2", "home", parseProbability(row[COL.homeProbability])], ["1x2", "draw", parseProbability(row[COL.drawProbability])], ["1x2", "away", parseProbability(row[COL.awayProbability])],
      ["ou25", "under", parseProbability(row[COL.underProbability])], ["ou25", "over", parseProbability(row[COL.overProbability])]
    ];
    const bookmakerOverOdds = parseOdds(row[COL.bookmakerOverOdds]);
    const bookmakerUnderOdds = parseOdds(row[COL.bookmakerUnderOdds]);
    const fallbackPrices = bookmakerOverOdds != null && bookmakerUnderOdds != null
      ? [
          { market: "ou25" as const, outcome: "over" as const, odds: bookmakerOverOdds },
          { market: "ou25" as const, outcome: "under" as const, odds: bookmakerUnderOdds }
        ]
      : [];
    fixtures.push({ marketId, kickoffUtc, homeTeam, awayTeam, league, predictions: probabilities.filter((entry): entry is ["1x2" | "ou25", Outcome, number] => entry[2] != null).map(([market, outcome, probability]) => ({ market, outcome, probability })), fallbackPrices });
  }
  return fixtures;
}

export async function fetchModelFixtures(url = DEFAULT_MODEL_CSV): Promise<ModelFixture[]> {
  const response = await fetch(url, { headers: { Accept: "text/csv" } });
  if (!response.ok) throw new Error(`Model feed returned HTTP ${response.status}`);
  const fixtures = parseModelCsv(await response.text());
  if (!fixtures.length) throw new Error("Model feed contained no valid E0/Premier League rows");
  return fixtures;
}
