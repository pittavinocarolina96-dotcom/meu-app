import { useEffect, useRef, useState } from "react";
import { clearCrash, clearStage, lastCrash } from "../diag.ts";
import { loadImage, toDataURL, trim } from "../image.ts";
import { applyMask, Cutter, keepLargestParts, type Point } from "../segment.ts";

type Tool = "magic" | "brush" | "eraser";
interface Stroke { erase: boolean; r: number; pts: [number, number][] }
type Action = { kind: "point" } | { kind: "stroke" };

const SIZES = [
  { id: "s", label: "Fino", k: 0.012 },
  { id: "m", label: "Médio", k: 0.025 },
  { id: "l", label: "Grosso", k: 0.05 },
];

/** Pinta um círculo na máscara (255 = roupa, 0 = fora). */
function dab(mask: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, r: number, v: number) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) mask[y * w + x] = v;
}

/** Traço de A até B, com círculos bem juntinhos para não deixar falhas. */
function line(mask: Uint8ClampedArray, w: number, h: number, a: [number, number], b: [number, number], r: number, v: number) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(d / Math.max(1, r / 3)));
  for (let i = 0; i <= n; i++) dab(mask, w, h, a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, r, v);
}

function applyStroke(mask: Uint8ClampedArray, w: number, h: number, s: Stroke) {
  const v = s.erase ? 0 : 255;
  if (s.pts.length === 1) dab(mask, w, h, s.pts[0][0], s.pts[0][1], s.r, v);
  for (let i = 1; i < s.pts.length; i++) line(mask, w, h, s.pts[i - 1], s.pts[i], s.r, v);
}

/**
 * Recorte da peça: a IA faz o primeiro recorte sozinha (✨ Mágica). Depois você ajusta com
 * 🖌️ Pincel (pinta o que é roupa) e 🧽 Borracha (apaga braço, alça, bolsa…).
 */
