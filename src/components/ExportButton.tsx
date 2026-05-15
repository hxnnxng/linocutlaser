import type { SvgDoc, TraceParams } from '../types';
import { buildSvgString } from '../utils/exportSvg';

type Props = {
  doc: SvgDoc | null;
  params: TraceParams;
  sourceName: string | null;
};

export function ExportButton({ doc, params, sourceName }: Props) {
  const disabled = !doc || doc.layers.length === 0;

  const download = () => {
    if (!doc) return;
    const svg = buildSvgString(doc, params, sourceName ?? undefined);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(sourceName ?? 'linocut').replace(/\.[^.]+$/, '')}-linocut.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <button
      onClick={download}
      disabled={disabled}
      style={{
        padding: '10px 14px',
        border: 'none',
        background: disabled ? '#ccc' : '#0a84ff',
        color: '#fff',
        borderRadius: 6,
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      Eksportér SVG
    </button>
  );
}
