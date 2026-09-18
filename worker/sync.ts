import { fetchUpcomingFixtures, fetchFixturePrices } from "./football-api";
import { beginSync, finishSync, getModelProbabilities, linkFixture, saveModelFixture, setState } from "./db";
import { fetchModelFixtures } from "./model";
import { fixtureMatches } from "./normalize";
import { calculateValue, fairProbabilities } from "./value";
import type { Env, ModelFixture, PriceSet } from "./types";

const DEFAULT_LEAGUE_ID = "3120672213";

export function addExactOuFallback(priceSets: PriceSet[], model: ModelFixture): PriceSet[] {
  if (priceSets.some(set => set.market === "ou25")) return priceSets;
  const fallback = model.fallbackPrices.filter(price => price.market === "ou25");
  const over = fallback.find(price => price.outcome === "over")?.odds;
  const under = fallback.find(price => price.outcome === "under")?.odds;
  if (over == null || under == null) return priceSets;
  return [...priceSets, { market: "ou25", prices: { over, under }, line: 2.5, source: "model_sheet" }];
}

export async function runSync(env: Env): Promise<Record<string, number>> {
  if (!env.FIVE_DOLLAR_API_KEY) throw new Error("FIVE_DOLLAR_API_KEY is not configured");
  const syncId = await beginSync(env.DB, "scheduled");
  const counts = { modelFixtures: 0, providerFixtures: 0, matchedFixtures: 0, oddsRequests: 0 };
  try {
    const modelFixtures = await fetchModelFixtures(env.MODEL_CSV_URL);
    counts.modelFixtures = modelFixtures.length;
    for (const fixture of modelFixtures) await saveModelFixture(env.DB, fixture);
    await setState(env.DB, "last_model_sync", new Date().toISOString());

    const providerFixtures = await fetchUpcomingFixtures(env.FIVE_DOLLAR_API_KEY, env.FOOTBALL_API_LEAGUE_ID ?? DEFAULT_LEAGUE_ID, env.FOOTBALL_API_BASE_URL);
    counts.providerFixtures = providerFixtures.length;
    const matched: Array<{ model: ModelFixture; provider: (typeof providerFixtures)[number] }> = [];
    for (const model of modelFixtures) {
      const provider = providerFixtures.find(candidate => fixtureMatches(model, candidate));
      if (!provider) continue;
      await linkFixture(env.DB, model.marketId, provider);
      matched.push({ model, provider });
    }
    counts.matchedFixtures = matched.length;

    for (const { model, provider } of matched.sort((a, b) => Date.parse(a.provider.kickoff_utc) - Date.parse(b.provider.kickoff_utc)).slice(0, 12)) {
      const priceSets = addExactOuFallback(await fetchFixturePrices(env.FIVE_DOLLAR_API_KEY, provider.id, env.FOOTBALL_API_BASE_URL), model);
      counts.oddsRequests++;
      const observedAt = new Date().toISOString();
      for (const set of priceSets) {
        const complete = Object.fromEntries(Object.entries(set.prices).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
        const fair = fairProbabilities(complete);
        const modelProbabilities = await getModelProbabilities(env.DB, model.marketId, set.market);
        for (const [outcome, marketOdds] of Object.entries(complete)) {
          const bookmaker = set.source === "model_sheet" ? "model_sheet" : "bet365";
          await env.DB.prepare("INSERT INTO odds_snapshots (fixture_id, provider_fixture_id, bookmaker, market, outcome, line, decimal_odds, observed_at, source_price_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(model.marketId, provider.id, bookmaker, set.market, outcome, set.line, marketOdds, observedAt, set.source).run();
          const modelProbability = modelProbabilities[outcome];
          if (modelProbability == null) continue;
          const value = calculateValue(modelProbability, marketOdds, fair.probabilities[outcome], fair.overround);
          await env.DB.prepare(`INSERT INTO comparisons (fixture_id, market, outcome, model_probability, model_odds, market_odds, market_probability, overround, edge, expected_return, classification, observed_at, price_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(fixture_id, market, outcome) DO UPDATE SET model_probability=excluded.model_probability, model_odds=excluded.model_odds, market_odds=excluded.market_odds, market_probability=excluded.market_probability, overround=excluded.overround, edge=excluded.edge, expected_return=excluded.expected_return, classification=excluded.classification, observed_at=excluded.observed_at, price_source=excluded.price_source`)
            .bind(model.marketId, set.market, outcome, modelProbability * 100, 1 / modelProbability, marketOdds, value.marketProbability, value.overround, value.edge, value.expectedReturn, value.classification, observedAt, set.source).run();
        }
      }
    }
    await setState(env.DB, "last_odds_sync", new Date().toISOString());
    await finishSync(env.DB, syncId, "success", counts);
    return counts;
  } catch (error) {
    await finishSync(env.DB, syncId, "failed", counts, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
