import simplifyJs from 'simplify-js';
import type { Ring } from '../types';

export function simplifyRing(ring: Ring, toleranceMm: number): Ring {
  if (ring.length < 4 || toleranceMm <= 0) return ring;
  const open = ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y
    ? ring.slice(0, -1)
    : ring;
  const simplified = simplifyJs(open, toleranceMm, true);
  if (simplified.length < 3) return ring;
  return simplified;
}
