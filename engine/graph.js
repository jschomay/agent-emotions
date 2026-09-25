// Ported from ~/Desktop/emotion graph/emotion-graph.html (TOP/BOTTOM/TOPOLOGY/MAG + recompute()).
// Same constants, same math — only the DOM/graph-rendering parts were dropped.

export const TOP = [
  { id: 'frust_enl', neg: 'frustration', pos: 'enlightenment' },
  { id: 'humil_pride', neg: 'humiliation', pos: 'pride' },
  { id: 'anx_conf', neg: 'anxiety', pos: 'confidence' },
  { id: 'disap_enc', neg: 'disappointed', pos: 'encouraged' },
  { id: 'dread_hope', neg: 'dread', pos: 'hopeful' },
  { id: 'bore_cur', neg: 'boredom', pos: 'curiosity' },
];

export const BOTTOM = [
  { id: 'fear', label: 'fear', family: 'bad' },
  { id: 'anger', label: 'anger', family: 'bad' },
  { id: 'sadness', label: 'sadness', family: 'bad' },
  { id: 'trust', label: 'trust', family: 'good' },
  { id: 'joy', label: 'joy', family: 'good' },
  { id: 'motivation', label: 'motivation', family: 'good' },
];

// Fixed topology: none | small(0.1) | mid(0.55) | large(1.0). Not user-editable.
export const TOPOLOGY = {
  frust_enl: { fear: 'small', anger: 'large', sadness: 'small', trust: 'none', joy: 'large', motivation: 'mid' },
  humil_pride: { fear: 'mid', anger: 'large', sadness: 'large', trust: 'small', joy: 'mid', motivation: 'mid' },
  anx_conf: { fear: 'large', anger: 'none', sadness: 'none', trust: 'mid', joy: 'small', motivation: 'none' },
  disap_enc: { fear: 'none', anger: 'large', sadness: 'mid', trust: 'small', joy: 'mid', motivation: 'large' },
  dread_hope: { fear: 'large', anger: 'none', sadness: 'none', trust: 'large', joy: 'small', motivation: 'none' },
  bore_cur: { fear: 'none', anger: 'none', sadness: 'small', trust: 'small', joy: 'small', motivation: 'large' },
};

export const MAG = { small: 0.1, mid: 0.55, large: 1.0 };

export function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

export function edgeWeight(topId, bottomId, family) {
  const tier = TOPOLOGY[topId][bottomId];
  if (tier === 'none') return 0;
  return family === 'bad' ? -MAG[tier] : MAG[tier];
}

/**
 * @param {Record<string, number>} topAxisValues - one value per TOP id, -1..1 (the "effective_trigger" per axis;
 *   no separate ambient term — this engine only ever receives one already-characterized event vector per turn)
 * @param {Record<string, number>} disposition - one value per BOTTOM id, -1..1 (persistent personality bias)
 * @returns {Record<string, number>} one value per BOTTOM id, 0..1
 */
export function computeEmotions(topAxisValues, disposition) {
  const output = {};
  for (const b of BOTTOM) {
    const Z =
      TOP.reduce((s, t) => s + edgeWeight(t.id, b.id, b.family) * (topAxisValues[t.id] ?? 0), 0) +
      (disposition[b.id] ?? 0);
    output[b.id] = sigmoid(Z);
  }
  return output;
}
