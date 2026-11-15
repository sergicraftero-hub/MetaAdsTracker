"use client";
import { useEffect, useMemo, useState } from "react";
import { stageOf } from "@/lib/fields";
import type { CallLog, LeadsPayload } from "@/lib/types";
import { api, dayKey, timeKey } from "./util";

const NO_CONTACT = new Set(["ILOCALIZABLE", "NUMERO ERRONEO", "SALTADO", ""]);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
const mmss = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "—");

interface Stats {
  calls: number;
  contacts: number;
  won: number;
  skipped: number;
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
    avg: real.length ? real.reduce((a, r) => a + r.seconds, 0) / real.length : NaN,
    perHour: hours > 0.05 ? real.length / hours : NaN,
    first: times.length ? new Date(Math.min(...times)) : undefined,
    last: times.length ? new Date(Math.max(...times)) : undefined,
  };
}

export default function Activity({ data }: { data: LeadsPayload }) {
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
            <div className="tile"><span className="tile-label">Saltados sin llamar</span><span className="tile-value">{total.skipped}</span></div>
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
                    <th>Saltados</th>
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
                      <td>{u.skipped}</td>
                      <td>{mmss(u.avg)}</td>
                      <td>{Number.isFinite(u.perHour) ? u.perHour.toFixed(1).replace(".", ",") : "—"}</td>
                      {days === 1 && <td>{u.first ? timeKey(u.first) : "—"}</td>}
                      {days === 1 && <td>{u.last ? timeKey(u.last) : "—"}</td>}
                    </tr>
                  ))}
                  {byUser.length === 0 && (
                    <tr><td colSpan={9} className="muted">Sin llamadas registradas en este periodo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