export function Cutout({ src, onDone, onSkip }: { src: string; onDone: (dataURL: string) => void; onSkip: () => void }) {
  const view = useRef<HTMLCanvasElement>(null);
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [cutter, setCutter] = useState<Cutter | null>(null);
  const [ai, setAi] = useState<"loading" | "ready" | "off">("loading");
  const [status, setStatus] = useState("Preparando o recorte inteligente…");
  const [note, setNote] = useState("");
  const [points, setPoints] = useState<Point[]>([]);
  const [aiMask, setAiMask] = useState<Uint8ClampedArray | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [history, setHistory] = useState<Action[]>([]);
  const [tool, setTool] = useState<Tool>("magic");
  const [size, setSize] = useState("m");
  const [busy, setBusy] = useState(false);
  const [crashed] = useState(lastCrash);
  const [choice, setChoice] = useState<"ai" | "manual" | null>(crashed ? null : "ai");

  const work = useRef<Uint8ClampedArray | null>(null); // máscara atual (IA + traços)
  const drawing = useRef<Stroke | null>(null);
  const frame = useRef(0);

  // carrega a foto
  useEffect(() => {
    let alive = true;
    loadImage(src).then((img) => {
      if (!alive) return;
      const k = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      setBase(c);
    });
    return () => { alive = false; };
  }, [src]);

  // prepara a IA (ou o modo só à mão)
  useEffect(() => {
    if (!base || !choice) return;
    if (choice === "manual") { manualOnly(""); return; }
    let alive = true;
    setAi("loading");
    Cutter.create(base, (pct) => alive && setStatus(`Baixando a IA de recorte (só na 1ª vez)… ${pct}%`)).then(
      (cut) => {
        if (!alive) return;
        setCutter(cut);
        setAi("ready");
        setPoints([{ x: base.width / 2, y: base.height / 2, on: true }]);
      },
      (e) => {
        console.error(e);
        clearStage();
        if (alive) manualOnly(`A IA de recorte não carregou (${(e as Error)?.message || e}). Use a borracha para apagar o que não é roupa.`);
      }
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, choice]);

  function manualOnly(msg: string) {
    setAi("off");
    setNote(msg || "Sem IA: a foto toda está selecionada. Use a borracha para apagar o que não é roupa.");
    setAiMask(new Uint8ClampedArray(base!.width * base!.height).fill(255));
    setTool("eraser");
  }

  // recorte da IA a cada toque mágico
  useEffect(() => {
    if (!cutter || !base || !points.length) return;
    let alive = true;
    setBusy(true);
    cutter.mask(points).then(
      (m) => {
        if (!alive) return;
        keepLargestParts(m, base.width, base.height);
        setAiMask(m);
        setBusy(false);
      },
      (e) => { console.error(e); clearStage(); if (alive) { setNote(`O recorte automático falhou (${(e as Error)?.message || e}). Use pincel e borracha.`); setBusy(false); } }
    );
    return () => { alive = false; };
  }, [cutter, base, points]);

  // máscara = IA + todos os traços, na ordem
  useEffect(() => {
    if (!base || !aiMask) return;
    const m = aiMask.slice();
    for (const s of strokes) applyStroke(m, base.width, base.height, s);
    work.current = m;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, aiMask, strokes, tool]);

  function draw() {
    const cv = view.current, m = work.current;
    if (!cv || !base) return;
    if (cv.width !== base.width) { cv.width = base.width; cv.height = base.height; }
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(base, 0, 0);
    if (m) {
      const img = ctx.getImageData(0, 0, base.width, base.height);
      const d = img.data;
      for (let i = 0; i < m.length; i++) {
        if (!m[i]) { d[i * 4] = d[i * 4] * 0.22 + 12; d[i * 4 + 1] = d[i * 4 + 1] * 0.22 + 10; d[i * 4 + 2] = d[i * 4 + 2] * 0.22 + 8; }
      }
      ctx.putImageData(img, 0, 0);
    }
    if (tool === "magic") {
      const r = Math.max(7, base.width / 55);
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = p.on ? "#3fae6a" : "#d0453f";
        ctx.fill();
        ctx.lineWidth = r / 3;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      }
    }
  }

  const radius = () => (SIZES.find((s) => s.id === size)!.k) * Math.max(base?.width ?? 0, base?.height ?? 0);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const b = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - b.left) / b.width) * base!.width, ((e.clientY - b.top) / b.height) * base!.height];
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!base || !work.current) return;
    const p = pos(e);
    if (tool === "magic") {
      if (!cutter || busy) return;
      setPoints([...points, { x: p[0], y: p[1], on: true }]);
      setHistory([...history, { kind: "point" }]);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const s: Stroke = { erase: tool === "eraser", r: radius(), pts: [p] };
    drawing.current = s;
    applyStroke(work.current, base.width, base.height, s);
    draw();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = drawing.current;
    if (!s || !base || !work.current) return;
    const p = pos(e);
    line(work.current, base.width, base.height, s.pts[s.pts.length - 1], p, s.r, s.erase ? 0 : 255);
    s.pts.push(p);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(draw);
  };
  const up = () => {
    const s = drawing.current;
    if (!s) return;
    drawing.current = null;
    setStrokes((st) => [...st, s]);
    setHistory((h) => [...h, { kind: "stroke" }]);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory(history.slice(0, -1));
    if (last.kind === "stroke") setStrokes(strokes.slice(0, -1));
    else setPoints(points.slice(0, -1));
  };

  const done = () => {
    if (!base || !work.current) return;
    clearCrash();
    const { canvas, coverage } = applyMask(base, work.current);
    if (coverage < 0.01) { setNote("Quase nada ficou selecionado. Use o pincel para pintar a roupa."); return; }
    onDone(toDataURL(trim(canvas), true));
  };

  if (!choice)
    return (
      <div className="cutout">
        <div className="banner warn">
          Da última vez a IA de recorte fechou o app na etapa “{crashed}”. Isso costuma ser falta de memória no celular.
          Abrir o LookLab direto no Safari (ou pelo ícone na tela de início) ajuda.
        </div>
        <button className="btn primary block" onClick={() => { clearCrash(); setChoice("manual"); }}>Recortar à mão (pincel e borracha)</button>
        <button className="btn ghost block" onClick={() => { clearCrash(); setChoice("ai"); }}>Tentar a IA de recorte de novo</button>
        <button className="btn ghost block" onClick={onSkip}>Usar a foto sem recortar</button>
      </div>
    );

  const ready = !!aiMask;
  return (
    <div className="cutout">
      <div className="tools">
        {ai !== "off" && (
          <button className={`tool ${tool === "magic" ? "on" : ""}`} onClick={() => setTool("magic")}>✨<span>Mágica</span></button>
        )}
        <button className={`tool ${tool === "brush" ? "on" : ""}`} onClick={() => setTool("brush")}>🖌️<span>Pincel</span></button>
        <button className={`tool ${tool === "eraser" ? "on" : ""}`} onClick={() => setTool("eraser")}>🧽<span>Borracha</span></button>
        <button className="tool" disabled={!history.length || busy} onClick={undo}>↩️<span>Desfazer</span></button>
      </div>
      <p className="muted small hint">
        {tool === "magic" && "A IA já recortou a roupa. Se faltou um pedaço grande, toque nele. Para ajustes finos, use pincel e borracha."}
        {tool === "brush" && "Pinte por cima do que é roupa e ficou escuro."}
        {tool === "eraser" && "Passe por cima do que não é roupa (braço, cabide, bolsa, outra peça)."}
      </p>
      {/* sempre ocupa o espaço, para a foto não "pular" ao trocar de ferramenta */}
      <div className="chips sizes" style={{ visibility: tool === "magic" ? "hidden" : "visible" }}>
        <span className="muted small">Tamanho:</span>
        {SIZES.map((s) => (
          <button key={s.id} className={`chip ${size === s.id ? "on" : ""}`} onClick={() => setSize(s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="cutout-view">
        {!ready && <div className="cutout-loading">{status}</div>}
        <canvas
          ref={view}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ display: ready ? "block" : "none" }}
          className={tool === "magic" ? "" : "painting"}
        />
        {busy && <div className="cutout-busy">recortando…</div>}
      </div>
      {note && <div className="banner warn">{note}</div>}
      <button className="btn primary block" disabled={!ready || busy} onClick={done}>Pronto, é essa a peça</button>
      <button className="btn ghost block" onClick={onSkip}>Usar a foto sem recortar</button>
    </div>
  );
}
