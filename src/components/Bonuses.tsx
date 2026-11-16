"use client";
import Empty from "./Empty";
import { useCallback, useEffect, useState } from "react";
import type { Bonus, LeadsPayload } from "@/lib/types";
import { useDialogs } from "./Dialogs";
import Icon from "./Icon";
import { api } from "./util";

const METRIC = { firmados: "fibras firmadas", llamadas: "llamadas", contactos: "contactos" } as const;
const PERIOD = { dia: "hoy", semana: "esta semana", mes: "este mes" } as const;
const PERIOD_NAME = { dia: "Cada día", semana: "Cada semana", mes: "Cada mes" } as const;

const same = (a: string, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

function useBonuses(refreshKey: unknown) {
  const [state, setState] = useState<{ ready: boolean; bonuses: Bonus[] } | null>(null);
  const load = useCallback(async () => {
    try {
      setState(await api<{ ready: boolean; bonuses: Bonus[] }>("/api/bonos"));
    } catch {
      setState((s) => s ?? { ready: true, bonuses: [] });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load, refreshKey]);
  return { state, load };
}

function Meter({ b, quiet }: { b: Bonus; quiet?: boolean }) {
  const value = b.value ?? 0;
  const done = value >= b.goal;
  return (
    <div className={done ? "bonus done" : "bonus"}>
      <span className="bonus-ico"><Icon name={done ? "trophy" : "target"} size={20} /></span>
      <div className="bonus-main">
        <div className="bonus-head">
          <strong>{b.title}</strong>
          {!quiet && (
            <span className="bonus-num">
              {value}
              <small>/{b.goal}</small>
            </span>
          )}
        </div>
        <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={b.goal} aria-valuenow={Math.min(value, b.goal)} aria-label={b.title}>
          <span style={{ width: `${Math.min(100, (value / b.goal) * 100)}%` }} />
        </div>
        <span className="muted hint">
          {done ? "Conseguido · " : ""}
          {b.prize ? `${b.prize} · ` : ""}
          {METRIC[b.metric]} {PERIOD[b.period]} · {b.para ? "tuyo" : "equipo"}
        </span>
      </div>
    </div>
  );
}

/** Bonos del comercial en el modo «Llamar»: el del equipo y los suyos. */
export function BonusCards({ data, refreshKey }: { data: LeadsPayload; refreshKey: unknown }) {
  const { state } = useBonuses(refreshKey);
  if (!state) return null;
  const mine = state.bonuses.filter((b) => b.active && (!b.para || same(b.para, data.me.code) || same(b.para, data.me.name)));
  if (!mine.length) {
    return (
      <div className="bonus empty-bonus">
        <span className="bonus-ico"><Icon name="sparkle" size={20} /></span>
        <span>
          <strong>Todavía no hay bono en juego</strong>
          <span className="muted hint">Dirección está pensando en algo rico. Mientras tanto, ¡a por la siguiente llamada!</span>
        </span>
      </div>
    );
  }
  // Primero el del equipo, luego los individuales
  return (
    <div className="bonus-list">
      {[...mine].sort((a, b) => Number(!!a.para) - Number(!!b.para)).map((b) => <Meter key={b.id} b={b} quiet={data.me.role !== "admin" && b.metric === "firmados"} />)}
    </div>
  );
}

const EMPTY = { title: "", prize: "", metric: "firmados", goal: "5", period: "semana", para: "" };

/** Gestión de bonos para dirección: crear, editar, pausar y borrar. */
export function BonusAdmin({ data, people, toast }: { data: LeadsPayload; people: string[]; toast: (m: string, e?: boolean) => void }) {
  const { state, load } = useBonuses(0);
  const dlg = useDialogs();
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const targets = [...new Set([...data.comerciales, ...people])];

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      await load();
    } catch (e) {
      toast((e as Error).message, true);
    }
    setBusy(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, goal: Number(form.goal) };
    run(
      () => (editing ? api(`/api/bonos/${editing}`, "PATCH", body) : api("/api/bonos", "POST", body)),
      editing ? "Bono actualizado" : "Bono creado",
    ).then(() => {
      setForm(EMPTY);
      setEditing(null);
    });
  }

  return (
    <section className="card">
      <h2>Bonos</h2>
      <p className="muted hint">
        Un bono «de todo el equipo» suma lo de todos, incluida dirección si llama. Uno individual solo cuenta lo de esa persona.
        Las fibras firmadas salen de Contrataciones y solo cuentan las de primera residencia que siguen en pie (ni líneas, ni segundas residencias, ni bajas). Llamadas y contactos salen de la pestaña Llamar.
      </p>
      {!state ? (
        <p className="muted">Cargando…</p>
      ) : !state.ready ? (
        <p className="notice">Para guardar bonos hace falta la página «BUT Calls» en Notion compartida con la integración.</p>
      ) : (
        <>
          {state.bonuses.length === 0 && <Empty small title="Aún no hay bonos" text="Crea el primero aquí abajo." />}
          <ul className="bonus-admin">
            {state.bonuses.map((b) => (
              <li key={b.id} className={b.active ? "" : "off"}>
                <div>
                  <strong>{b.title}</strong> <span className="pill">{b.para || "Todo el equipo"}</span> {!b.active && <span className="pill warn">Pausado</span>}
                  <div className="muted hint">
                    {b.value ?? 0} de {b.goal} {METRIC[b.metric]} · {PERIOD_NAME[b.period].toLowerCase()}
                    {b.prize ? ` · Premio: ${b.prize}` : ""}
                  </div>
                </div>
                <div className="cell-actions">
                  <button
                    className="btn small"
                    onClick={() => {
                      setEditing(b.id);
                      setForm({ title: b.title, prize: b.prize, metric: b.metric, goal: String(b.goal), period: b.period, para: b.para });
                    }}
                  >
                    Editar
                  </button>
                  <button className="btn small" disabled={busy} onClick={() => run(() => api(`/api/bonos/${b.id}`, "PATCH", { active: !b.active }), b.active ? "Bono pausado" : "Bono activado")}>
                    {b.active ? "Pausar" : "Activar"}
                  </button>
                  <button className="btn small" disabled={busy} onClick={async () => (await dlg.confirm({ title: `¿Borrar el bono «${b.title}»?`, text: "Dejará de verse y no se puede recuperar.", ok: "Borrar", danger: true })) && run(() => api(`/api/bonos/${b.id}`, "DELETE"), "Bono borrado")}>
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <form className="newuser" onSubmit={submit}>
            <h3>{editing ? "Editar bono" : "Añadir bono"}</h3>
            <div className="grid2">
              <label>
                Nombre
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="p. ej. Reto de la semana" />
              </label>
              <label>
                Premio
                <input value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} placeholder="p. ej. Desayuno para todos" />
              </label>
              <label>
                Para quién
                <select value={form.para} onChange={(e) => setForm({ ...form, para: e.target.value })}>
                  <option value="">Todo el equipo (global)</option>
                  {targets.map((t) => <option key={t}>{t}</option>)}
                  {form.para && !targets.includes(form.para) && <option>{form.para}</option>}
                </select>
              </label>
              <label>
                Qué cuenta
                <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
                  <option value="firmados">Fibras firmadas (primera residencia)</option>
                  <option value="contactos">Contactos (llamadas con respuesta)</option>
                  <option value="llamadas">Llamadas</option>
                </select>
              </label>
              <label>
                Meta
                <input required type="number" min={1} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
              </label>
              <label>
                Se renueva
                <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
                  <option value="dia">{PERIOD_NAME.dia}</option>
                  <option value="semana">{PERIOD_NAME.semana}</option>
                  <option value="mes">{PERIOD_NAME.mes}</option>
                </select>
              </label>
            </div>
            <div className="quick">
              <button className="btn primary" disabled={busy}>{editing ? "Guardar cambios" : "Crear bono"}</button>
              {editing && <button type="button" className="btn" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancelar</button>}
            </div>
          </form>
        </>
      )}
    </section>
  );
}
