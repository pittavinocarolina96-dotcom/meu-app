// Regras para combinar peças, contar looks e otimizar o orçamento.
// Funciona sem IA: usa categoria, harmonia de cores, ocasião, clima e estilo.
import { colorById, hueOf } from "./colors.ts";
import type { Item, LookItems, Profile } from "./types.ts";

export const THRESHOLD = 0.55;

export interface Filters {
  occasion?: string;
  season?: string;
}

const mainColor = (it: Item) => it.colors[0] ?? "preto";

/** Harmonia de cores entre as cores principais das peças (0–1). */
export function colorHarmony(items: Item[]): number {
  const loud = items.map(mainColor).filter((c) => !(colorById(c)?.neutral ?? true));
  const prints = loud.filter((c) => c === "estampado").length;
  const solids = [...new Set(loud.filter((c) => c !== "estampado"))];
  if (prints >= 2) return 0.2;
  if (prints === 1) return solids.length === 0 ? 0.95 : solids.length === 1 ? 0.65 : 0.3;
  if (solids.length === 0) return 0.75; // tudo neutro: clássico, nunca erra
  if (solids.length === 1) return 1;
  if (solids.length === 2) {
    let d = Math.abs(hueOf(solids[0]) - hueOf(solids[1]));
    if (d > 180) d = 360 - d;
    if (d <= 40) return 0.85; // análogas
    if (d >= 140) return 0.8; // complementares
    return 0.4;
  }
  return 0.25;
}

/** Interseção de listas onde lista vazia = "serve para tudo". null = incompatível. */
function intersect(lists: string[][]): string[] | null {
  const set = lists.filter((l) => l.length > 0);
  if (set.length === 0) return [];
  const out = set.reduce((a, b) => a.filter((x) => b.includes(x)));
  return out.length ? out : null;
}

function styleScore(items: Item[], profile: Profile): number {
  const all = items.flatMap((i) => i.styles);
  if (all.length === 0) return 0.7;
  const counts = new Map<string, number>();
  for (const s of all) counts.set(s, (counts.get(s) ?? 0) + 1);
  const shared = Math.max(...counts.values()) / items.length; // quantas peças dividem o estilo mais comum
  const fav = profile.styles.length ? all.filter((s) => profile.styles.includes(s)).length / all.length : 0.5;
  return 0.6 * shared + 0.4 * fav;
}

function paletteScore(items: Item[], profile: Profile): number {
  const cols = items.map(mainColor);
  if (cols.some((c) => profile.avoidColors.includes(c))) return 0;
  if (!profile.favColors.length) return 0.6;
  const loud = cols.filter((c) => !(colorById(c)?.neutral ?? true));
  if (!loud.length) return 0.7;
  return 0.4 + 0.6 * (loud.filter((c) => profile.favColors.includes(c)).length / loud.length);
}

/** Pontuação de um conjunto de peças. 0 quando ocasião/clima não batem. */
export function scoreItems(items: Item[], profile: Profile, filters: Filters = {}): number {
  const occ = intersect(items.map((i) => i.occasions));
  const sea = intersect(items.map((i) => i.seasons));
  if (occ === null || sea === null) return 0;
  if (filters.occasion && occ.length && !occ.includes(filters.occasion)) return 0;
  if (filters.season && sea.length && !sea.includes(filters.season)) return 0;
  const h = colorHarmony(items);
  if (h < 0.3) return h * 0.5;
  return 0.6 * h + 0.25 * styleScore(items, profile) + 0.15 * paletteScore(items, profile);
}

export const lookItemIds = (l: LookItems) =>
  [l.top, l.bottom, l.outer, l.shoes, ...l.accessories].filter(Boolean) as string[];

export interface ScoredLook extends LookItems {
  key: string;
  score: number;
}

export const lookKey = (l: LookItems) =>
  [l.top, l.bottom, l.outer ?? "-", l.shoes ?? "-", ...[...l.accessories].sort()].join("|");

/** Ativas = tudo que não foi descartado. */
export const activeItems = (items: Item[]) => items.filter((i) => i.status !== "discarded");

const byCat = (items: Item[], c: Item["category"]) => items.filter((i) => i.category === c);

/** Melhor complemento (sapato/terceira peça/acessório) para uma base, se algum combinar. */
function bestExtra(base: Item[], options: Item[], profile: Profile, filters: Filters, minGain = -0.05) {
  const baseScore = scoreItems(base, profile, filters);
  let best: Item | undefined, bestScore = -1;
  for (const o of options) {
    const s = scoreItems([...base, o], profile, filters);
    if (s >= THRESHOLD && s - baseScore >= minGain && s > bestScore) { best = o; bestScore = s; }
  }
  return best;
}

