import { useMemo, useState } from "react";
import { brl, Chips, Collage, Empty, Sheet, Swatch } from "../components.tsx";
import { activeItems, generateLooks, lookItemIds, lookKey, scoreItems, type Filters } from "../engine.ts";
import { catLabel, OCCASIONS, SEASONS } from "../options.ts";
import { uid, useStore } from "../store.tsx";
import type { Item, LookItems, SavedLook } from "../types.ts";

const pct = (s: number) => `${Math.round(Math.min(1, s) * 100)}%`;

function missingCost(look: LookItems, map: Map<string, Item>) {
  return lookItemIds(look).reduce((s, id) => {
    const it = map.get(id);
    return it && it.status === "want" ? s + (it.price ?? 0) : s;
  }, 0);
}

function LookCard({
  look, map, score, title, saved, onOpen, onToggleSave,
}: {
  look: LookItems; map: Map<string, Item>; score?: number; title?: string; saved: boolean;
  onOpen: () => void; onToggleSave: () => void;
}) {
  const cost = missingCost(look, map);
  return (
    <div className="look-card">
      <button className="look-open" onClick={onOpen} aria-label="Ver look">
        <Collage look={look} items={map} />
      </button>
      <button className={`heart ${saved ? "on" : ""}`} onClick={onToggleSave} aria-label={saved ? "Remover dos salvos" : "Salvar look"}>
        {saved ? "♥" : "♡"}
      </button>
      <div className="look-info">
        {title && <b className="look-title">{title}</b>}
        <span className="look-meta">
          {score !== undefined && <span className="match">combina {pct(score)}</span>}
          {cost > 0 ? <span>falta {brl(cost)}</span> : <span className="owned">já tenho tudo</span>}
        </span>
      </div>
    </div>
  );
}

