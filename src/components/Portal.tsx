"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isClosed } from "@/lib/fields";
import type { Leave, LeadsPayload, Payslip, Person, Shift } from "@/lib/types";
import { useDialogs } from "./Dialogs";
import Icon from "./Icon";
import { SHIFT_WARN_MS, api, dayKey, shiftRemaining } from "./util";

type Toast = (m: string, e?: boolean) => void;
interface Props {
  data: LeadsPayload;
  toast: Toast;
}

const SETUP = "Para usar el portal hace falta la página «BUT Calls» en Notion compartida con la integración.";
const pad = (n: number) => String(n).padStart(2, "0");
const hms = (ms: number) => `${pad(Math.floor(ms / 3600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}`;
const hm = (ms: number) => `${Math.floor(ms / 3600_000)} h ${pad(Math.round((ms % 3600_000) / 60_000))} min`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
const monthName = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
const shiftMonth = (m: string, by: number) => {
  const d = new Date(`${m}-01T12:00:00`);
  d.setMonth(d.getMonth() + by);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const breakMs = (s: Shift, now: number) => s.breaks.reduce((a, b) => a + Math.max(0, (b.e ? new Date(b.e).getTime() : now) - new Date(b.s).getTime()), 0);
const workedMs = (s: Shift, now: number) => Math.max(0, (s.end ? new Date(s.end).getTime() : now) - new Date(s.start).getTime() - breakMs(s, now));
const localInput = (iso: string) => {
  const d = new Date(iso);
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Avisa al resto de la app (campana de dirección, calendario) de que algo ha cambiado en el portal. */
export const portalChanged = () => window.dispatchEvent(new Event("portal-changed"));

/* ============================== Fichaje ============================== */

function Clock({ data, toast }: Props) {
  const dlg = useDialogs();
  const admin = data.me.role === "admin";
  const [month, setMonth] = useState(dayKey(new Date()).slice(0, 7));
  const [who, setWho] = useState(data.me.email);
  const [state, setState] = useState<{ ready: boolean; open: Shift | null; shifts: Shift[]; people: Person[] } | null>(null);
  const [skew, setSkew] = useState(0);
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ id: string; start: string; end: string; reason: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ ready: boolean; open: Shift | null; shifts: Shift[]; people: Person[]; now?: string }>(`/api/portal/fichaje?mes=${month}&usuario=${encodeURIComponent(who)}`);
      setState(r);
      if (r.now) setSkew(new Date(r.now).getTime() - Date.now());
    } catch (e) {
      toast((e as Error).message, true);
    }
  }, [month, who, toast]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function punch(action: string, ok: string) {
    setBusy(true);
    try {
      await api("/api/portal/fichaje", "POST", { action });
      toast(ok);
      await load();
    } catch (e) {
      toast((e as Error).message, true);
    }
    setBusy(false);
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    try {
      await api("/api/portal/fichaje", "PATCH", { id: edit.id, start: new Date(edit.start).toISOString(), end: edit.end ? new Date(edit.end).toISOString() : null, reason: edit.reason });
      toast("Registro corregido");
      setEdit(null);
      await load();
    } catch (e) {
      toast((e as Error).message, true);
    }
    setBusy(false);
  }

  if (!state) return <p className="muted">Cargando…</p>;
  if (!state.ready) return <p className="notice">{SETUP}</p>;

  const now = Date.now() + skew;
  const open = state.open;
  const onBreak = !!open?.breaks.some((b) => !b.e);
  const total = state.shifts.reduce((a, s) => a + workedMs(s, now), 0);
  const all = who === "todos";

  return (
    <div className="stack">
      <section className="card clock">
        <span className={open ? (onBreak ? "pill warn" : "pill on") : "pill"}>{open ? (onBreak ? "En descanso" : "Trabajando") : "Fuera de jornada"}</span>
        <div className="clock-time" aria-live="off">{open ? hms(workedMs(open, now)) : "00:00:00"}</div>
        <p className="muted hint">
          {open
            ? `Entrada a las ${time(open.start)} · descansos: ${hm(breakMs(open, now))}`
            : "Pulsa «Entrar» al empezar tu jornada. La hora la registra el servidor, no tu dispositivo."}
        </p>
        {open && now - new Date(open.start).getTime() > 12 * 3600_000 && (
          <p className="error hint">Esta jornada lleva más de 12 horas abierta. Si olvidaste fichar la salida, ficha ahora y pide a dirección que corrija la hora.</p>
        )}
        <div className="contact">
          {!open && <button className="btn primary big" disabled={busy} onClick={() => punch("entrar", "Entrada registrada")}>Entrar</button>}
          {open && !onBreak && <button className="btn big" disabled={busy} onClick={() => punch("pausa", "Descanso iniciado")}>Empezar descanso</button>}
          {open && onBreak && <button className="btn primary big" disabled={busy} onClick={() => punch("reanudar", "Descanso terminado")}>Volver del descanso</button>}
          {open && <button className="btn big danger" disabled={busy} onClick={async () => (await dlg.confirm({ title: "¿Terminar la jornada?", text: "Se registrará tu hora de salida.", ok: "Fichar salida" })) && punch("salir", "Salida registrada")}>Salir</button>}
        </div>
      </section>

      <section className="card">
        <div className="between">
          <h2>Registro de jornada</h2>
          <div className="month-nav">
            <button className="btn small" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior"><Icon name="left" size={16} /></button>
            <strong className="cap">{monthName(month)}</strong>
            <button className="btn small" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente"><Icon name="right" size={16} /></button>
          </div>
        </div>
        <div className="filters">
          {admin && (
            <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Trabajador">
              {state.people.map((p) => <option key={p.email} value={p.email}>{p.name}</option>)}
              <option value="todos">Todos los trabajadores</option>
            </select>
          )}
          <a className="btn" href={`/api/portal/fichaje/export?mes=${month}&usuario=${encodeURIComponent(who)}`}>Descargar registro (CSV)</a>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {all && <th>Trabajador</th>}
                <th>Día</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Descansos</th>
                <th>Trabajado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.shifts.map((s) => (
                <tr key={s.id}>
                  {all && <th scope="row">{s.name}</th>}
                  <td className="cap">{new Date(s.start).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}</td>
                  <td>{time(s.start)}</td>
                  <td>{s.end ? time(s.end) : "abierta"}</td>
                  <td title={s.breaks.map((b) => `${time(b.s)}–${b.e ? time(b.e) : ""}`).join(", ")}>{s.breaks.length ? hm(breakMs(s, now)) : "—"}</td>
                  <td>{hm(workedMs(s, now))}</td>
                  <td className="cell-actions">
                    {!s.valid && <span className="pill warn" title="El registro se ha cambiado directamente en Notion, fuera de la aplicación">Alterado</span>}
                    {s.edits && <span className="pill" title={s.edits}>Corregido</span>}
                    {admin && <button className="btn small" onClick={() => setEdit({ id: s.id, start: localInput(s.start), end: s.end ? localInput(s.end) : "", reason: "" })}>Corregir</button>}
                  </td>
                </tr>
              ))}
              {state.shifts.length === 0 && (
                <tr><td colSpan={7} className="muted">Sin fichajes este mes.</td></tr>
              )}
            </tbody>
            {state.shifts.length > 0 && (
              <tfoot>
                <tr>
                  <th scope="row" colSpan={all ? 5 : 4}>Total del mes</th>
                  <td><strong>{hm(total)}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="muted hint">
          El registro guarda la hora de inicio y fin de cada jornada y los descansos, se conserva en Notion y cada trabajador puede consultar y
          descargar el suyo. Las correcciones solo las hace dirección, con motivo, y queda anotado quién, cuándo y el valor anterior.
        </p>
      </section>

      {edit && (
        <div className="overlay centered" onClick={(e) => e.target === e.currentTarget && setEdit(null)}>
          <div className="card modal" role="dialog" aria-modal="true" aria-label="Corregir fichaje">
            <h2>Corregir fichaje</h2>
            <label>
              Entrada
              <input type="datetime-local" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} />
            </label>
            <label>
              Salida (vacío = jornada abierta)
              <input type="datetime-local" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} />
            </label>
            <label>
              Motivo de la corrección (obligatorio)
              <textarea rows={2} value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} placeholder="p. ej. Olvidó fichar la salida; salió a las 18:00" />
            </label>
            <div className="contact">
              <button className="btn" onClick={() => setEdit(null)}>Cancelar</button>
              <button className="btn primary" disabled={busy || edit.reason.trim().length < 5} onClick={saveEdit}>Guardar corrección</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Vacaciones y solicitudes ============================== */

const STATUS_CHIP = { pendiente: "c-yellow", aprobada: "c-green", rechazada: "c-red" } as const;
const range = (r: Leave) => (r.from === r.to ? fmtDay(r.from) : `${fmtDay(r.from)} – ${fmtDay(r.to)}`);
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
function countDays(from: string, to: string) {
  let total = 0;
  let work = 0;
  for (let d = new Date(`${from}T12:00:00`); dayKey(d) <= to; d.setDate(d.getDate() + 1)) {
    total++;
    if (d.getDay() !== 0 && d.getDay() !== 6) work++;
  }
  return { total, work };
}

export async function resolveLeave(id: string, status: "aprobada" | "rechazada", toast: Toast) {
  try {
    await api("/api/portal/solicitudes", "PATCH", { id, status });
    toast(status === "aprobada" ? "Solicitud aprobada" : "Solicitud rechazada");
    portalChanged();
  } catch (e) {
    toast((e as Error).message, true);
  }
}

function Leaves({ data, toast }: Props) {
  const dlg = useDialogs();
  const admin = data.me.role === "admin";
  const [state, setState] = useState<{ ready: boolean; requests: Leave[]; types: string[] } | null>(null);
  const [month, setMonth] = useState(dayKey(new Date()).slice(0, 7));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("Vacaciones");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await api("/api/portal/solicitudes"));
    } catch (e) {
      toast((e as Error).message, true);
    }
  }, [toast]);
  useEffect(() => {
    load();
    window.addEventListener("portal-changed", load);
    return () => window.removeEventListener("portal-changed", load);
  }, [load]);

  const days = useMemo(() => {
    const first = new Date(`${month}-01T12:00:00`);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { key: dayKey(d), day: d.getDate(), inMonth: dayKey(d).startsWith(month), weekend: d.getDay() === 0 || d.getDay() === 6 };
    });
  }, [month]);

  if (!state) return <p className="muted">Cargando…</p>;
  if (!state.ready) return <p className="notice">{SETUP}</p>;

  const mine = state.requests.filter((r) => r.user === data.me.email);
  const pending = state.requests.filter((r) => r.status === "pendiente");
  const on = (day: string) => state.requests.filter((r) => r.status !== "rechazada" && r.from <= day && day <= r.to);
  const sel = (day: string) => !!from && day >= from && day <= (to || from);
  const n = from ? countDays(from, to || from) : null;

  function pick(day: string) {
    if (!from || to || day < from) {
      setFrom(day);
      setTo("");
    } else setTo(day);
  }

  async function submit() {
    setBusy(true);
    try {
      await api("/api/portal/solicitudes", "POST", { type, from, to: to || from, note });
      toast("Solicitud enviada a dirección");
      setFrom("");
      setTo("");
      setNote("");
      portalChanged();
    } catch (e) {
      toast((e as Error).message, true);
    }
    setBusy(false);
  }

  async function remove(id: string) {
    try {
      await api(`/api/portal/solicitudes?id=${id}`, "DELETE");
      toast("Solicitud retirada");
      portalChanged();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <div className="stack">
      {admin && pending.length > 0 && (
        <section className="card">
          <h2>Pendientes de aprobar <span className="count">{pending.length}</span></h2>
          <ul className="bonus-admin">
            {pending.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.name}</strong> · {r.type} · {range(r)}
                  {r.note && <div className="muted hint">{r.note}</div>}
                </div>
                <div className="cell-actions">
                  <button className="btn primary small" onClick={() => resolveLeave(r.id, "aprobada", toast)}>Aprobar</button>
                  <button className="btn small" onClick={() => resolveLeave(r.id, "rechazada", toast)}>Rechazar</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="between">
          <h2>Calendario</h2>
          <div className="month-nav">
            <button className="btn small" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior"><Icon name="left" size={16} /></button>
            <strong className="cap">{monthName(month)}</strong>
            <button className="btn small" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente"><Icon name="right" size={16} /></button>
          </div>
        </div>
        <p className="muted hint">Toca el primer día y luego el último para pedir vacaciones u otra ausencia.</p>
        <div className="cal" role="grid" aria-label={`Calendario de ${monthName(month)}`}>
          {["L", "M", "X", "J", "V", "S", "D"].map((d) => <span key={d} className="cal-head">{d}</span>)}
          {days.map((d) => {
            const items = on(d.key);
            return (
              <button
                key={d.key}
                className={["cal-day", d.inMonth ? "" : "out", d.weekend ? "weekend" : "", sel(d.key) ? "sel" : ""].join(" ")}
                onClick={() => pick(d.key)}
                aria-pressed={sel(d.key)}
                title={items.map((r) => `${r.name}: ${r.type} (${r.status})`).join("\n")}
              >
                <span>{d.day}</span>
                <span className="cal-marks">
                  {items.slice(0, 3).map((r) => (
                    <i key={r.id} className={`chip ${STATUS_CHIP[r.status]}`}>{r.user === data.me.email ? "Yo" : r.name.split(" ")[0]}</i>
                  ))}
                  {items.length > 3 && <i className="chip">+{items.length - 3}</i>}
                </span>
              </button>
            );
          })}
        </div>

        {from && n && (
          <div className="step">
            <h3>
              Nueva solicitud: {fmtDay(from)}
              {to && to !== from ? ` – ${fmtDay(to)}` : ""} · {n.total} {n.total === 1 ? "día" : "días"} ({n.work} laborables)
            </h3>
            <div className="grid2">
              <label>
                Tipo
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {state.types.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>
                Comentario (opcional)
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            <div className="quick">
              <button className="btn primary" disabled={busy} onClick={submit}>Enviar solicitud</button>
              <button className="btn" onClick={() => { setFrom(""); setTo(""); }}>Cancelar</button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>{admin ? "Todas las solicitudes" : "Mis solicitudes"}</h2>
        <ul className="bonus-admin">
          {(admin ? state.requests : mine).map((r) => (
            <li key={r.id}>
              <div>
                {admin && <strong>{r.name} · </strong>}
                {r.type} · {range(r)} <span className={`chip ${STATUS_CHIP[r.status]}`}>{r.status}</span>
                {(r.note || r.resolved) && <div className="muted hint">{[r.note, r.resolved && `Resuelta por ${r.resolved}`].filter(Boolean).join(" · ")}</div>}
              </div>
              <div className="cell-actions">
                {admin && r.status !== "aprobada" && <button className="btn small" onClick={() => resolveLeave(r.id, "aprobada", toast)}>Aprobar</button>}
                {admin && r.status !== "rechazada" && <button className="btn small" onClick={() => resolveLeave(r.id, "rechazada", toast)}>Rechazar</button>}
                {(admin || r.status === "pendiente") && <button className="btn small" onClick={async () => (await dlg.confirm({ title: "¿Retirar esta solicitud?", ok: "Retirar", danger: true })) && remove(r.id)}>Retirar</button>}
              </div>
            </li>
          ))}
        </ul>
        {(admin ? state.requests : mine).length === 0 && <p className="muted empty-line">Aún no hay solicitudes.</p>}
      </section>
    </div>
  );
}

/* ============================== Nóminas ============================== */

function Payslips({ data, toast }: Props) {
  const dlg = useDialogs();
  const admin = data.me.role === "admin";
  const [state, setState] = useState<{ ready: boolean; payslips: Payslip[]; people: Person[] } | null>(null);
  const [user, setUser] = useState("");
  const [period, setPeriod] = useState(dayKey(new Date()).slice(0, 7));
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await api("/api/portal/nominas"));
    } catch (e) {
      toast((e as Error).message, true);
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append("user", user);
    form.append("period", period);
    form.append("file", file);
    const res = await fetch("/api/portal/nominas", { method: "POST", body: form }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    if (res?.ok) {
      toast("Nómina subida");
      setFile(null);
      setFileKey((k) => k + 1);
      await load();
    } else toast(j?.error ?? "No se pudo subir", true);
    setBusy(false);
  }

  if (!state) return <p className="muted">Cargando…</p>;
  if (!state.ready) return <p className="notice">{SETUP}</p>;

  return (
    <div className="stack">
      {admin && (
        <section className="card">
          <h2>Subir nómina</h2>
          <form className="newuser first" onSubmit={upload}>
            <div className="grid2">
              <label>
                Trabajador
                <select required value={user} onChange={(e) => setUser(e.target.value)}>
                  <option value="">Elige…</option>
                  {state.people.map((p) => <option key={p.email} value={p.email}>{p.name}</option>)}
                </select>
              </label>
              <label>
                Mes
                <input required type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </label>
              <label>
                PDF (hasta 4 MB)
                <input key={fileKey} required type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <button className="btn primary" disabled={busy || !file || !user}>{busy ? "Subiendo…" : "Subir nómina"}</button>
          </form>
        </section>
      )}
      <section className="card">
        <h2>{admin ? "Nóminas subidas" : "Mis nóminas"}</h2>
        <ul className="bonus-admin">
          {state.payslips.map((p) => (
            <li key={p.id}>
              <div>
                <strong className="cap">{monthName(p.period)}</strong>
                {admin && ` · ${p.name}`}
                <div className="muted hint">{p.file}</div>
              </div>
              <div className="cell-actions">
                <a className="btn small primary" href={`/api/portal/nominas/${p.id}`} target="_blank" rel="noreferrer">Descargar</a>
                {admin && (
                  <button
                    className="btn small"
                    onClick={async () => {
                      if (!(await dlg.confirm({ title: "¿Borrar esta nómina?", text: "El trabajador dejará de verla.", ok: "Borrar", danger: true }))) return;
                      try {
                        await api(`/api/portal/nominas?id=${p.id}`, "DELETE");
                        toast("Nómina borrada");
                        load();
                      } catch (e) {
                        toast((e as Error).message, true);
                      }
                    }}
                  >
                    Borrar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {state.payslips.length === 0 && <p className="muted empty-line">Todavía no hay nóminas.</p>}
      </section>
    </div>
  );
}

/* ============================== Portal ============================== */

export default function Portal({ data, toast }: Props) {
  const [tab, setTab] = useState<"fichaje" | "ausencias" | "nominas">("fichaje");
  return (
    <div className="stack">
      <div className="seg wrap" role="group" aria-label="Secciones del portal">
        <button className={tab === "fichaje" ? "active" : ""} onClick={() => setTab("fichaje")}>Fichaje</button>
        <button className={tab === "ausencias" ? "active" : ""} onClick={() => setTab("ausencias")}>Vacaciones</button>
        <button className={tab === "nominas" ? "active" : ""} onClick={() => setTab("nominas")}>Nóminas</button>
      </div>
      {tab === "fichaje" && <Clock data={data} toast={toast} />}
      {tab === "ausencias" && <Leaves data={data} toast={toast} />}
      {tab === "nominas" && <Payslips data={data} toast={toast} />}
    </div>
  );
}

/* ============================== Campana de dirección ============================== */

interface News {
  id: string;
  kind: string;
  text: string;
  at: string;
}
interface OpenClock {
  id: string;
  name: string;
  mine: boolean;
  hours: number;
}
interface UnreadChat {
  id: string;
  name: string;
  unread: number;
  last: string;
}
interface BellProps {
  data: LeadsPayload;
  toast: Toast;
  onGoPortal: () => void;
  onGoWhatsApp: () => void;
  onOpenLead: (id: string) => void;
}
const SEEN_KEY = "but-calls-avisos-vistos";

/**
 * Campana de avisos, arriba a la derecha.
 * - Dirección: solicitudes pendientes (aprobar a un clic) y jornadas que alguien dejó abiertas.
 * - Cada trabajador: rellamadas suyas que tocan ahora, clientes que le han escrito por WhatsApp,
 *   su jornada si lleva demasiadas horas abierta, solicitudes resueltas y nóminas nuevas.
 */
export function Bell({ data, toast, onGoPortal, onGoWhatsApp, onOpenLead }: BellProps) {
  const [pending, setPending] = useState<Leave[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [clock, setClock] = useState<OpenClock[]>([]);
  const [chats, setChats] = useState<UnreadChat[]>([]);
  const [seen, setSeen] = useState(0);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const announced = useRef<Set<string> | null>(null);
  const chatsLoaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ pending: Leave[]; news: News[]; clock: OpenClock[] }>("/api/portal/avisos");
      setPending(r.pending);
      setNews(r.news);
      setClock(r.clock ?? []);
    } catch {}
  }, []);
  const loadChats = useCallback(async () => {
    if (!data.waReady || !data.me.code) return;
    try {
      const list = (await api<{ chats: UnreadChat[] }>("/api/whatsapp/pendientes")).chats;
      // Los mensajes que ya estaban sin leer al abrir la app no se anuncian
      if (!chatsLoaded.current) for (const c of list) announced.current?.add(`w:${c.id}:${c.unread}`);
      chatsLoaded.current = true;
      setChats(list);
    } catch {}
  }, [data.waReady, data.me.code]);

  useEffect(() => {
    try {
      setSeen(Number(localStorage.getItem(SEEN_KEY)) || 0);
    } catch {}
    load();
    loadChats();
    const visible = () => document.visibilityState === "visible";
    const t1 = setInterval(() => visible() && load(), 60_000);
    const t2 = setInterval(() => visible() && loadChats(), 30_000);
    const t3 = setInterval(() => setTick((n) => n + 1), 30_000); // para que las rellamadas salten a su hora
    window.addEventListener("portal-changed", load);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
      window.removeEventListener("portal-changed", load);
    };
  }, [load, loadChats]);

  // Rellamadas propias con hora de hoy cuya hora ya ha llegado
  const code = data.me.code.trim().toLowerCase();
  const now = Date.now();
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const due = !code
    ? []
    : data.leads.filter((l) => {
        const v = String(l.f.rellamada ?? "");
        if (!v.includes("T") || isClosed(l.f.estado) || String(l.f.comercial ?? "").trim().toLowerCase() !== code) return false;
        const t = new Date(v).getTime();
        return t <= now && t >= startOfDay;
      });

  // Fin de jornada: aviso cuando quedan 5 minutos (dirección no tiene límite)
  const left = data.me.role === "admin" ? null : shiftRemaining(data.clock, now);
  const ending = left !== null && left <= SHIFT_WARN_MS;
  const warned = useRef(false);
  useEffect(() => {
    if (ending && !warned.current) toast(left! > 0 ? "Te quedan 5 minutos de jornada. Ve cerrando y ficha la salida." : "Has cumplido tu jornada. Ficha la salida en el Portal.");
    warned.current = ending;
  });

  // Aviso emergente la primera vez que aparece una rellamada o un mensaje nuevo
  useEffect(() => {
    const keys = [...due.map((l) => `r:${l.id}:${l.f.rellamada}`), ...chats.map((c) => `w:${c.id}:${c.unread}`)];
    if (announced.current === null) {
      announced.current = new Set(keys); // lo que ya estaba al abrir la app no se anuncia
      return;
    }
    for (const l of due) {
      const k = `r:${l.id}:${l.f.rellamada}`;
      if (!announced.current.has(k)) toast(`Te toca rellamar a ${String(l.f.nombre ?? "un lead")}`);
      announced.current.add(k);
    }
    for (const c of chats) {
      const k = `w:${c.id}:${c.unread}`;
      if (!announced.current.has(k)) toast(`${c.name} te ha escrito por WhatsApp`);
      announced.current.add(k);
    }
  });

  const fresh = news.filter((n) => new Date(n.at).getTime() > seen);
  const count = pending.length + fresh.length + due.length + chats.length + clock.length + (ending ? 1 : 0);
  const empty = !pending.length && !news.length && !due.length && !chats.length && !clock.length && !ending;

  function toggle() {
    if (open && fresh.length) {
      // Al cerrar el panel, los avisos informativos quedan como vistos en este dispositivo
      const t = Date.now();
      setSeen(t);
      try {
        localStorage.setItem(SEEN_KEY, String(t));
      } catch {}
    }
    setOpen(!open);
  }
  const go = (fn: () => void) => () => {
    toggle();
    fn();
  };

  return (
    <div className="bell">
      <button className="btn small bell-btn" onClick={toggle} aria-expanded={open} aria-label={`Avisos: ${count} nuevos`}>
        <Icon name="bell" size={18} />
        {count > 0 && <span className="badge">{count}</span>}
      </button>
      {open && (
        <div className="card bell-panel" role="dialog" aria-label="Avisos">
          <h2>Avisos</h2>
          {empty && <p className="muted hint">No tienes avisos.</p>}
          <ul className="bonus-admin">
            {ending && (
              <li>
                <button className="news" onClick={go(onGoPortal)}>
                  <span className="news-line"><Icon name="hourglass" size={16} /> {left! > 0 ? "Tu jornada termina enseguida" : "Has cumplido tu jornada"}</span>
                  <span className="muted hint">Ya no te salen más llamadas. Ficha la salida en el Portal al terminar.</span>
                </button>
              </li>
            )}
            {due.map((l) => (
              <li key={`r${l.id}`}>
                <button className="news" onClick={go(() => onOpenLead(l.id))}>
                  <span className="news-line"><Icon name="phone" size={16} /> Te toca rellamar a <strong>{String(l.f.nombre ?? "")}</strong></span>
                  <span className="muted hint">Programada a las {time(String(l.f.rellamada))}</span>
                </button>
              </li>
            ))}
            {chats.map((c) => (
              <li key={`w${c.id}`}>
                <button className="news" onClick={go(onGoWhatsApp)}>
                  <span className="news-line"><Icon name="chat" size={16} /> <strong>{c.name}</strong> te ha escrito{c.unread > 1 ? ` (${c.unread})` : ""}</span>
                  <span className="muted hint">{c.last}</span>
                </button>
              </li>
            ))}
            {clock.map((c) => (
              <li key={`c${c.id}`}>
                <button className="news" onClick={go(onGoPortal)}>
                  <span className="news-line"><Icon name="alarm" size={16} /> {c.mine ? "Tu jornada sigue abierta" : <><strong>{c.name}</strong> no ha fichado la salida</>}</span>
                  <span className="muted hint">Lleva {c.hours} h abierta. {c.mine ? "¿Olvidaste fichar la salida?" : "Puedes corregirla en Portal → Fichaje."}</span>
                </button>
              </li>
            ))}
            {pending.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <div className="hint">{r.type} · {range(r)}</div>
                  {r.note && <div className="muted hint">{r.note}</div>}
                </div>
                <div className="cell-actions">
                  <button className="btn primary small" onClick={() => resolveLeave(r.id, "aprobada", toast)}>Aprobar</button>
                  <button className="btn small" onClick={() => resolveLeave(r.id, "rechazada", toast)}>Rechazar</button>
                </div>
              </li>
            ))}
            {news.map((n) => (
              <li key={n.id} className={new Date(n.at).getTime() > seen ? "" : "off"}>
                <button className="news" onClick={go(onGoPortal)}>
                  <span className="news-line"><Icon name={n.kind === "nomina" ? "file" : n.kind === "aprobada" ? "check" : "x"} size={16} /> {n.text}</span>
                  <span className="muted hint">{new Date(n.at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
