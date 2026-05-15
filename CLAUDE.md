# Linocutlaser

React SPA that turns an image into a multicolor lino-cut SVG for laser cutting/engraving. Hand-cut aesthetic via controlled jagged-noise on simplified contours. All geometry uses **paper-mm** (SVG user units = millimetres).

## Stack

- Vite + React 18 + TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`)
- `simplify-js` for Douglas-Peucker, `simplex-noise` for coherent perpendicular jaggedness
- Own marching-squares contour tracer ([src/utils/contour.ts](src/utils/contour.ts)) — binary masks come from the brush, no external tracer needed
- No UI framework — plain styled components

## Commands

```
npm run dev        # vite dev server, port 5174
npm run build      # tsc --noEmit && vite build
npm run typecheck  # tsc --noEmit
```

## Data flow (one-way)

1. User uploads image → resampled to ≤600px longest side via `loadImage`
2. User picks color count (1/2/3) + hex per plate in `ColorPanel`
3. User assigns regions to colors in `PaintCanvas`:
   - Default tool is `region`: image is posterized into N levels via `buildRegionMap`, connected components are labelled, clicking a region copies its pixels into the active color's mask. Boundaries are drawn as a black overlay.
   - `brush` / `eraser` / `fill` tools are available for manual painting / region correction.
4. On mask change or param change, masks + `TraceParams` go to `tracePipeline.worker.ts`
5. Worker: per-mask `traceContours` → `simplifyPath` → `jaggify` → assembles `SvgDoc` with engrave + cut layers per color
6. `SvgPreview` renders inline; `ExportButton` serialises to mm-unit SVG with layer groups

Parameter changes flow through `useDebouncedValue` (250ms) before re-tracing.

## Coordinate system

- All output geometry uses **paper-mm**, origin top-left, y-down (matches SVG)
- Source pixel grid maps linearly to paper-mm via `pxToMm` with letterbox-offset (preserves aspect)
- Default paper: A4 (210×297mm), user-adjustable

## Color plates

`ColorPlate.mask` is a `Uint8Array` (one byte per source pixel). A pixel can only belong to one plate — when the user paints color A on top of an existing color B pixel, B's mask is cleared at that pixel on `pointerup`.

Per-plate output is two `SvgLayer`s:
- `{id: 'c1-engrave', role: 'engrave', printColor, paths: [...]}` — filled regions (laser raster engrave)
- `{id: 'c1-cut', role: 'cut', printColor, paths: [...]}` — same geometry, hairline red stroke (vector cut)

Layers serialize in plate order: c1-engrave, c1-cut, c2-engrave, c2-cut, c3-engrave, c3-cut.

## Jaggify

`jaggify` resamples each closed path at uniform arc length, computes per-vertex normal (mean of adjacent edge perpendiculars), and displaces along the normal by `amplitudeMm * noise1D(i * step, seed)` using simplex-noise. Coherent (not white-noise) so kanten ripples rather than fuzzes. Runs **after** simplify (else DP removes the jagged shape).

Same `jaggedSeed` is reused across renders so adjusting amplitude/frequency doesn't reshuffle the jaggedness pattern.

## Export conventions (laser software compatibility)

```xml
<svg viewBox="0 0 {wMm} {hMm}" width="{wMm}mm" height="{hMm}mm">
  <g id="c1-engrave" data-print-color="{hex}">
    <path fill="{hex}" stroke="none" d="..."/>
  </g>
  <g id="c1-cut">
    <path fill="none" stroke="#FF0000" stroke-width="0.01" d="..."/>
  </g>
  ...
</svg>
```

- mm-unit ensures 1:1 import in Lightburn / LaserGRBL
- Red stroke on cut layer = vector-cut convention
- Filled engrave layer = raster-engrave convention
- `data-print-color` preserves the user's intended print color without breaking laser-software stroke/fill detection
