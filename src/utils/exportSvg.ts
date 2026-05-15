import type { SvgDoc, TraceParams } from '../types';

const CUT_STROKE = '#FF0000';
const CUT_STROKE_WIDTH_MM = 0.01;

export function buildSvgString(doc: SvgDoc, params?: TraceParams, source?: string): string {
  const { paper, layers } = doc;
  const w = fmt(paper.wMm);
  const h = fmt(paper.hMm);

  const desc = params
    ? `simplify=${params.simplifyMm}mm jagged=${params.jaggedAmplitudeMm}mm@${params.jaggedFrequencyPerMm}/mm seed=${params.jaggedSeed} minArea=${params.minAreaMm2}mm²`
    : '';

  const head = [
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1"`,
    ` viewBox="0 0 ${w} ${h}"`,
    ` width="${w}mm" height="${h}mm">`,
  ].join('');

  const titleParts: string[] = ['<title>Linocutlaser export</title>'];
  if (source) titleParts.push(`<desc>source: ${escapeXml(source)}</desc>`);
  if (desc) titleParts.push(`<desc>${escapeXml(desc)}</desc>`);

  const body = layers
    .map((layer) => {
      const dStr = layer.paths.map((p) => p.d).join(' ');
      if (!dStr.trim()) return '';
      if (layer.role === 'engrave') {
        return `  <g id="${layer.id}" data-print-color="${layer.printColor}"><path fill="${layer.printColor}" stroke="none" fill-rule="evenodd" d="${dStr}"/></g>`;
      }
      return `  <g id="${layer.id}"><path fill="none" stroke="${CUT_STROKE}" stroke-width="${CUT_STROKE_WIDTH_MM}" d="${dStr}"/></g>`;
    })
    .filter(Boolean)
    .join('\n');

  return `${head}\n  ${titleParts.join('')}\n${body}\n</svg>\n`;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, '') : '0';
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
