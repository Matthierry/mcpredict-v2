import { useEffect, useMemo, useState } from "react";
import { getDashboard } from "./api";
import type { DashboardPayload, FixtureView, Market, Mode, OutcomeComparison } from "./types";

const pct = (value: number | null, signed = false) => value == null ? "—" : `${signed && value > 0 ? "+" : ""}${value.toFixed(1)}%`;
const odds = (value: number | null) => value == null ? "—" : value.toFixed(2);
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)) : "Not yet synced";
const day = (value: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(value));

function OutcomeRow({ item, leader }: { item: OutcomeComparison; leader: boolean }) {
  const positive = (item.edge ?? 0) > 0;
  const source = item.priceSource === "model_sheet" ? "Sheet exact 2.5" : item.priceSource === "opening" ? "Bet365 opening" : item.priceSource === "latest" ? "Bet365 latest" : null;
  return <div className={`outcome-row ${leader ? "outcome-row--leader" : ""}`}>
    <div className="outcome-name"><span>{item.outcome}</span>{leader && <span className="signal">Model pick</span>}</div>
    <div><small>Model</small><strong className="model">{pct(item.modelProbability)}</strong></div>
    <div><small>Market</small><strong>{pct(item.marketProbability)}</strong></div>
    <div><small>Price</small><strong>{odds(item.marketOdds)}</strong>{source && <span style={{ display: "block", marginTop: 3, color: "#777", fontSize: ".58rem", lineHeight: 1.2 }}>{source}</span>}</div>
    <div><small>Edge</small><strong className={item.edge == null ? "muted" : positive ? "positive" : "negative"}>{pct(item.edge, true)}</strong></div>
    <div><small>EV</small><strong className={item.expectedReturn == null ? "muted" : item.expectedReturn > 0 ? "positive" : "negative"}>{pct(item.expectedReturn, true)}</strong></div>
  </div>;
}

function FixtureCard({ fixture, market }: { fixture: FixtureView; market: Market }) {
  const rows = fixture.markets[market] ?? [];
  const leader = rows.reduce<OutcomeComparison | null>((best, row) => !best || row.modelProbability > best.modelProbability ? row : best, null);
  const exactPriceUnavailable = market === "ou25" && rows.length > 0 && rows.every(row => row.marketOdds == null);
  return <article className="fixture-card">
    <header className="fixture-header">
      <div><span>{day(fixture.kickoffUtc)}</span><strong>{time(fixture.kickoffUtc)}</strong></div>
      <div className="teams"><strong>{fixture.homeTeam}</strong><span>vs</span><strong>{fixture.awayTeam}</strong></div>
      <span className={`status ${fixture.matchState}`}>{fixture.matchState === "matched" ? "Fixture matched" : "Awaiting fixture match"}</span>
    </header>
    {exactPriceUnavailable && <div style={{ margin: "10px 12px 0", padding: "10px 12px", border: "1px solid rgba(241,144,20,.25)", borderRadius: 8, background: "rgba(241,144,20,.06)", color: "#caa97c", fontSize: ".72rem" }}>Exact O/U 2.5 price unavailable from both live feed and sheet.</div>}
    {rows.length ? <div className="outcomes">{rows.map(row => <OutcomeRow key={row.outcome} item={row} leader={leader?.outcome === row.outcome} />)}</div> : <div className="empty-market">Model output for this market is not available.</div>}
  </article>;
}

export default function App() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("value");
  const [market, setMarket] = useState<Market>("1x2");
  const [minimumEdge, setMinimumEdge] = useState(-100);

  useEffect(() => { getDashboard().then(setData).catch(err => setError(err instanceof Error ? err.message : "Unable to load dashboard")).finally(() => setLoading(false)); }, []);

  const fixtures = useMemo(() => {
    if (!data) return [];
    const score = (fixture: FixtureView) => Math.max(...(fixture.markets[market] ?? []).map(row => mode === "value" ? row.edge ?? -999 : row.modelProbability), -999);
    return data.fixtures.filter(fixture => minimumEdge <= -100 || (fixture.markets[market] ?? []).some(row => (row.edge ?? -999) >= minimumEdge)).sort((a, b) => score(b) - score(a));
  }, [data, market, minimumEdge, mode]);

  const opportunities = data?.fixtures.flatMap(f => f.markets[market] ?? []).filter(row => (row.edge ?? 0) > 0).length ?? 0;
  const highestEdge = Math.max(...(data?.fixtures.flatMap(f => f.markets[market] ?? []).map(row => row.edge ?? -999) ?? [-999]));

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">MC</span><span><b>MC PREDICT</b><small>v2 · Premier League</small></span></a><div className="live-label"><i /> Market comparison feed</div></header>
    <main>
      <section className="hero"><p className="eyebrow">MODEL VERSUS MARKET</p><h1>Track the gap between<br /><span>price and probability.</span></h1><p>Independent Premier League forecasts compared with the latest available Bet365 prices.</p></section>
      {loading && <div className="notice">Loading the latest market comparison…</div>}
      {error && <div className="notice notice--error"><strong>Dashboard unavailable</strong><span>{error}. The first data sync may still need to run.</span></div>}
      {data && <>
        <section className="kpis">
          <div><small>Upcoming fixtures</small><strong>{data.diagnostics.fixtureCount}</strong></div>
          <div><small>Fixtures matched</small><strong>{data.diagnostics.matchedCount}</strong></div>
          <div><small>Positive edges</small><strong>{opportunities}</strong></div>
          <div><small>Highest edge</small><strong className="positive">{highestEdge > -999 ? pct(highestEdge, true) : "—"}</strong></div>
        </section>
        <section className="toolbar">
          <div className="segmented"><button className={mode === "value" ? "active" : ""} onClick={() => setMode("value")}>Value</button><button className={mode === "probability" ? "active" : ""} onClick={() => setMode("probability")}>Probability</button></div>
          <div className="segmented"><button className={market === "1x2" ? "active" : ""} onClick={() => setMarket("1x2")}>Match result</button><button className={market === "ou25" ? "active" : ""} onClick={() => setMarket("ou25")}>O/U 2.5</button></div>
          <label>Minimum edge<select value={minimumEdge} onChange={event => setMinimumEdge(Number(event.target.value))}><option value={-100}>All</option><option value={0}>Positive only</option><option value={5}>5%+</option><option value={10}>10%+</option></select></label>
        </section>
        <div className="sync-line"><span>Model: {dateTime(data.lastModelSync)}</span><span>Odds: {dateTime(data.lastOddsSync)}</span></div>
        <section className="fixture-list">{fixtures.length ? fixtures.map(fixture => <FixtureCard key={fixture.id} fixture={fixture} market={market} />) : <div className="notice">No fixtures match the selected filters.</div>}</section>
      </>}
    </main>
    <footer><span>MC Predict v2 · Data. Model. Signal.</span><a href="https://5dollarfootballapi.com" target="_blank" rel="noreferrer">Football data by 5DollarFootballAPI</a></footer>
  </div>;
}
