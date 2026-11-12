// Teste temporário: compara modelos de recorte (memória, tempo, qualidade).
import * as T from "@huggingface/transformers";
import { mkdirSync } from "node:fs";
const [, , cls, id, dtype] = process.argv;
mkdirSync("seg-out", { recursive: true });
const t0 = Date.now();
const model = await T[cls].from_pretrained(id, { dtype });
const processor = await T.AutoProcessor.from_pretrained(id);
console.log(`RESULT ${id} carregado em ${Date.now() - t0}ms`);
const cases = { "short.jpg": [150, 170], "top.jpg": [150, 150], "verde.jpg": [150, 110], "blusa.jpg": [140, 110] };
const tag = id.split("/")[1];
for (const [f, pt] of Object.entries(cases)) {
  const img = await T.RawImage.read(`tests/seg/${f}`);
  const t1 = Date.now();
  const inputs = await processor(img, { input_points: [[[pt]]], input_labels: [[[1]]] });
  const out = await model(inputs);
  const masks = await processor.post_process_masks(out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
  const dims = masks[0].dims, H = dims.at(-2), W = dims.at(-1), n = masks[0].data.length / (H * W);
  const rgb = img.rgb();
  const outW = W * n, buf = new Uint8ClampedArray(outW * H * 3);
  for (let k = 0; k < n; k++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const on = masks[0].data[k * H * W + y * W + x];
    for (let c = 0; c < 3; c++) { const v = rgb.data[(y * W + x) * 3 + c]; buf[(y * outW + k * W + x) * 3 + c] = on ? v : 40 + v * 0.15; }
  }
  await new T.RawImage(buf, outW, H, 3).save(`seg-out/${tag}-${f}.png`);
  console.log(`RESULT ${tag} ${f} ${Date.now() - t1}ms dims=${dims} scores=${Array.from(out.iou_scores.data).map((s) => s.toFixed(2))}`);
}
