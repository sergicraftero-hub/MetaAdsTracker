"use client";
import { useEffect, useMemo, useState } from "react";
import { isClosed, stageOf } from "@/lib/fields";
import type { CallLog, Lead, LeadsPayload } from "@/lib/types";
import Activity from "./Activity";
import { BonusCards } from "./Bonuses";
import { api, dayKey, entryTime, isDue, parseWhen, pretty, str } from "./util";

type Range = "7" | "30" | "90" | "365" | "max" | "custom";
const RANGES: [Range, string][] = [
  ["7", "7 días"],
  ["30", "30 días"],
  ["90", "90 días"],
  ["365", "1 año"],
  ["max", "Máximo"],
  ["custom", "Periodo"],
];
const NOBODY = "Sin asignar";

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(a / b < 0.1 && a ? 1 : 0).replace(".", ",")} %` : "—");
const contacted = (l: Lead) => !!l.f.estado || !!l.f.fechaContacto;
const won = (l: Lead) => stageOf(l.f.estado) === "ganado";

function Tile({ label, value, sub, hero }: { label: string; value: string | number; sub?: string; hero?: boolean }) {
  return (
    <div className={hero ? "tile hero" : "tile"}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {sub && <span className="muted tile-sub">{sub}</span>}
    </div>
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

function Breakdown({ title, groups, folded }: { title: string; groups: Map<string, Lead[]>; folded?: boolean }) {
  const rows = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const best = Math.max(0.0001, ...rows.map(([, ls]) => ls.filter(won).length / Math.max(1, ls.length)));
  const body = (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Leads</th>
              <th>Contactados</th>
              <th>Contacto</th>
              <th>Firmados</th>
              <th>Conversión</th>
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
                  <td>{pct(c, ls.length)}</td>
                  <td>{w}</td>
                  <td>
                    <span className="cellbar"><i style={{ width: `${(w / Math.max(1, ls.length) / best) * 100}%` }} /></span>
                    {pct(w, ls.length)}
                  </td>
                  <td>{pct(w, c)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
  return folded ? (
    <details className="card fold">
      <summary>{title}</summary>
      {body}
    </details>
  ) : (
    <section className="card">
      <h2>{title}</h2>
      {body}
    </section>
  );
}


/** Momento de la primera llamada a un lead, a partir de «1ER_INTENTO» (y «FECHA_CONTACTO» si solo trae la hora). */
function firstCallTime(l: Lead): number | null {
  const entry = entryTime(l);
  const a = str(l.f.intento1).trim();
  if (!entry || !a) return null;
  let m = a.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    const y = new Date(entry).getFullYear();
    let d = new Date(y, Number(m[2]) - 1, Number(m[1]), Number(m[3]), Number(m[4]));
    if (d.getTime() < entry - 86400_000) d = new Date(y + 1, Number(m[2]) - 1, Number(m[1]), Number(m[3]), Number(m[4]));
    return d.getTime();
  }
  m = a.match(/^(\d{1,2}):(\d{2})$/);
  const day = parseWhen(l.f.fechaContacto)?.date;
  if (m && day) return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(m[1]), Number(m[2])).getTime();
  return null;
}

const span = (ms: number) => {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
  return `${Math.round(min / 1440)} días`;
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};

/** Velocidad de respuesta: cuánto se tarda desde que entra el lead hasta la primera llamada. */
function ResponseSpeed({ leads, showSellers }: { leads: Lead[]; showSellers: boolean }) {
  const rows = leads
    .map((l) => ({ l, first: firstCallTime(l) }))
    .filter((x): x is { l: Lead; first: number } => x.first !== null && x.first - entryTime(x.l) > -5 * 60_000)
    .map((x) => ({ who: str(x.l.f.comercial) || NOBODY, ms: Math.max(0, x.first - entryTime(x.l)) }));
  const waiting = leads.filter((l) => !l.f.estado && !l.f.intento1 && !l.f.fechaContacto);
  const oldest = waiting.length ? Date.now() - Math.min(...waiting.map(entryTime)) : 0;
  const within = (ms: number) => rows.filter((r) => r.ms <= ms).length;
  const groups = new Map<string, number[]>();
  for (const r of rows) groups.set(r.who, [...(groups.get(r.who) ?? []), r.ms]);
  const bySeller = [...groups.entries()]
    .map(([who, ms]) => ({ who, n: ms.length, med: median(ms), fast: ms.filter((x) => x <= 3600_000).length }))
    .sort((a, b) => a.med - b.med);

  return (
    <section className="card">
      <h2>Velocidad de respuesta</h2>
      <p className="muted hint">Tiempo desde que entra el lead hasta la primera llamada. Los leads que entran de noche o en festivo alargan la media, por eso se usa la mediana.</p>
      {rows.length === 0 ? (
        <p className="muted empty-line">Aún no hay leads llamados en este periodo con la hora de la primera llamada.</p>
      ) : (
        <div className="tiles inner-tiles">
          <div className="tile"><span className="tile-label">Tiempo habitual (mediana)</span><span className="tile-value">{span(median(rows.map((r) => r.ms)))}</span><span className="muted tile-sub">{rows.length} leads medidos</span></div>
          <div className="tile"><span className="tile-label">En menos de 5 min</span><span className="tile-value">{pct(within(5 * 60_000), rows.length)}</span></div>
          <div className="tile"><span className="tile-label">En menos de 1 hora</span><span className="tile-value">{pct(within(3600_000), rows.length)}</span></div>
          <div className="tile"><span className="tile-label">En el mismo día (24 h)</span><span className="tile-value">{pct(within(86400_000), rows.length)}</span></div>
          <div className="tile"><span className="tile-label">Esperando la primera llamada</span><span className="tile-value">{waiting.length}</span><span className="muted tile-sub">{waiting.length ? `el más antiguo, hace ${span(oldest)}` : "ninguno"}</span></div>
        </div>
      )}
      {showSellers && bySeller.length > 1 && (
        <details>
          <summary>Ver por comercial</summary>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Comercial</th><th>Leads medidos</th><th>Tiempo habitual</th><th>En menos de 1 h</th></tr></thead>
              <tbody>
                {bySeller.map((r) => (
                  <tr key={r.who}><th scope="row">{r.who}</th><td>{r.n}</td><td>{span(r.med)}</td><td>{pct(r.fast, r.n)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

const PROFILE: [key: "compania" | "cuantoPaga" | "quiereTele" | "titular", label: string][] = [
  ["compania", "Compañía actual"],
  ["cuantoPaga", "Lo que paga al mes"],
  ["quiereTele", "Tele que quiere"],
  ["titular", "Si es el titular"],
];

/** Cómo son los leads que entran: reparto en porcentaje según lo que contestaron en el formulario. */
function LeadProfile({ leads }: { leads: Lead[] }) {
  const [dim, setDim] = useState<(typeof PROFILE)[number][0]>("compania");
  const rows = [...groupBy(leads, (l) => pretty(l.f[dim]) || "Sin respuesta").entries()]
    .map(([name, ls]) => ({ name, n: ls.length, won: ls.filter(won).length }))
    .sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="card">
      <div className="between">
        <h2>Cómo son los leads que entran</h2>
        <select className="mini-select" value={dim} onChange={(e) => setDim(e.target.value as typeof dim)} aria-label="Qué mirar">
          {PROFILE.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      {rows.length === 0 ? (
        <p className="muted empty-line">Sin leads en este periodo.</p>
      ) : (
        <ul className="barlist profile">
          {rows.map((r) => (
            <li key={r.name} title={`${r.name}: ${r.n} leads, ${r.won} firmados`}>
              <span className="bar-name cap">{r.name}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${(r.n / max) * 100}%` }} /></span>
              <span className="bar-value">{pct(r.n, leads.length)}</span>
              <span className="muted hint profile-conv">{r.won ? `${pct(r.won, r.n)} firma` : "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface Bucket {
  key: string;
  label: string;
  tip: string;
  leads: number;
  won: number;
}

