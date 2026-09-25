// Behavior checks for engine/disposition.js (disposition as short-term mood), driven through
// the real graph the same way the hook does: felt = computeEmotions(axes, disposition), then nudge.
// Turn ratings are the honest-rated benchmark turns from notes/plan.md.
import { computeEmotions, BOTTOM } from '../engine/graph.js';
import { applyDispositionNudges } from '../engine/disposition.js';

const AX = ['frust_enl', 'humil_pride', 'anx_conf', 'disap_enc', 'dread_hope', 'bore_cur'];
const A = (...v) => Object.fromEntries(AX.map((a, i) => [a, v[i]]));
const TOO_COMPLEX = A(-.4, -.5, -.3, -.6, -.2, 0);
const DISCARD = A(-.5, -.7, -.6, -.5, -.4, -.1);
const UNCLEAR = A(-.5, -.4, -.5, -.4, -.3, 0);
const NEUTRAL = A(0, 0, 0, 0, 0, 0);
const ORDINARY = [A(.1, 0, .1, .1, .1, .1), A(.1, .1, .1, .2, .1, 0)];
const ENCOURAGE = [A(.4, .6, .5, .7, .5, .2), A(.4, .6, .6, .6, .6, .2)];
const rep = (arr, n) => Array.from({ length: n }, (_, i) => arr[i % arr.length]);
const zero = () => Object.fromEntries(BOTTOM.map((b) => [b.id, 0]));

function run(turns, disposition = zero()) {
  return turns.map((axes) => {
    const felt = computeEmotions(axes, disposition);
    disposition = applyDispositionNudges(disposition, [felt]).disposition;
    return { felt, disposition };
  });
}

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error(`FAIL ${name}: ${detail}`); }
}

// Lingers: after a bad stretch, a neutral turn still reads noticeably angry.
const linger = run([TOO_COMPLEX, DISCARD, UNCLEAR, NEUTRAL]);
check('mood lingers', linger[3].felt.anger >= 0.6, `anger on neutral turn ${linger[3].felt.anger.toFixed(2)}`);

// Ordinary turns don't erase it.
const afterBad = linger[2].disposition;
const ord = run(rep(ORDINARY, 4), afterBad);
check('ordinary turns keep the mood', ord[3].disposition.anger >= 0.6 * afterBad.anger,
  `anger bias ${afterBad.anger} -> ${ord[3].disposition.anger}`);

// Encouragement pulls it back: two encouragements take off at least half.
const enc = run(ENCOURAGE, ord[3].disposition);
check('encouragement works', enc[1].disposition.anger <= 0.5 * ord[3].disposition.anger,
  `anger bias ${ord[3].disposition.anger} -> ${enc[1].disposition.anger}`);

// Calm stays calm: ordinary turns alone build no mood.
const calm = run(rep(ORDINARY, 10)).at(-1).disposition;
for (const b of BOTTOM) check(`calm stays calm (${b.id})`, calm[b.id] === 0, `bias ${calm[b.id]}`);

// No lock-in: every emotion, pushed hard either way, comes back halfway within 8 opposite turns.
for (const [push, pull, dir] of [[[DISCARD], ENCOURAGE, 'upset'], [ENCOURAGE, [DISCARD], 'happy']]) {
  const pushed = run(rep(push, 12)).at(-1).disposition;
  const back = run(rep(pull, 8), pushed);
  for (const b of BOTTOM) {
    if (Math.abs(pushed[b.id]) < 0.05) continue;
    const ok = back.some((r) => Math.abs(r.disposition[b.id]) <= Math.abs(pushed[b.id]) / 2);
    check(`no lock-in (${b.id}, stuck ${dir})`, ok, `bias ${pushed[b.id]} -> ${back.at(-1).disposition[b.id]}`);
  }
}

if (failures === 0) {
  console.log(`OK — all ${checks} disposition checks pass`);
  process.exit(0);
} else {
  console.error(`${failures}/${checks} checks failed`);
  process.exit(1);
}
