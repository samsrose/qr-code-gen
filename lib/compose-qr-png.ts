import { QR_SIZE } from "./qr-instance";

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cw: number,
  ch: number
) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return;
  const scale = Math.max(cw / w, ch / h);
  const dw = w * scale;
  const dh = h * scale;
  const x = (cw - dw) / 2;
  const y = (ch - dh) / 2;
  ctx.drawImage(img, x, y, dw, dh);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/**
 * When a background image is set, composite it behind the QR raster.
 * QR PNG should be generated with a transparent background.
 */
export async function compositeQrOverBackground(
  qrPngBlob: Blob,
  backgroundSrc: string,
  width = QR_SIZE,
  height = QR_SIZE
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  const [bg, qrBlobUrl] = await Promise.all([
    loadImage(backgroundSrc),
    Promise.resolve(URL.createObjectURL(qrPngBlob)),
  ]);

  try {
    const qrImg = await loadImage(qrBlobUrl);
    drawImageCover(ctx, bg, width, height);
    ctx.drawImage(qrImg, 0, 0, width, height);
  } finally {
    URL.revokeObjectURL(qrBlobUrl);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("PNG encode failed"));
      },
      "image/png",
      1
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
