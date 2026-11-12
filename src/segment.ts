// Recorte inteligente: o EdgeTAM (versão do "Segment Anything" feita para rodar em celular)
// roda no próprio aparelho, de graça. Você toca na roupa (ou o app toca no meio dela) e ele
// recorta exatamente aquela peça, separando-a do fundo, da pele e das outras roupas.
// Nos testes: ~0,7 GB de memória e <1 s por foto (o SlimSAM usava 3,8 GB e fechava a página no iPhone).
import { clearStage, stage } from "./diag.ts";

// fp32: a versão quantizada (q8) deste modelo dá máscaras erradas
const MODEL = "onnx-community/EdgeTAM-ONNX";

export interface Point { x: number; y: number; on: boolean } // x,y em pixels do canvas; on=false = "tirar"

let loading: Promise<{ model: any; processor: any; RawImage: any }> | null = null;

export function loadSam(onProgress?: (pct: number) => void) {
  loading ??= (async () => {
    stage("carregar o recorte");
    const t = await import("@huggingface/transformers");
    t.env.allowLocalModels = false;
    // modo leve: 1 thread, sem worker extra (menos memória no iPhone)
    const wasm = (t.env.backends as any)?.onnx?.wasm;
    if (wasm) { wasm.numThreads = 1; wasm.proxy = false; }
    stage("baixar a IA de recorte");
    const progress_callback = (p: any) => {
      if (p.status === "progress" && String(p.file).endsWith(".onnx")) onProgress?.(Math.round(p.progress));
    };
    const [model, processor] = await Promise.all([
      t.EdgeTamModel.from_pretrained(MODEL, { dtype: "fp32", progress_callback }),
      t.AutoProcessor.from_pretrained(MODEL),
    ]);
    clearStage();
    return { model, processor, RawImage: t.RawImage };
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

/** Uma imagem preparada: a parte pesada (embeddings) roda uma vez; cada toque é rápido. */
export class Cutter {
  private constructor(
    private sam: { model: any; processor: any },
    private image: any,
    private emb: any,
    readonly src: HTMLCanvasElement
  ) {}

  static async create(src: HTMLCanvasElement, onProgress?: (pct: number) => void) {
    const sam = await loadSam(onProgress);
    stage("analisar a foto");
    const image = sam.RawImage.fromCanvas(src);
    const emb = await sam.model.get_image_embeddings(await sam.processor(image));
    clearStage();
    return new Cutter(sam, image, emb, src);
  }

  /** Máscara (0/255 por pixel, tamanho do canvas) para os toques dados. */
  async mask(points: Point[]): Promise<Uint8ClampedArray> {
    const { model, processor } = this.sam;
    // a análise pesada da foto (emb) já foi feita; aqui só entram os toques
    const prompt = await processor(this.image, {
      input_points: [[points.map((p) => [p.x, p.y])]],
      input_labels: [[points.map((p) => (p.on ? 1 : 0))]],
    });
    const { original_sizes, reshaped_input_sizes, input_points, input_labels } = prompt;
    stage("recortar");
    const out = await model({ ...this.emb, input_points, input_labels });
    clearStage();
    const masks = await processor.post_process_masks(out.pred_masks, original_sizes, reshaped_input_sizes);
    const scores: Float32Array = out.iou_scores.data;
    // O modelo devolve 3 opções: [pessoa/objeto inteiro, peça, pedaço]. Nos testes com prints da
    // Shein, com 1 toque a do meio foi sempre a roupa. Com mais toques, vale a de maior confiança.
    let best = 1;
    if (points.length > 1) for (let i = 0; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
    const m = masks[0];
    const H = m.dims.at(-2), W = m.dims.at(-1);
    const data: Uint8Array = m.data;
    const w = this.src.width, h = this.src.height;
    const a = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) {
      const my = Math.min(H - 1, Math.floor((y * H) / h));
      for (let x = 0; x < w; x++) {
        const mx = Math.min(W - 1, Math.floor((x * W) / w));
        if (data[best * H * W + my * W + mx]) a[y * w + x] = 255;
      }
    }
    return a;
  }
}

/** Aplica a máscara (como está na tela), suaviza a borda e devolve só a peça. */
export function applyMask(src: HTMLCanvasElement, mask: Uint8ClampedArray): { canvas: HTMLCanvasElement; coverage: number } {
  const w = src.width, h = src.height;
  const soft = blurAlpha(mask, w, h);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    img.data[i * 4 + 3] = Math.min(img.data[i * 4 + 3], soft[i]);
    if (soft[i] > 127) n++;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, coverage: n / (w * h) };
}

/** Mantém as regiões grandes (tira pontinhos soltos, como textos do print). Usado no recorte da IA. */
export function keepLargestParts(a: Uint8ClampedArray, w: number, h: number) {
  const label = new Int32Array(w * h);
  const sizes: number[] = [0];
  const stack: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (!a[p] || label[p]) continue;
    const id = sizes.length;
    let n = 0;
    stack.push(p);
    label[p] = id;
    while (stack.length) {
      const q = stack.pop()!;
      n++;
      const x = q % w, y = (q / w) | 0;
      if (x > 0 && a[q - 1] && !label[q - 1]) { label[q - 1] = id; stack.push(q - 1); }
      if (x < w - 1 && a[q + 1] && !label[q + 1]) { label[q + 1] = id; stack.push(q + 1); }
      if (y > 0 && a[q - w] && !label[q - w]) { label[q - w] = id; stack.push(q - w); }
      if (y < h - 1 && a[q + w] && !label[q + w]) { label[q + w] = id; stack.push(q + w); }
    }
    sizes.push(n);
  }
  const max = Math.max(0, ...sizes);
  for (let p = 0; p < w * h; p++) if (a[p] && sizes[label[p]] < max * 0.12) a[p] = 0;
}

/** Suaviza a borda (desfoque 5x5). */
function blurAlpha(a: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const r = 2, tmp = new Float32Array(w * h), out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / (2 * r + 1);
      s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / (2 * r + 1);
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}
