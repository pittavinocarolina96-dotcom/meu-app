import { useRef, useState } from "react";
import { nearestColor } from "../colors.ts";
import { CropEditor } from "../components.tsx";
import { cropResize, dominantColor, fileToDataURL, forAI, loadImage, toDataURL, type Rect } from "../image.ts";
import { Cutout } from "./Cutout.tsx";
import { uid, useStore } from "../store.tsx";
import { emptyDraft, ItemForm, type Draft } from "./ItemForm.tsx";

interface Current {
  src: string;
  img: HTMLImageElement;
  rect: Rect;
  cropped?: string; // foto recortada no retângulo
  preview?: string; // imagem final (só a peça)
  draft: Draft;
}

const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

export function AddPage({ onDone }: { onDone: () => void }) {
  const { settings, saveItem, toast } = useStore();
  const [queue, setQueue] = useState<File[]>([]);
  const [cur, setCur] = useState<Current | null>(null);
  const [step, setStep] = useState<"pick" | "crop" | "cut" | "details">("pick");
  const [aiState, setAiState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [aiMsg, setAiMsg] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const token = useRef(0);
  const hasAI = !!settings.apiKey;

  async function open(file: File) {
    const t = ++token.current;
    const src = await fileToDataURL(file);
    const img = await loadImage(src);
    setCur({ src, img, rect: FULL, draft: emptyDraft() });
    setStep("crop");
    setAiMsg("");
    if (!hasAI) { setAiState("idle"); return; }
    setAiState("busy");
    try {
      const { analyzeItem } = await import("../ai.ts");
      const a = await analyzeItem(settings, forAI(img));
      if (t !== token.current) return;
      const pad = 0.02;
      const b = a.box;
      const rect: Rect | null =
        b.w > 30 && b.h > 30
          ? {
              x: Math.max(0, b.x / 1000 - pad), y: Math.max(0, b.y / 1000 - pad),
              w: Math.min(1, (b.x + b.w) / 1000 + pad) - Math.max(0, b.x / 1000 - pad),
              h: Math.min(1, (b.y + b.h) / 1000 + pad) - Math.max(0, b.y / 1000 - pad),
            }
          : null;
      setCur((c) =>
        c && c.src === src
          ? {
              ...c,
              rect: rect ?? c.rect,
              draft: {
                ...c.draft, name: a.name, category: a.category as Draft["category"], colors: a.colors.slice(0, 3),
                styles: a.styles, occasions: a.occasions, seasons: a.seasons,
                price: a.price ?? undefined, store: a.store ?? undefined,
              },
            }
          : c
      );
      setAiState("done");
    } catch (e) {
      if (t !== token.current) return;
      setAiState("error");
      setAiMsg((e as Error).message);
    }
  }

  function pick(files: FileList | null) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setQueue(list.slice(1));
    open(list[0]);
  }

  function processCrop() {
    if (!cur) return;
    const c = cropResize(cur.img, cur.rect);
    setCur({ ...cur, cropped: toDataURL(c, false) });
    setStep("cut");
  }

  async function finishCut(dataURL: string) {
    if (!cur) return;
    const draft = { ...cur.draft };
    if (!draft.colors.length) {
      const img = await loadImage(dataURL);
      draft.colors = [nearestColor(dominantColor(cropResize(img, FULL, 200)))];
    }
    setCur((c) => (c ? { ...c, preview: dataURL, draft: c.draft.colors.length ? c.draft : draft } : c));
    setStep("details");
  }

  function save() {
    if (!cur?.preview) return;
    saveItem({ ...cur.draft, name: cur.draft.name.trim() || "Peça sem nome", id: uid(), image: cur.preview, createdAt: Date.now() });
    toast("Peça salva 👗");
    next();
  }

  function next() {
    token.current++;
    if (queue.length) {
      const [f, ...rest] = queue;
      setQueue(rest);
      open(f);
    } else {
      setCur(null);
      setStep("pick");
      setAiState("idle");
    }
  }

  if (step === "pick" || !cur) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Adicionar peças</h1>
          <p className="muted">Suba prints ou fotos das roupas que você quer comprar. Dá para escolher várias de uma vez.</p>
        </header>
        <button className="upload" onClick={() => fileInput.current?.click()}>
          <span className="upload-icon">＋</span>
          <b>Escolher prints da galeria</b>
          <small>{hasAI ? "A IA vai identificar tipo, cor e preço sozinha ✨" : "Você recorta a peça e marca tipo e cor"}</small>
        </button>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        <div className="tips">
          <h3>Dicas</h3>
          <ul>
            <li>Prints da página do produto funcionam bem: você recorta só a roupa no próximo passo.</li>
            <li>Fotos com fundo liso (branco ou cinza) ficam ótimas na colagem, porque o fundo sai.</li>
            <li>Cole o link do produto no cadastro para ir direto à loja na hora de comprar.</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head row-between">
        <button className="link-btn" onClick={() => (step === "details" ? setStep("cut") : step === "cut" ? setStep("crop") : next())}>
          ← {step === "details" ? "Recorte" : step === "cut" ? "Enquadrar" : queue.length ? "Pular" : "Cancelar"}
        </button>
        {queue.length > 0 && <span className="muted">mais {queue.length} na fila</span>}
      </header>

      {aiState === "busy" && <div className="banner">✨ A IA está analisando a peça…</div>}
      {aiState === "done" && step === "crop" && <div className="banner ok">✨ A IA encontrou a peça e preencheu os dados. Confira!</div>}
      {aiState === "error" && <div className="banner warn">{aiMsg} Você pode continuar à mão.</div>}

      {step === "crop" && (
        <>
          <h2 className="step-title">1. Enquadre a peça</h2>
          <p className="muted small">Arraste o retângulo em volta da roupa (sem os textos da loja).</p>
          <CropEditor src={cur.src} rect={cur.rect} onChange={(rect) => setCur({ ...cur, rect })} />
          <button className="btn primary block" onClick={processCrop}>Continuar</button>
        </>
      )}

      {step === "cut" && cur.cropped && (
        <>
          <h2 className="step-title">2. Toque na roupa</h2>
          <Cutout src={cur.cropped} onDone={finishCut} onSkip={() => finishCut(cur.cropped!)} />
        </>
      )}

      {step === "details" && cur.preview && (
        <>
          <h2 className="step-title">3. Confira os detalhes</h2>
          <div className="preview"><img src={cur.preview} alt="" /></div>
          {aiState === "busy" && <p className="muted center">Os campos serão preenchidos assim que a IA terminar.</p>}
          <ItemForm value={cur.draft} onChange={(draft) => setCur({ ...cur, draft })} />
          <button className="btn primary block" onClick={save}>Salvar peça</button>
          {!queue.length && (
            <button className="btn ghost block" onClick={() => { save(); onDone(); }}>Salvar e ver os looks</button>
          )}
        </>
      )}
    </div>
  );
}