/** Reparte los leads por día, semana o mes según lo largo que sea el periodo. */
function buckets(leads: Lead[], from: Date, to: Date): { unit: string; list: Bucket[] } {
  const days = Math.round((to.getTime() - from.getTime()) / 86400_000) + 1;
  const unit = days <= 31 ? "día" : days <= 125 ? "semana" : "mes";
  const start = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (unit === "semana") x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    if (unit === "mes") x.setDate(1);
    return x;
  };
  const list: Bucket[] = [];
  const index = new Map<string, Bucket>();
  for (let d = start(from); d <= to; ) {
    const key = dayKey(d);
    const label =
      unit === "mes" ? d.toLocaleDateString("es-ES", { month: "short" }) : unit === "semana" || days <= 10 || d.getDate() % 5 === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : "";
    const tip =
      unit === "mes"
        ? d.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
        : `${unit === "semana" ? "Semana del " : ""}${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
    const b = { key, label, tip, leads: 0, won: 0 };
    list.push(b);
    index.set(key, b);
    d = new Date(d);
    if (unit === "día") d.setDate(d.getDate() + 1);
    else if (unit === "semana") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
  }
  for (const l of leads) {
    const b = index.get(dayKey(start(new Date(entryTime(l)))));
    if (!b) continue;
    b.leads++;
    if (won(l)) b.won++;
  }
  return { unit, list };
}

const NO_CONTACT = new Set(["ILOCALIZABLE", "NUMERO ERRONEO", "SALTADO", ""]);

/** Panel del comercial: solo lo suyo y solo lo básico, para no agobiar. */
function MyDay({ data }: { data: LeadsPayload }) {
  const [calls, setCalls] = useState<CallLog[] | null>(null);
  useEffect(() => {
    api<{ calls: CallLog[] }>("/api/llamadas?dias=31")
      .then((r) => setCalls(r.calls))
      .catch(() => setCalls([]));
  }, [data.syncedAt]);

  const today = dayKey(new Date());
  const month = today.slice(0, 7);
  const real = (calls ?? []).filter((c) => c.result !== "SALTADO");
  const ofToday = real.filter((c) => dayKey(new Date(c.at)) === today);
  const signed = (list: CallLog[]) => list.filter((c) => stageOf(c.result) === "ganado").length;

  return (
    <div className="stack narrow">
      <p className="muted">Hola, {data.me.name.split(" ")[0]}. Así va tu día.</p>
      <div className="tiles">
        <Tile label="Llamadas hoy" value={calls ? ofToday.length : "…"} />
        <Tile label="Contactos hoy" value={calls ? ofToday.filter((c) => !NO_CONTACT.has(c.result.toUpperCase())).length : "…"} sub="llamadas con respuesta" />
        <Tile hero label="Firmados este mes" value={calls ? signed(real.filter((c) => dayKey(new Date(c.at)).startsWith(month))) : "…"} sub={calls ? `${signed(ofToday)} hoy` : undefined} />
      </div>
      <BonusCards data={data} refreshKey={data.syncedAt} />
    </div>
  );
}

export default function Dashboard({ data, onOpenLead }: { data: LeadsPayload; onOpenLead?: (id: string) => void }) {
  return data.me.role === "admin" ? <ManagerDashboard data={data} onOpenLead={onOpenLead} /> : <MyDay data={data} />;
}

function ManagerDashboard({ data, onOpenLead }: { data: LeadsPayload; onOpenLead?: (id: string) => void }) {
  const [range, setRange] = useState<Range>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [who, setWho] = useState<Set<string>>(new Set());
  const admin = data.me.role === "admin";

  const period = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    if (range === "custom") {
      return { start: from ? new Date(`${from}T00:00:00`) : new Date(0), end: to ? new Date(`${to}T23:59:59`) : end };
    }
    if (range === "max") return { start: new Date(0), end };
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (Number(range) - 1));
    return { start, end };
  }, [range, from, to]);

  const leads = useMemo(
    () =>
      data.leads.filter((l) => {
        const t = entryTime(l);
        if (t < period.start.getTime() || t > period.end.getTime()) return false;
        return !who.size || who.has(str(l.f.comercial) || NOBODY);
      }),
    [data.leads, period, who],
  );

  const chart = useMemo(() => {
    const times = leads.map(entryTime).filter(Boolean);
    if (!times.length) return { unit: "día", list: [] as Bucket[] };
    const first = period.start.getTime() > 0 ? period.start : new Date(Math.min(...times));
    return buckets(leads, first, new Date(Math.min(period.end.getTime(), Date.now())));
  }, [leads, period]);
  const maxBar = Math.max(1, ...chart.list.map((b) => b.leads));

  const nContacted = leads.filter(contacted).length;
  const nWon = leads.filter(won).length;
  const nOpen = leads.filter((l) => stageOf(l.f.estado) === "abierto").length;
  const nLost = leads.filter((l) => stageOf(l.f.estado) === "perdido").length;
  const overdue = leads.filter((l) => !isClosed(l.f.estado) && l.f.rellamada && isDue(l.f.rellamada)).length;
  const byEstado = [...groupBy(leads, (l) => str(l.f.estado) || "Sin contactar").entries()]
    .map(([name, ls]) => ({ name, value: ls.length }))
    .sort((a, b) => b.value - a.value);
  const maxEstado = Math.max(1, ...byEstado.map((r) => r.value));

  const toggle = (name: string) =>
    setWho((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });

  return (
    <div className="stack">
      <div className="filters">
        <div className="seg wrap" role="group" aria-label="Periodo de entrada del lead">
          {RANGES.map(([r, label]) => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>
              {label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="dates">
            <label>
              Desde
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        )}
      </div>
      {admin && (
        <div className="who-filter" role="group" aria-label="Comerciales">
          <button className={who.size ? "tag" : "tag on"} onClick={() => setWho(new Set())}>Todos</button>
          {[...data.comerciales, NOBODY].map((c) => (
            <button key={c} className={who.has(c) ? "tag on" : "tag"} aria-pressed={who.has(c)} onClick={() => toggle(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <p className="muted hint">Las tasas cuentan los leads por su fecha de entrada: de los que entraron en el periodo, cuántos se han contactado y firmado hasta hoy.</p>

      <div className="tiles kpis">
        <Tile hero label="Conversión a firmado" value={pct(nWon, leads.length)} sub={`${nWon} firmados de ${leads.length} leads`} />
        <Tile label="Tasa de contacto" value={pct(nContacted, leads.length)} sub={`${nContacted} contactados`} />
        <Tile label="Cierre sobre contactados" value={pct(nWon, nContacted)} sub="firmados entre contactados" />
        <Tile label="En curso" value={nOpen} sub={`${overdue} con rellamada atrasada o de hoy`} />
        <Tile label="Descartados" value={nLost} sub={`${pct(nLost, leads.length)} de los leads`} />
      </div>

      <ResponseSpeed leads={leads} showSellers={admin} />

      <section className="card">
        <h2>Leads y firmados por {chart.unit}</h2>
        <div className="legend">
          <span><i className="sw s1" /> Leads</span>
          <span><i className="sw s2" /> Firmados</span>
        </div>
        {chart.list.length === 0 ? (
          <p className="muted empty-line">Sin leads en este periodo.</p>
        ) : (
          <div className="daychart" role="img" aria-label={`Leads y firmados por ${chart.unit}`}>
            {chart.list.map((b) => (
              <div key={b.key} className="day" tabIndex={0}>
                <span className="tip">
                  {b.tip}: <strong>{b.leads}</strong> leads, <strong>{b.won}</strong> firmados ({pct(b.won, b.leads)})
                </span>
                <span className="pair">
                  <span className="day-bar" style={{ height: `${(b.leads / maxBar) * 100}%` }} />
                  <span className="day-bar s2" style={{ height: `${(b.won / maxBar) * 100}%` }} />
                </span>
                <span className="day-label">{b.label}</span>
              </div>
            ))}
          </div>
        )}
        {chart.list.length > 0 && (
          <details>
            <summary>Ver como tabla</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Periodo</th><th>Leads</th><th>Firmados</th><th>Conversión</th></tr>
                </thead>
                <tbody>
                  {chart.list.map((b) => (
                    <tr key={b.key}><th scope="row">{b.tip}</th><td>{b.leads}</td><td>{b.won}</td><td>{pct(b.won, b.leads)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      {admin && <Breakdown title="Conversión por comercial" groups={groupBy(leads, (l) => str(l.f.comercial) || NOBODY)} />}

      <section className="card">
        <h2>Leads por estado</h2>
        {byEstado.length ? (
          <ul className="barlist">
            {byEstado.map((r) => (
              <li key={r.name} title={`${r.name}: ${r.value}`}>
                <span className="bar-name">{r.name}</span>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${(r.value / maxEstado) * 100}%` }} /></span>
                <span className="bar-value">{r.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted empty-line">Sin leads en este periodo.</p>
        )}
      </section>

      <LeadProfile leads={leads} />

      <h2 className="section-title">Actividad del equipo</h2>
      <Activity data={data} onOpenLead={onOpenLead} />
    </div>
  );
}
