import type {
  ColorId,
  MaskDims,
  PaperMm,
  Ring,
  SvgDoc,
  SvgLayer,
  SvgPath,
  TraceParams,
} from '../types';
import { traceContours, ringAreaPx, projectRing } from './contour';
import { simplifyRing } from './simplify';
import { jaggifyRing } from './jaggify';
import { makePxToMm } from './pxToMm';

export type PlateInput = {
  id: ColorId;
  printColor: string;
  mask: Uint8Array;
};

const CHANNEL_BY_ID: Record<ColorId, number> = { c1: 0, c2: 1, c3: 2 };

export function buildSvgDoc(
  plates: PlateInput[],
  dims: MaskDims,
  paper: PaperMm,
  params: TraceParams,
): SvgDoc {
  const pxToMm = makePxToMm(dims, paper);
  const minAreaPx = pxToMm.scaleMmPerPx > 0
    ? params.minAreaMm2 / (pxToMm.scaleMmPerPx * pxToMm.scaleMmPerPx)
    : 0;

  const layers: SvgLayer[] = [];

  for (const plate of plates) {
    const rawRings = traceContours(plate.mask, dims);
    const ringsMm: Ring[] = [];
    for (const ring of rawRings) {
      if (ringAreaPx(ring) < minAreaPx) continue;
      const projected = projectRing(ring, pxToMm.project);
      const simplified = simplifyRing(projected, params.simplifyMm);
      const jagged = jaggifyRing(simplified, {
        amplitudeMm: params.jaggedAmplitudeMm,
        frequencyPerMm: params.jaggedFrequencyPerMm,
        seed: params.jaggedSeed,
        channel: CHANNEL_BY_ID[plate.id],
      });
      ringsMm.push(jagged);
    }

    if (ringsMm.length === 0) continue;

    const engravePath: SvgPath = { d: ringsToFillPath(ringsMm) };
    const cutPaths: SvgPath[] = ringsMm.map((ring) => ({ d: ringToStrokePath(ring) }));

    layers.push({
      id: `${plate.id}-engrave`,
      colorId: plate.id,
      role: 'engrave',
      printColor: plate.printColor,
      paths: [engravePath],
    });
    layers.push({
      id: `${plate.id}-cut`,
      colorId: plate.id,
      role: 'cut',
      printColor: plate.printColor,
      paths: cutPaths,
    });
  }

  return { paper, layers };
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, '') : '0';
}

function ringToStrokePath(ring: Ring): string {
  if (ring.length === 0) return '';
  let d = `M ${fmt(ring[0].x)} ${fmt(ring[0].y)}`;
  for (let i = 1; i < ring.length; i++) {
    d += ` L ${fmt(ring[i].x)} ${fmt(ring[i].y)}`;
  }
  d += ' Z';
  return d;
}

function ringsToFillPath(rings: Ring[]): string {
  return rings.map(ringToStrokePath).join(' ');
}
