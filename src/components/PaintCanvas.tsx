import { useEffect, useLayoutEffect, useRef, type PointerEvent } from 'react';
import type { ColorId, ColorPlate, MaskDims } from '../types';

export type PaintTool = 'brush' | 'eraser' | 'fill';

type Props = {
  source: ImageBitmap;
  dims: MaskDims;
  plates: ColorPlate[];
  activeColorId: ColorId;
  brushSizePx: number;
  tool: PaintTool;
  onStrokeBegin: () => void;
  onStrokeEnd: (updates: { id: ColorId; mask: Uint8Array }[]) => void;
};

const DISPLAY_MAX = 720;
const SOURCE_DIM = 0.35;
const PAINT_ALPHA = 0.65;

export function PaintCanvas({
  source,
  dims,
  plates,
  activeColorId,
  brushSizePx,
  tool,
  onStrokeBegin,
  onStrokeEnd,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const masksRef = useRef<Map<ColorId, Uint8Array>>(new Map());
  const drawingRef = useRef(false);
  const lastPxRef = useRef<{ x: number; y: number } | null>(null);
  const touchedRef = useRef<Set<ColorId>>(new Set());

  const scaleRef = useRef(1);

  useLayoutEffect(() => {
    masksRef.current = new Map(plates.map((p) => [p.id, new Uint8Array(p.mask)]));
    redraw();
  }, [plates, dims]);

  useEffect(() => {
    redraw();
  }, [source]);

  function setupCanvasSize() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(1, DISPLAY_MAX / Math.max(dims.w, dims.h));
    scaleRef.current = scale;
    canvas.width = dims.w;
    canvas.height = dims.h;
    canvas.style.width = `${Math.round(dims.w * scale)}px`;
    canvas.style.height = `${Math.round(dims.h * scale)}px`;
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
    ctx.putImageData(overlay, 0, 0);
  }

  function getMaskCoords(e: PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
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
        if (matches(n)) {
          visited[n] = 1;
          stack.push(n);
        }
      }
      if (x < dims.w - 1) {
        const n = idx + 1;
        if (matches(n)) {
          visited[n] = 1;
          stack.push(n);
        }
      }
      if (y > 0) {
        const n = idx - dims.w;
        if (matches(n)) {
          visited[n] = 1;
          stack.push(n);
        }
      }
      if (y < dims.h - 1) {
        const n = idx + dims.w;
        if (matches(n)) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }

    touchedRef.current.add(activeColorId);
    for (const id of masksRef.current.keys()) {
      if (id !== activeColorId) touchedRef.current.add(id);
    }
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const pt = getMaskCoords(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    touchedRef.current.clear();
    onStrokeBegin();

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
    if (!drawingRef.current) return;
    const pt = getMaskCoords(e);
    if (!pt) return;
    const last = lastPxRef.current;
    if (last) lineStamp(last.x, last.y, pt.x, pt.y);
    else stampAt(pt.x, pt.y);
    lastPxRef.current = pt;
    redraw();
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPxRef.current = null;
    finishStroke();
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

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 12, background: '#222' }}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          imageRendering: 'pixelated',
          cursor: tool === 'fill' ? 'crosshair' : 'cell',
          touchAction: 'none',
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
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
