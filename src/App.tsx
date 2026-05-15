import { useCallback, useMemo, useState } from 'react';
import { buildRegionMap, type RegionMap } from './utils/regions';
import { ImageDrop } from './components/ImageDrop';
import { PaintCanvas, type PaintTool } from './components/PaintCanvas';
import { ColorPanel } from './components/ColorPanel';
import { Controls } from './components/Controls';
import { SvgPreview } from './components/SvgPreview';
import { LayerToggles, DEFAULT_VISIBILITY, type LayerVisibility } from './components/LayerToggles';
import { ExportButton } from './components/ExportButton';
import type { ColorId, ColorPlate, MaskDims, PaperMm, TraceParams } from './types';
import { loadImage, type LoadedImage } from './utils/loadImage';
import { usePipeline } from './hooks/usePipeline';
import { useDebouncedValue } from './hooks/useDebouncedValue';

const DEFAULT_PARAMS: TraceParams = {
  simplifyMm: 0.4,
  jaggedAmplitudeMm: 0.25,
  jaggedFrequencyPerMm: 1.2,
  jaggedSeed: 1337,
  minAreaMm2: 1.5,
};

const DEFAULT_PAPER: PaperMm = { wMm: 148, hMm: 210 };

const DEFAULT_PALETTE: Record<ColorId, string> = {
  c1: '#1a1a1a',
  c2: '#c0392b',
  c3: '#d4a017',
};

const ALL_IDS: ColorId[] = ['c1', 'c2', 'c3'];

type ImageState = {
  source: ImageBitmap;
  dims: MaskDims;
  luminance: Uint8Array;
  name: string;
};

