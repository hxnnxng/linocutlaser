import type { ColorId, ColorPlate } from '../types';
import type { PaintTool } from './PaintCanvas';

type Props = {
  plates: ColorPlate[];
  colorCount: 1 | 2 | 3;
  activeColorId: ColorId;
  tool: PaintTool;
  brushSizePx: number;
  canUndo: boolean;
  onColorCountChange: (n: 1 | 2 | 3) => void;
  onActiveColorChange: (id: ColorId) => void;
  onPrintColorChange: (id: ColorId, hex: string) => void;
  onToolChange: (t: PaintTool) => void;
  onBrushSizeChange: (px: number) => void;
  onClearMask: (id: ColorId) => void;
  onUndo: () => void;
};

const COLOR_LABELS: Record<ColorId, string> = { c1: 'Farve 1', c2: 'Farve 2', c3: 'Farve 3' };

export function ColorPanel({
  plates,
  colorCount,
  activeColorId,
  tool,
  brushSizePx,
  canUndo,
  onColorCountChange,
  onActiveColorChange,
  onPrintColorChange,
  onToolChange,
  onBrushSizeChange,
  onClearMask,
  onUndo,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section title="Antal farver">
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => onColorCountChange(n as 1 | 2 | 3)}
              style={pillStyle(colorCount === n)}
            >
              {n}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Farver">
        {plates.map((plate) => (
          <div
            key={plate.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 6,
              borderRadius: 6,
              background: plate.id === activeColorId ? '#e8f1ff' : 'transparent',
              border: `1px solid ${plate.id === activeColorId ? '#0a84ff' : 'transparent'}`,
              cursor: 'pointer',
            }}
            onClick={() => onActiveColorChange(plate.id)}
          >
            <input
              type="color"
              value={plate.printColor}
              onChange={(e) => onPrintColorChange(plate.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: 32, height: 28, padding: 0, border: 'none', cursor: 'pointer' }}
            />
            <span style={{ flex: 1, fontSize: 13 }}>{COLOR_LABELS[plate.id]}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearMask(plate.id);
              }}
              style={smallButtonStyle}
              title="Ryd dette lag"
            >
              Ryd
            </button>
          </div>
        ))}
      </Section>

      <Section title="Værktøj">
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onToolChange('brush')} style={pillStyle(tool === 'brush')}>
            Pensel
          </button>
          <button onClick={() => onToolChange('eraser')} style={pillStyle(tool === 'eraser')}>
            Visker
          </button>
          <button onClick={() => onToolChange('fill')} style={pillStyle(tool === 'fill')}>
            Fyld
          </button>
        </div>
        <label style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Penselstørrelse: {brushSizePx}px
          <input
            type="range"
            min={2}
            max={120}
            step={1}
            value={brushSizePx}
            onChange={(e) => onBrushSizeChange(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </label>
      </Section>

      <button onClick={onUndo} disabled={!canUndo} style={fullButtonStyle(canUndo)}>
        Fortryd seneste strøg
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: '#666', textTransform: 'uppercase', marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '6px 10px',
    border: `1px solid ${active ? '#0a84ff' : '#ccc'}`,
    background: active ? '#0a84ff' : '#fff',
    color: active ? '#fff' : '#222',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
  };
}

const smallButtonStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #ccc',
  background: '#fff',
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
};

function fullButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    border: '1px solid #ccc',
    background: enabled ? '#fff' : '#f5f5f5',
    color: enabled ? '#222' : '#999',
    borderRadius: 6,
    fontSize: 13,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}
