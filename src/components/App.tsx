"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Fields, Lead, LeadsPayload } from "@/lib/types";
import CallMode from "./CallMode";
import Dashboard from "./Dashboard";
import LeadDetail from "./LeadDetail";
import NewLead from "./NewLead";
import Team from "./Team";
import { api } from "./util";
import { PhoneAlerts } from "./CallButton";
import { Agenda, LeadList, Pipeline } from "./views";
import WhatsApp, { ChatView } from "./WhatsApp";

type Tab = "llamar" | "hoy" | "leads" | "whatsapp" | "embudo" | "panel" | "equipo";
const CACHE_KEY = "but-calls-v1";

const ICONS: Record<Tab, string> = {
  llamar: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z",
  hoy: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  leads: "M4 6h16M4 12h16M4 18h10",
  whatsapp: "M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.7-5.2A8.5 8.5 0 1 1 21 12Z",
  embudo: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z",
  panel: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  equipo: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1a3 3 0 0 0-2-2.8M4 19v-1a3 3 0 0 1 2-2.8",
};
const TITLES: Record<Tab, string> = { llamar: "Llamar", hoy: "Agenda", leads: "Leads", whatsapp: "WhatsApp", embudo: "Embudo", panel: "Panel", equipo: "Equipo" };

export interface Actions {
  open: (id: string) => void;
  save: (id: string, fields: Partial<Fields>) => Promise<void>;
  attempt: (id: string, fields?: Partial<Fields>) => Promise<void>;
  toast: (msg: string, error?: boolean) => void;
  replace: (lead: Lead) => void;
  /** Abre el chat de WhatsApp integrado con este lead */
  chat: (lead: Lead) => void;
}

