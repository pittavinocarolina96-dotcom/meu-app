import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { checkCrash } from "./diag.ts";
import { StoreProvider } from "./store.tsx";

checkCrash();
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);

// Se o app foi atualizado enquanto estava aberto, os arquivos antigos somem do servidor e
// carregar uma parte nova (IA, recorte) falha. Só recarrega se houver mesmo uma versão nova;
// senão deixa o erro aparecer normalmente.
window.addEventListener("vite:preloadError", async () => {
  try {
    const current = (document.querySelector('script[type="module"][src]') as HTMLScriptElement | null)?.src ?? "";
    const html = await (await fetch("./", { cache: "no-store" })).text();
    const name = current.split("/").pop();
    if (name && !html.includes(name)) location.reload();
  } catch { /* offline: não faz nada */ }
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
