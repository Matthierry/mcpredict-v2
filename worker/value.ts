export interface ValueResult {
  marketProbability: number;
  overround: number;
  edge: number;
  expectedReturn: number;
  classification: string;
}

export function fairProbabilities(prices: Record<string, number>): { probabilities: Record<string, number>; overround: number } {
  const entries = Object.entries(prices);
  if (entries.length < 2 || entries.some(([, price]) => !Number.isFinite(price) || price <= 1)) throw new Error("Market prices must be valid decimal odds");
  const raw = Object.fromEntries(entries.map(([outcome, price]) => [outcome, 1 / price]));
  const total = Object.values(raw).reduce((sum, probability) => sum + probability, 0);
  return { probabilities: Object.fromEntries(Object.entries(raw).map(([outcome, probability]) => [outcome, probability / total])), overround: (total - 1) * 100 };
}

export function classifyEdge(edge: number): string {
  if (edge > 10) return "High";
  if (edge > 5) return "Good";
  if (edge > 0) return "Some";
  if (edge > -5) return "No";
  if (edge > -10) return "Bad";
  return "Very bad";
}

export function calculateValue(modelProbability: number, marketOdds: number, fairMarketProbability: number, overround: number): ValueResult {
  const edge = (modelProbability - fairMarketProbability) * 100;
  return { marketProbability: fairMarketProbability * 100, overround, edge, expectedReturn: (modelProbability * marketOdds - 1) * 100, classification: classifyEdge(edge) };
}
