import { describe, expect, it } from "vitest";
import { addExactOuFallback } from "../worker/sync";
import type { ModelFixture, PriceSet } from "../worker/types";

const model: ModelFixture = {
  marketId: "E0-001",
  kickoffUtc: "2026-09-20T15:00:00.000Z",
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  league: "E0",
  predictions: [],
  fallbackPrices: [
    { market: "ou25", outcome: "over", odds: 1.91 },
    { market: "ou25", outcome: "under", odds: 1.99 }
  ]
};

describe("exact O/U 2.5 fallback", () => {
  it("uses the sheet prices when the API has no exact 2.5 set", () => {
    expect(addExactOuFallback([], model)).toEqual([
      { market: "ou25", prices: { over: 1.91, under: 1.99 }, line: 2.5, source: "model_sheet" }
    ]);
  });

  it("keeps the API exact 2.5 set when it exists", () => {
    const api: PriceSet[] = [{ market: "ou25", prices: { over: 1.85, under: 2 }, line: 2.5, source: "latest" }];
    expect(addExactOuFallback(api, model)).toEqual(api);
  });
});
