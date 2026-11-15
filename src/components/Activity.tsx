"use client";
import { useEffect, useMemo, useState } from "react";
import { stageOf } from "@/lib/fields";
import type { CallLog, LeadsPayload } from "@/lib/types";
import { api, dayKey, digits, str, timeKey } from "./util";

const NO_CONTACT = new Set(["ILOCALIZABLE", "NUMERO ERRONEO", "SALTADO", ""]);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
const hm = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")} min` : `${Math.round(s / 60)} min`);
const mmss = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "—");

/** Llamada más corta de este tiempo (en segundos) se marca para revisar */
const SHORT_CALL = 8;

/**
 * Señales para dirección:
 * - "nocall": marcó un resultado en la cola sin pulsar Llamar.
 * - "short": pulsó Llamar pero estuvo fuera de la app menos de unos segundos.
 */
function flagOf(r: CallLog): "nocall" | "short" | null {
  if (r.result === "SALTADO" || r.source === "ficha") return null;
  if (!r.called) return "nocall";
  if (r.away > 0 && r.away < SHORT_CALL) return "short";
  return null;
}

interface Stats {
  calls: number;
  contacts: number;
  won: number;
  skipped: number;
  /** Resultados guardados en la cola sin haber pulsado Llamar */
  noCall: number;
  /** Segundos reales en llamada (tiempo fuera de la app) */
  talk: number;
  avg: number;
  perHour: number;
  first?: Date;
  last?: Date;
}

function stats(rows: CallLog[]): Stats {
  const real = rows.filter((r) => r.result !== "SALTADO");
  // Horas trabajadas: de la primera a la última llamada de cada persona y día
  const spans = new Map<string, [number, number]>();
  for (const r of real) {
    const t = new Date(r.at).getTime();
    const k = `${r.user}|${dayKey(new Date(t))}`;
    const s = spans.get(k);
    spans.set(k, s ? [Math.min(s[0], t), Math.max(s[1], t + r.seconds * 1000)] : [t, t + r.seconds * 1000]);
  }
  const hours = [...spans.values()].reduce((a, [x, y]) => a + (y - x), 0) / 3600_000;
  const times = real.map((r) => new Date(r.at).getTime());
  return {
    calls: real.length,
    contacts: real.filter((r) => !NO_CONTACT.has(r.result.toUpperCase())).length,
    won: real.filter((r) => stageOf(r.result) === "ganado").length,
    skipped: rows.length - real.length,
    noCall: real.filter((r) => flagOf(r) === "nocall").length,
    talk: real.reduce((a, r) => a + (r.away || 0), 0),
    avg: real.length ? real.reduce((a, r) => a + r.seconds, 0) / real.length : NaN,
    perHour: hours > 0.05 ? real.length / hours : NaN,
    first: times.length ? new Date(Math.min(...times)) : undefined,
    last: times.length ? new Date(Math.max(...times)) : undefined,
  };
}

