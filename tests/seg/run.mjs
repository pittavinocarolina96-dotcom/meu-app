// Teste temporário (roda no GitHub Actions): segmentação de roupas com Transformers.js.
import { pipeline, RawImage } from "@huggingface/transformers";
import { readdirSync, statSync } from "node:fs";
import { deflateSync } from "node:zlib";

const seg = await pipeline("image-segmentation", "Xenova/segformer_b2_clothes", { dtype: process.env.DTYPE || "q8" });
const t0 = Date.now();
for (const f of readdirSync("tests/seg").filter((f) => f.endsWith(".jpg"))) {
  const img = await RawImage.read(`tests/seg/${f}`);
  const out = await seg(img);
  console.log(`\n### ${f} ${img.width}x${img.height}`);
  for (const o of out) {
    const d = o.mask.data;
    let n = 0;
    for (const v of d) if (v > 127) n++;
    console.log(`  ${o.label.padEnd(14)} ${(100 * n / d.length).toFixed(1)}%  mask ${o.mask.width}x${o.mask.height}`);
  }
  // mapa de rótulos 1 char por pixel, reduzido, para inspecionar no log
  const W = 46, H = Math.round(46 * img.height / img.width / 2);
  const chars = {};
  out.forEach((o, i) => (chars[o.label] = "BHhGUSPDbLRFlrabLR"[["Background","Hat","Hair","Sunglasses","Upper-clothes","Skirt","Pants","Dress","Belt","Left-shoe","Right-shoe","Face","Left-leg","Right-leg","Left-arm","Right-arm","Bag","Scarf"].indexOf(o.label)] ?? "?"));
  for (let y = 0; y < H; y++) {
    let line = "  ";
    for (let x = 0; x < W; x++) {
      const px = Math.floor(x * img.width / W), py = Math.floor(y * img.height / H);
      let c = ".";
      for (const o of out) if (o.mask.data[py * o.mask.width + px] > 127) c = o.label === "Background" ? "." : chars[o.label];
      line += c;
    }
    console.log(line);
  }
}
console.log("\ntempo:", Date.now() - t0, "ms");
const cache = "node_modules/@huggingface/transformers/.cache/Xenova/segformer_b2_clothes/onnx";
try { for (const f of readdirSync(cache)) console.log("arquivo", f, (statSync(`${cache}/${f}`).size / 1e6).toFixed(1), "MB"); } catch (e) { console.log("cache?", e.message); }
