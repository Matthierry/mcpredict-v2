import { describe, expect, it } from "vitest";
import { fixtureMatches, modelKickoff, normalizeTeam, parseProbability } from "../worker/normalize";
describe("source normalization", () => {
  it("normalizes common Premier League aliases", () => { expect(normalizeTeam("Man Utd FC")).toBe("manchester united"); expect(normalizeTeam("Wolves")).toBe("wolverhampton wanderers"); });
  it("accepts percentage and decimal probability formats", () => { expect(parseProbability("57.4%")).toBeCloseTo(.574); expect(parseProbability("0.574")).toBeCloseTo(.574); });
  it("matches across a timezone difference", () => expect(fixtureMatches({homeTeam:"Man Utd",awayTeam:"Wolves",kickoffUtc:"2026-09-20T14:00:00Z"},{teams:{home:{name:"Manchester United"},away:{name:"Wolverhampton Wanderers"}},kickoff_utc:"2026-09-20T15:00:00Z"})).toBe(true));
  it("parses UK dates", () => expect(modelKickoff("20/09/2026","15:00")).toBe("2026-09-20T15:00:00.000Z"));
});
