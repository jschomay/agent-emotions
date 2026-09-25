import { BOTTOM } from './graph.js';

const NO_MARK_ZONE = 0.1; // felt within 0.4–0.6 leaves no mark
const MARK_RATE = 0.45; // mark = MARK_RATE × (felt − 0.5)
const UNPLEASANT_WEIGHT = 1.5; // marks toward upset (fear/anger/sadness up, trust/joy/motivation down) count more
const CAP = 0.45; // max |bias|; keeps strong opposite moments able to pull any emotion back

/**
 * Deterministic, no LLM. Disposition acts as short-term mood: the lingering effect of how the
 * agent has felt recently. Each turn, every emotion the agent felt noticeably (outside 0.4–0.6)
 * leaves a mark on its bias proportional to how strongly it was felt. Mild turns leave none, so
 * ordinary pleasantness doesn't erase a bad mood; strong encouragement does.
 *
 * Judged on the felt reading (the value just computed with the current bias included), like a
 * person seeing the world through their mood. The cap is what prevents lock-in: even at the cap,
 * a strongly encouraging (or upsetting) turn still reads outside the no-mark zone.
 *
 * Tuned offline against honest-rated turns (see notes/mood-eval.mjs).
 *
 * @param history state history; the last entry is this turn's felt values
 * @returns {{ disposition: Record<string, number>, nudged: string[] }}
 */
export function applyDispositionNudges(disposition, history) {
  const felt = history[history.length - 1];
  const next = { ...disposition };
  const nudged = [];
  if (!felt) return { disposition: next, nudged };

  for (const b of BOTTOM) {
    const d = felt[b.id] - 0.5;
    let mark = Math.abs(d) < NO_MARK_ZONE ? 0 : d * MARK_RATE;
    const towardUpset = b.family === 'bad' ? d > 0 : d < 0;
    if (towardUpset) mark *= UNPLEASANT_WEIGHT;

    const current = next[b.id] ?? 0;
    // Round to avoid float drift (e.g. landing on 1e-17 instead of exactly 0) — visible as a
    // stray near-zero bias in the dashboard otherwise.
    const moved = Math.round(Math.max(-CAP, Math.min(CAP, current + mark)) * 100) / 100;
    if (moved !== current) {
      next[b.id] = moved;
      nudged.push(b.id);
    }
  }

  return { disposition: next, nudged };
}
