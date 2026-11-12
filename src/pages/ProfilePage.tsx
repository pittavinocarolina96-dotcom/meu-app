import { useRef, useState } from "react";
import { MODELS } from "../models.ts";
import { Chips, ColorPicker } from "../components.tsx";
import { STYLES } from "../options.ts";
import { useStore } from "../store.tsx";

export function ProfilePage() {
  const { profile, setProfile, settings, setSettings, items, looks, replaceAll, toast } = useStore();
  const [key, setKey] = useState(settings.apiKey);
  const [show, setShow] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const inviteLink = `${location.origin}${location.pathname}#chave=${encodeURIComponent(settings.apiKey)}`;
  const appLink = `${location.origin}${location.pathname}`;

  const copy = async (text: string, msg: string) => {
    try {
      if (navigator.share && /Mobi/.test(navigator.userAgent)) await navigator.share({ title: "LookLab", url: text });
      else { await navigator.clipboard.writeText(text); toast(msg); }
    } catch { /* cancelado */ }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app: "looklab", version: 1, items, looks, profile })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `looklab-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (f: File) => {
    try {
      const d = JSON.parse(await f.text());
      if (d.app !== "looklab" || !Array.isArray(d.items)) throw new Error();
      if (!confirm(`Importar ${d.items.length} peças e ${d.looks?.length ?? 0} looks? Isso substitui o que está neste aparelho.`)) return;
      replaceAll({ items: d.items, looks: d.looks ?? [], profile: d.profile ?? profile });
      toast("Backup importado");
    } catch {
      toast("Arquivo inválido");
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Perfil</h1>
        <p className="muted">Seu gosto deixa as sugestões mais certeiras.</p>
      </header>

      <section className="card">
        <h2>🎨 Cores que me favorecem</h2>
        <ColorPicker max={12} value={profile.favColors} onChange={(v) => setProfile({ ...profile, favColors: v })} />
      </section>
      <section className="card">
        <h2>🚫 Cores que evito</h2>
        <p className="muted small">Looks com essas cores não aparecem nas sugestões.</p>
        <ColorPicker max={12} value={profile.avoidColors} onChange={(v) => setProfile({ ...profile, avoidColors: v })} />
      </section>
      <section className="card">
        <h2>✨ Meu estilo</h2>
        <Chips options={STYLES} value={profile.styles} onChange={(v) => setProfile({ ...profile, styles: v })} />
      </section>

      <section className="card">
        <h2>🤖 IA (opcional)</h2>
        <p className="muted small">
          Com uma chave da Anthropic, a IA lê os prints (tipo, cor, preço) e monta looks explicando por quê.
          Sem chave, tudo funciona à mão. A chave fica salva só neste aparelho.
        </p>
        <label className="field">
          <span>Chave da API</span>
          <div className="key-row">
            <input type={show ? "text" : "password"} value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-..." autoComplete="off" />
            <button className="btn ghost" onClick={() => setShow(!show)}>{show ? "Ocultar" : "Ver"}</button>
          </div>
        </label>
        <label className="field">
          <span>Modelo</span>
          <select value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <div className="row-gap">
          <button className="btn primary" onClick={() => { setSettings({ ...settings, apiKey: key.trim() }); toast(key.trim() ? "IA ativada ✨" : "IA desativada"); }}>
            Salvar chave
          </button>
          {settings.apiKey && <button className="btn ghost" onClick={() => { setKey(""); setSettings({ ...settings, apiKey: "" }); toast("IA desativada"); }}>Remover</button>}
        </div>
        <details className="help">
          <summary>Como conseguir uma chave?</summary>
          <ol>
            <li>Entre em <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a> e crie uma conta.</li>
            <li>Em <b>Billing</b>, adicione um crédito pequeno (é pré-pago, sem mensalidade).</li>
            <li>Em <b>API Keys</b>, crie uma chave e cole aqui.</li>
          </ol>
          <p>Custo aproximado: R$ 0,01 a R$ 0,06 por foto analisada; pedir looks custa poucos centavos.</p>
        </details>
      </section>

      <section className="card">
        <h2>💌 Convidar amigas</h2>
        <p className="muted small">Cada pessoa usa no próprio celular, e as peças de uma não aparecem para a outra.</p>
        <button className="btn ghost block" onClick={() => copy(appLink, "Link copiado")}>Compartilhar link do app</button>
        {settings.apiKey && (
          <>
            <button className="btn ghost block" onClick={() => copy(inviteLink, "Link com IA copiado")}>Compartilhar link já com a minha IA</button>
            <p className="muted small">
              ⚠️ Esse link leva a sua chave: o uso da IA por quem abrir sai na sua conta. Mande só para quem você confia.
              Para cortar o acesso, apague a chave em console.anthropic.com e crie outra.
            </p>
          </>
        )}
      </section>

      <section className="card">
        <h2>💾 Backup</h2>
        <p className="muted small">Seus dados ficam só neste navegador. Faça backup para trocar de celular.</p>
        <div className="row-gap">
          <button className="btn ghost" onClick={exportData}>Exportar</button>
          <button className="btn ghost" onClick={() => file.current?.click()}>Importar</button>
        </div>
        <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
      </section>
      <p className="muted small center">LookLab · feito para comprar menos e combinar mais</p>
    </div>
  );
}
