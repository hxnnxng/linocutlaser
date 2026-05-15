import type { MaskDims } from '../types';

export type LoadedImage = {
  bitmap: ImageBitmap;
  dims: MaskDims;
  luminance: Uint8Array;
};

const MAX_DIM = 600;

export async function loadImage(file: File): Promise<LoadedImage> {
  const source = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_DIM / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * ratio));
  const h = Math.max(1, Math.round(source.height * ratio));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
  ctx.drawImage(source, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  source.close();

  const luminance = new Uint8Array(w * h);
  const data = imageData.data;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    luminance[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }

  const bitmap = await createImageBitmap(imageData);

  return { bitmap, dims: { w, h }, luminance };
}
