import type { Env } from "./types";
import { runSync } from "./sync";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": status === 200 ? "public, max-age=60" : "no-store" } });

async function dashboard(env: Env): Promise<Response> {
  const [fixtureResult, predictionResult, comparisonResult, stateResult] = await Promise.all([
    env.DB.prepare("SELECT id, provider_fixture_id, kickoff_utc, home_team, away_team, status, match_state FROM fixtures WHERE datetime(kickoff_utc) >= datetime('now', '-4 hours') ORDER BY datetime(kickoff_utc)").all<any>(),
    env.DB.prepare("SELECT fixture_id, market, outcome, probability * 100 AS model_probability, model_odds FROM model_predictions").all<any>(),
    env.DB.prepare(`SELECT c.fixture_id, c.market, c.outcome, c.model_probability, c.model_odds, c.market_odds, c.market_probability, c.edge, c.expected_return, c.classification, c.observed_at,
      (SELECT os.source_price_type FROM odds_snapshots os WHERE os.fixture_id=c.fixture_id AND os.market=c.market AND os.outcome=c.outcome ORDER BY os.id DESC LIMIT 1) AS price_source
      FROM comparisons c`).all<any>(),
    env.DB.prepare("SELECT key, value FROM site_state").all<{ key: string; value: string }>()
  ]);
  const comparisons = new Map(comparisonResult.results.map(row => [`${row.fixture_id}|${row.market}|${row.outcome}`, row]));
  const predictions = new Map<string, any[]>();
  for (const row of predictionResult.results) predictions.set(row.fixture_id, [...(predictions.get(row.fixture_id) ?? []), row]);
  const fixtures = fixtureResult.results.map(row => {
    const markets: Record<string, any[]> = { "1x2": [], ou25: [] };
    for (const prediction of predictions.get(row.id) ?? []) {
      const comparison = comparisons.get(`${row.id}|${prediction.market}|${prediction.outcome}`);
      markets[prediction.market].push({ outcome: prediction.outcome, modelProbability: comparison?.model_probability ?? prediction.model_probability, modelOdds: comparison?.model_odds ?? prediction.model_odds, marketOdds: comparison?.market_odds ?? null, marketProbability: comparison?.market_probability ?? null, edge: comparison?.edge ?? null, expectedReturn: comparison?.expected_return ?? null, classification: comparison?.classification ?? null, observedAt: comparison?.observed_at ?? null, priceSource: comparison?.price_source ?? null });
    }
    return { id: row.id, providerFixtureId: row.provider_fixture_id, kickoffUtc: row.kickoff_utc, homeTeam: row.home_team, awayTeam: row.away_team, status: row.status, matchState: row.match_state, markets };
  });
  const state = Object.fromEntries(stateResult.results.map(row => [row.key, row.value]));
  return json({ generatedAt: new Date().toISOString(), lastModelSync: state.last_model_sync ?? null, lastOddsSync: state.last_odds_sync ?? null, bookmaker: "Bet365", competition: "Premier League", fixtures, diagnostics: { fixtureCount: fixtures.length, matchedCount: fixtures.filter(row => row.matchState === "matched").length, comparisonCount: comparisonResult.results.length } });
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/v1/health" && request.method === "GET") return json({ ok: true, environment: env.ENVIRONMENT ?? "unknown", timestamp: new Date().toISOString() });
  if (url.pathname === "/api/v1/dashboard" && request.method === "GET") return dashboard(env);
  if (url.pathname === "/api/internal/sync" && request.method === "POST") {
    const supplied = request.headers.get("authorization");
    if (!env.SYNC_TOKEN || supplied !== `Bearer ${env.SYNC_TOKEN}`) return json({ error: "Not found" }, 404);
    try { return json({ success: true, counts: await runSync(env) }); } catch (error) { return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500); }
  }
  return json({ error: "Not found" }, 404);
}
