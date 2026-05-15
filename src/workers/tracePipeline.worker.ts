/// <reference lib="webworker" />
import type { PipelineRequest, PipelineResponse } from '../types';
import { buildSvgDoc } from '../utils/buildSvgDoc';

self.onmessage = (e: MessageEvent<PipelineRequest>) => {
  const req = e.data;
  const plates = req.plates.map((p) => ({
    id: p.id,
    printColor: p.printColor,
    mask: new Uint8Array(p.mask),
  }));
  const doc = buildSvgDoc(plates, req.maskDims, req.paper, req.params);
  const res: PipelineResponse = { id: req.id, doc };
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(res);
};
