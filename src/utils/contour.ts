import type { MaskDims, Ring } from '../types';

/**
 * Trace closed contours from a binary mask by stitching together the
 * directed boundary edges between filled and empty pixels.
 *
 * Each pixel (x, y) contributes a boundary edge per side whose
 * neighbour is empty (or out of bounds). Edges are oriented so the
 * filled region stays on the left in screen coordinates (y-down):
 *   top:    (x,y)     -> (x+1,y)
 *   right:  (x+1,y)   -> (x+1,y+1)
 *   bottom: (x+1,y+1) -> (x,y+1)
 *   left:   (x,y+1)   -> (x,y)
 *
 * Stitching by endpoint-match yields one ring per outer outline and
 * one (reverse-oriented) ring per hole. Points are integer pixel
 * corners.
 */
export function traceContours(mask: Uint8Array, dims: MaskDims): Ring[] {
  const { w, h } = dims;

  type Edge = { x0: number; y0: number; x1: number; y1: number };
  const edges: Edge[] = [];

  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (!at(x, y - 1)) edges.push({ x0: x, y0: y, x1: x + 1, y1: y });
      if (!at(x + 1, y)) edges.push({ x0: x + 1, y0: y, x1: x + 1, y1: y + 1 });
      if (!at(x, y + 1)) edges.push({ x0: x + 1, y0: y + 1, x1: x, y1: y + 1 });
      if (!at(x - 1, y)) edges.push({ x0: x, y0: y + 1, x1: x, y1: y });
    }
  }

  if (edges.length === 0) return [];

  const key = (x: number, y: number) => x * (h + 2) + y;
  const byStart = new Map<number, Edge[]>();
  for (const e of edges) {
    const k = key(e.x0, e.y0);
    const arr = byStart.get(k);
    if (arr) arr.push(e);
    else byStart.set(k, [e]);
  }

  const rings: Ring[] = [];
  while (byStart.size > 0) {
    const firstKey = byStart.keys().next().value as number;
    const firstArr = byStart.get(firstKey)!;
    let edge = firstArr.pop()!;
    if (firstArr.length === 0) byStart.delete(firstKey);

    const ring: Ring = [{ x: edge.x0, y: edge.y0 }];
    const startX = edge.x0;
    const startY = edge.y0;

    while (true) {
      ring.push({ x: edge.x1, y: edge.y1 });
      if (edge.x1 === startX && edge.y1 === startY) break;

      const k = key(edge.x1, edge.y1);
      const arr = byStart.get(k);
      if (!arr || arr.length === 0) break;

      const prevDx = edge.x1 - edge.x0;
      const prevDy = edge.y1 - edge.y0;
      let bestIdx = 0;
      let bestScore = -Infinity;
      for (let i = 0; i < arr.length; i++) {
        const cand = arr[i];
        const dx = cand.x1 - cand.x0;
        const dy = cand.y1 - cand.y0;
        const dot = prevDx * dx + prevDy * dy;
        if (dot > bestScore) {
          bestScore = dot;
          bestIdx = i;
        }
      }
      edge = arr.splice(bestIdx, 1)[0];
      if (arr.length === 0) byStart.delete(k);
    }

    if (ring.length >= 4) rings.push(ring);
  }

  return rings;
}

export function ringAreaPx(ring: Ring): number {
  if (ring.length < 3) return 0;
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j].x + ring[i].x) * (ring[j].y - ring[i].y);
  }
  return Math.abs(a) / 2;
}

export function projectRing(
  ring: Ring,
  project: (x: number, y: number) => { x: number; y: number },
): Ring {
  return ring.map((p) => project(p.x, p.y));
}
