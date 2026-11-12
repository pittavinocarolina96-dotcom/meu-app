// IA opcional: lê o print da peça e sugere looks. Usa a chave da Anthropic colada nas configurações.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { COLORS } from "./colors.ts";
import { DEFAULT_MODEL } from "./models.ts";
import { CATEGORIES, OCCASIONS, SEASONS, STYLES } from "./options.ts";
import type { Item, LookItems, Profile, Settings } from "./types.ts";


const ids = <T extends { id: string }>(l: T[]) => l.map((x) => x.id) as [string, ...string[]];

function client(s: Settings) {
  // O app roda só no navegador; a chave fica no aparelho de quem usa.
  return new Anthropic({ apiKey: s.apiKey.trim(), dangerouslyAllowBrowser: true });
}

/** Opções comuns: troca para outro modelo automaticamente se o Opus recusar (só o Opus aceita). */
function common(s: Settings) {
  const model = s.model || DEFAULT_MODEL;
  return model.startsWith("claude-opus")
    ? { model, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : { model, betas: [] as string[] };
}

function friendlyError(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) return new Error("Chave da IA inválida. Confira em Perfil → IA.");
  if (e instanceof Anthropic.RateLimitError) return new Error("Muitas análises seguidas. Espere um minutinho e tente de novo.");
  if (e instanceof Anthropic.APIConnectionError) return new Error("Sem conexão com a IA. Verifique a internet.");
  if (e instanceof Anthropic.APIError) {
    const msg = String(e.message || "");
    if (/credit|balance|billing/i.test(msg)) return new Error("A conta da IA está sem crédito. Adicione crédito em console.anthropic.com.");
    return new Error(`A IA respondeu com erro (${e.status ?? "?"}). Tente de novo.`);
  }
  return e instanceof Error ? e : new Error("Erro inesperado na IA.");
}

const ItemAnalysis = z.object({
  name: z.string().describe("Nome curto em português, ex.: 'Blusa canelada de alcinha'"),
  category: z.enum(ids(CATEGORIES)),
  colors: z.array(z.enum(ids(COLORS))).describe("1 a 3 cores, a principal primeiro"),
  styles: z.array(z.enum(ids(STYLES))),
  occasions: z.array(z.enum(ids(OCCASIONS))),
  seasons: z.array(z.enum(ids(SEASONS))),
  price: z.number().nullable().describe("Preço em reais se aparecer no print, senão null"),
  store: z.string().nullable(),
  box: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
    .describe("Caixa só da peça principal na imagem, em milésimos (0–1000) da largura/altura"),
});
export type ItemAnalysis = z.infer<typeof ItemAnalysis>;

export async function analyzeItem(s: Settings, image: { data: string; media: "image/jpeg" }): Promise<ItemAnalysis> {
  try {
    const res = await client(s).beta.messages.parse({
      ...common(s),
      max_tokens: 4000,
      output_config: { effort: "low", format: betaZodOutputFormat(ItemAnalysis) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.media, data: image.data } },
            {
              type: "text",
              text:
                "Esta imagem é uma foto ou print de uma peça de roupa, sapato ou acessório que quero comprar " +
                "(muitas vezes um print da Shein ou de outra loja, com textos e botões em volta). " +
                "Identifique a peça principal e preencha os campos. Categorias: top = parte de cima " +
                "(blusa, camisa, cropped, body); bottom = parte de baixo (calça, saia, short); outer = terceira peça " +
                "(blazer, jaqueta, cardigã, colete); shoes = calçado; accessory = bolsa, cinto, bijuteria, óculos. " +
                "Ocasiões e clima: marque só os que fazem sentido de verdade para a peça. " +
                "Se o preço aparecer, use o valor atual (com desconto). A caixa deve envolver só a peça, sem textos da loja.",
            },
          ],
        },
      ],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("A IA não conseguiu analisar essa imagem. Preencha à mão.");
    return res.parsed_output;
  } catch (e) {
    throw friendlyError(e);
  }
}

const LookSuggestions = z.object({
  looks: z.array(
    z.object({
      title: z.string().describe("Nome curto e charmoso do look"),
      top: z.string(),
      bottom: z.string(),
      outer: z.string().nullable(),
      shoes: z.string().nullable(),
      accessories: z.array(z.string()),
      why: z.string().describe("1–2 frases explicando por que combina e quando usar"),
    })
  ),
});

export interface AILook extends LookItems { title: string; why: string }

export async function suggestLooks(s: Settings, items: Item[], profile: Profile, request: string): Promise<AILook[]> {
  const catalog = items.map((i) => ({
    id: i.id, nome: i.name, categoria: i.category, cores: i.colors, estilos: i.styles,
    ocasioes: i.occasions, clima: i.seasons, preco: i.price ?? null, status: i.status === "bought" ? "já comprei" : "quero comprar",
  }));
  try {
    const res = await client(s).beta.messages.parse({
      ...common(s),
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(LookSuggestions) },
      system:
        "Você é uma consultora de estilo brasileira. Monta looks só com as peças do catálogo (use os ids exatos). " +
        "Cada look precisa de exatamente uma parte de cima (top) e uma de baixo (bottom); terceira peça, sapato e " +
        "acessórios são opcionais e só entram se combinarem. Pense em harmonia de cores, proporção, estilo e ocasião. " +
        "Ajude a pessoa a comprar menos e melhor: prefira looks que reaproveitem peças versáteis.",
      messages: [
        {
          role: "user",
          content:
            `Meu perfil: cores que me favorecem ${JSON.stringify(profile.favColors)}, cores que evito ${JSON.stringify(profile.avoidColors)}, ` +
            `estilos que gosto ${JSON.stringify(profile.styles)}.\n\nCatálogo:\n${JSON.stringify(catalog)}\n\n` +
            `Pedido: ${request.trim() || "Monte de 6 a 10 looks variados com o que eu tenho aqui."}`,
        },
      ],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("A IA não conseguiu montar os looks agora.");
    const byId = new Map(items.map((i) => [i.id, i]));
    const okCat = (id: string | null, c: Item["category"]) => (id && byId.get(id)?.category === c ? id : undefined);
    return res.parsed_output.looks
      .map((l) => ({
        title: l.title, why: l.why,
        top: okCat(l.top, "top")!, bottom: okCat(l.bottom, "bottom")!,
        outer: okCat(l.outer, "outer"), shoes: okCat(l.shoes, "shoes"),
        accessories: l.accessories.filter((a) => okCat(a, "accessory")),
      }))
      .filter((l) => l.top && l.bottom);
  } catch (e) {
    throw friendlyError(e);
  }
}
