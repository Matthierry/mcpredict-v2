import type { ModelFixture, ProviderFixture } from "./types";

export async function beginSync(db: D1Database, source: string): Promise<number> {
  const result = await db.prepare("INSERT INTO sync_runs (source, status, started_at) VALUES (?, 'running', datetime('now'))").bind(source).run();
  return Number(result.meta.last_row_id);
}

export async function finishSync(db: D1Database, id: number, status: "success" | "failed", counts: Record<string, number>, error?: string): Promise<void> {
  await db.prepare("UPDATE sync_runs SET status=?, completed_at=datetime('now'), model_fixtures=?, provider_fixtures=?, matched_fixtures=?, odds_requests=?, error_message=? WHERE id=?")
    .bind(status, counts.modelFixtures ?? 0, counts.providerFixtures ?? 0, counts.matchedFixtures ?? 0, counts.oddsRequests ?? 0, error ?? null, id).run();
}

export async function saveModelFixture(db: D1Database, fixture: ModelFixture): Promise<void> {
  await db.prepare(`INSERT INTO fixtures (id, model_market_id, competition_key, kickoff_utc, home_team, away_team, status, match_state, updated_at)
    VALUES (?, ?, 'E0', ?, ?, ?, 'scheduled', 'unmatched', datetime('now'))
    ON CONFLICT(id) DO UPDATE SET kickoff_utc=excluded.kickoff_utc, home_team=excluded.home_team, away_team=excluded.away_team, updated_at=datetime('now')`)
    .bind(fixture.marketId, fixture.marketId, fixture.kickoffUtc, fixture.homeTeam, fixture.awayTeam).run();
  for (const prediction of fixture.predictions) {
    await db.prepare(`INSERT INTO model_predictions (fixture_id, market, outcome, probability, model_odds, imported_at) VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(fixture_id, market, outcome) DO UPDATE SET probability=excluded.probability, model_odds=excluded.model_odds, imported_at=datetime('now')`)
      .bind(fixture.marketId, prediction.market, prediction.outcome, prediction.probability, prediction.probability > 0 ? 1 / prediction.probability : null).run();
  }
}

export async function linkFixture(db: D1Database, modelId: string, provider: ProviderFixture): Promise<void> {
  await db.prepare("UPDATE fixtures SET provider_fixture_id=?, provider_home_team=?, provider_away_team=?, kickoff_utc=?, status=?, match_state='matched', updated_at=datetime('now') WHERE id=?")
    .bind(provider.id, provider.teams.home.name, provider.teams.away.name, provider.kickoff_utc, provider.status, modelId).run();
}

export async function getModelProbabilities(db: D1Database, fixtureId: string, market: string): Promise<Record<string, number>> {
  const result = await db.prepare("SELECT outcome, probability FROM model_predictions WHERE fixture_id=? AND market=?").bind(fixtureId, market).all<{ outcome: string; probability: number }>();
  return Object.fromEntries(result.results.map(row => [row.outcome, row.probability]));
}

export async function setState(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare("INSERT INTO site_state (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')").bind(key, value).run();
}
