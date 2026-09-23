import { BOTTOM } from './graph.js';

const STREAK_LEN = 3;
const DEVIATION_THRESHOLD = 0.2; // distance from neutral (0.5), for the streak rule
const SPIKE_HIGH = 0.8; // single-turn value at/above this nudges disposition up
const SPIKE_LOW = 0.2; // single-turn value at/below this nudges disposition down
const NUDGE_AMOUNT = 0.05;

/**
 * Deterministic, no LLM. Two independent triggers, each capable of nudging a given
 * emotion's disposition bias by a small fixed amount (capped at +/-1):
 *
 * - Streak: the same emotion has sat >0.2 from neutral, same direction, for the last
 *   3 turns (history must already include the just-computed value).
 * - Spike: a single turn hit a real extreme (>=0.8 or <=0.2) — one bad-enough moment
 *   is itself worth a nudge, no streak needed ("getting really mad makes you quicker
 *   to anger next time").
 *
 * If both fire for the same emotion in the same turn, only one nudge is applied (they
 * agree on direction by construction, so this just avoids double-counting one event).
 *
 * First-pass thresholds/amounts — expect to tune once there are real sessions to look at.
 *
 * @returns {{ disposition: Record<string, number>, nudged: string[] }}
 */
export function applyDispositionNudges(disposition, history) {
  const latest = history[history.length - 1];
  const streakWindow = history.length >= STREAK_LEN ? history.slice(-STREAK_LEN) : null;

  const next = { ...disposition };
  const nudged = [];

  for (const b of BOTTOM) {
    let direction = 0;

    if (streakWindow) {
      const deviations = streakWindow.map((v) => v[b.id] - 0.5);
      if (deviations.every((d) => d > DEVIATION_THRESHOLD)) direction = 1;
      else if (deviations.every((d) => d < -DEVIATION_THRESHOLD)) direction = -1;
    }

    if (direction === 0 && latest) {
      if (latest[b.id] >= SPIKE_HIGH) direction = 1;
      else if (latest[b.id] <= SPIKE_LOW) direction = -1;
    }

    if (direction === 0) continue;

    const current = next[b.id] ?? 0;
    // Round to avoid float drift (e.g. +0.05 then -0.05 landing on 1e-17 instead of
    // exactly 0) — visible as a stray near-zero bias in the dashboard otherwise.
    const moved = Math.round(Math.max(-1, Math.min(1, current + direction * NUDGE_AMOUNT)) * 100) / 100;
    if (moved !== current) {
      next[b.id] = moved;
      nudged.push(b.id);
    }
  }

  return { disposition: next, nudged };
}
