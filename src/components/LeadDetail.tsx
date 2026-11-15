"use client";
import { useEffect, useState } from "react";
import { LABELS, stageOf } from "@/lib/fields";
import type { FieldKey, Lead, LeadsPayload } from "@/lib/types";
import type { Actions } from "./App";
import { dayKey, fmtAgo, fmtWhen, parseWhen, pretty, str, telHref, timeKey, waHref } from "./util";
import { Chip } from "./views";

interface Props {
  lead: Lead;
  data: LeadsPayload;
  actions: Actions;
  onClose: () => void;
}

const EDITABLE: FieldKey[] = ["nombre", "telefono", "email", "cp"];
const INFO: FieldKey[] = ["compania", "cuantoPaga", "titular", "quiereTele", "cp", "email"];

export default function LeadDetail({ lead, data, actions, onClose }: Props) {
  const f = lead.f;
  const { schema, me } = data;
  const admin = me.role === "admin";
  const cb = parseWhen(f.rellamada);
  const [cbDate, setCbDate] = useState(cb ? dayKey(cb.date) : "");
  const [cbTime, setCbTime] = useState(cb?.hasTime ? timeKey(cb.date) : "");
  const [notes, setNotes] = useState(str(f.comentarios));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const hasOption = (name: string) => schema.estado.options?.some((o) => o.name === name);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Si el lead cambia en Notion mientras la ficha está abierta, refleja los valores nuevos
  useEffect(() => {
    const w = parseWhen(f.rellamada);
    setCbDate(w ? dayKey(w.date) : "");
    setCbTime(w?.hasTime ? timeKey(w.date) : "");
  }, [f.rellamada]);
  useEffect(() => setNotes(str(f.comentarios)), [f.comentarios]);

  const save = (fields: Parameters<Actions["save"]>[1]) => actions.save(lead.id, fields);

  function callbackValue(date: string, time: string): string | null {
    if (!date) return null;
    return time ? new Date(`${date}T${time}:00`).toISOString() : date;
  }
  function setCallback(date: string, time: string) {
    setCbDate(date);
    setCbTime(time);
    const extra = date && !f.estado && hasOption("RELLAMAR") ? { estado: "RELLAMAR" } : {};
    save({ rellamada: callbackValue(date, time), ...extra });
  }
  function quick(days: number, time: string) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setCallback(dayKey(d), time);
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={`Ficha de ${str(f.nombre)}`}>
        <header className="sheet-head">
          <button className="btn small" onClick={onClose}>← Volver</button>
          {lead.url && (
            <a className="btn small" href={lead.url} target="_blank" rel="noreferrer">Abrir en Notion</a>
          )}
        </header>

        <div className="sheet-body">
          <div>
            <h2 className="lead-name">{str(f.nombre) || "Sin nombre"}</h2>
            <p className="muted">
              {str(f.telefono)} · entró {fmtAgo(f.fecha)}
            </p>
            <div className="chips">
              <Chip value={f.estado} schema={schema} />
              <Chip value={f.comercial} schema={schema} field="comercial" />
              <Chip value={f.estadoContrato} schema={schema} field="estadoContrato" />
            </div>
          </div>

          <div className="contact">
            <a className="btn primary" href={telHref(f.telefono)}>Llamar</a>
            <a className="btn" href={waHref(f.telefono)} target="_blank" rel="noreferrer">WhatsApp</a>
            {f.email && <a className="btn" href={`mailto:${str(f.email)}`}>Email</a>}
          </div>

          <section className="card inner">
            <h3>Seguimiento</h3>
            <div className="contact">
              <button className="btn" onClick={() => actions.attempt(lead.id)}>Registrar intento</button>
              {hasOption("ILOCALIZABLE") && (
                <button className="btn" onClick={() => actions.attempt(lead.id, { estado: "ILOCALIZABLE" })}>No contesta</button>
              )}
            </div>
            <p className="muted hint">
              {[f.intento1, f.intento2, f.intento3].filter(Boolean).length === 0
                ? "Sin intentos de llamada todavía."
                : `Intentos: ${[f.intento1, f.intento2, f.intento3].filter(Boolean).map(str).join("  ·  ")}`}
              {f.fechaContacto ? ` — primer contacto: ${fmtWhen(f.fechaContacto)}` : ""}
            </p>

            <label>
              Estado
              <select value={str(f.estado)} onChange={(e) => save({ estado: e.target.value || null })}>
                <option value="">Sin contactar</option>
                {schema.estado.options?.map((o) => <option key={o.name}>{o.name}</option>)}
              </select>
            </label>

            <div className="field">
              <span className="label">Rellamada</span>
              <div className="inline">
                <input type="date" aria-label="Día de la rellamada" value={cbDate} onChange={(e) => setCallback(e.target.value, e.target.value ? cbTime : "")} />
                <input type="time" aria-label="Hora de la rellamada" value={cbTime} disabled={!cbDate} onChange={(e) => setCallback(cbDate, e.target.value)} />
              </div>
              <div className="quick">
                <button className="btn small" onClick={() => quick(0, timeKey(new Date(Date.now() + 2 * 3600_000)))}>En 2 h</button>
                <button className="btn small" onClick={() => quick(1, "10:00")}>Mañana 10:00</button>
                <button className="btn small" onClick={() => quick(1, "17:00")}>Mañana 17:00</button>
                {cbDate && <button className="btn small" onClick={() => setCallback("", "")}>Quitar</button>}
              </div>
            </div>

            {admin ? (
              <label>
                Comercial
                <select value={str(f.comercial)} onChange={(e) => save({ comercial: e.target.value || null })}>
                  <option value="">Sin asignar</option>
                  {data.comerciales.map((c) => <option key={c}>{c}</option>)}
                  {f.comercial && !data.comerciales.includes(str(f.comercial)) && <option>{str(f.comercial)}</option>}
                </select>
              </label>
            ) : (
              !f.comercial && me.code && (
                <button className="btn" onClick={() => save({ comercial: me.code })}>Asignarme este lead</button>
              )
            )}

            {(stageOf(f.estado) === "ganado" || f.estadoContrato) && schema.estadoContrato.type !== "missing" && (
              <label>
                Estado del contrato
                <select value={str(f.estadoContrato)} onChange={(e) => save({ estadoContrato: e.target.value || null })}>
                  <option value="">—</option>
                  {schema.estadoContrato.options?.map((o) => <option key={o.name}>{o.name}</option>)}
                </select>
              </label>
            )}

            {(stageOf(f.estado) === "ganado" || lead.contrato) && (
              <div className="field">
                <span className="label">Contrato</span>
                <span className="muted hint">{lead.contrato ? `Adjunto en Notion: ${lead.contrato}` : "Sin contrato adjunto."}</span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  aria-label="Subir contrato"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 4 * 1024 * 1024) return actions.toast("El archivo supera los 4 MB", true);
                    const form = new FormData();
                    form.append("file", file);
                    const res = await fetch(`/api/leads/${lead.id}/contrato`, { method: "POST", body: form }).catch(() => null);
                    const j = await res?.json().catch(() => ({}));
                    if (res?.ok) {
                      actions.replace(j.lead);
                      actions.toast("Contrato subido a Notion");
                    } else actions.toast(`No se subió el contrato: ${j?.error ?? "sin conexión"}`, true);
                  }}
                />
              </div>
            )}

            <label className="check">
              <input type="checkbox" checked={f.whatsapp === true} onChange={(e) => save({ whatsapp: e.target.checked })} />
              WhatsApp enviado
            </label>

            <label>
              Comentarios
              <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes.trim() !== str(f.comentarios).trim() && save({ comentarios: notes })} />
            </label>
            {notes.trim() !== str(f.comentarios).trim() && (
              <button className="btn primary small" onClick={() => save({ comentarios: notes })}>Guardar comentarios</button>
            )}
          </section>

          <section className="card inner">
            <div className="between">
              <h3>Datos del lead</h3>
              <button
                className="btn small"
                onClick={() => {
                  if (editing) {
                    const changed = Object.fromEntries(Object.entries(draft).filter(([k, v]) => v.trim() !== str(f[k as FieldKey])));
                    if (Object.keys(changed).length) save(changed);
                  } else setDraft(Object.fromEntries(EDITABLE.map((k) => [k, str(f[k])])));
                  setEditing(!editing);
                }}
              >
                {editing ? "Guardar" : "Editar"}
              </button>
            </div>
            {editing ? (
              EDITABLE.map((k) => (
                <label key={k}>
                  {LABELS[k]}
                  <input value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
                </label>
              ))
            ) : (
              <dl className="info">
                {INFO.map((k) => (
                  <div key={k}>
                    <dt>{LABELS[k]}</dt>
                    <dd>{pretty(f[k]) || "—"}</dd>
                  </div>
                ))}
                <div>
                  <dt>{LABELS.fecha}</dt>
                  <dd>{parseWhen(f.fecha)?.date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) ?? "—"}</dd>
                </div>
              </dl>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
