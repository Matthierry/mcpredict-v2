import type { PriceSet, ProviderFixture } from "./types";

const DEFAULT_BASE_URL = "https://api.5dollarfootballapi.com/v1";

async function apiRequest<T>(path: string, apiKey: string, baseUrl = DEFAULT_BASE_URL): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
  if (!response.ok) throw new Error(`Football API ${path} returned HTTP ${response.status}`);
  const body = await response.json() as { success: number; data: T; error?: { message?: string } };
  if (!body.success) throw new Error(body.error?.message ?? "Football API request failed");
  return body.data;
}

export async function fetchUpcomingFixtures(apiKey: string, leagueId: string, baseUrl?: string, days = 7): Promise<ProviderFixture[]> {
  const fixtures: ProviderFixture[] = [];
  const now = Date.now();
  for (let offset = 0; offset < days; offset++) {
    const start = Math.floor((now + offset * 86_400_000) / 1000);
    const end = Math.floor((now + (offset + 1) * 86_400_000) / 1000);
    const data = await apiRequest<ProviderFixture[]>(`/fixtures?start_time=${start}&end_time=${end}&league=${encodeURIComponent(leagueId)}&status=scheduled&per_page=100`, apiKey, baseUrl);
    fixtures.push(...data);
  }
  return [...new Map(fixtures.map(fixture => [fixture.id, fixture])).values()];
}

function completePrices(candidate: Record<string, number> | null | undefined, outcomes: string[]): candidate is Record<string, number> {
  return !!candidate && outcomes.every(outcome => Number(candidate[outcome]) > 1);
}

export async function fetchFixturePrices(apiKey: string, fixtureId: number, baseUrl?: string): Promise<PriceSet[]> {
  const data = await apiRequest<{ bookmakers: Array<{ slug: string; odds: Record<string, any> }> }>(`/fixtures/${fixtureId}/odds?bookmakers=bet365`, apiKey, baseUrl);
  const odds = data.bookmakers.find(bookmaker => bookmaker.slug === "bet365")?.odds;
  if (!odds) return [];
  const sets: PriceSet[] = [];
  const match = completePrices(odds["1x2"]?.closing, ["home", "draw", "away"]) ? odds["1x2"].closing : odds["1x2"]?.opening;
  if (completePrices(match, ["home", "draw", "away"])) sets.push({ market: "1x2", prices: { home: match.home, draw: match.draw, away: match.away }, line: null, source: odds["1x2"]?.closing === match ? "latest" : "opening" });
  const goalCandidates = [odds.goal_line?.closing, odds.goal_line?.opening].filter((candidate: any) => candidate?.line === 2.5);
  const goal = goalCandidates.find((candidate: any) => completePrices(candidate, ["over", "under"]));
  if (goal) sets.push({ market: "ou25", prices: { over: goal.over, under: goal.under }, line: 2.5, source: odds.goal_line?.closing === goal ? "latest" : "opening" });
  return sets;
}
