// Diagnóstico simples: anota a etapa em andamento. Se o iPhone fechar a página no meio
// (falta de memória), na próxima abertura dá para saber onde parou e não repetir sozinho.
const KEY = "looklab-stage";
const CRASH = "looklab-cut-crash";

export function stage(name: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ name, t: Date.now() })); } catch { /* sem storage */ }
}
export function clearStage() {
  try { localStorage.removeItem(KEY); } catch { /* sem storage */ }
}

/** Chamado ao abrir o app: se ficou uma etapa pendente há pouco tempo, a página foi fechada no meio dela. */
export function checkCrash() {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    if (!raw) return;
    const { name, t } = JSON.parse(raw);
    if (Date.now() - t < 5 * 60_000) localStorage.setItem(CRASH, JSON.stringify({ name, t: Date.now() }));
  } catch { /* sem storage */ }
}

/** Etapa em que o recorte fechou a página da última vez (ou null). */
export function lastCrash(): string | null {
  try {
    const raw = localStorage.getItem(CRASH);
    return raw ? JSON.parse(raw).name : null;
  } catch { return null; }
}
export function clearCrash() {
  try { localStorage.removeItem(CRASH); } catch { /* sem storage */ }
}
