import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" para funcionar em https://<usuario>.github.io/meu-app/
export default defineConfig({
  base: "./",
  plugins: [react()],
  // compatível com iPhones mais antigos (iOS 14+)
  build: { target: ["es2020", "safari14"] },
});
