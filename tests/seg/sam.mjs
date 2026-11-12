// Teste temporário: SlimSAM recortando a peça a partir de um toque (ponto) ou de uma caixa.
import { SamModel, AutoProcessor, RawImage } from "@huggingface/transformers";
const id = "Xenova/slimsam-77-uniform";
const model = await SamModel.from_pretrained(id, { dtype: "q8" });
const processor = await AutoProcessor.from_pretrained(id);
const cases = {
  "short.jpg": { pt: [115, 170], box: [60, 90, 200, 252] },
  "top.jpg": { pt: [95, 110], box: [20, 20, 190, 192] },
  "verde.jpg": { pt: [110, 100], box: [40, 40, 190, 190] },
  "blusa.jpg": { pt: [110, 70], box: [10, 10, 229, 130] },
};
function show(mask, w, h) {
  const W = 46, H = Math.round(46 * h / w / 2);
  for (let y = 0; y < H; y++) {
    let l = "  ";
    for (let x = 0; x < W; x++) l += mask[Math.floor(y * h / H) * w + Math.floor(x * w / W)] ? "#" : ".";
    console.log(l);
  }
}
for (const [f, c] of Object.entries(cases)) {
  const img = await RawImage.read(`tests/seg/${f}`);
  for (const mode of ["ponto", "caixa"]) {
    const t0 = Date.now();
    const inputs = mode === "ponto"
      ? await processor(img, { input_points: [[c.pt]], input_labels: [[1]] })
      : await processor(img, { input_boxes: [[c.box]] });
    const out = await model(inputs);
    const masks = await processor.post_process_masks(out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
    const scores = out.iou_scores.data;
    let best = 0; for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
    const m = masks[0]; // [1, 3, H, W]
    const [, , H, W] = m.dims;
    const data = m.data.slice(best * H * W, (best + 1) * H * W);
    let n = 0; for (const v of data) if (v) n++;
    console.log(`\n### ${f} (${mode}) score=${scores[best].toFixed(2)} área=${(100 * n / (H * W)).toFixed(0)}% ${Date.now() - t0}ms`);
    show(data, W, H);
  }
}
