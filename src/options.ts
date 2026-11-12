import type { Category } from "./types.ts";

export const CATEGORIES: { id: Category; label: string; plural: string }[] = [
  { id: "top", label: "Parte de cima", plural: "Partes de cima" },
  { id: "bottom", label: "Parte de baixo", plural: "Partes de baixo" },
  { id: "outer", label: "Terceira peça", plural: "Terceiras peças" },
  { id: "shoes", label: "Sapato", plural: "Sapatos" },
  { id: "accessory", label: "Acessório", plural: "Acessórios" },
];

export const OCCASIONS = [
  { id: "trabalho", label: "Trabalho" },
  { id: "casual", label: "Casual" },
  { id: "festa", label: "Festa" },
  { id: "encontro", label: "Encontro" },
  { id: "academia", label: "Academia" },
  { id: "viagem", label: "Viagem" },
];

export const SEASONS = [
  { id: "calor", label: "Calor" },
  { id: "meia", label: "Meia-estação" },
  { id: "frio", label: "Frio" },
];

export const STYLES = [
  { id: "basico", label: "Básico" },
  { id: "minimalista", label: "Minimalista" },
  { id: "classico", label: "Clássico" },
  { id: "romantico", label: "Romântico" },
  { id: "esportivo", label: "Esportivo" },
  { id: "streetwear", label: "Streetwear" },
  { id: "boho", label: "Boho" },
  { id: "sexy", label: "Sexy" },
  { id: "moderno", label: "Moderno" },
];

export const catLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)!.label;
export const labelOf = (list: { id: string; label: string }[], id: string) =>
  list.find((x) => x.id === id)?.label ?? id;
