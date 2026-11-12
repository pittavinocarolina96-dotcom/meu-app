import { useMemo, useState } from "react";
import { brl, Empty, ItemThumb } from "../components.tsx";
import { optimizeBudget, rankItems, type BudgetResult } from "../engine.ts";
import { useStore } from "../store.tsx";
import type { Item } from "../types.ts";
import { parsePrice } from "./ItemForm.tsx";
import { ItemEditor } from "./ItemsPage.tsx";

export function ShopPage({ onAdd }: { onAdd: () => void }) {
  const { items, profile, saveItem, toast } = useStore();
  const [budget, setBudget] = useState("");
  const [result, setResult] = useState<BudgetResult | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const rank = useMemo(() => rankItems(items, profile), [items, profile]);
  const want = rank.filter((r) => r.item.status === "want");
  const total = want.reduce((s, r) => s + (r.item.price ?? 0), 0);
  const maxLooks = Math.max(1, ...want.map((r) => r.looks));
  const orphans = want.filter((r) => r.looks === 0);

  if (!want.length)
    return (
      <div className="page">
        <header className="page-head"><h1>Comprar</h1></header>
        <Empty icon="🧾" title="Sua lista de desejos está vazia">
          <p>Adicione peças marcadas como “Quero” para ver o ranking e montar o carrinho ideal.</p>
          <button className="btn primary" onClick={onAdd}>Adicionar peças</button>
        </Empty>
      </div>
    );

  const run = () => {
    const v = parsePrice(budget) ?? 0;
    if (!(v > 0)) { toast("Digite um valor de orçamento"); return; }
    setResult(optimizeBudget(items, profile, v));
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Comprar</h1>
        <p className="muted">{want.length} peças na lista · {brl(total)} no total</p>
      </header>

      <section className="card">
        <h2>💰 Carrinho ideal</h2>
        <p className="muted">Quanto você quer gastar? O app escolhe as peças que formam <b>mais looks por real</b>. O que você já comprou entra de graça.</p>
        <div className="budget-row">
          <span className="prefix">R$</span>
          <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="300" onKeyDown={(e) => e.key === "Enter" && run()} />
          <button className="btn primary" onClick={run}>Calcular</button>
        </div>
        {result && (
          <div className="budget-result">
            {result.chosen.length === 0 ? (
              <p>Nenhuma combinação cabe nesse valor. Tente um orçamento maior.</p>
            ) : (
              <>
                <div className="stats">
                  <div><b>{result.looks}</b><span>looks</span></div>
                  <div><b>{brl(result.spent)}</b><span>gasto</span></div>
                  <div><b>{result.looks ? brl(result.spent / result.looks) : "–"}</b><span>por look</span></div>
                </div>
                <div className="grid">
                  {result.chosen.map((i) => <ItemThumb key={i.id} item={i} onClick={() => setEditing(i)} />)}
                </div>
                <button
                  className="btn ghost block"
                  onClick={() => {
                    result.chosen.forEach((i) => saveItem({ ...i, status: "bought" }));
                    toast("Marcadas como compradas 🎉");
                    setResult(null);
                  }}
                >
                  Comprei tudo isso
                </button>
              </>
            )}
            {result.noPrice.length > 0 && (
              <p className="muted small">{result.noPrice.length} peça(s) sem preço ficaram de fora. Coloque o preço para entrarem no cálculo.</p>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>🏆 Peças mais versáteis</h2>
        <p className="muted">Quantos looks cada peça forma com o resto da lista.</p>
        <ol className="rank">
          {want.filter((r) => r.looks > 0).map((r) => (
            <li key={r.item.id} onClick={() => setEditing(r.item)}>
              <img src={r.item.image} alt="" />
              <div className="rank-info">
                <b>{r.item.name}</b>
                <div className="bar"><span style={{ width: `${(r.looks / maxLooks) * 100}%` }} /></div>
                <span className="muted small">
                  {r.looks} look{r.looks > 1 ? "s" : ""}
                  {r.item.price ? ` · ${brl(r.item.price)} · ${brl(r.item.price / r.looks)}/look` : " · sem preço"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {orphans.length > 0 && (
        <section className="card warn-card">
          <h2>⚠️ Não combinam com nada (ainda)</h2>
          <p className="muted">Estas peças não formam nenhum look com o resto da lista. Bons candidatos a sair do carrinho.</p>
          <div className="grid">
            {orphans.map((r) => <ItemThumb key={r.item.id} item={r.item} onClick={() => setEditing(r.item)} />)}
          </div>
        </section>
      )}
      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
