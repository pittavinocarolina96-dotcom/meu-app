import { useEffect, useRef, useState } from "react";
import { loadImage, toDataURL, trim } from "../image.ts";
import { applyMask, Cutter, type Point } from "../segment.ts";

/**
 * Tela "toque na roupa": o app já toca no meio da foto; você toca em outras partes da
 * peça para incluir, ou muda para "Tirar" e toca no que não é a roupa (braço, cabelo, outra peça).
 */
export function Cutout({ src, onDone, onSkip }: { src: string; onDone: (dataURL: string) => void; onSkip: () => void }) {
  const view = useRef<HTMLCanvasElement>(null);
  const [cutter, setCutter] = useState<Cutter | null>(null);
  const [status, setStatus] = useState("Preparando o recorte inteligente…");
  const [error, setError] = useState("");
  const [points, setPoints] = useState<Point[]>([]);
  const [mask, setMask] = useState<Uint8ClampedArray | null>(null);
  const [mode, setMode] = useState<"on" | "off">("on");
  const [busy, setBusy] = useState(true);

  // prepara a imagem e o modelo
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const img = await loadImage(src);
        const k = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        const cut = await Cutter.create(c, (pct) => alive && setStatus(`Baixando a IA de recorte (só na 1ª vez)… ${pct}%`));
        if (!alive) return;
        setStatus("");
        setCutter(cut);
        setPoints([{ x: c.width / 2, y: c.height / 2, on: true }]);
      } catch (e) {
        console.error(e);
        if (alive) { setError("Não consegui carregar o recorte inteligente. Verifique a internet e tente de novo."); setBusy(false); }
      }
    })();
    return () => { alive = false; };
  }, [src]);

  // recalcula a máscara a cada toque
  useEffect(() => {
    if (!cutter || !points.length) return;
    let alive = true;
    setBusy(true);
    cutter.mask(points).then(
      (m) => { if (alive) { setMask(m); setBusy(false); } },
      (e) => { console.error(e); if (alive) { setError("O recorte falhou nesta foto."); setBusy(false); } }
    );
    return () => { alive = false; };
  }, [cutter, points]);

  // desenha: foto, área fora da peça escurecida, e os toques
  useEffect(() => {
    const cv = view.current;
    if (!cv || !cutter) return;
    const { src: s } = cutter;
    cv.width = s.width; cv.height = s.height;
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(s, 0, 0);
    if (mask) {
      const img = ctx.getImageData(0, 0, s.width, s.height);
      for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) {
          img.data[i * 4] = img.data[i * 4] * 0.25 + 10;
          img.data[i * 4 + 1] = img.data[i * 4 + 1] * 0.25 + 8;
          img.data[i * 4 + 2] = img.data[i * 4 + 2] * 0.25 + 6;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    const r = Math.max(8, s.width / 45);
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.on ? "#3fae6a" : "#d0453f";
      ctx.fill();
      ctx.lineWidth = r / 3;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillRect(p.x - r / 2, p.y - r / 8, r, r / 4);
      if (p.on) ctx.fillRect(p.x - r / 8, p.y - r / 2, r / 4, r);
    }
  }, [cutter, mask, points]);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!cutter || busy) return;
    const b = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * cutter.src.width;
    const y = ((e.clientY - b.top) / b.height) * cutter.src.height;
    setPoints([...points, { x, y, on: mode === "on" }]);
  };

  const done = () => {
    if (!cutter || !mask) return;
    const { canvas, coverage } = applyMask(cutter.src, mask);
    if (coverage < 0.01) { setError("Quase nada ficou selecionado. Toque em cima da roupa."); return; }
    onDone(toDataURL(trim(canvas), true));
  };

  if (error && !cutter)
    return (
      <div className="cutout">
        <div className="banner warn">{error}</div>
        <button className="btn ghost block" onClick={onSkip}>Continuar sem recortar</button>
      </div>
    );

  return (
    <div className="cutout">
      <p className="muted small">
        Toque na <b>roupa</b> para incluir. Se pegou algo a mais (braço, cabelo, outra peça), escolha <b>Tirar</b> e toque em cima.
      </p>
      <div className="cutout-view">
        {!cutter && <div className="cutout-loading">{status}</div>}
        <canvas ref={view} onPointerDown={tap} style={{ display: cutter ? "block" : "none" }} />
        {busy && cutter && <div className="cutout-busy">recortando…</div>}
      </div>
      {error && <div className="banner warn">{error}</div>}
      <div className="cutout-tools">
        <div className="segmented small-seg">
          <button className={mode === "on" ? "on" : ""} onClick={() => setMode("on")}>＋ Incluir</button>
          <button className={mode === "off" ? "on" : ""} onClick={() => setMode("off")}>－ Tirar</button>
        </div>
        <button className="btn ghost" disabled={points.length <= 1 || busy} onClick={() => setPoints(points.slice(0, -1))}>Desfazer</button>
      </div>
      <button className="btn primary block" disabled={!mask || busy} onClick={done}>Pronto, é essa a peça</button>
      <button className="btn ghost block" onClick={onSkip}>Usar a foto sem recortar</button>
    </div>
  );
}
