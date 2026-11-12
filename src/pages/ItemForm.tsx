import { useEffect, useState } from "react";
import { Chips, ColorPicker } from "../components.tsx";
import { CATEGORIES, OCCASIONS, SEASONS, STYLES } from "../options.ts";
import type { Item } from "../types.ts";

export type Draft = Omit<Item, "id" | "image" | "createdAt">;

export const emptyDraft = (): Draft => ({
  name: "", category: "top", colors: [], styles: [], occasions: [], seasons: [], status: "want",
});

export function ItemForm({ value, onChange }: { value: Draft; onChange: (d: Draft) => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="form">
      <label className="field">
        <span>Nome</span>
        <input value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Blusa canelada preta" />
      </label>
      <div className="field">
        <span>Tipo</span>
        <Chips single options={CATEGORIES} value={[value.category]} onChange={(v) => v[0] && set("category", v[0] as Item["category"])} />
      </div>
      <div className="field">
        <span>Cores <small>(até 3; a primeira é a principal)</small></span>
        <ColorPicker value={value.colors} onChange={(v) => set("colors", v)} />
      </div>
      <div className="row2">
        <label className="field">
          <span>Preço (R$)</span>
          <PriceInput value={value.price} onChange={(n) => set("price", n)} />
        </label>
        <label className="field">
          <span>Loja</span>
          <input value={value.store ?? ""} onChange={(e) => set("store", e.target.value)} placeholder="Shein" />
        </label>
      </div>
      <label className="field">
        <span>Link do produto</span>
        <input type="url" value={value.link ?? ""} onChange={(e) => set("link", e.target.value)} placeholder="Cole aqui o link (opcional)" />
      </label>
      <div className="field">
        <span>Ocasiões <small>(nenhuma = serve para tudo)</small></span>
        <Chips options={OCCASIONS} value={value.occasions} onChange={(v) => set("occasions", v)} />
      </div>
      <div className="field">
        <span>Clima <small>(nenhum = qualquer clima)</small></span>
        <Chips options={SEASONS} value={value.seasons} onChange={(v) => set("seasons", v)} />
      </div>
      <div className="field">
        <span>Estilo</span>
        <Chips options={STYLES} value={value.styles} onChange={(v) => set("styles", v)} />
      </div>
      <div className="field">
        <span>Situação</span>
        <Chips
          single
          options={[{ id: "want", label: "Quero" }, { id: "bought", label: "Comprei" }, { id: "discarded", label: "Descartei" }]}
          value={[value.status]}
          onChange={(v) => v[0] && set("status", v[0] as Item["status"])}
        />
      </div>
    </div>
  );
}

const fmt = (n?: number) => (n === undefined ? "" : n.toFixed(2).replace(".", ","));
export const parsePrice = (t: string) => {
  const n = parseFloat(t.replace(/\s|R\$/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
};

/** Guarda o texto digitado (com vírgula) e só converte para número por baixo. */
function PriceInput({ value, onChange }: { value?: number; onChange: (n?: number) => void }) {
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    if (parsePrice(text) !== value) setText(fmt(value)); // valor mudou por fora (ex.: IA)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={(e) => { setText(e.target.value); onChange(parsePrice(e.target.value)); }}
      placeholder="0,00"
    />
  );
}
