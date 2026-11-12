import { test } from "node:test";
import assert from "node:assert/strict";
import { colorHarmony, generateLooks, optimizeBudget, rankItems, scoreItems } from "../src/engine.ts";
import type { Item, Profile } from "../src/types.ts";

let n = 0;
const it = (category: Item["category"], colors: string[], extra: Partial<Item> = {}): Item => ({
  id: `i${++n}`, image: "", name: `${category}-${colors[0]}`, category, colors,
  styles: [], occasions: [], seasons: [], status: "want", createdAt: n, ...extra,
});
const profile: Profile = { favColors: [], avoidColors: [], styles: [] };

test("neutros combinam; duas estampas não", () => {
  assert.ok(colorHarmony([it("top", ["branco"]), it("bottom", ["jeans"])]) >= 0.7);
  assert.ok(colorHarmony([it("top", ["estampado"]), it("bottom", ["estampado"])]) < 0.3);
  assert.ok(colorHarmony([it("top", ["vermelho"]), it("bottom", ["rosa"]), it("shoes", ["amarelo"])]) < 0.3);
});

test("ocasiões incompatíveis zeram o look", () => {
  const a = it("top", ["preto"], { occasions: ["academia"] });
  const b = it("bottom", ["preto"], { occasions: ["festa"] });
  assert.equal(scoreItems([a, b], profile), 0);
});

test("gera looks e ranqueia a peça mais versátil", () => {
  const items = [
    it("top", ["branco"], { price: 50 }), it("top", ["vermelho"], { price: 60 }), it("top", ["estampado"], { price: 80 }),
    it("bottom", ["jeans"], { price: 100 }), it("bottom", ["estampado"], { price: 90 }),
    it("shoes", ["preto"], { price: 120 }),
  ];
  const looks = generateLooks(items, profile);
  assert.ok(looks.length >= 4);
  assert.ok(looks.every((l) => l.shoes));
  const rank = rankItems(items, profile);
  const bottoms = rank.filter((r) => r.item.category === "bottom");
  assert.equal(bottoms[0].item.colors[0], "jeans");
  assert.ok(bottoms[1].looks < bottoms[0].looks);
});

test("orçamento respeita o limite e prioriza mais looks por real", () => {
  const items = [
    it("top", ["branco"], { price: 40 }), it("top", ["preto"], { price: 40 }),
    it("bottom", ["jeans"], { price: 80 }), it("bottom", ["estampado"], { price: 300 }),
    it("shoes", ["bege"], { price: 70 }),
  ];
  const r = optimizeBudget(items, profile, 200);
  assert.ok(r.spent <= 200);
  assert.equal(r.looks, 2);
  assert.ok(!r.chosen.some((c) => c.price === 300));
  const r2 = optimizeBudget(items, profile, 240);
  assert.ok(r2.chosen.some((c) => c.category === "shoes"));
});

test("peças compradas entram de graça", () => {
  const items = [it("bottom", ["jeans"], { status: "bought", price: 100 }), it("top", ["branco"], { price: 30 })];
  const r = optimizeBudget(items, profile, 30);
  assert.equal(r.looks, 1);
  assert.equal(r.spent, 30);
});
