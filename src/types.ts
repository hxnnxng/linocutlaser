export type PaperMm = { wMm: number; hMm: number };

export type ColorId = 'c1' | 'c2' | 'c3';

export type ColorPlate = {
  id: ColorId;
  printColor: string;
  mask: Uint8Array;
};

export type MaskDims = { w: number; h: number };

export type TraceParams = {
  simplifyMm: number;
  jaggedAmplitudeMm: number;
  jaggedFrequencyPerMm: number;
  jaggedSeed: number;
  minAreaMm2: number;
};

export type SvgPath = { d: string };

export type SvgLayerRole = 'engrave' | 'cut';

export type SvgLayer = {
  id: string;
  colorId: ColorId;
  role: SvgLayerRole;
  printColor: string;
  paths: SvgPath[];
};

export type SvgDoc = {
  paper: PaperMm;
  layers: SvgLayer[];
};

export type Point = { x: number; y: number };
export type Ring = Point[];

export type PipelineRequest = {
  id: number;
  paper: PaperMm;
  maskDims: MaskDims;
  plates: { id: ColorId; printColor: string; mask: ArrayBuffer }[];
  params: TraceParams;
};

export type PipelineResponse = {
  id: number;
  doc: SvgDoc;
};
