import type { MaskDims } from '../types';

export type RegionMap = {
  dims: MaskDims;
  levels: number;
  regionIds: Int32Array;
  regionCount: number;
};

const MIN_REGION_PIXELS = 6;

/**
 * Posterize the luminance grid into `levels` bins, then label
 * 8-connected components. Each pixel gets a regionId (0..regionCount-1).
 *
 * Small noisy components are merged into a neighbouring region so the
 * user doesn't see thousands of single-pixel "areas". After merging,
 * regionIds are densely re-numbered.
 */
export function buildRegionMap(
  luminance: Uint8Array,
  dims: MaskDims,
  levels: number,
): RegionMap {
  const { w, h } = dims;
  const n = w * h;

  const indexed = new Uint8Array(n);
  const bins = Math.max(2, Math.min(8, Math.floor(levels)));
  const scale = bins / 256;
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(luminance[i] * scale);
    indexed[i] = idx >= bins ? bins - 1 : idx;
  }

  const regionIds = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let nextId = 0;
  const sizes: number[] = [];

  for (let start = 0; start < n; start++) {
    if (regionIds[start] !== -1) continue;
    const level = indexed[start];
    const id = nextId++;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    regionIds[start] = id;
    while (top > 0) {
      const p = stack[--top];
      size++;
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const np = ny * w + nx;
          if (regionIds[np] !== -1) continue;
          if (indexed[np] !== level) continue;
          regionIds[np] = id;
          stack[top++] = np;
        }
      }
    }
    sizes.push(size);
  }

  return mergeSmallRegions(regionIds, sizes, dims);
}

function mergeSmallRegions(
  regionIds: Int32Array,
  sizes: number[],
  dims: MaskDims,
): RegionMap {
  const { w, h } = dims;
  const n = w * h;
  const originalCount = sizes.length;

  const parent = new Int32Array(originalCount);
  for (let i = 0; i < originalCount; i++) parent[i] = i;
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (sizes[ra] < sizes[rb]) {
      parent[ra] = rb;
      sizes[rb] += sizes[ra];
    } else {
      parent[rb] = ra;
      sizes[ra] += sizes[rb];
    }
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const id = regionIds[p];
      if (sizes[find(id)] >= MIN_REGION_PIXELS) continue;
      let bestNeighbour = -1;
      let bestSize = -1;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const neighbourRoot = find(regionIds[ny * w + nx]);
          if (neighbourRoot === find(id)) continue;
          if (sizes[neighbourRoot] > bestSize) {
            bestSize = sizes[neighbourRoot];
            bestNeighbour = neighbourRoot;
          }
        }
      }
      if (bestNeighbour !== -1) union(id, bestNeighbour);
    }
  }

  const remap = new Int32Array(originalCount).fill(-1);
  let nextId = 0;
  const finalIds = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const root = find(regionIds[i]);
    if (remap[root] === -1) remap[root] = nextId++;
    finalIds[i] = remap[root];
  }

  return {
    dims,
    levels: 0,
    regionIds: finalIds,
    regionCount: nextId,
  };
}

/**
 * Find the region id at a given pixel coordinate. Returns -1 if out of bounds.
 */
export function regionAt(map: RegionMap, x: number, y: number): number {
  const { w, h } = map.dims;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= w || yi >= h) return -1;
  return map.regionIds[yi * w + xi];
}

/**
 * Iterate over all pixels in a given region and call cb(idx) for each.
 */
export function forEachRegionPixel(
  map: RegionMap,
  regionId: number,
  cb: (idx: number) => void,
): void {
  const ids = map.regionIds;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] === regionId) cb(i);
  }
}

/**
 * Render the region boundaries onto an ImageData buffer. Pixels whose
 * 4-neighbour belongs to a different region become opaque dark grey;
 * the rest is transparent. Suitable as an overlay layer.
 */
export function paintRegionBoundaries(map: RegionMap, target: Uint8ClampedArray): void {
  const { w, h } = map.dims;
  const ids = map.regionIds;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const me = ids[p];
      let edge = false;
      if (x + 1 < w && ids[p + 1] !== me) edge = true;
      else if (y + 1 < h && ids[p + w] !== me) edge = true;
      else if (x > 0 && ids[p - 1] !== me) edge = true;
      else if (y > 0 && ids[p - w] !== me) edge = true;
      const di = p * 4;
      if (edge) {
        target[di] = 0;
        target[di + 1] = 0;
        target[di + 2] = 0;
        target[di + 3] = 255;
      } else {
        target[di + 3] = 0;
      }
    }
  }
}
