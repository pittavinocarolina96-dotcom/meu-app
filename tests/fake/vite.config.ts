import { defineConfig, mergeConfig } from "vite";
// Build de teste: troca a IA de recorte por uma falsa (círculo em volta do toque).
import base from "../../vite.config.ts";
import { fileURLToPath } from "node:url";
export default mergeConfig(base, defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  resolve: { alias: { "@huggingface/transformers": fileURLToPath(new URL("./transformers.ts", import.meta.url)) } },
  build: { outDir: "dist-fake", emptyOutDir: true },
}));
