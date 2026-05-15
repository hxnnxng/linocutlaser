import type { PaperMm, TraceParams } from '../types';

type Props = {
  params: TraceParams;
  paper: PaperMm;
  onParamsChange: (p: TraceParams) => void;
  onPaperChange: (p: PaperMm) => void;
};

export function Controls({ params, paper, onParamsChange, onPaperChange }: Props) {
  const upd = (patch: Partial<TraceParams>) => onParamsChange({ ...params, ...patch });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Section title="Papir (mm)">
        <div style={{ display: 'flex', gap: 8 }}>
          <NumberInput
            label="Bredde"
            value={paper.wMm}
            onChange={(v) => onPaperChange({ ...paper, wMm: v })}
          />
          <NumberInput
            label="Højde"
            value={paper.hMm}
            onChange={(v) => onPaperChange({ ...paper, hMm: v })}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <PaperPreset label="A6" w={105} h={148} onPick={onPaperChange} />
          <PaperPreset label="A5" w={148} h={210} onPick={onPaperChange} />
          <PaperPreset label="A4" w={210} h={297} onPick={onPaperChange} />
        </div>
      </Section>

      <Slider
        label="Forenkling (ε mm)"
        value={params.simplifyMm}
        min={0}
        max={3}
        step={0.05}
        onChange={(v) => upd({ simplifyMm: v })}
      />
      <Slider
        label="Ujævnhed (amplitude mm)"
        value={params.jaggedAmplitudeMm}
        min={0}
        max={1.5}
        step={0.02}
        onChange={(v) => upd({ jaggedAmplitudeMm: v })}
      />
      <Slider
        label="Ujævnhed (frekvens/mm)"
        value={params.jaggedFrequencyPerMm}
        min={0.2}
        max={4}
        step={0.1}
        onChange={(v) => upd({ jaggedFrequencyPerMm: v })}
      />
      <Slider
        label="Min område (mm²)"
        value={params.minAreaMm2}
        min={0}
        max={50}
        step={0.5}
        onChange={(v) => upd({ minAreaMm2: v })}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#666' }}>Seed: {params.jaggedSeed}</span>
        <button
          onClick={() => upd({ jaggedSeed: Math.floor(Math.random() * 1e9) })}
          style={{
            padding: '4px 10px',
            border: '1px solid #ccc',
            background: '#fff',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Ny ujævnhed
        </button>
      </div>
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

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ fontSize: 12, display: 'block' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ color: '#666' }}>{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ fontSize: 12, flex: 1 }}>
      <span>{label}</span>
      <input
        type="number"
        min={20}
        max={1000}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', padding: 4, fontSize: 13 }}
      />
    </label>
  );
}

function PaperPreset({
  label,
  w,
  h,
  onPick,
}: {
  label: string;
  w: number;
  h: number;
  onPick: (p: PaperMm) => void;
}) {
  return (
    <button
      onClick={() => onPick({ wMm: w, hMm: h })}
      style={{
        flex: 1,
        padding: '4px 8px',
        border: '1px solid #ccc',
        background: '#fff',
        borderRadius: 4,
        fontSize: 11,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
