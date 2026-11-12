// Teste temporário: SlimSAM recortando a peça a partir de um toque. Imprime as imagens em base64.
import { SamModel, AutoProcessor, RawImage } from "@huggingface/transformers";
import { mkdirSync } from "node:fs";
mkdirSync("seg-out", { recursive: true });
const id = "Xenova/slimsam-77-uniform";
const model = await SamModel.from_pretrained(id, { dtype: "q8" });
const processor = await AutoProcessor.from_pretrained(id);
const cases = { "short.jpg": [150, 170], "top.jpg": [150, 150], "verde.jpg": [150, 110], "blusa.jpg": [140, 110] };
for (const [f, pt] of Object.entries(cases)) {
  const img = await RawImage.read(`tests/seg/${f}`);
  const inputs = await processor(img, { input_points: [[pt]], input_labels: [[1]] });
  const out = await model(inputs);
  const masks = await processor.post_process_masks(out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
  const [, n, H, W] = masks[0].dims;
  const rgb = img.rgb();
  const outW = W * n, buf = new Uint8ClampedArray(outW * H * 3);
  for (let k = 0; k < n; k++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const on = masks[0].data[k * H * W + y * W + x];
    for (let c = 0; c < 3; c++) {
      const v = rgb.data[(y * W + x) * 3 + c];
      buf[(y * outW + k * W + x) * 3 + c] = on ? v : 40 + v * 0.15;
    }
  }
  const comp = new RawImage(buf, outW, H, 3);
  await comp.save(`seg-out/${f}.png`);
  console.log(`IMG ${f} scores=${Array.from(out.iou_scores.data).map((s) => s.toFixed(2)).join(",")}`);
}
