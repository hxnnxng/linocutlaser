import type { MaskDims, PaperMm, Point } from '../types';

export type PxToMm = {
  scaleMmPerPx: number;
  offsetMm: Point;
  project: (xPx: number, yPx: number) => Point;
};

export function makePxToMm(dims: MaskDims, paper: PaperMm): PxToMm {
  const sx = paper.wMm / dims.w;
  const sy = paper.hMm / dims.h;
  const scale = Math.min(sx, sy);
  const offsetMm: Point = {
    x: (paper.wMm - dims.w * scale) / 2,
    y: (paper.hMm - dims.h * scale) / 2,
  };
  return {
    scaleMmPerPx: scale,
    offsetMm,
    project: (xPx, yPx) => ({
      x: offsetMm.x + xPx * scale,
      y: offsetMm.y + yPx * scale,
    }),
  };
}