export default function Activity({ data, onOpenLead }: { data: LeadsPayload; onOpenLead?: (id: string) => void }) {
  const [who, setWho] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [limit, setLimit] = useState(40);
  const [days, setDays] = useState<1 | 7 | 30>(1);
  const [calls, setCalls] = useState<CallLog[] | null>(null);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState("");
  const admin = data.me.role === "admin";

  useEffect(() => {
    let alive = true;
    setCalls(null);
    api<{ ready: boolean; calls: CallLog[] }>(`/api/llamadas?dias=${days}`)
      .then((r) => {
        if (!alive) return;
        setCalls(r.calls);
        setReady(r.ready);
        setError("");
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [days, data.syncedAt]);

  const total = useMemo(() => stats(calls ?? []), [calls]);
  const byUser = useMemo(() => {
    const m = new Map<string, CallLog[]>();
    for (const c of calls ?? []) m.set(c.user || "—", [...(m.get(c.user || "—") ?? []), c]);
    return [...m.entries()].map(([user, rows]) => ({ user, ...stats(rows) })).sort((a, b) => b.calls - a.calls);
  }, [calls]);

  // Hoy: llamadas por hora del día. Varios días: llamadas por día.
  const bars = useMemo(() => {
    const real = (calls ?? []).filter((c) => c.result !== "SALTADO");
    if (days === 1) {
      const counts = new Map<number, number>();
      for (const c of real) counts.set(new Date(c.at).getHours(), (counts.get(new Date(c.at).getHours()) ?? 0) + 1);
      const hours = [...counts.keys()];
      const from = Math.min(9, ...hours);
      const to = Math.max(20, ...hours);
      return Array.from({ length: to - from + 1 }, (_, i) => ({ label: `${from + i}`, tip: `${from + i}:00–${from + i + 1}:00`, value: counts.get(from + i) ?? 0 }));
    }
    const counts = new Map<string, number>();
    for (const c of real) counts.set(dayKey(new Date(c.at)), (counts.get(dayKey(new Date(c.at))) ?? 0) + 1);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return {
        label: days <= 7 || d.getDate() % 5 === 0 ? `${d.getDate()}` : "",
        tip: d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }),
        value: counts.get(dayKey(d)) ?? 0,
      };
    });
  }, [calls, days]);
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <section className="card">
      <div className="between">
        <h2>Actividad de llamadas</h2>
        <div className="seg" role="group" aria-label="Periodo de las llamadas">
          {([1, 7, 30] as const).map((d) => (
            <button key={d} className={days === d ? "active" : ""} onClick={() => setDays(d)}>
              {d === 1 ? "Hoy" : `${d} días`}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="error">{error}</p>
      ) : !ready ? (
        <p className="notice">
          Todavía no se registran las llamadas. Crea en Notion una página llamada «BUT Calls» y compártela con la integración; la
          app crea dentro el registro y a partir de ahí aparecen aquí las métricas del modo «Llamar».
        </p>
      ) : calls === null ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          <div className="tiles inner-tiles">
            <div className="tile"><span className="tile-label">Llamadas</span><span className="tile-value">{total.calls}</span></div>
            <div className="tile"><span className="tile-label">Contactos</span><span className="tile-value">{total.contacts}</span><span className="muted tile-sub">{pct(total.contacts, total.calls)} de las llamadas</span></div>
            <div className="tile"><span className="tile-label">Firmados</span><span className="tile-value">{total.won}</span></div>
            <div className="tile"><span className="tile-label">Tiempo medio por lead</span><span className="tile-value">{mmss(total.avg)}</span></div>
            <div className="tile"><span className="tile-label">Llamadas por hora</span><span className="tile-value">{Number.isFinite(total.perHour) ? total.perHour.toFixed(1).replace(".", ",") : "—"}</span></div>
            <div className="tile"><span className="tile-label">Tiempo real en llamada</span><span className="tile-value">{total.talk ? hm(total.talk) : "—"}</span><span className="muted tile-sub">medido en el móvil</span></div>
            <div className="tile"><span className="tile-label">Marcadas sin llamar</span><span className="tile-value">{total.noCall}</span><span className="muted tile-sub">{total.skipped} leads saltados</span></div>
          </div>

          <h3 className="sub">{days === 1 ? "Llamadas por hora del día" : "Llamadas por día"}</h3>
          <div className="daychart" role="img" aria-label={days === 1 ? "Llamadas por hora del día" : "Llamadas por día"}>
            {bars.map((b, i) => (
              <div key={i} className="day" tabIndex={0}>
                <span className="tip">{b.tip}: <strong>{b.value}</strong></span>
                <span className="day-bar" style={{ height: `${(b.value / max) * 100}%` }} />
                <span className="day-label">{b.label}</span>
              </div>
            ))}
          </div>

          {admin && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Llamadas</th>
                    <th>Contactos</th>
                    <th>Firmados</th>
                    <th>Sin llamar</th>
                    <th>En llamada</th>
                    <th>Tiempo medio</th>
                    <th>Por hora</th>
                    {days === 1 && <th>Primera</th>}
                    {days === 1 && <th>Última</th>}
                  </tr>
                </thead>
                <tbody>
                  {byUser.map((u) => (
                    <tr key={u.user}>
                      <th scope="row">{u.user}</th>
                      <td>{u.calls}</td>
                      <td>{u.contacts} ({pct(u.contacts, u.calls)})</td>
                      <td>{u.won}</td>
                      <td>{u.noCall}</td>
                      <td>{u.talk ? hm(u.talk) : "—"}</td>
                      <td>{mmss(u.avg)}</td>
                      <td>{Number.isFinite(u.perHour) ? u.perHour.toFixed(1).replace(".", ",") : "—"}</td>
                      {days === 1 && <td>{u.first ? timeKey(u.first) : "—"}</td>}
                      {days === 1 && <td>{u.last ? timeKey(u.last) : "—"}</td>}
                    </tr>
                  ))}
                  {byUser.length === 0 && (
                    <tr><td colSpan={10} className="muted">Sin llamadas registradas en este periodo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {admin && <CallList calls={calls} data={data} who={who} setWho={setWho} onlyFlagged={onlyFlagged} setOnlyFlagged={setOnlyFlagged} limit={limit} setLimit={setLimit} onOpenLead={onOpenLead} />}
        </>
      )}
    </section>
  );
}

interface ListProps {
  calls: CallLog[];
  data: LeadsPayload;
  who: string;
  setWho: (v: string) => void;
  onlyFlagged: boolean;
  setOnlyFlagged: (v: boolean) => void;
  limit: number;
  setLimit: (n: number) => void;
  onOpenLead?: (id: string) => void;
}

/** Registro de llamadas una a una: quién llamó a quién, cuándo y cuánto duró, cruzado con los leads. */
function CallList({ calls, data, who, setWho, onlyFlagged, setOnlyFlagged, limit, setLimit, onOpenLead }: ListProps) {
  const byId = useMemo(() => new Map(data.leads.map((l) => [l.id, l])), [data.leads]);
  const people = useMemo(() => [...new Set(calls.map((c) => c.user).filter(Boolean))].sort(), [calls]);
  const rows = useMemo(
    () =>
      calls
        .filter((c) => (!who || c.user === who) && (!onlyFlagged || flagOf(c)))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [calls, who, onlyFlagged],
  );
  const flagged = calls.filter((c) => flagOf(c)).length;

  return (
    <div className="calllist">
      <h3 className="sub">Registro de llamadas</h3>
      <p className="muted hint">
        «En llamada» es el tiempo que el móvil estuvo fuera de la app tras pulsar Llamar (incluye los tonos). «—» significa que no se pudo
        medir. No sustituye al registro del operador, pero deja ver quién marca resultados sin llamar.
      </p>
      <div className="filters">
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Persona">
          <option value="">Todas las personas</option>
          {people.map((p) => <option key={p}>{p}</option>)}
        </select>
        <label className="check small-check">
          <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
          Solo para revisar ({flagged})
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Persona</th>
              <th>Lead</th>
              <th>Teléfono</th>
              <th>Resultado</th>
              <th>En llamada</th>
              <th>Con el lead</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((c) => {
              const lead = byId.get(c.leadId);
              const flag = flagOf(c);
              const d = new Date(c.at);
              return (
                <tr key={c.id}>
                  <td>{d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} {timeKey(d)}</td>
                  <th scope="row">{c.user || "—"}</th>
                  <td className="left">
                    {lead && onOpenLead ? (
                      <button className="btn link inline-link" onClick={() => onOpenLead(lead.id)}>{str(lead.f.nombre) || c.leadName}</button>
                    ) : (
                      c.leadName || "—"
                    )}
                  </td>
                  <td>{c.phone || (lead ? `+${digits(lead.f.telefono)}` : "—")}</td>
                  <td className="left">{c.result === "SALTADO" ? "Saltado" : c.result || "—"}</td>
                  <td>{c.away ? mmss(c.away) : "—"}</td>
                  <td>{c.seconds ? mmss(c.seconds) : "—"}</td>
                  <td className="left">
                    {flag === "nocall" && <span className="pill warn">Sin pulsar Llamar</span>}
                    {flag === "short" && <span className="pill warn">Llamada de {c.away} s</span>}
                    {c.source === "ficha" && <span className="pill">Apuntado en la ficha</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="muted">Sin llamadas con ese filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > limit && <button className="btn link" onClick={() => setLimit(limit + 100)}>Ver más ({rows.length - limit})</button>}
    </div>
  );
}