export function App() {
  const [image, setImage] = useState<ImageState | null>(null);
  const [colorCount, setColorCount] = useState<1 | 2 | 3>(1);
  const [plates, setPlates] = useState<ColorPlate[]>(() => buildInitialPlates(1, null, []));
  const [activeColorId, setActiveColorId] = useState<ColorId>('c1');
  const [tool, setTool] = useState<PaintTool>('region');
  const [brushSizePx, setBrushSizePx] = useState(40);
  const [posterizeLevels, setPosterizeLevels] = useState(4);
  const [paper, setPaper] = useState<PaperMm>(DEFAULT_PAPER);
  const [params, setParams] = useState<TraceParams>(DEFAULT_PARAMS);
  const [visibility, setVisibility] = useState<LayerVisibility>(DEFAULT_VISIBILITY);
  const [undoStack, setUndoStack] = useState<ColorPlate[][]>([]);

  const debouncedPlates = useDebouncedValue(plates, 250);
  const debouncedParams = useDebouncedValue(params, 250);
  const debouncedPaper = useDebouncedValue(paper, 250);

  const { doc, busy } = usePipeline(debouncedPlates, image?.dims ?? null, debouncedPaper, debouncedParams);

  const regionMap: RegionMap | null = useMemo(() => {
    if (!image) return null;
    return buildRegionMap(image.luminance, image.dims, posterizeLevels);
  }, [image, posterizeLevels]);

  const handleFile = useCallback(async (file: File) => {
    const loaded: LoadedImage = await loadImage(file);
    const next: ImageState = {
      source: loaded.bitmap,
      dims: loaded.dims,
      luminance: loaded.luminance,
      name: file.name,
    };
    setImage(next);
    setPlates(buildInitialPlates(colorCount, next, plates));
    setUndoStack([]);
    if (!ALL_IDS.slice(0, colorCount).includes(activeColorId)) setActiveColorId('c1');
  }, [colorCount, activeColorId, plates]);

  const handleColorCountChange = useCallback((n: 1 | 2 | 3) => {
    setColorCount(n);
    if (!image) {
      setPlates(buildInitialPlates(n, null, plates));
      return;
    }
    setPlates(buildInitialPlates(n, image, plates));
    setUndoStack([]);
    if (!ALL_IDS.slice(0, n).includes(activeColorId)) setActiveColorId('c1');
  }, [image, plates, activeColorId]);

  const handlePrintColorChange = useCallback((id: ColorId, hex: string) => {
    setPlates((prev) => prev.map((p) => (p.id === id ? { ...p, printColor: hex } : p)));
  }, []);

  const handleStrokeBegin = useCallback(() => {
    setUndoStack((prev) => {
      const snapshot = plates.map((p) => ({ ...p, mask: new Uint8Array(p.mask) }));
      const next = [...prev, snapshot];
      return next.length > 30 ? next.slice(next.length - 30) : next;
    });
  }, [plates]);

  const handleStrokeEnd = useCallback((updates: { id: ColorId; mask: Uint8Array }[]) => {
    setPlates((prev) => {
      const byId = new Map(updates.map((u) => [u.id, u.mask]));
      return prev.map((p) => (byId.has(p.id) ? { ...p, mask: byId.get(p.id)! } : p));
    });
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setPlates(last);
      return prev.slice(0, -1);
    });
  }, []);

  const handleClearMask = useCallback((id: ColorId) => {
    if (!image) return;
    handleStrokeBegin();
    setPlates((prev) =>
      prev.map((p) => (p.id === id ? { ...p, mask: new Uint8Array(image.dims.w * image.dims.h) } : p)),
    );
  }, [image, handleStrokeBegin]);

  const layout = useMemo(() => ({
    grid: {
      display: 'grid',
      gridTemplateColumns: '260px 1fr 320px',
      gap: 16,
      padding: 16,
      minHeight: '100vh',
      background: '#f4f4f4',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    } as React.CSSProperties,
    panel: {
      background: '#fff',
      borderRadius: 8,
      padding: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    } as React.CSSProperties,
  }), []);

  return (
    <div style={layout.grid}>
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={layout.panel}>
          <ImageDrop onFile={handleFile} hasImage={!!image} />
          {image && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>
              {image.name} — {image.dims.w}×{image.dims.h}px
            </div>
          )}
        </div>
        <div style={layout.panel}>
          <ColorPanel
            plates={plates}
            colorCount={colorCount}
            activeColorId={activeColorId}
            tool={tool}
            brushSizePx={brushSizePx}
            posterizeLevels={posterizeLevels}
            canUndo={undoStack.length > 0}
            hasImage={!!image}
            onColorCountChange={handleColorCountChange}
            onActiveColorChange={setActiveColorId}
            onPrintColorChange={handlePrintColorChange}
            onToolChange={setTool}
            onBrushSizeChange={setBrushSizePx}
            onPosterizeLevelsChange={setPosterizeLevels}
            onClearMask={handleClearMask}
            onUndo={handleUndo}
          />
        </div>
      </aside>

      <main style={{ ...layout.panel, padding: 0, overflow: 'hidden' }}>
        {image ? (
          <PaintCanvas
            source={image.source}
            dims={image.dims}
            plates={plates}
            activeColorId={activeColorId}
            brushSizePx={brushSizePx}
            tool={tool}
            regionMap={regionMap}
            onStrokeBegin={handleStrokeBegin}
            onStrokeEnd={handleStrokeEnd}
          />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            Upload et billede for at komme i gang.
          </div>
        )}
      </main>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={layout.panel}>
          <Controls params={params} paper={paper} onParamsChange={setParams} onPaperChange={setPaper} />
        </div>
        <div style={layout.panel}>
          <SvgPreview doc={doc} visibility={visibility} busy={busy} />
        </div>
        <div style={layout.panel}>
          <LayerToggles doc={doc} visibility={visibility} onChange={setVisibility} />
        </div>
        <ExportButton doc={doc} params={params} sourceName={image?.name ?? null} />
      </aside>
    </div>
  );
}

function buildInitialPlates(
  count: 1 | 2 | 3,
  image: ImageState | null,
  prev: ColorPlate[],
): ColorPlate[] {
  const ids = ALL_IDS.slice(0, count);
  const prevById = new Map(prev.map((p) => [p.id, p]));
  const w = image?.dims.w ?? 0;
  const h = image?.dims.h ?? 0;
  return ids.map((id) => {
    const existing = prevById.get(id);
    const printColor = existing?.printColor ?? DEFAULT_PALETTE[id];
    if (!image) return { id, printColor, mask: new Uint8Array(0) };
    if (existing && existing.mask.length === w * h) {
      return { id, printColor, mask: existing.mask };
    }
    return { id, printColor, mask: new Uint8Array(w * h) };
  });
}