/** Gera os looks automáticos: toda combinação cima+baixo válida, com o melhor sapato etc. */
export function generateLooks(all: Item[], profile: Profile, filters: Filters = {}, limit = 200): ScoredLook[] {
  const items = activeItems(all);
  const tops = byCat(items, "top"), bottoms = byCat(items, "bottom");
  const shoes = byCat(items, "shoes"), outers = byCat(items, "outer"), accs = byCat(items, "accessory");
  const wantsOuter = filters.season === "frio" || filters.season === "meia";
  const looks: ScoredLook[] = [];
  for (const t of tops) for (const b of bottoms) {
    const base = [t, b];
    if (scoreItems(base, profile, filters) < THRESHOLD) continue;
    const shoe = bestExtra(base, shoes, profile, filters);
    if (shoe) base.push(shoe);
    const outer = bestExtra(base, outers, profile, filters, wantsOuter ? -0.1 : 0.02);
    if (outer) base.push(outer);
    const acc = bestExtra(base, accs, profile, filters, 0);
    if (acc) base.push(acc);
    const look: LookItems = { top: t.id, bottom: b.id, shoes: shoe?.id, outer: outer?.id, accessories: acc ? [acc.id] : [] };
    looks.push({ ...look, key: lookKey(look), score: scoreItems(base, profile, filters) });
  }
  return looks.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface RankRow {
  item: Item;
  looks: number; // em quantos looks a peça entra
  perReal?: number; // looks por R$ 100
}

/**
 * Versatilidade: para cima/baixo, quantas bases válidas a peça forma;
 * para sapato/terceira peça/acessório, com quantas bases ela combina.
 */
export function rankItems(all: Item[], profile: Profile): RankRow[] {
  const items = activeItems(all);
  const tops = byCat(items, "top"), bottoms = byCat(items, "bottom");
  const bases: Item[][] = [];
  for (const t of tops) for (const b of bottoms) if (scoreItems([t, b], profile) >= THRESHOLD) bases.push([t, b]);
  return items
    .map((item) => {
      let n: number;
      if (item.category === "top" || item.category === "bottom") n = bases.filter((b) => b.includes(item)).length;
      else n = bases.filter((b) => scoreItems([...b, item], profile) >= THRESHOLD).length;
      return { item, looks: n, perReal: item.price ? (n / item.price) * 100 : undefined };
    })
    .sort((a, b) => b.looks - a.looks || (b.perReal ?? 0) - (a.perReal ?? 0));
}

export interface BudgetResult {
  chosen: Item[];
  spent: number;
  looks: number;
  extrasLooks: number;
  noPrice: Item[];
}

/**
 * "Mais looks por real". Peças já compradas entram de graça.
 * Fase 1: escolhe partes de cima/baixo (sozinhas ou em par) que mais aumentam o
 * nº de looks por real gasto. Fase 2: com o que sobrar, sapatos/terceiras peças/acessórios
 * que combinam com mais looks escolhidos.
 */
export function optimizeBudget(all: Item[], profile: Profile, budget: number): BudgetResult {
  const items = activeItems(all);
  const owned = items.filter((i) => i.status === "bought");
  const noPrice = items.filter((i) => i.status === "want" && !(i.price && i.price > 0));
  const candidates = items.filter((i) => i.status === "want" && i.price && i.price > 0);
  const ok = new Map<string, boolean>();
  const pairOk = (t: Item, b: Item) => {
    const k = t.id + b.id;
    if (!ok.has(k)) ok.set(k, scoreItems([t, b], profile) >= THRESHOLD);
    return ok.get(k)!;
  };
  const countBases = (set: Item[]) => {
    const ts = byCat(set, "top"), bs = byCat(set, "bottom");
    let n = 0;
    for (const t of ts) for (const b of bs) if (pairOk(t, b)) n++;
    return n;
  };

  const chosen: Item[] = [];
  let left = budget;
  const pool = () => [...owned, ...chosen];
  const baseCands = () => candidates.filter((c) => (c.category === "top" || c.category === "bottom") && !chosen.includes(c));

  for (;;) {
    const current = countBases(pool());
    let best: { add: Item[]; ratio: number } | undefined;
    const cands = baseCands();
    const consider = (add: Item[]) => {
      const cost = add.reduce((s, i) => s + i.price!, 0);
      if (cost > left) return;
      const gain = countBases([...pool(), ...add]) - current;
      if (gain <= 0) return;
      const ratio = gain / cost;
      if (!best || ratio > best.ratio) best = { add, ratio };
    };
    for (const c of cands) consider([c]);
    for (const t of cands.filter((c) => c.category === "top"))
      for (const b of cands.filter((c) => c.category === "bottom")) if (pairOk(t, b)) consider([t, b]);
    if (!best) break;
    chosen.push(...best.add);
    left -= best.add.reduce((s, i) => s + i.price!, 0);
  }

  // Fase 2: complementos
  const bases: Item[][] = [];
  const set = pool();
  for (const t of byCat(set, "top")) for (const b of byCat(set, "bottom")) if (pairOk(t, b)) bases.push([t, b]);
  let extrasLooks = 0;
  const extras = candidates.filter((c) => c.category !== "top" && c.category !== "bottom");
  const extraGain = (e: Item) => bases.filter((b) => scoreItems([...b, e], profile) >= THRESHOLD).length;
  const ranked = extras
    .map((e) => ({ e, g: extraGain(e) }))
    .filter((x) => x.g > 0)
    .sort((a, b) => b.g / b.e.price! - a.g / a.e.price!);
  const hasCat = new Set(owned.map((o) => o.category));
  for (const { e, g } of ranked) {
    if (e.price! > left) continue;
    // um de cada tipo primeiro; repetidos só se ainda sobrar
    if (hasCat.has(e.category) && ranked.some((r) => !hasCat.has(r.e.category) && r.e.price! <= left && !chosen.includes(r.e))) continue;
    chosen.push(e);
    hasCat.add(e.category);
    left -= e.price!;
    extrasLooks += g;
  }

  return { chosen, spent: budget - left, looks: countBases(pool()), extrasLooks, noPrice };
}
