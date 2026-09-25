// Regression test for engine/graph.js. fear/anger/sadness/trust/joy must reproduce the
// worked examples in ~/Desktop/emotion graph/examples.md exactly (to 2 decimal places).
// The prototype's "love" node was replaced by "motivation" with a different topology, so
// its expected values were computed independently (by hand in Python, not from this
// engine) from the motivation row: frust_enl mid, humil_pride mid, disap_enc large,
// bore_cur large.
import { computeEmotions } from '../engine/graph.js';

const EVENTS = {
  big: { frust_enl: -1, humil_pride: -1, anx_conf: -1, disap_enc: -1, dread_hope: 0, bore_cur: 0 },
  mild: { frust_enl: 0, humil_pride: 0, anx_conf: 0, disap_enc: -1, dread_hope: 0, bore_cur: 0 },
};

const CHARACTERS = {
  sam: { fear: 0, anger: 0, sadness: 0, trust: 0, joy: 0, motivation: 0 },
  priya: { fear: -1, anger: -1, sadness: -1, trust: 1, joy: 1, motivation: 1 },
  rex: { fear: 1, anger: 1, sadness: 1, trust: -1, joy: -1, motivation: -1 },
};

const EXPECTED = {
  sam: {
    big: { fear: 0.84, anger: 0.95, sadness: 0.84, trust: 0.32, joy: 0.1, motivation: 0.11 },
    mild: { fear: 0.5, anger: 0.73, sadness: 0.63, trust: 0.48, joy: 0.37, motivation: 0.27 },
  },
  priya: {
    big: { fear: 0.66, anger: 0.88, sadness: 0.66, trust: 0.56, joy: 0.23, motivation: 0.25 },
    mild: { fear: 0.27, anger: 0.5, sadness: 0.39, trust: 0.71, joy: 0.61, motivation: 0.5 },
  },
  rex: {
    big: { fear: 0.93, anger: 0.98, sadness: 0.93, trust: 0.15, joy: 0.04, motivation: 0.04 },
    mild: { fear: 0.73, anger: 0.88, sadness: 0.82, trust: 0.25, joy: 0.18, motivation: 0.12 },
  },
};

let failures = 0;
let checks = 0;

for (const charName of Object.keys(CHARACTERS)) {
  for (const eventName of Object.keys(EVENTS)) {
    const actual = computeEmotions(EVENTS[eventName], CHARACTERS[charName]);
    const expected = EXPECTED[charName][eventName];
    for (const emotion of Object.keys(expected)) {
      checks++;
      const a = Math.round(actual[emotion] * 100) / 100;
      const e = expected[emotion];
      if (Math.abs(a - e) > 0.01) {
        failures++;
        console.error(`FAIL ${charName}/${eventName}/${emotion}: expected ${e}, got ${a}`);
      }
    }
  }
}

if (failures === 0) {
  console.log(`OK — all ${checks} checks match expected values`);
  process.exit(0);
} else {
  console.error(`${failures}/${checks} checks failed`);
  process.exit(1);
}
