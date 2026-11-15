"use client";
import { useMemo, useState } from "react";
import { isClosed, stageOf } from "@/lib/fields";
import type { Lead, LeadsPayload } from "@/lib/types";
import Activity from "./Activity";
import { dayDiff, dayKey, entryTime, isDue, parseWhen, pretty, str } from "./util";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
const contacted = (l: Lead) => !!l.f.estado || !!l.f.fechaContacto;
const won = (l: Lead) => stageOf(l.f.estado) === "ganado";

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {sub && <span className="muted tile-sub">{sub}</span>}
    </div>
  );
}

function BarList({ rows }: { rows: { name: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.name} title={`${r.name}: ${r.value}`}>
          <span className="bar-name">{r.name}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="bar-value">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function Breakdown({ title, groups }: { title: string; groups: Map<string, Lead[]> }) {
  const rows = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Leads</th>
              <th>Contactados</th>
              <th>Firmados</th>
              <th>Cierre</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, ls]) => {
              const c = ls.filter(contacted).length;
              const w = ls.filter(won).length;
              return (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{ls.length}</td>
                  <td>{c}</td>
                  <td>{w}</td>
                  <td>{pct(w, c)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function groupBy(leads: Lead[], key: (l: Lead) => string) {
  const m = new Map<string, Lead[]>();
  for (const l of leads) {
    const k = key(l);
    m.set(k, [...(m.get(k) ?? []), l]);
  }
  return m;
}

export default function Dashboard({ data }: { data: LeadsPayload }) {
  const [range, setRange] = useState<"7" | "30" | "all">("30");
  const [comercial, setComercial] = useState("");
  const admin = data.me.role === "admin";

  const leads = useMemo(() => {
    const since = range === "all" ? 0 : Date.now() - Number(range) * 86400_000;
    return data.leads.filter((l) => entryTime(l) >= since && (!comercial || str(l.f.comercial) === comercial));
  }, [data.leads, range, comercial]);

  const days = useMemo(() => {
    const n = range === "7" ? 7 : 30;
    const counts = new Map<string, number>();
    for (const l of leads) {
      const w = parseWhen(l.f.fecha);
      if (w) counts.set(dayKey(w.date), (counts.get(dayKey(w.date)) ?? 0) + 1);
    }
    return Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (n - 1 - i));
      return { date: d, value: counts.get(dayKey(d)) ?? 0 };
    });
  }, [leads, range]);
  const maxDay = Math.max(1, ...days.map((d) => d.value));

  const nContacted = leads.filter(contacted).length;
  const nWon = leads.filter(won).length;
  const overdue = leads.filter((l) => !isClosed(l.f.estado) && l.f.rellamada && isDue(l.f.rellamada)).length;
  const byEstado = [...groupBy(leads, (l) => str(l.f.estado) || "Sin contactar").entries()]
    .map(([name, ls]) => ({ name, value: ls.length }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="stack">
      <Activity data={data} />
      <h2 className="section-title">Leads</h2>
      <div className="filters">
        <div className="seg" role="group" aria-label="Periodo de entrada del lead">
          {(["7", "30", "all"] as const).map((r) => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>
              {r === "all" ? "Todo" : `${r} días`}
            </button>
          ))}
        </div>
        {admin && (
          <select value={comercial} onChange={(e) => setComercial(e.target.value)} aria-label="Comercial">
            <option value="">Todos los comerciales</option>
            {data.comerciales.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
      </div>

      <div className="tiles">
        <Tile label="Leads" value={leads.length} sub="entrados en el periodo" />
        <Tile label="Contactados" value={nContacted} sub={`${pct(nContacted, leads.length)} de los leads`} />
        <Tile label="Firmados" value={nWon} sub={`${pct(nWon, leads.length)} de los leads`} />
        <Tile label="Cierre sobre contactados" value={pct(nWon, nContacted)} />
        <Tile label="Sin contactar" value={leads.length - nContacted} />
        <Tile label="Rellamadas atrasadas o de hoy" value={overdue} />
      </div>

      <section className="card">
        <h2>Leads que entran por día</h2>
        <p className="muted hint">Últimos {days.length} días · máximo {maxDay} en un día</p>
        <div className="daychart" role="img" aria-label={`Leads por día en los últimos ${days.length} días`}>
          {days.map((d) => (
            <div key={dayKey(d.date)} className="day" tabIndex={0}>
              <span className="tip">
                {d.date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}: <strong>{d.value}</strong>
              </span>
              <span className="day-bar" style={{ height: `${(d.value / maxDay) * 100}%` }} />
              <span className="day-label">{dayDiff(d.date) === 0 ? "hoy" : d.date.getDate() % 5 === 0 || days.length <= 7 ? d.date.getDate() : ""}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Leads por estado</h2>
        {byEstado.length ? <BarList rows={byEstado} /> : <p className="muted empty-line">Sin leads en este periodo.</p>}
      </section>

      {admin && <Breakdown title="Por comercial" groups={groupBy(leads, (l) => str(l.f.comercial) || "Sin asignar")} />}
      <Breakdown title="Por compañía actual" groups={groupBy(leads, (l) => pretty(l.f.compania) || "—")} />
      <Breakdown title="Por lo que paga al mes" groups={groupBy(leads, (l) => pretty(l.f.cuantoPaga) || "—")} />
    </div>
  );
}
