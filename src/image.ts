// Processamento de imagem no próprio aparelho: recorte, remoção de fundo e cor dominante.

export interface Rect { x: number; y: number; w: number; h: number } // frações 0–1

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Não consegui abrir essa imagem."));
    img.src = src;
  });
}

export const fileToDataURL = (f: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Recorta (rect em frações) e reduz para no máximo `max` px no maior lado. */
export function cropResize(img: HTMLImageElement, rect: Rect, max = 720): HTMLCanvasElement {
  const sx = rect.x * img.naturalWidth, sy = rect.y * img.naturalHeight;
  const sw = rect.w * img.naturalWidth, sh = rect.h * img.naturalHeight;
  const k = Math.min(1, max / Math.max(sw, sh));
  const c = canvas(sw * k, sh * k);
  c.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

/** Corta as bordas transparentes. */
export function trim(src: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = src;
  const d = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 20) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return src;
  const c = canvas(x1 - x0 + 1, y1 - y0 + 1);
  c.getContext("2d")!.drawImage(src, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/** Cor dominante dos pixels visíveis (quantização simples em caixas). */
export function dominantColor(c: HTMLCanvasElement): [number, number, number] {
  const k = Math.min(1, 120 / Math.max(c.width, c.height));
  const s = canvas(c.width * k, c.height * k);
  const ctx = s.getContext("2d")!;
  ctx.drawImage(c, 0, 0, s.width, s.height);
  const d = ctx.getImageData(0, 0, s.width, s.height).data;
  const boxes = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const key = ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5);
    const box = boxes.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    box.n++; box.r += d[i]; box.g += d[i + 1]; box.b += d[i + 2];
    boxes.set(key, box);
  }
  let best = { n: 0, r: 0, g: 0, b: 0 };
  for (const b of boxes.values()) if (b.n > best.n) best = b;
  if (!best.n) return [0, 0, 0];
  return [best.r / best.n, best.g / best.n, best.b / best.n];
}

export function toDataURL(c: HTMLCanvasElement, transparent: boolean): string {
  // webp guarda transparência e ocupa pouco; Safari antigo cai para PNG sozinho
  const webp = c.toDataURL("image/webp", 0.86);
  if (webp.startsWith("data:image/webp")) return webp;
  return transparent ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.88);
}

/** Versão em JPEG/base64 para mandar para a IA (sem o prefixo data:). */
export function forAI(img: HTMLImageElement, max = 1280): { data: string; media: "image/jpeg" } {
  const c = cropResize(img, { x: 0, y: 0, w: 1, h: 1 }, max);
  return { data: c.toDataURL("image/jpeg", 0.85).split(",")[1], media: "image/jpeg" };
}
