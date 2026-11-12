import { useEffect, useRef, useState, type ReactNode } from "react";
import { COLORS, colorById } from "./colors.ts";
import type { Rect } from "./image.ts";
import type { Item, LookItems } from "./types.ts";

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Swatch({ id, size = 14 }: { id: string; size?: number }) {
  const c = colorById(id);
  return <span className="swatch" style={{ width: size, height: size, background: c?.hex ?? "#ccc" }} title={c?.label} />;
}

/** Colagem do look, estilo moodboard. */
export function Collage({ look, items, small }: { look: LookItems; items: Map<string, Item>; small?: boolean }) {
  const g = (id?: string) => (id ? items.get(id) : undefined);
  const top = g(look.top), bottom = g(look.bottom), outer = g(look.outer), shoes = g(look.shoes);
  const accs = look.accessories.map(g).filter(Boolean) as Item[];
  const tint = colorById(top?.colors[0] ?? "bege")?.hex ?? "#d8c3a0";
  const bg = tint.startsWith("#") ? `radial-gradient(circle at 70% 25%, ${tint}22, transparent 60%), var(--card-2)` : "var(--card-2)";
  return (
    <div className={`collage ${outer ? "has-outer" : ""} ${small ? "small" : ""}`} style={{ background: bg }}>
      {outer && <img className="c-outer" src={outer.image} alt={outer.name} />}
      {bottom && <img className="c-bottom" src={bottom.image} alt={bottom.name} />}
      {top && <img className="c-top" src={top.image} alt={top.name} />}
      {shoes && <img className="c-shoes" src={shoes.image} alt={shoes.name} />}
      {accs.slice(0, 2).map((a, i) => (
        <img key={a.id} className={`c-acc c-acc-${i}`} src={a.image} alt={a.name} />
      ))}
    </div>
  );
}

export function Chips({
  options, value, onChange, single,
}: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            className={`chip ${on ? "on" : ""}`}
            onClick={() => onChange(single ? (on ? [] : [o.id]) : on ? value.filter((x) => x !== o.id) : [...value, o.id])}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ColorPicker({ value, onChange, max = 3 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div className="colors">
      {COLORS.map((c) => {
        const idx = value.indexOf(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={`color ${idx >= 0 ? "on" : ""}`}
            onClick={() => onChange(idx >= 0 ? value.filter((x) => x !== c.id) : [...value, c.id].slice(-max))}
            title={c.label}
          >
            <span className="dot" style={{ background: c.hex }} />
            <span className="lbl">{c.label}</span>
            {idx === 0 && max > 1 && <span className="main">principal</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/** Retângulo arrastável para recortar só a peça do print. */
export function CropEditor({ src, rect, onChange }: { src: string; rect: Rect; onChange: (r: Rect) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: string; sx: number; sy: number; r: Rect } | null>(null);
  const [, force] = useState(0);

  const start = (mode: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, r: rect };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !box.current) return;
    const b = box.current.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / b.width, dy = (e.clientY - d.sy) / b.height;
    let { x, y, w, h } = d.r;
    const min = 0.08;
    if (d.mode === "move") {
      x = Math.min(Math.max(0, x + dx), 1 - w);
      y = Math.min(Math.max(0, y + dy), 1 - h);
    } else {
      if (d.mode.includes("l")) { const nx = Math.min(Math.max(0, x + dx), x + w - min); w += x - nx; x = nx; }
      if (d.mode.includes("r")) w = Math.min(Math.max(min, w + dx), 1 - x);
      if (d.mode.includes("t")) { const ny = Math.min(Math.max(0, y + dy), y + h - min); h += y - ny; y = ny; }
      if (d.mode.includes("b")) h = Math.min(Math.max(min, h + dy), 1 - y);
    }
    onChange({ x, y, w, h });
    force((n) => n + 1);
  };
  const end = () => { drag.current = null; };
  const pct = (n: number) => `${n * 100}%`;
  return (
    <div className="crop" ref={box} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <img src={src} alt="" draggable={false} />
      <div
        className="crop-rect"
        style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
        onPointerDown={start("move")}
      >
        {["tl", "tr", "bl", "br"].map((m) => (
          <span key={m} className={`handle ${m}`} onPointerDown={start(m)} />
        ))}
      </div>
    </div>
  );
}

export function ItemThumb({ item, onClick, badge }: { item: Item; onClick?: () => void; badge?: ReactNode }) {
  return (
    <button className={`thumb status-${item.status}`} onClick={onClick} type="button">
      <div className="thumb-img"><img src={item.image} alt={item.name} loading="lazy" /></div>
      <div className="thumb-info">
        <span className="thumb-name">{item.name || "Sem nome"}</span>
        <span className="thumb-meta">
          {item.colors.slice(0, 3).map((c) => <Swatch key={c} id={c} size={10} />)}
          {item.price ? <b>{brl(item.price)}</b> : <i>sem preço</i>}
        </span>
      </div>
      {item.status === "bought" && <span className="tag tag-bought">comprei</span>}
      {item.status === "discarded" && <span className="tag tag-disc">descartei</span>}
      {badge}
    </button>
  );
}
