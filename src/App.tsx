import { useEffect, useState } from "react";
import { AddPage } from "./pages/AddPage.tsx";
import { ItemsPage } from "./pages/ItemsPage.tsx";
import { LooksPage } from "./pages/LooksPage.tsx";
import { ProfilePage } from "./pages/ProfilePage.tsx";
import { ShopPage } from "./pages/ShopPage.tsx";
import { useStore } from "./store.tsx";

type Tab = "looks" | "items" | "add" | "shop" | "profile";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "looks", icon: "✦", label: "Looks" },
  { id: "items", icon: "▦", label: "Peças" },
  { id: "add", icon: "＋", label: "Adicionar" },
  { id: "shop", icon: "◎", label: "Comprar" },
  { id: "profile", icon: "☺", label: "Perfil" },
];

export function App() {
  const { ready, message } = useStore();
  const [tab, setTab] = useState<Tab>("looks");
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);
  if (!ready) return <div className="loading">LookLab</div>;
  return (
    <>
      <main>
        {tab === "looks" && <LooksPage onAdd={() => setTab("add")} goProfile={() => setTab("profile")} />}
        {tab === "items" && <ItemsPage onAdd={() => setTab("add")} />}
        {tab === "add" && <AddPage onDone={() => setTab("looks")} />}
        {tab === "shop" && <ShopPage onAdd={() => setTab("add")} />}
        {tab === "profile" && <ProfilePage />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={`${tab === t.id ? "on" : ""} ${t.id === "add" ? "add" : ""}`} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
      {message && <div className="toast" role="status">{message}</div>}
    </>
  );
}
