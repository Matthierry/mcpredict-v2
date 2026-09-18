const TEAM_ALIASES: Record<string, string> = {
  "man utd": "manchester united", "man united": "manchester united",
  "man city": "manchester city", "spurs": "tottenham hotspur", "tottenham": "tottenham hotspur",
  "nottm forest": "nottingham forest", "nottingham": "nottingham forest",
  "wolves": "wolverhampton wanderers", "west ham": "west ham united",
  "newcastle": "newcastle united", "brighton": "brighton and hove albion"
};

export function normalizeTeam(value: string): string {
  const normalized = value.toLowerCase().replace(/&/g, "and").replace(/[.'’]/g, "").replace(/\b(fc|afc|football club)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  return TEAM_ALIASES[normalized] ?? normalized;
}

export function fixtureMatches(model: { homeTeam: string; awayTeam: string; kickoffUtc: string }, provider: { teams: { home: { name: string }; away: { name: string } }; kickoff_utc: string }): boolean {
  const teamMatch = normalizeTeam(model.homeTeam) === normalizeTeam(provider.teams.home.name) && normalizeTeam(model.awayTeam) === normalizeTeam(provider.teams.away.name);
  const timeDifference = Math.abs(new Date(model.kickoffUtc).getTime() - new Date(provider.kickoff_utc).getTime());
  return teamMatch && timeDifference <= 3 * 60 * 60 * 1000;
}

export function parseProbability(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const numeric = Number(text.replace("%", "").replace(",", "."));
  if (!Number.isFinite(numeric)) return null;
  const probability = text.includes("%") || numeric > 1 ? numeric / 100 : numeric;
  return probability >= 0 && probability <= 1 ? probability : null;
}

export function modelKickoff(dateValue: string, timeValue: string): string | null {
  const date = dateValue.trim();
  const time = timeValue.trim() || "00:00";
  let year: string, month: string, day: string;
  const iso = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const uk = date.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (iso) [, year, month, day] = iso;
  else if (uk) [, day, month, year] = uk;
  else return null;
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;
  const result = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}:00Z`);
  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}
