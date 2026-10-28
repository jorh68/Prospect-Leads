/** Pure aggregation helpers for the dashboard (unit-tested). */

export interface ScoreBin {
  from: number;
  to: number;
  count: number;
}

/** Ten bins: 0–9, 10–19 … 90–100. */
export function scoreHistogram(scores: number[]): ScoreBin[] {
  const bins: ScoreBin[] = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i === 9 ? 100 : i * 10 + 9, count: 0 }));
  for (const s of scores) {
    if (!Number.isFinite(s)) continue;
    bins[Math.min(9, Math.max(0, Math.floor(s / 10)))].count++;
  }
  return bins;
}
