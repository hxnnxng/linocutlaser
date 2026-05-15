import { createNoise2D } from 'simplex-noise';
import type { Ring } from '../types';

export type JaggifyParams = {
  amplitudeMm: number;
  frequencyPerMm: number;
  seed: number;
  channel: number;
};

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isClosed(ring: Ring): boolean {
  if (ring.length < 2) return false;
  const a = ring[0];
  const b = ring[ring.length - 1];
  return a.x === b.x && a.y === b.y;
}

function ensureClosed(ring: Ring): Ring {
  return isClosed(ring) ? ring : [...ring, { ...ring[0] }];
}

function perimeter(ring: Ring): number {
  let p = 0;
  for (let i = 1; i < ring.length; i++) {
    const dx = ring[i].x - ring[i - 1].x;
    const dy = ring[i].y - ring[i - 1].y;
    p += Math.hypot(dx, dy);
  }
  return p;
}

function resampleRingUniform(ring: Ring, spacingMm: number): Ring {
  const closed = ensureClosed(ring);
  const perim = perimeter(closed);
  if (perim < spacingMm * 4) return closed;
  const n = Math.max(4, Math.round(perim / spacingMm));
  const step = perim / n;

  const out: Ring = [];
  let segIdx = 0;
  let segStartLen = 0;
  const segDist = (i: number) =>
    Math.hypot(closed[i + 1].x - closed[i].x, closed[i + 1].y - closed[i].y);
  let segLen = segDist(0);

  for (let i = 0; i < n; i++) {
    const target = i * step;
    while (segStartLen + segLen < target && segIdx < closed.length - 2) {
      segStartLen += segLen;
      segIdx++;
      segLen = segDist(segIdx);
    }
    const t = segLen > 0 ? (target - segStartLen) / segLen : 0;
    const a = closed[segIdx];
    const b = closed[segIdx + 1];
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });
  }
  out.push({ ...out[0] });
  return out;
}

export function jaggifyRing(ring: Ring, params: JaggifyParams): Ring {
  const { amplitudeMm, frequencyPerMm, seed, channel } = params;
  if (amplitudeMm <= 0 || frequencyPerMm <= 0) return ring;

  const spacingMm = 1 / frequencyPerMm;
  const resampled = resampleRingUniform(ring, spacingMm);
  const n = resampled.length - 1;
  if (n < 4) return ring;

  const rng = mulberry32(seed ^ (channel * 0x9e3779b9));
  const noise = createNoise2D(rng);
  const phase = channel * 17.3;

  const out: Ring = new Array(resampled.length);
  for (let i = 0; i < n; i++) {
    const prev = resampled[(i - 1 + n) % n];
    const next = resampled[(i + 1) % n];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = ty / len;
    const ny = -tx / len;
    const t = i / n;
    const lowFreq = noise(t * 6.2831853, phase);
    const highFreq = noise(t * 18.8495559, phase + 5.5) * 0.35;
    const noiseVal = (lowFreq + highFreq) / 1.35;
    const disp = noiseVal * amplitudeMm;
    out[i] = {
      x: resampled[i].x + nx * disp,
      y: resampled[i].y + ny * disp,
    };
  }
  out[n] = { ...out[0] };
  return out;
}
