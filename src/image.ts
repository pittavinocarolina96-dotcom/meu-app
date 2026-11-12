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

/**
 * Remove o fundo por "inundação" a partir das bordas: pixels parecidos com a cor da
 * borda e conectados a ela viram transparentes. Funciona bem com fotos de produto
 * (fundo liso claro/cinza), que é o caso da maioria das lojas online.
 */
export function removeBackground(src: HTMLCanvasElement, tolerance = 34): { canvas: HTMLCanvasElement; removed: number } {
  const { width: w, height: h } = src;
  const c = canvas(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const tol2 = tolerance * tolerance * 3;

  // semente em cada pixel da borda; compara com a cor da própria semente (aceita fundos em degradê)
  const seeds: number[] = [];
  for (let x = 0; x < w; x++) seeds.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) seeds.push(y * w, y * w + w - 1);

  for (const s of seeds) {
    if (seen[s]) continue;
    const r0 = px[s * 4], g0 = px[s * 4 + 1], b0 = px[s * 4 + 2];
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const i = p * 4;
      px[i + 3] = 0;
      const x = p % w, y = (p / w) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) {
        if (q < 0 || seen[q]) continue;
        const j = q * 4;
        const d = (px[j] - r0) ** 2 + (px[j + 1] - g0) ** 2 + (px[j + 2] - b0) ** 2;
        if (d <= tol2) { seen[q] = 1; stack.push(q); }
      }
    }
  }

  // suaviza a borda: pixel opaco vizinho de transparente fica semitransparente
  const alpha = new Uint8ClampedArray(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = px[p * 4 + 3];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    if (!alpha[p]) continue;
    const t = (alpha[p - 1] === 0 ? 1 : 0) + (alpha[p + 1] === 0 ? 1 : 0) + (alpha[p - w] === 0 ? 1 : 0) + (alpha[p + w] === 0 ? 1 : 0);
    if (t) px[p * 4 + 3] = 255 - t * 50;
  }
  ctx.putImageData(data, 0, 0);
  let removed = 0;
  for (let p = 0; p < w * h; p++) if (seen[p]) removed++;
  return { canvas: trim(c), removed: removed / (w * h) };
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
