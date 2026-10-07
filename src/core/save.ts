export interface RunStats {
  score: number;
  distance: number;
  coins: number;
  bestCombo: number;
  phase: number;
  seed: number;
  cause: string;
}

export interface BestRecord {
  score: number;
  distance: number;
  coins: number;
  bestCombo: number;
  runs: number;
}

const KEY = 'gamedon.runner.phase2.v1';
const EMPTY: BestRecord = { score: 0, distance: 0, coins: 0, bestCombo: 0, runs: 0 };

export function loadBest(): BestRecord {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) as Partial<BestRecord>;
    return {
      score: p.score ?? 0,
      distance: p.distance ?? 0,
      coins: p.coins ?? 0,
      bestCombo: p.bestCombo ?? 0,
      runs: p.runs ?? 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** Merges a finished run into the stored record and returns the updated best. */
export function submitRun(stats: RunStats): { best: BestRecord; isRecord: boolean } {
  const best = loadBest();
  const isRecord = stats.score > best.score;
  const next: BestRecord = {
    score: Math.max(best.score, stats.score),
    distance: Math.max(best.distance, Math.floor(stats.distance)),
    coins: Math.max(best.coins, stats.coins),
    bestCombo: Math.max(best.bestCombo, stats.bestCombo),
    runs: best.runs + 1,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode) - scores stay in memory only */
  }
  return { best: next, isRecord };
}
