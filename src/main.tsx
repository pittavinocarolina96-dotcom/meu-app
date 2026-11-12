import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { StoreProvider } from "./store.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);

// Se o app foi atualizado enquanto estava aberto, os arquivos antigos somem do servidor
// e carregar uma parte nova (IA, recorte) falha. Nesse caso recarrega uma vez para pegar a versão nova.
window.addEventListener("vite:preloadError", (e) => {
  const key = "looklab-reloaded";
  let last = 0;
  try { last = Number(sessionStorage.getItem(key) || 0); } catch { /* sem storage */ }
  if (Date.now() - last < 30_000) return; // já tentou agora há pouco: deixa o erro aparecer
  e.preventDefault();
  try { sessionStorage.setItem(key, String(Date.now())); } catch { /* sem storage */ }
  location.reload();
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
