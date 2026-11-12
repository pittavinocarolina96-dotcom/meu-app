export interface NamedColor {
  id: string;
  label: string;
  hex: string;
  neutral: boolean;
}

// Neutros combinam com tudo. "estampado" é tratado à parte.
export const COLORS: NamedColor[] = [
  { id: "preto", label: "Preto", hex: "#1c1c1c", neutral: true },
  { id: "branco", label: "Branco", hex: "#f7f7f4", neutral: true },
  { id: "off-white", label: "Off-white", hex: "#efe6d2", neutral: true },
  { id: "cinza", label: "Cinza", hex: "#8c8c8c", neutral: true },
  { id: "bege", label: "Bege", hex: "#d8c3a0", neutral: true },
  { id: "caramelo", label: "Caramelo", hex: "#b0763f", neutral: true },
  { id: "marrom", label: "Marrom", hex: "#5b3a27", neutral: true },
  { id: "jeans", label: "Jeans", hex: "#4d6d93", neutral: true },
  { id: "marinho", label: "Azul-marinho", hex: "#1f2a44", neutral: true },
  { id: "dourado", label: "Dourado", hex: "#c9a227", neutral: true },
  { id: "prateado", label: "Prateado", hex: "#bfc0c7", neutral: true },
  { id: "oliva", label: "Verde-oliva", hex: "#6b6a3a", neutral: false },
  { id: "verde", label: "Verde", hex: "#2e8b57", neutral: false },
  { id: "menta", label: "Verde-menta", hex: "#a6dbc2", neutral: false },
  { id: "azul", label: "Azul", hex: "#2f6fd6", neutral: false },
  { id: "azul-claro", label: "Azul-claro", hex: "#9fc4e8", neutral: false },
  { id: "lilas", label: "Lilás", hex: "#b7a1dc", neutral: false },
  { id: "roxo", label: "Roxo", hex: "#6a3d9a", neutral: false },
  { id: "rosa", label: "Rosa", hex: "#ec8fb0", neutral: false },
  { id: "rosa-claro", label: "Rosa-claro", hex: "#f5c9d6", neutral: false },
  { id: "vermelho", label: "Vermelho", hex: "#c62630", neutral: false },
  { id: "vinho", label: "Vinho", hex: "#6d1a2c", neutral: false },
  { id: "terracota", label: "Terracota", hex: "#c2603d", neutral: false },
  { id: "laranja", label: "Laranja", hex: "#ef7d31", neutral: false },
  { id: "amarelo", label: "Amarelo", hex: "#f2c94c", neutral: false },
  { id: "estampado", label: "Estampado", hex: "conic-gradient(#ec8fb0,#f2c94c,#2f6fd6,#2e8b57,#ec8fb0)", neutral: false },
];

export const colorById = (id: string) => COLORS.find((c) => c.id === id);

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export const hueOf = (id: string): number => {
  const c = colorById(id);
  if (!c || !c.hex.startsWith("#")) return 0;
  return rgbToHsl(...hexToRgb(c.hex))[0];
};

/** Cor nomeada mais próxima de um RGB (para sugerir a cor da peça automaticamente). */
export function nearestColor(rgb: [number, number, number]): string {
  let best = "preto", bestD = Infinity;
  for (const c of COLORS) {
    if (!c.hex.startsWith("#")) continue;
    const [r, g, b] = hexToRgb(c.hex);
    // distância "redmean", barata e razoável para percepção
    const rm = (rgb[0] + r) / 2;
    const d = (2 + rm / 256) * (rgb[0] - r) ** 2 + 4 * (rgb[1] - g) ** 2 + (2 + (255 - rm) / 256) * (rgb[2] - b) ** 2;
    if (d < bestD) { bestD = d; best = c.id; }
  }
  return best;
}
