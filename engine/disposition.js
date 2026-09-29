import { BOTTOM } from './graph.js';

const FADE = 0.3; // share of a pleasant-side bias that fades each turn
const FADE_UPSET = 0.15; // bad moods fade more slowly
const NO_MARK_ZONE = 0.2; // felt within 0.3–0.7 leaves no mark
const MARK_RATE = 0.45; // mark = MARK_RATE × (felt − 0.5)
const UNPLEASANT_WEIGHT = 1.5; // marks toward upset (fear/anger/sadness up, trust/joy/motivation down) count more

/**
 * Deterministic, no LLM. Disposition is short-term mood: the lingering effect of how the agent
 * has felt recently. Each turn the mood first fades a little toward neutral (excitement wears off
 * once it's just work; bad moods cool more slowly), then every emotion felt strongly (outside
 * 0.3–0.7) leaves a mark proportional to how strongly it was felt.
 *
 * Judged on the felt reading (bias included). Fading is what prevents lock-in: any mood decays
 * unless something keeps renewing it.
 *
 * Tuned offline (notes/fade-eval.mjs).
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
    const upset = (x) => (b.family === 'bad' ? x > 0 : x < 0);
    const current = next[b.id] ?? 0;
    let v = current * (1 - (upset(current) ? FADE_UPSET : FADE));

    const d = felt[b.id] - 0.5;
    if (Math.abs(d) >= NO_MARK_ZONE) v += d * MARK_RATE * (upset(d) ? UNPLEASANT_WEIGHT : 1);

    const moved = Math.round(Math.max(-1, Math.min(1, v)) * 100) / 100;
    if (moved !== current) {
      next[b.id] = moved;
      nudged.push(b.id);
    }
  }

  return { disposition: next, nudged };
}
