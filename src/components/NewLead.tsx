"use client";
import { useState } from "react";
import type { Lead, LeadsPayload } from "@/lib/types";
import { api } from "./util";

export default function NewLead({ data, onClose, onCreated }: { data: LeadsPayload; onClose: () => void; onCreated: (l: Lead) => void }) {
  const [f, setF] = useState({ nombre: "", telefono: "", email: "", cp: "", comentarios: "", comercial: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields = Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim()));
      onCreated((await api<{ lead: Lead }>("/api/leads", "POST", { fields })).lead);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay centered" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="card modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Nuevo lead">
        <h2>Nuevo lead</h2>
        <label>
          Nombre
          <input required value={f.nombre} onChange={set("nombre")} autoFocus />
        </label>
        <label>
          Teléfono
          <input required type="tel" value={f.telefono} onChange={set("telefono")} placeholder="+34…" />
        </label>
        <label>
          Email
          <input type="email" value={f.email} onChange={set("email")} />
        </label>
        <label>
          Código postal
          <input value={f.cp} onChange={set("cp")} inputMode="numeric" />
        </label>
        {data.me.role === "admin" && (
          <label>
            Comercial
            <select value={f.comercial} onChange={set("comercial")}>
              <option value="">Sin asignar</option>
              {data.comerciales.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        )}
        <label>
          Comentarios
          <textarea rows={3} value={f.comentarios} onChange={set("comentarios")} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="contact">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={busy}>{busy ? "Creando…" : "Crear lead"}</button>
        </div>
      </form>
    </div>
  );
}