export default function App() {
  const [data, setData] = useState<LeadsPayload | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [tab, setTab] = useState<Tab>("llamar");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [chatLead, setChatLead] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ msg: string; error: boolean } | null>(null);
  const pending = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string, isError = false) => {
    setToastMsg({ msg, error: isError });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), isError ? 6000 : 2500);
  }, []);

  const load = useCallback(async () => {
    if (pending.current > 0) return; // no pisar cambios que aún se están guardando
    try {
      const d = await api<LeadsPayload>("/api/leads");
      if (pending.current > 0) return;
      setData(d);
      setError("");
      setStale(false);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(d));
      } catch {}
    } catch (e) {
      setStale(true);
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) setData(JSON.parse(cached));
    } catch {}
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 45_000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", load);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", load);
    };
  }, [load]);

  // El botón «atrás» del móvil cierra la ficha en vez de salir de la app
  const open = useCallback((id: string) => {
    setSelected(id);
    history.pushState({ lead: id }, "");
  }, []);
  const close = useCallback(() => {
    if (history.state?.lead) history.back();
    else setSelected(null);
  }, []);
  useEffect(() => {
    const onPop = () => setSelected(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const replaceLead = useCallback((lead: Lead) => {
    setData((d) => {
      if (!d) return d;
      const exists = d.leads.some((l) => l.id === lead.id);
      return { ...d, leads: exists ? d.leads.map((l) => (l.id === lead.id ? lead : l)) : [lead, ...d.leads] };
    });
  }, []);

  const mutate = useCallback(
    async (id: string, fields: Partial<Fields>, path: string, method: string, okMsg: string) => {
      let before: Lead | undefined;
      setData((d) => {
        if (!d) return d;
        before = d.leads.find((l) => l.id === id);
        return { ...d, leads: d.leads.map((l) => (l.id === id ? { ...l, f: { ...l.f, ...fields } } : l)) };
      });
      pending.current++;
      try {
        const { lead } = await api<{ lead: Lead }>(path, method, { fields });
        replaceLead(lead);
        toast(okMsg);
      } catch (e) {
        if (before) replaceLead(before);
        toast(`No se guardó: ${(e as Error).message}`, true);
      } finally {
        pending.current--;
      }
    },
    [replaceLead, toast],
  );

  const actions: Actions = useMemo(
    () => ({
      open,
      toast,
      replace: replaceLead,
      chat: (lead) => setChatLead(lead.id),
      save: (id, fields) => mutate(id, fields, `/api/leads/${id}`, "PATCH", "Guardado en Notion"),
      attempt: (id, fields = {}) => mutate(id, fields, `/api/leads/${id}/intento`, "POST", "Intento registrado"),
    }),
    [open, toast, mutate, replaceLead],
  );

  if (!data) {
    return (
      <main className="center">
        {error ? (
          <div className="card empty">
            <p className="error">{error}</p>
            <button className="btn" onClick={load}>Reintentar</button>
          </div>
        ) : (
          <p className="muted">Cargando leads…</p>
        )}
      </main>
    );
  }

  const admin = data.me.role === "admin";
  const tabs: Tab[] = admin ? ["llamar", "hoy", "leads", "whatsapp", "embudo", "panel", "equipo"] : ["llamar", "hoy", "leads", "whatsapp", "embudo", "panel"];
  const lead = selected ? data.leads.find((l) => l.id === selected) : undefined;

  return (
    <div className="shell">
      <nav className="nav" aria-label="Secciones">
        <div className="brand">
          <img src="/logo.svg" alt="BUT Calls" />
        </div>
        {tabs.map((t) => (
          <button key={t} className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)} aria-current={tab === t}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={ICONS[t]} />
            </svg>
            <span>{TITLES[t]}</span>
          </button>
        ))}
        <div className="nav-foot">
          <div className="who">
            <strong>{data.me.name}</strong>
            <span className="muted">{admin ? "Dirección" : `Comercial${data.me.code ? ` · ${data.me.code}` : ""}`}</span>
          </div>
          <button
            className="btn small"
            onClick={async () => {
              await fetch("/api/logout", { method: "POST" }).catch(() => {});
              try {
                localStorage.removeItem(CACHE_KEY);
              } catch {}
              window.location.href = "/login";
            }}
          >
            Salir
          </button>
        </div>
      </nav>

      <main className="main">
        <header className="top">
          <span className="top-logo only-mobile" role="img" aria-label="BUT Calls" />
          <h1>{TITLES[tab]}</h1>
          <div className="top-actions">
            {(data.demo || stale) && (
              <span className={stale ? "pill warn" : "pill"}>{stale ? "Sin conexión · datos guardados" : "Demo"}</span>
            )}
            <button className="btn small only-desktop" onClick={load} title="Actualizar">Actualizar</button>
            <button className="btn primary small" onClick={() => setCreating(true)}>+ Lead</button>
            <button
              className="btn small only-mobile"
              onClick={async () => {
                await fetch("/api/logout", { method: "POST" }).catch(() => {});
                window.location.href = "/login";
              }}
            >
              Salir
            </button>
          </div>
        </header>
        {tab === "llamar" && <CallMode data={data} replaceLead={replaceLead} toast={toast} onChat={actions.chat} />}
        {tab === "hoy" && <Agenda data={data} actions={actions} />}
        {tab === "leads" && <LeadList data={data} actions={actions} />}
        {tab === "whatsapp" && <WhatsApp data={data} openLead={open} toast={toast} />}
        {tab === "embudo" && <Pipeline data={data} actions={actions} />}
        {tab === "panel" && <Dashboard data={data} />}
        {tab === "equipo" && admin && <Team data={data} toast={toast} />}
      </main>

      {lead && <LeadDetail key={lead.id} lead={lead} data={data} actions={actions} onClose={close} />}
      {creating && (
        <NewLead
          data={data}
          onClose={() => setCreating(false)}
          onCreated={(l) => {
            replaceLead(l);
            setCreating(false);
            toast("Lead creado en Notion");
            open(l.id);
          }}
        />
      )}
      {chatLead && (() => {
        const l = data.leads.find((x) => x.id === chatLead);
        if (!l) return null;
        return (
          <div className="overlay top-layer" onClick={(e) => e.target === e.currentTarget && setChatLead(null)}>
            <aside className="sheet chat-sheet" role="dialog" aria-modal="true" aria-label={`WhatsApp con ${String(l.f.nombre ?? "")}`}>
              <ChatView chat={String(l.f.telefono ?? "")} title={String(l.f.nombre ?? "Lead")} subtitle={String(l.f.telefono ?? "")} onBack={() => setChatLead(null)} toast={toast} />
            </aside>
          </div>
        );
      })()}
      <PhoneAlerts />
      {toastMsg && (
        <div className={toastMsg.error ? "toast bad" : "toast"} role="status">
          {toastMsg.msg}
        </div>
      )}
    </div>
  );
}
