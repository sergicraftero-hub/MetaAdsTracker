"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lead, LeadsPayload, WaChat, WaMessage } from "@/lib/types";
import { digits, str } from "./util";

interface Inbox {
  configured: boolean;
  ok: boolean;
  status: string;
  phone: string;
  chats: WaChat[];
}

const MAX = 4 * 1024 * 1024;
const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
function shortDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? hour(iso) : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
const dayTitle = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
const TICKS: Record<string, string> = { pending: "🕓", sent: "✓", delivered: "✓✓", read: "✓✓ leído", played: "✓✓ leído", failed: "no enviado" };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url).catch(() => null);
  const j = await res?.json().catch(() => ({}));
  if (res?.status === 401) window.location.href = "/login";
  if (!res?.ok) throw new Error(j?.error ?? "Sin conexión");
  return j as T;
}

/** Conversación de WhatsApp con un número, con caja para escribir y adjuntar. */
export function ChatView({ chat, title, subtitle, onBack, onOpenLead, toast }: { chat: string; title: string; subtitle?: string; onBack?: () => void; onOpenLead?: () => void; toast: (m: string, e?: boolean) => void }) {
  const [messages, setMessages] = useState<WaMessage[] | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const load = useCallback(
    async (read: boolean) => {
      try {
        const r = await getJson<{ messages: WaMessage[] }>(`/api/whatsapp/chat?id=${encodeURIComponent(chat)}${read ? "&leer=1" : ""}`);
        setMessages(r.messages);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [chat],
  );

  useEffect(() => {
    setMessages(null);
    count.current = 0;
    load(true);
    const timer = setInterval(() => document.visibilityState === "visible" && load(false), 6000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (messages && messages.length !== count.current) {
      count.current = messages.length;
      end.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (file && file.size > MAX) return toast("El archivo supera los 4 MB", true);
    setBusy(true);
    const form = new FormData();
    form.append("id", chat);
    form.append("text", text);
    if (file) form.append("file", file);
    const res = await fetch("/api/whatsapp/chat", { method: "POST", body: form }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    if (res?.ok) {
      setMessages((m) => [...(m ?? []), j.message]);
      setText("");
      setFile(null);
      setFileKey((k) => k + 1);
    } else toast(`No se envió: ${j?.error ?? "sin conexión"}`, true);
    setBusy(false);
  }

  let lastDay = "";
  return (
    <div className="chat">
      <header className="chat-head">
        {onBack && <button className="btn small" onClick={onBack}>←</button>}
        <div className="chat-title">
          <strong>{title}</strong>
          {subtitle && <span className="muted hint">{subtitle}</span>}
        </div>
        {onOpenLead && <button className="btn small" onClick={onOpenLead}>Ver ficha</button>}
      </header>
      <div className="chat-body">
        {error && <p className="error hint">{error}</p>}
        {messages === null && !error && <p className="muted hint">Cargando conversación…</p>}
        {messages?.length === 0 && <p className="muted hint">Aún no hay mensajes con este número. Escribe el primero.</p>}
        {messages?.map((m) => {
          const day = dayTitle(m.at);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id} className="msg-wrap">
              {sep && <div className="day-sep cap">{day}</div>}
              <div className={m.fromMe ? "msg me" : "msg"}>
                {m.file &&
                  (m.file.mime.startsWith("image/") ? (
                    <a href={`/api/whatsapp/media/${m.file.id}`} target="_blank" rel="noreferrer">
                      <img src={`/api/whatsapp/media/${m.file.id}`} alt={m.file.kind} loading="lazy" />
                    </a>
                  ) : m.file.mime.startsWith("audio/") ? (
                    <audio controls preload="none" src={`/api/whatsapp/media/${m.file.id}`} />
                  ) : (
                    <a className="file" href={`/api/whatsapp/media/${m.file.id}`} download={m.file.name}>
                      📎 {m.file.name}
                    </a>
                  ))}
                {m.text && <span className="note-text">{m.text}</span>}
                <span className="msg-meta">
                  {m.fromMe && m.by ? `${m.by} · ` : ""}
                  {hour(m.at)}
                  {m.fromMe && m.status ? ` · ${TICKS[m.status] ?? m.status}` : ""}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="chat-form" onSubmit={send}>
        {file && (
          <span className="pill attach-pill">
            📎 {file.name}
            <button type="button" aria-label="Quitar archivo" onClick={() => { setFile(null); setFileKey((k) => k + 1); }}>×</button>
          </span>
        )}
        <div className="chat-row">
          <label className="icon-btn clip" title="Adjuntar archivo (hasta 4 MB)">
            📎
            <input key={fileKey} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <textarea
            rows={1}
            value={text}
            placeholder="Escribe un mensaje"
            aria-label="Mensaje"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !busy && (text.trim() || file)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="btn primary" disabled={busy || (!text.trim() && !file)}>{busy ? "…" : "Enviar"}</button>
        </div>
      </form>
    </div>
  );
}

/** Pestaña WhatsApp: la bandeja del número compartido, igual para todo el equipo. */
export default function WhatsApp({ data, openLead, toast }: { data: LeadsPayload; openLead: (id: string) => void; toast: (m: string, e?: boolean) => void }) {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      setInbox(await getJson<Inbox>("/api/whatsapp"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const byPhone = useMemo(() => {
    const m = new Map<string, Lead>();
    for (const l of data.leads) if (l.f.telefono) m.set(digits(l.f.telefono), l);
    return m;
  }, [data.leads]);
  const nameOf = (c: WaChat) => str(byPhone.get(c.phone)?.f.nombre) || c.name || `+${c.phone}`;

  if (error && !inbox) return <section className="card"><p className="error">{error}</p><button className="btn" onClick={load}>Reintentar</button></section>;
  if (!inbox) return <p className="muted">Cargando WhatsApp…</p>;
  if (!inbox.configured) {
    return (
      <section className="card">
        <h2>WhatsApp compartido</h2>
        <p className="notice">
          Falta conectar el WhatsApp. En whapi.cloud crea un canal, escanea el QR con el número del equipo y copia el token del
          canal en la variable <code>WHAPI_TOKEN</code> del servidor (Vercel → Settings → Environment Variables) y vuelve a desplegar.
        </p>
      </section>
    );
  }
  if (!inbox.ok) {
    return (
      <section className="card">
        <h2>WhatsApp compartido</h2>
        <p className="notice">
          El número no está conectado ahora mismo (estado: {inbox.status || "desconocido"}). Entra en el panel de Whapi y vuelve a
          escanear el QR con el teléfono del equipo.
        </p>
        <button className="btn" onClick={load}>Comprobar de nuevo</button>
      </section>
    );
  }

  const chats = inbox.chats.filter((c) => !q || `${nameOf(c)} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  const current = inbox.chats.find((c) => c.id === open);
  const typed = digits(q);
  const lead = open ? byPhone.get(open.replace(/@.*/, "")) : undefined;

  return (
    <div className={open ? "wa has-open" : "wa"}>
      <aside className="card wa-list">
        <input type="search" placeholder="Buscar chat o escribir un teléfono" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar chat" />
        <p className="muted hint">Número compartido: +{inbox.phone}</p>
        <ul className="rows">
          {chats.map((c) => (
            <li key={c.id} className="row">
              <button className={c.id === open ? "row-main chat-item on" : "row-main chat-item"} onClick={() => setOpen(c.id)}>
                <span className="row-title">
                  <strong>{nameOf(c)}</strong>
                  {byPhone.has(c.phone) && <span className="chip c-blue">Lead</span>}
                  {c.unread > 0 && <span className="unread" aria-label={`${c.unread} sin leer`}>{c.unread}</span>}
                </span>
                <span className="row-sub muted">{c.lastFromMe ? "Tú: " : ""}{c.last || "—"}</span>
              </button>
              <span className="row-meta muted">{shortDate(c.at)}</span>
            </li>
          ))}
        </ul>
        {chats.length === 0 && typed.length >= 9 && (
          <button className="btn" onClick={() => setOpen(`${typed}@s.whatsapp.net`)}>Abrir chat con +{typed}</button>
        )}
        {chats.length === 0 && typed.length < 9 && <p className="muted empty-line">Ningún chat coincide.</p>}
      </aside>
      <section className="card wa-chat">
        {open ? (
          <ChatView
            key={open}
            chat={open}
            title={str(lead?.f.nombre) || (current ? nameOf(current) : `+${open.replace(/@.*/, "")}`)}
            subtitle={`+${open.replace(/@.*/, "")}`}
            onBack={() => setOpen(null)}
            onOpenLead={lead ? () => openLead(lead.id) : undefined}
            toast={toast}
          />
        ) : (
          <p className="muted empty-line">Elige un chat de la lista.</p>
        )}
      </section>
    </div>
  );
}
