import { useMemo, useState } from "react";
import { Chips, Empty, ItemThumb, Sheet } from "../components.tsx";
import { CATEGORIES } from "../options.ts";
import { useStore } from "../store.tsx";
import type { Item } from "../types.ts";
import { Cutout } from "./Cutout.tsx";
import { ItemForm, type Draft } from "./ItemForm.tsx";

export function ItemEditor({ item, onClose }: { item: Item; onClose: () => void }) {
  const { saveItem, removeItem, toast } = useStore();
  const [draft, setDraft] = useState<Draft>(item);
  const [image, setImage] = useState(item.image);
  const [cutting, setCutting] = useState(false);
  if (cutting)
    return (
      <Sheet title="Recortar só a roupa" onClose={() => setCutting(false)}>
        <Cutout src={image} onDone={(d) => { setImage(d); setCutting(false); }} onSkip={() => setCutting(false)} />
      </Sheet>
    );
  return (
    <Sheet title="Editar peça" onClose={onClose}>
      <div className="preview"><img src={image} alt="" /></div>
      <button className="btn ghost block" onClick={() => setCutting(true)}>✂️ Recortar só a roupa</button>
      {item.link && (
        <a className="btn ghost block" href={item.link} target="_blank" rel="noreferrer">Abrir na loja ↗</a>
      )}
      <ItemForm value={draft} onChange={setDraft} />
      <button className="btn primary block" onClick={() => { saveItem({ ...item, ...draft, image }); toast("Peça atualizada"); onClose(); }}>
        Salvar
      </button>
      <button
        className="btn danger block"
        onClick={() => {
          if (confirm("Apagar esta peça? Os looks salvos com ela também somem.")) { removeItem(item.id); onClose(); }
        }}
      >
        Apagar peça
      </button>
    </Sheet>
  );
}

export function ItemsPage({ onAdd }: { onAdd: () => void }) {
  const { items } = useStore();
  const [cat, setCat] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>(["want", "bought"]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);

  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          (!cat.length || cat.includes(i.category)) &&
          (!status.length || status.includes(i.status)) &&
          (!q || `${i.name} ${i.store ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      ),
    [items, cat, status, q]
  );

  return (
    <div className="page">
      <header className="page-head">
        <h1>Minhas peças</h1>
        <p className="muted">{items.filter((i) => i.status === "want").length} na lista de desejos · {items.filter((i) => i.status === "bought").length} compradas</p>
      </header>
      {items.length === 0 ? (
        <Empty icon="🛍️" title="Nenhuma peça ainda">
          <p>Comece subindo os prints das roupas que você está de olho.</p>
          <button className="btn primary" onClick={onAdd}>Adicionar peças</button>
        </Empty>
      ) : (
        <>
          <input className="search" placeholder="Buscar por nome ou loja" value={q} onChange={(e) => setQ(e.target.value)} />
          <Chips options={CATEGORIES.map((c) => ({ id: c.id, label: c.plural }))} value={cat} onChange={setCat} />
          <Chips
            options={[{ id: "want", label: "Quero" }, { id: "bought", label: "Comprei" }, { id: "discarded", label: "Descartei" }]}
            value={status}
            onChange={setStatus}
          />
          <div className="grid">
            {shown.map((i) => <ItemThumb key={i.id} item={i} onClick={() => setEditing(i)} />)}
          </div>
          {!shown.length && <p className="muted center">Nenhuma peça com esses filtros.</p>}
        </>
      )}
      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
