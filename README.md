# Linocutlaser

Browser-værktøj der laver SVG til lasercutting/-gravering af linoleum med et håndskåret udtryk. Tag et billede ind, tildel manuelt op til 3 trykfarver med pensel, og få en SVG i millimeter med separate engrave- og cut-lag pr. farve — klar til Lightburn eller LaserGRBL.

## Kør

```bash
npm install
npm run dev       # http://localhost:5174
npm run build     # producerer dist/
npm run typecheck
```

## Workflow

1. Drop et billede (PNG/JPG). Det skaleres til ≤600px langs længste side.
2. Vælg antal farver (1, 2 eller 3) og hex-værdi pr. plade via color pickerne.
3. Tildel områder til farver. To tilgange — kombinér efter behov:
   - **Region-mode** (default): billedet posterizes til N niveauer (slider 2-8) og opdeles i connected components. Klik på et område for at tildele det den aktive farve. Konturerne tegnes som overlay på canvas så du kan se hvad der er klikbart.
   - **Pensel/visker/fyld-bucket**: manuel maling oven på regionerne hvis du vil finjustere. En pixel kan kun tilhøre én farve; en ny tildeling "stjæler" pixels fra andre farver.
4. Justér forenkling (Douglas-Peucker ε), ujævnhed (amplitude + frekvens) og min-areal med sliders. "Ny ujævnhed" genseeder noise-mønstret.
5. SVG-preview opdateres live (debounced 250ms). Toggle engrave/cut pr. farve.
6. **Eksportér SVG** → fil med viewBox i millimeter, en `<g>` pr. farve+rolle.

## Output-format

```xml
<svg viewBox="0 0 148 210" width="148mm" height="210mm">
  <g id="c1-engrave" data-print-color="#1a1a1a">
    <path fill="#1a1a1a" stroke="none" fill-rule="evenodd" d="..."/>
  </g>
  <g id="c1-cut">
    <path fill="none" stroke="#FF0000" stroke-width="0.01" d="..."/>
  </g>
  ...
</svg>
```

- Rød hairline stroke på cut-laget = vektor-cut-konvention.
- Fyldt engrave-lag = raster engrave-konvention.
- `data-print-color` bevarer den tilsigtede trykfarve uden at bryde laser-softwarens stroke/fill-detektering.
- Alle paper-bboxes er identiske på tværs af farver, så plader stables 1:1 ved registreret tryk.

## Stack

- Vite + React 18 + TypeScript (strict)
- `simplify-js` (Douglas-Peucker), `simplex-noise` (sammenhængende kant-ujævnhed)
- Eget marching-edge-stitch contour-tracer ([src/utils/contour.ts](src/utils/contour.ts))
- Trace-pipelinen kører i en Web Worker, så UI ikke fryser

## Koordinatsystem

SVG user units = millimetre, origin top-venstre, y-ned. Source-pixelgrid mappes lineært til paper-mm med letterbox-offset, så aspect bevares.
