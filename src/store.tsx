// Estado do app, salvo no próprio aparelho (IndexedDB). Nada vai para servidor.
import { get, set } from "idb-keyval";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { DEFAULT_MODEL } from "./models.ts";
import type { Item, Profile, SavedLook, Settings } from "./types.ts";

interface Data {
  items: Item[];
  looks: SavedLook[];
  profile: Profile;
  settings: Settings;
}

const EMPTY: Data = {
  items: [],
  looks: [],
  profile: { favColors: [], avoidColors: [], styles: [] },
  settings: { apiKey: "", model: DEFAULT_MODEL },
};

interface Store extends Data {
  ready: boolean;
  saveItem: (i: Item) => void;
  removeItem: (id: string) => void;
  saveLook: (l: SavedLook) => void;
  removeLook: (id: string) => void;
  setProfile: (p: Profile) => void;
  setSettings: (s: Settings) => void;
  replaceAll: (d: Partial<Data>) => void;
  toast: (msg: string) => void;
  message: string;
}

const Ctx = createContext<Store>(null!);
export const useStore = () => useContext(Ctx);
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Lê a chave vinda de um link de convite (#chave=...) e limpa o endereço. */
function keyFromInvite(): string | null {
  const m = location.hash.match(/chave=([^&]+)/);
  if (!m) return null;
  history.replaceState(null, "", location.pathname + location.search);
  return decodeURIComponent(m[1]);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef<number>(0);

  const toast = (msg: string) => {
    setMessage(msg);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(""), 2600);
  };

  useEffect(() => {
    (async () => {
      const loaded: Data = { ...EMPTY };
      try {
        for (const k of Object.keys(EMPTY) as (keyof Data)[]) {
          const v = await get(k);
          if (v !== undefined) (loaded as any)[k] = v;
        }
      } catch {
        toast("Não consegui abrir os dados salvos neste navegador.");
      }
      loaded.settings = { ...EMPTY.settings, ...loaded.settings };
      const invited = keyFromInvite();
      if (invited) {
        loaded.settings = { ...loaded.settings, apiKey: invited };
        set("settings", loaded.settings).catch(() => {});
        toast("IA ativada pelo link de convite ✨");
      }
      setData(loaded);
      setReady(true);
    })();
  }, []);

  const update = <K extends keyof Data>(k: K, v: Data[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    set(k, v).catch(() => toast("Não consegui salvar. O armazenamento do celular pode estar cheio."));
  };

  const store: Store = {
    ...data,
    ready,
    message,
    toast,
    saveItem: (i) => {
      const exists = data.items.some((x) => x.id === i.id);
      update("items", exists ? data.items.map((x) => (x.id === i.id ? i : x)) : [i, ...data.items]);
    },
    removeItem: (id) => {
      update("items", data.items.filter((x) => x.id !== id));
      update("looks", data.looks.filter((l) => ![l.top, l.bottom, l.outer, l.shoes, ...l.accessories].includes(id)));
    },
    saveLook: (l) => {
      const exists = data.looks.some((x) => x.id === l.id);
      update("looks", exists ? data.looks.map((x) => (x.id === l.id ? l : x)) : [l, ...data.looks]);
    },
    removeLook: (id) => update("looks", data.looks.filter((x) => x.id !== id)),
    setProfile: (p) => update("profile", p),
    setSettings: (s) => update("settings", s),
    replaceAll: (d) => {
      for (const k of Object.keys(d) as (keyof Data)[]) update(k, d[k] as any);
    },
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
