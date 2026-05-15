import type { SvgDoc } from '../types';
import type { LayerVisibility } from './LayerToggles';

type Props = {
  doc: SvgDoc | null;
  visibility: LayerVisibility;
  busy: boolean;
};

export function SvgPreview({ doc, visibility, busy }: Props) {
  if (!doc) {
    return (
      <div style={placeholderStyle}>
        Ingen forhåndsvisning endnu — upload et billede og mal et lag.
      </div>
    );
  }
  const { paper, layers } = doc;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ background: '#fff', padding: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <svg
          viewBox={`0 0 ${paper.wMm} ${paper.hMm}`}
          width={Math.min(500, paper.wMm * 2)}
          height={Math.min(700, paper.hMm * 2)}
          style={{ display: 'block', background: '#fafafa' }}
        >
          <rect x={0} y={0} width={paper.wMm} height={paper.hMm} fill="#fff" stroke="#ddd" strokeWidth={0.2} />
          {layers.map((layer) => {
            if (!visibility[layer.colorId]?.[layer.role]) return null;
            const d = layer.paths.map((p) => p.d).join(' ');
            if (!d.trim()) return null;
            if (layer.role === 'engrave') {
              return (
                <path
                  key={layer.id}
                  d={d}
                  fill={layer.printColor}
                  stroke="none"
                  fillRule="evenodd"
                  opacity={0.95}
                />
              );
            }
            return (
              <path
                key={layer.id}
                d={d}
                fill="none"
                stroke="#FF0000"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      </div>
      {busy && <div style={{ fontSize: 11, color: '#0a84ff' }}>Genererer…</div>}
    </div>
  );
}

const placeholderStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: '#888',
  fontSize: 13,
  background: '#fff',
  border: '1px dashed #ddd',
  borderRadius: 8,
};
