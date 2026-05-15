import type { MaskDims } from '../types';

/**
 * Otsu's method: pick the luminance threshold that maximises inter-class
 * variance. Returns a binary mask where dark pixels (foreground in
 * a linocut sense) are 1.
 */
export function autoMaskFromLuminance(luminance: Uint8Array, dims: MaskDims): Uint8Array {
  const threshold = otsuThreshold(luminance);
  const mask = new Uint8Array(dims.w * dims.h);
  for (let i = 0; i < luminance.length; i++) {
    mask[i] = luminance[i] <= threshold ? 1 : 0;
  }
  return mask;
}

export function maskFromThreshold(
  luminance: Uint8Array,
  dims: MaskDims,
  threshold: number,
): Uint8Array {
  const mask = new Uint8Array(dims.w * dims.h);
  for (let i = 0; i < luminance.length; i++) {
    mask[i] = luminance[i] <= threshold ? 1 : 0;
  }
  return mask;
}

function otsuThreshold(luminance: Uint8Array): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < luminance.length; i++) hist[luminance[i]]++;

  const total = luminance.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let bestVar = -1;
  let bestT = 127;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      bestT = t;
    }
  }
  return bestT;
}
