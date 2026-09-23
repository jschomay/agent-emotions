import { BOTTOM } from './graph.js';

const STREAK_LEN = 5;
const DEVIATION_THRESHOLD = 0.2; // distance from neutral (0.5)
const NUDGE_AMOUNT = 0.05;

/**
 * Deterministic, no LLM: if an emotion has sat >0.2 from neutral, same direction,
 * for the last 5 turns (history must already include the just-computed value),
 * nudge that emotion's disposition bias a small fixed amount, capped at +/-1.
 *
 * First-pass default — expect to tune once there are real sessions to look at.
 *
 * @returns {{ disposition: Record<string, number>, nudged: string[] }}
 */
export function applyDispositionNudges(disposition, history) {
  if (history.length < STREAK_LEN) return { disposition, nudged: [] };

  const recent = history.slice(-STREAK_LEN);
  const next = { ...disposition };
  const nudged = [];

  for (const b of BOTTOM) {
    const deviations = recent.map((v) => v[b.id] - 0.5);
    const allAbove = deviations.every((d) => d > DEVIATION_THRESHOLD);
    const allBelow = deviations.every((d) => d < -DEVIATION_THRESHOLD);
    if (!allAbove && !allBelow) continue;

    const direction = allAbove ? 1 : -1;
    const current = next[b.id] ?? 0;
    const moved = Math.max(-1, Math.min(1, current + direction * NUDGE_AMOUNT));
    if (moved !== current) {
      next[b.id] = moved;
      nudged.push(b.id);
    }
  }

  return { disposition: next, nudged };
}
