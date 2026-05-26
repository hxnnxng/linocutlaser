import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import type { ColorId, ColorPlate, MaskDims } from '../types';
import { paintRegionBoundaries, regionAt, type RegionMap } from '../utils/regions';

export type PaintTool = 'brush' | 'eraser' | 'fill' | 'region';

type Props = {
  source: ImageBitmap;
  dims: MaskDims;
  plates: ColorPlate[];
  activeColorId: ColorId;
  brushSizePx: number;
  tool: PaintTool;
  regionMap: RegionMap | null;
  onStrokeBegin: () => void;
  onStrokeEnd: (updates: { id: ColorId; mask: Uint8Array }[]) => void;
};

const SOURCE_DIM = 0.35;
const PAINT_ALPHA = 0.65;
const MIN_ZOOM = 1;
const MAX_ZOOM = 24;

export function PaintCanvas({
  source,
  dims,
  plates,
  activeColorId,
  brushSizePx,
  tool,
  regionMap,
  onStrokeBegin,
  onStrokeEnd,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const masksRef = useRef<Map<ColorId, Uint8Array>>(new Map());
  const drawingRef = useRef(false);
  const lastPxRef = useRef<{ x: number; y: number } | null>(null);
  const touchedRef = useRef<Set<ColorId>>(new Set());
  const hoverRegionRef = useRef<number>(-1);
  const regionOverlayRef = useRef<ImageData | null>(null);

  const panningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, panX: 0, panY: 0 });

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setViewport((prev) => (prev.w === cr.width && prev.h === cr.height ? prev : { w: cr.width, h: cr.height }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    if (viewport.w === 0 || viewport.h === 0) return 1;
    return Math.min(viewport.w / dims.w, viewport.h / dims.h);
  }, [viewport, dims]);

  const displayScale = fitScale * zoom;
  const displayW = dims.w * displayScale;
  const displayH = dims.h * displayScale;

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [dims, source]);

  useLayoutEffect(() => {
    masksRef.current = new Map(plates.map((p) => [p.id, new Uint8Array(p.mask)]));
    redraw();
  }, [plates, dims]);

  useEffect(() => {
    redraw();
  }, [source]);

  useEffect(() => {
    if (!regionMap) {
      regionOverlayRef.current = null;
      redraw();
      return;
    }
    const overlay = new ImageData(dims.w, dims.h);
    paintRegionBoundaries(regionMap, overlay.data);
    regionOverlayRef.current = overlay;
    redraw();
  }, [regionMap, dims]);

  function setupCanvasSize() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dims.w;
    canvas.height = dims.h;
  }

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setupCanvasSize();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, dims.w, dims.h);

    ctx.globalAlpha = SOURCE_DIM;
    ctx.drawImage(source, 0, 0, dims.w, dims.h);
    ctx.globalAlpha = 1;

    const overlay = ctx.getImageData(0, 0, dims.w, dims.h);
    const data = overlay.data;
    for (const plate of plates) {
      const mask = masksRef.current.get(plate.id);
      if (!mask) continue;
      const [r, g, b] = hexToRgb(plate.printColor);
      for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) continue;
        const di = i * 4;
        data[di] = blend(data[di], r, PAINT_ALPHA);
        data[di + 1] = blend(data[di + 1], g, PAINT_ALPHA);
        data[di + 2] = blend(data[di + 2], b, PAINT_ALPHA);
        data[di + 3] = 255;
      }
    }

    if (regionOverlayRef.current && (tool === 'region' || tool === 'fill')) {
      const ov = regionOverlayRef.current.data;
      for (let i = 0; i < data.length; i += 4) {
        const oa = ov[i + 3];
        if (oa === 0) continue;
        const alpha = oa / 255;
        data[i] = blend(data[i], ov[i], alpha);
        data[i + 1] = blend(data[i + 1], ov[i + 1], alpha);
        data[i + 2] = blend(data[i + 2], ov[i + 2], alpha);
        data[i + 3] = 255;
      }
    }

    if (tool === 'region' && regionMap && hoverRegionRef.current >= 0) {
      const ids = regionMap.regionIds;
      const target = hoverRegionRef.current;
      const activePlate = plates.find((p) => p.id === activeColorId);
      const [hr, hg, hb] = activePlate ? hexToRgb(activePlate.printColor) : [120, 200, 255];
      for (let i = 0; i < ids.length; i++) {
        if (ids[i] !== target) continue;
        const di = i * 4;
        data[di] = blend(data[di], hr, 0.35);
        data[di + 1] = blend(data[di + 1], hg, 0.35);
        data[di + 2] = blend(data[di + 2], hb, 0.35);
        data[di + 3] = 255;
      }
    }

    ctx.putImageData(overlay, 0, 0);
  }

  function getMaskCoords(e: PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const px = (e.clientX - rect.left) * (dims.w / rect.width);
    const py = (e.clientY - rect.top) * (dims.h / rect.height);
    return { x: px, y: py };
  }

  function stampAt(cx: number, cy: number) {
    if (tool === 'fill') return;
    const radius = brushSizePx / 2;
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(dims.w - 1, Math.ceil(cx + radius));
    const y1 = Math.min(dims.h - 1, Math.ceil(cy + radius));

    const active = masksRef.current.get(activeColorId);
    if (!active) return;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r2) continue;
        const idx = y * dims.w + x;
        if (tool === 'brush') {
          active[idx] = 1;
          for (const [id, m] of masksRef.current) {
            if (id !== activeColorId && m[idx]) m[idx] = 0;
          }
        } else {
          active[idx] = 0;
        }
      }
    }
    touchedRef.current.add(activeColorId);
    if (tool === 'brush') {
      for (const id of masksRef.current.keys()) {
        if (id !== activeColorId) touchedRef.current.add(id);
      }
    }
  }

  function lineStamp(x0: number, y0: number, x1: number, y1: number) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(1, Math.floor(brushSizePx / 4));
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      stampAt(x0 + dx * t, y0 + dy * t);
    }
  }

  function floodFill(cx: number, cy: number) {
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);
    if (x0 < 0 || y0 < 0 || x0 >= dims.w || y0 >= dims.h) return;
    const active = masksRef.current.get(activeColorId);
    if (!active) return;

    const startIdx = y0 * dims.w + x0;
    const seedActive = active[startIdx];
    const ownerColor: ColorId | null = (() => {
      if (seedActive) return activeColorId;
      for (const [id, m] of masksRef.current) {
        if (m[startIdx]) return id;
      }
      return null;
    })();

    const targetVal = seedActive ? 1 : 0;
    if (ownerColor === activeColorId && targetVal === 1) return;

    const visited = new Uint8Array(dims.w * dims.h);
    const stack: number[] = [startIdx];
    visited[startIdx] = 1;

    const matches = (idx: number) => {
      if (visited[idx]) return false;
      if (ownerColor === null) {
        for (const m of masksRef.current.values()) if (m[idx]) return false;
        return true;
      }
      const owner = masksRef.current.get(ownerColor);
      return owner ? owner[idx] === 1 : false;
    };

    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % dims.w;
      const y = (idx - x) / dims.w;
      active[idx] = 1;
      for (const [id, m] of masksRef.current) {
        if (id !== activeColorId && m[idx]) m[idx] = 0;
      }
      if (x > 0) {
        const n = idx - 1;
        if (matches(n)) { visited[n] = 1; stack.push(n); }
      }
      if (x < dims.w - 1) {
        const n = idx + 1;
        if (matches(n)) { visited[n] = 1; stack.push(n); }
      }
      if (y > 0) {
        const n = idx - dims.w;
        if (matches(n)) { visited[n] = 1; stack.push(n); }
      }
      if (y < dims.h - 1) {
        const n = idx + dims.w;
        if (matches(n)) { visited[n] = 1; stack.push(n); }
      }
    }

    touchedRef.current.add(activeColorId);
    for (const id of masksRef.current.keys()) {
      if (id !== activeColorId) touchedRef.current.add(id);
    }
  }

  function assignRegion(rid: number) {
    if (!regionMap || rid < 0) return;
    const active = masksRef.current.get(activeColorId);
    if (!active) return;
    const ids = regionMap.regionIds;
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] !== rid) continue;
      active[i] = 1;
      for (const [id, m] of masksRef.current) {
        if (id !== activeColorId && m[i]) m[i] = 0;
      }
    }
    touchedRef.current.add(activeColorId);
    for (const id of masksRef.current.keys()) {
      if (id !== activeColorId) touchedRef.current.add(id);
    }
  }

  function isPanGesture(e: PointerEvent<HTMLCanvasElement>): boolean {
    return e.button === 1 || e.button === 2 || e.shiftKey || e.altKey;
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (isPanGesture(e)) {
      e.currentTarget.setPointerCapture(e.pointerId);
      panningRef.current = true;
      panStartRef.current = { mx: e.clientX, my: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    const pt = getMaskCoords(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    touchedRef.current.clear();
    onStrokeBegin();

    if (tool === 'region') {
      if (regionMap) {
        const rid = regionAt(regionMap, pt.x, pt.y);
        assignRegion(rid);
      }
      finishStroke();
      drawingRef.current = false;
      lastPxRef.current = null;
      return;
    }
    if (tool === 'fill') {
      floodFill(pt.x, pt.y);
      finishStroke();
      drawingRef.current = false;
      lastPxRef.current = null;
      return;
    }
    stampAt(pt.x, pt.y);
    lastPxRef.current = pt;
    redraw();
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (panningRef.current) {
      const dx = e.clientX - panStartRef.current.mx;
      const dy = e.clientY - panStartRef.current.my;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      return;
    }

    const pt = getMaskCoords(e);
    if (!pt) return;

    if (tool === 'region' && !drawingRef.current) {
      const rid = regionMap ? regionAt(regionMap, pt.x, pt.y) : -1;
      if (rid !== hoverRegionRef.current) {
        hoverRegionRef.current = rid;
        redraw();
      }
      return;
    }

    if (!drawingRef.current) return;
    const last = lastPxRef.current;
    if (last) lineStamp(last.x, last.y, pt.x, pt.y);
    else stampAt(pt.x, pt.y);
    lastPxRef.current = pt;
    redraw();
  }

  function handlePointerUp() {
    if (panningRef.current) {
      panningRef.current = false;
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPxRef.current = null;
    finishStroke();
  }

  function handlePointerLeave() {
    if (hoverRegionRef.current !== -1) {
      hoverRegionRef.current = -1;
      redraw();
    }
  }

  function finishStroke() {
    const updates: { id: ColorId; mask: Uint8Array }[] = [];
    for (const id of touchedRef.current) {
      const m = masksRef.current.get(id);
      if (m) updates.push({ id, mask: new Uint8Array(m) });
    }
    redraw();
    if (updates.length > 0) onStrokeEnd(updates);
  }

  function zoomAtPoint(viewportX: number, viewportY: number, factor: number) {
    const newZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const actualFactor = newZoom / zoom;
    if (actualFactor === 1) return;
    setZoom(newZoom);
    setPan({
      x: viewportX - actualFactor * (viewportX - pan.x),
      y: viewportY - actualFactor * (viewportY - pan.y),
    });
  }

  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAtPoint(mx, my, factor);
  }

  function zoomCenter(factor: number) {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    zoomAtPoint(rect.width / 2, rect.height / 2, factor);
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  const baseLeft = (viewport.w - dims.w * fitScale) / 2;
  const baseTop = (viewport.h - dims.h * fitScale) / 2;

  const cursor = panningRef.current
    ? 'grabbing'
    : tool === 'region' || tool === 'fill'
    ? 'crosshair'
    : 'cell';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 360,
        background: '#222',
        overflow: 'hidden',
      }}
    >
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          style={{
            position: 'absolute',
            left: `${baseLeft + pan.x}px`,
            top: `${baseTop + pan.y}px`,
            width: `${displayW}px`,
            height: `${displayH}px`,
            imageRendering: 'pixelated',
            cursor,
            touchAction: 'none',
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        />
      </div>
      <ZoomToolbar
        zoom={zoom}
        onZoomIn={() => zoomCenter(1.4)}
        onZoomOut={() => zoomCenter(1 / 1.4)}
        onReset={resetView}
      />
      <HintBar />
    </div>
  );
}

function ZoomToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const btn: React.CSSProperties = {
    width: 32,
    height: 32,
    border: 'none',
    background: 'rgba(255,255,255,0.92)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button onClick={onZoomIn} style={btn} title="Zoom ind">+</button>
      <button onClick={onZoomOut} style={btn} title="Zoom ud">−</button>
      <button onClick={onReset} style={{ ...btn, fontSize: 11 }} title="Tilpas til vindue">FIT</button>
      <div
        style={{
          marginTop: 2,
          padding: '2px 6px',
          fontSize: 11,
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          borderRadius: 4,
          textAlign: 'center',
        }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

function HintBar() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        left: 12,
        fontSize: 11,
        color: 'rgba(255,255,255,0.55)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      Scrollhjul: zoom · Højreklik/Shift+træk: panorér
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function blend(a: number, b: number, alpha: number): number {
  return Math.round(a * (1 - alpha) + b * alpha);
}
