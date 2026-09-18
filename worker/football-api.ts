import type { PriceSet, ProviderFixture } from "./types";

const DEFAULT_BASE_URL = "https://api.5dollarfootballapi.com/v1";

async function apiRequest<T>(path: string, apiKey: string, baseUrl = DEFAULT_BASE_URL): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
  const text = await response.text();
  let body: { success?: number; data?: T; error?: { code?: string; message?: string } } = {};
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    // Preserve a useful HTTP error below when the provider returns a non-JSON response.
  }
  if (!response.ok || !body.success) {
    const providerDetail = [body.error?.code, body.error?.message].filter(Boolean).join(": ");
    throw new Error(`Football API ${path} returned HTTP ${response.status}${providerDetail ? ` (${providerDetail})` : ""}`);
  }
  return body.data as T;
}

interface LeagueSummary {
  id: number;
  name: string;
  short_name?: string;
  country?: { code?: string; name?: string };
}

async function resolvePremierLeagueId(apiKey: string, configuredId: string, baseUrl?: string): Promise<string> {
  const leagues = await apiRequest<LeagueSummary[]>(
    "/leagues?country=GB-ENG&per_page=100",
    apiKey,
    baseUrl
  );
  const configured = leagues.find(league => String(league.id) === configuredId);
  const premierLeague = configured ?? leagues.find(league => {
    const name = league.name.toLowerCase();
    const shortName = league.short_name?.toLowerCase();
    return shortName === "epl" || name === "premier league" || name.includes("premier league");
  });
  if (!premierLeague) {
    const available = leagues.slice(0, 12).map(league => `${league.name} [${league.short_name ?? "no short name"}] id=${league.id}`).join(", ");
    throw new Error(`Football API did not return an identifiable English Premier League. English catalogue: ${available || "empty"}`);
  }
  return String(premierLeague.id);
}

export async function fetchUpcomingFixtures(apiKey: string, configuredLeagueId: string, baseUrl?: string, days = 7): Promise<ProviderFixture[]> {
  const leagueId = await resolvePremierLeagueId(apiKey, configuredLeagueId, baseUrl);
  const start = Math.floor(Date.now() / 1000);
  const end = Math.floor((Date.now() + days * 86_400_000) / 1000);
  const data = await apiRequest<ProviderFixture[]>(
    `/leagues/${encodeURIComponent(leagueId)}/fixtures?start_time=${start}&end_time=${end}&status=scheduled&order=asc&per_page=100`,
    apiKey,
    baseUrl
  );
  return [...new Map(data.map(fixture => [fixture.id, fixture])).values()];
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
