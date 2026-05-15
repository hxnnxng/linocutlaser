import type { ColorId, SvgDoc, SvgLayerRole } from '../types';

export type LayerVisibility = Record<ColorId, Record<SvgLayerRole, boolean>>;

export const DEFAULT_VISIBILITY: LayerVisibility = {
  c1: { engrave: true, cut: false },
  c2: { engrave: true, cut: false },
  c3: { engrave: true, cut: false },
};

type Props = {
  doc: SvgDoc | null;
  visibility: LayerVisibility;
  onChange: (v: LayerVisibility) => void;
};

export function LayerToggles({ doc, visibility, onChange }: Props) {
  const colors = doc ? Array.from(new Set(doc.layers.map((l) => l.colorId))) : [];
  if (colors.length === 0) return null;

  const toggle = (id: ColorId, role: SvgLayerRole) => {
    onChange({
      ...visibility,
      [id]: { ...visibility[id], [role]: !visibility[id][role] },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: '#666', textTransform: 'uppercase' }}>
        Vis lag
      </div>
      {colors.map((id) => (
        <div key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
          <span style={{ minWidth: 70 }}>{id.toUpperCase()}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={visibility[id].engrave}
              onChange={() => toggle(id, 'engrave')}
            />
            Engrave
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={visibility[id].cut}
              onChange={() => toggle(id, 'cut')}
            />
            Cut
          </label>
        </div>
      ))}
    </div>
  );
}
