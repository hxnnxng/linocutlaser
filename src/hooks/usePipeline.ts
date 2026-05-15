import { useEffect, useRef, useState } from 'react';
import type {
  ColorPlate,
  MaskDims,
  PaperMm,
  PipelineRequest,
  PipelineResponse,
  SvgDoc,
  TraceParams,
} from '../types';

export function usePipeline(
  plates: ColorPlate[],
  dims: MaskDims | null,
  paper: PaperMm,
  params: TraceParams,
): { doc: SvgDoc | null; busy: boolean } {
  const [doc, setDoc] = useState<SvgDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const nextIdRef = useRef(1);
  const lastSentIdRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/tracePipeline.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<PipelineResponse>) => {
      if (e.data.id !== lastSentIdRef.current) return;
      setDoc(e.data.doc);
      setBusy(false);
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!dims || !workerRef.current) {
      setDoc(null);
      return;
    }
    const id = nextIdRef.current++;
    lastSentIdRef.current = id;
    setBusy(true);

    const buffers: ArrayBuffer[] = [];
    const platesPayload = plates.map((p) => {
      const copy = new Uint8Array(p.mask);
      buffers.push(copy.buffer);
      return { id: p.id, printColor: p.printColor, mask: copy.buffer };
    });

    const req: PipelineRequest = {
      id,
      paper,
      maskDims: dims,
      plates: platesPayload,
      params,
    };
    workerRef.current.postMessage(req, buffers);
  }, [plates, dims, paper, params]);

  return { doc, busy };
}