function LookDetail({ look, onClose, onEdit }: { look: SavedLook | (LookItems & { id?: string }); onClose: () => void; onEdit: () => void }) {
  const { items, looks, saveLook, removeLook, saveItem, toast } = useStore();
  const map = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const savedMatch = looks.find((l) => lookKey(l) === lookKey(look));
  const pieces = lookItemIds(look).map((id) => map.get(id)).filter(Boolean) as Item[];
  const total = pieces.reduce((s, p) => s + (p.price ?? 0), 0);
  const cost = missingCost(look, map);
  const note = "note" in look ? look.note : savedMatch?.note;
  return (
    <Sheet title={("title" in look && look.title) || savedMatch?.title || "Look"} onClose={onClose}>
      <div className="detail-collage"><Collage look={look} items={map} /></div>
      {note && <p className="ai-note">✨ {note}</p>}
      <div className="pieces">
        {pieces.map((p) => (
          <div key={p.id} className="piece">
            <img src={p.image} alt="" />
            <div className="piece-info">
              <b>{p.name}</b>
              <span className="muted">
                {catLabel(p.category)} · {p.colors.slice(0, 2).map((c) => <Swatch key={c} id={c} size={10} />)}{" "}
                {p.price ? brl(p.price) : "sem preço"}
              </span>
              <span className="piece-actions">
                {p.link && <a href={p.link} target="_blank" rel="noreferrer">Ver na loja ↗</a>}
                {p.status === "want" && (
                  <button className="link-btn" onClick={() => { saveItem({ ...p, status: "bought" }); toast("Marcada como comprada"); }}>
                    Marcar como comprei
                  </button>
                )}
                {p.status === "bought" && <span className="tag tag-bought inline">comprei</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="totals">
        <span>Look completo: <b>{brl(total)}</b></span>
        <span>Falta comprar: <b>{brl(cost)}</b></span>
      </div>
      <div className="row-gap">
        {savedMatch ? (
          <button className="btn ghost" onClick={() => { removeLook(savedMatch.id); toast("Removido dos salvos"); onClose(); }}>Remover dos salvos</button>
        ) : (
          <button className="btn primary" onClick={() => { saveLook({ ...look, id: uid(), source: "auto", createdAt: Date.now() }); toast("Look salvo ♥"); }}>Salvar look</button>
        )}
        <button className="btn ghost" onClick={onEdit}>Editar peças</button>
      </div>
    </Sheet>
  );
}

/** Montar look à mão (ou ajustar um existente). */
export function Builder({ initial, onClose }: { initial?: Partial<SavedLook>; onClose: () => void }) {
  const { items, profile, saveLook, toast } = useStore();
  const act = activeItems(items);
  const map = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const of = (c: Item["category"]) => act.filter((i) => i.category === c);
  const [look, setLook] = useState<LookItems>({
    top: initial?.top ?? of("top")[0]?.id ?? "",
    bottom: initial?.bottom ?? of("bottom")[0]?.id ?? "",
    outer: initial?.outer, shoes: initial?.shoes, accessories: initial?.accessories ?? [],
  });
  const [title, setTitle] = useState(initial?.title ?? "");
  const chosen = lookItemIds(look).map((id) => map.get(id)).filter(Boolean) as Item[];
  const score = chosen.length >= 2 ? scoreItems(chosen, profile) : 0;

  // função (não componente) para não remontar e perder a rolagem a cada toque
  const row = (cat: Item["category"], optional?: boolean) => {
    const list = of(cat);
    const key = cat === "accessory" ? "accessories" : (cat as "top" | "bottom" | "outer" | "shoes");
    const isOn = (id: string) => (cat === "accessory" ? look.accessories.includes(id) : look[key as "top"] === id);
    const toggle = (id: string) => {
      if (cat === "accessory")
        setLook({ ...look, accessories: isOn(id) ? look.accessories.filter((a) => a !== id) : [...look.accessories, id] });
      else if (optional && isOn(id)) setLook({ ...look, [key]: undefined });
      else setLook({ ...look, [key]: id });
    };
    return (
      <div className="pick-row" key={cat}>
        <h4>{catLabel(cat)}{optional && <small> · opcional</small>}</h4>
        {list.length === 0 ? (
          <p className="muted small">Nenhuma peça desse tipo ainda.</p>
        ) : (
          <div className="pick-scroll">
            {list.map((i) => (
              <button key={i.id} className={`pick ${isOn(i.id) ? "on" : ""}`} onClick={() => toggle(i.id)}>
                <img src={i.image} alt={i.name} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const canSave = look.top && look.bottom;
  return (
    <Sheet title="Montar look" onClose={onClose}>
      <div className="builder-top">
        <div className="builder-collage"><Collage look={look} items={map} small /></div>
        <div className="builder-score">
          {canSave ? (
            <>
              <span className="big">{pct(score)}</span>
              <span className="muted">{score >= 0.75 ? "Combina muito!" : score >= 0.55 ? "Combina" : score > 0 ? "Arriscado" : "Ocasião/clima não batem"}</span>
            </>
          ) : (
            <span className="muted">Escolha uma parte de cima e uma de baixo</span>
          )}
        </div>
      </div>
      {row("top")}
      {row("bottom")}
      {row("outer", true)}
      {row("shoes", true)}
      {row("accessory", true)}
      <label className="field">
        <span>Nome do look (opcional)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Sexta no escritório" />
      </label>
      <button
        className="btn primary block"
        disabled={!canSave}
        onClick={() => {
          saveLook({ ...look, id: initial?.id ?? uid(), title: title.trim() || undefined, note: initial?.note, source: initial?.source ?? "manual", createdAt: initial?.createdAt ?? Date.now() });
          toast("Look salvo ♥");
          onClose();
        }}
      >
        Salvar look
      </button>
    </Sheet>
  );
}

function AskAI({ onClose }: { onClose: () => void }) {
  const { items, profile, settings, saveLook, toast } = useStore();
  const [req, setReq] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async () => {
    setBusy(true);
    setErr("");
    try {
      const { suggestLooks } = await import("../ai.ts");
      const res = await suggestLooks(settings, activeItems(items), profile, req);
      res.forEach((l, i) => saveLook({ ...l, note: l.why, id: uid(), source: "ia", createdAt: Date.now() + i }));
      toast(`${res.length} looks da IA salvos ✨`);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Pedir looks à IA" onClose={onClose}>
      <p className="muted">A IA olha todas as suas peças e monta looks explicando por que combinam. Os looks vão para a aba <b>Salvos</b>.</p>
      <label className="field">
        <span>O que você precisa? (opcional)</span>
        <textarea
          rows={3}
          value={req}
          onChange={(e) => setReq(e.target.value)}
          placeholder="Ex.: 5 looks para trabalho no calor, um deles para happy hour"
        />
      </label>
      {err && <div className="banner warn">{err}</div>}
      <button className="btn primary block" onClick={run} disabled={busy}>{busy ? "A IA está montando… (até 1 min)" : "Montar looks ✨"}</button>
    </Sheet>
  );
}

export function LooksPage({ onAdd, goProfile }: { onAdd: () => void; goProfile: () => void }) {
  const { items, looks, profile, settings, saveLook, removeLook, toast } = useStore();
  const [tab, setTab] = useState<"auto" | "saved">("auto");
  const [filters, setFilters] = useState<Filters>({});
  const [open, setOpen] = useState<(LookItems & { id?: string }) | null>(null);
  const [building, setBuilding] = useState<Partial<SavedLook> | null>(null);
  const [asking, setAsking] = useState(false);
  const [limit, setLimit] = useState(24);

  const map = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const auto = useMemo(() => generateLooks(items, profile, filters), [items, profile, filters]);
  const savedKeys = useMemo(() => new Map(looks.map((l) => [lookKey(l), l.id])), [looks]);
  const savedShown = looks.filter((l) => lookItemIds(l).every((id) => map.has(id) && map.get(id)!.status !== "discarded"));

  const act = activeItems(items);
  const tops = act.filter((i) => i.category === "top").length, bottoms = act.filter((i) => i.category === "bottom").length;

  const toggle = (l: LookItems) => {
    const id = savedKeys.get(lookKey(l));
    if (id) { removeLook(id); toast("Removido dos salvos"); }
    else { saveLook({ ...l, id: uid(), source: "auto", createdAt: Date.now() }); toast("Look salvo ♥"); }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="brand">LookLab</h1>
        <p className="muted">Looks com as peças que você quer comprar</p>
      </header>

      {tops === 0 || bottoms === 0 ? (
        <Empty icon="👚" title="Vamos montar seus looks">
          <p>
            Adicione pelo menos <b>uma parte de cima</b> e <b>uma de baixo</b>
            {items.length > 0 && <> (agora: {tops} de cima, {bottoms} de baixo)</>}.
          </p>
          <button className="btn primary" onClick={onAdd}>Adicionar peças</button>
        </Empty>
      ) : (
        <>
          <div className="actions-row">
            <button className="btn ghost" onClick={() => setBuilding({})}>✋ Montar à mão</button>
            {settings.apiKey ? (
              <button className="btn ghost" onClick={() => setAsking(true)}>✨ Pedir à IA</button>
            ) : (
              <button className="btn ghost" onClick={goProfile}>✨ Ativar IA</button>
            )}
          </div>
          <div className="segmented">
            <button className={tab === "auto" ? "on" : ""} onClick={() => setTab("auto")}>Sugeridos ({auto.length})</button>
            <button className={tab === "saved" ? "on" : ""} onClick={() => setTab("saved")}>Salvos ({savedShown.length})</button>
          </div>

          {tab === "auto" && (
            <>
              <div className="filters">
                <Chips single options={OCCASIONS} value={filters.occasion ? [filters.occasion] : []} onChange={(v) => setFilters({ ...filters, occasion: v[0] })} />
                <Chips single options={SEASONS} value={filters.season ? [filters.season] : []} onChange={(v) => setFilters({ ...filters, season: v[0] })} />
              </div>
              {auto.length === 0 ? (
                <Empty icon="🤔" title="Nenhum look com esse filtro">
                  <p>Tente outro filtro ou adicione peças que combinem com essa ocasião.</p>
                </Empty>
              ) : (
                <div className="looks-grid">
                  {auto.slice(0, limit).map((l) => (
                    <LookCard key={l.key} look={l} map={map} score={l.score} saved={savedKeys.has(l.key)} onOpen={() => setOpen(l)} onToggleSave={() => toggle(l)} />
                  ))}
                </div>
              )}
              {auto.length > limit && <button className="btn ghost block" onClick={() => setLimit(limit + 24)}>Ver mais looks</button>}
            </>
          )}

          {tab === "saved" &&
            (savedShown.length === 0 ? (
              <Empty icon="♡" title="Nenhum look salvo">
                <p>Toque no coração dos looks sugeridos, monte um à mão ou peça à IA.</p>
              </Empty>
            ) : (
              <div className="looks-grid">
                {savedShown.map((l) => (
                  <LookCard key={l.id} look={l} map={map} title={l.title ?? (l.source === "ia" ? "Sugestão da IA" : undefined)} saved onOpen={() => setOpen(l)} onToggleSave={() => { removeLook(l.id); toast("Removido dos salvos"); }} />
                ))}
              </div>
            ))}
        </>
      )}

      {open && (
        <LookDetail
          look={open}
          onClose={() => setOpen(null)}
          onEdit={() => {
            const saved = looks.find((l) => lookKey(l) === lookKey(open));
            setBuilding(saved ?? { ...open, id: undefined });
            setOpen(null);
          }}
        />
      )}
      {building && <Builder initial={building} onClose={() => setBuilding(null)} />}
      {asking && <AskAI onClose={() => setAsking(false)} />}
    </div>
  );
}
