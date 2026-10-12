import type { StyleSettings } from './subtitleCore';

/**
 * 从截图估计字幕样式（本地计算，不上传）。只是估计：取画面下部 40% 内最亮且连成横条的像素当作字幕文字，
 * 文字像素邻近的深色像素当作描边；文字行中心距底边的距离换算成 288 基准的 marginV。
 */
export interface PixelSource { width: number; height: number; data: Uint8ClampedArray | number[] }

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export function estimateStyleFromPixels(img: PixelSource): Partial<StyleSettings> | null {
  const { width: w, height: h, data } = img;
  if (w < 8 || h < 8) return null;
  const top = Math.floor(h * 0.6);
  const lum = (i: number) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  // Brightness threshold: top ~3% of the region, at least 170.
  const hist = new Array(256).fill(0);
  for (let y = top; y < h; y++) for (let x = 0; x < w; x++) hist[Math.min(255, Math.round(lum((y * w + x) * 4)))]++;
  const total = (h - top) * w;
  let acc = 0; let threshold = 255;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.03) { threshold = v; break; } }
  threshold = Math.max(170, threshold);
  const rows: number[] = []; const rs: number[] = []; const gs: number[] = []; const bs: number[] = [];
  const or: number[] = []; const og: number[] = []; const ob: number[] = [];
  const rowCount = new Array(h).fill(0);
  for (let y = top; y < h; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (lum(i) < threshold) continue;
      rowCount[y]++;
      rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
      for (const dx of [-3, 3]) {
        const nx = x + dx; if (nx < 0 || nx >= w) continue;
        const j = (y * w + nx) * 4;
        if (lum(j) < 90) { or.push(data[j]); og.push(data[j + 1]); ob.push(data[j + 2]); }
      }
    }
  }
  const minRow = Math.max(3, w * 0.01);
  for (let y = top; y < h; y++) if (rowCount[y] >= minRow) rows.push(y);
  if (rows.length < 3) return null;
  // Main (bottom-most) text band → its height ≈ font size, its bottom edge → marginV.
  const bandEnd = rows[rows.length - 1]; let bandStart = bandEnd;
  for (let k = rows.length - 2; k >= 0 && bandEnd - rows[k] < 40 * (h / 288) && rows[k] >= bandStart - 3 * (h / 288); k--) bandStart = rows[k];
  const scale = 288 / h;
  const size = Math.round((bandEnd - bandStart + 1) * scale * 1.15);
  const color = hex(median(rs), median(gs), median(bs));
  const outline = or.length > 10 ? hex(median(or), median(og), median(ob)) : '#000000';
  return {
    zhColor: color,
    enColor: color,
    zhOutline: outline,
    enOutline: outline,
    zhFontSize: Math.min(48, Math.max(12, size || 20)),
    marginV: Math.min(120, Math.max(0, Math.round((h - 1 - bandEnd) * scale))),
  };
}

/** Browser helper: decode an image File locally and estimate. */
export async function estimateStyleFromImageFile(file: File): Promise<Partial<StyleSettings> | null> {
  const bitmap = await createImageBitmap(file);
  const maxW = 960;
  const w = Math.min(maxW, bitmap.width);
  const h = Math.round(bitmap.height * (w / bitmap.width));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return estimateStyleFromPixels(ctx.getImageData(0, 0, w, h));
}
