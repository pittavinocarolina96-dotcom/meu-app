// Substituto do Transformers.js só para testar a interface: "recorta" um círculo em volta de cada toque.
export const env = { allowLocalModels: true };
export class RawImage { constructor(public width: number, public height: number) {} static fromCanvas(c: HTMLCanvasElement) { return new RawImage(c.width, c.height); } }
const tensor = (data: any, dims: number[]) => ({ data, dims });
export const AutoProcessor = {
  async from_pretrained() {
    const proc: any = async (img: RawImage) => ({ pixel_values: null, original_sizes: [[img.height, img.width]], reshaped_input_sizes: [[img.height, img.width]] });
    proc.reshape_input_points = (pts: number[][][][]) => tensor(pts[0][0], [1, 1, pts[0][0].length, 2]);
    proc.add_input_labels = (labels: number[][][]) => tensor(labels[0][0], [1, 1, labels[0][0].length]);
    proc.post_process_masks = async (m: any, sizes: number[][]) => {
      const [h, w] = sizes[0];
      const data = new Uint8Array(3 * h * w);
      const { pts, labels } = m;
      for (let k = 0; k < 3; k++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let on = false;
        pts.forEach(([px, py]: number[], i: number) => {
          if ((x - px) ** 2 + (y - py) ** 2 < (Math.min(w, h) * 0.3) ** 2) on = labels[i] ? true : false;
        });
        data[k * h * w + y * w + x] = on ? 1 : 0;
      }
      return [tensor(data, [1, 3, h, w])];
    };
    return proc;
  },
};
export const SamModel = {
  async from_pretrained(_id: string, opts: any) {
    for (const p of [10, 60, 100]) opts.progress_callback?.({ status: "progress", file: "onnx/model.onnx", progress: p });
    const model: any = async (inp: any) => ({ pred_masks: { pts: inp.input_points.data, labels: inp.input_labels.data }, iou_scores: tensor(new Float32Array([0.5, 0.9, 0.7]), [1, 1, 3]) });
    model.get_image_embeddings = async () => ({});
    return model;
  },
};
