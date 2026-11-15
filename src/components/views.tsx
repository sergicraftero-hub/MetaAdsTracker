"use client";
import { useMemo, useState } from "react";
import { isClosed, stageOf } from "@/lib/fields";
import type { Lead, LeadsPayload, Schema } from "@/lib/types";
import type { Actions } from "./App";
import CallButton from "./CallButton";
import Icon from "./Icon";
import { api, dayDiff, entryTime, fmtAgo, fmtWhen, isDue, matches, parseWhen, pretty, str } from "./util";

interface Props {
  data: LeadsPayload;
  actions: Actions;
}

export function Chip({ value, schema, field = "estado" }: { value: unknown; schema: Schema; field?: "estado" | "comercial" | "estadoContrato" }) {
  const name = typeof value === "string" ? value : "";
  if (!name) return field === "estado" ? <span className="chip c-new">Sin contactar</span> : null;
  const color = schema[field].options?.find((o) => o.name === name)?.color ?? "default";
  return <span className={`chip c-${color}`}>{name}</span>;
}

const PHONE_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  </svg>
);

interface RowProps extends Props {
  lead: Lead;
  meta?: "rellamada" | "entrada";
  showOwner?: boolean;
  /** Si se pasa, la fila lleva casilla de selección (asignación en bloque) */
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function LeadRow({ lead, data, actions, meta, showOwner, selected, onSelect }: RowProps) {
  const f = lead.f;
  const due = meta === "rellamada" && isDue(f.rellamada) && !isClosed(f.estado);
  const owner = showOwner || data.me.role === "admin" ? str(f.comercial) || (showOwner ? "sin asignar" : "") : "";
  return (
    <li className="row">
      {onSelect && <input type="checkbox" className="pick" checked={!!selected} onChange={() => onSelect(lead.id)} aria-label={`Seleccionar a ${str(f.nombre)}`} />}
      <button className="row-main" onClick={() => actions.open(lead.id)}>
        <span className="row-title">
          <strong>{str(f.nombre) || "Sin nombre"}</strong>
          <Chip value={f.estado} schema={data.schema} />
        </span>
        <span className="row-sub muted">{[str(f.telefono), pretty(f.compania), pretty(f.cuantoPaga), owner].filter(Boolean).join(" · ")}</span>
      </button>
      <span className={due ? "row-meta due" : "row-meta muted"}>
        {meta === "rellamada" && f.rellamada ? fmtWhen(f.rellamada) : fmtAgo(f.fecha)}
      </span>
      {f.telefono && !onSelect && (
        <CallButton lead={lead} className="icon-btn" toast={actions.toast} label={`Llamar a ${str(f.nombre)}`}>
          {PHONE_ICON}
        </CallButton>
      )}
    </li>
  );
}

const callbackTime = (l: Lead) => parseWhen(l.f.rellamada)?.date.getTime() ?? Infinity;

const pad2 = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Calendario mensual de rellamadas: se ve qué hay cada día y se arrastra una rellamada para cambiarla de día. */
function AgendaCalendar({ list, data, actions }: Props & { list: Lead[] }) {
  const today = keyOf(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [over, setOver] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, Lead[]>();
    for (const l of list) {
      const w = parseWhen(l.f.rellamada);
      if (!w) continue;
      const k = keyOf(w.date);
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return m;
  }, [list]);

  const days = useMemo(() => {
    const first = new Date(`${month}-01T12:00:00`);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { key: keyOf(d), n: d.getDate(), inMonth: keyOf(d).startsWith(month), weekend: d.getDay() === 0 || d.getDay() === 6 };
    });
  }, [month]);

  const move = (by: number) => {
    const d = new Date(`${month}-01T12:00:00`);
    d.setMonth(d.getMonth() + by);
    setMonth(keyOf(d).slice(0, 7));
  };

  /** Cambia la rellamada de día conservando su hora. */
  function reschedule(id: string, to: string) {
    const lead = list.find((l) => l.id === id);
    const w = lead && parseWhen(lead.f.rellamada);
    if (!lead || !w || keyOf(w.date) === to) return;
    actions.save(id, { rellamada: w.hasTime ? new Date(`${to}T${hhmm(w.date)}:00`).toISOString() : to });
  }

  const late = list.filter((l) => {
    const w = parseWhen(l.f.rellamada);
    return !!w && keyOf(w.date) < today;
  }).length;
  const selected = byDay.get(day) ?? [];

  return (
    <>
      <section className="card">
        <div className="between">
          <div className="month-nav">
            <button className="btn small" onClick={() => move(-1)} aria-label="Mes anterior"><Icon name="left" size={16} /></button>
            <strong className="cap">{new Date(`${month}-01T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</strong>
            <button className="btn small" onClick={() => move(1)} aria-label="Mes siguiente"><Icon name="right" size={16} /></button>
          </div>
          <button className="btn small" onClick={() => { setMonth(today.slice(0, 7)); setDay(today); }}>Hoy</button>
        </div>
        <p className="muted hint">
          {late > 0 ? `${late} rellamadas atrasadas de días anteriores. ` : ""}Toca un día para ver sus rellamadas. En ordenador, arrastra una a otro día para moverla.
        </p>
        <div className="cal agenda-cal" role="grid">
          {["L", "M", "X", "J", "V", "S", "D"].map((d) => <span key={d} className="cal-head">{d}</span>)}
          {days.map((d) => {
            const items = byDay.get(d.key) ?? [];
            const past = d.key < today;
            return (
              <div
                key={d.key}
                role="gridcell"
                tabIndex={0}
                className={["cal-day", d.inMonth ? "" : "out", d.weekend ? "weekend" : "", d.key === day ? "sel" : "", d.key === today ? "today" : "", over === d.key ? "over" : ""].join(" ")}
                onClick={() => setDay(d.key)}
                onKeyDown={(e) => e.key === "Enter" && setDay(d.key)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(d.key);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  setOver(null);
                  reschedule(e.dataTransfer.getData("text/plain"), d.key);
                }}
              >
                <span className="cal-num">
                  {d.n}
                  {items.length > 0 && <i className={past ? "cal-count late" : "cal-count"}>{items.length}</i>}
                </span>
                <span className="cal-marks">
                  {items.slice(0, 3).map((l) => {
                    const w = parseWhen(l.f.rellamada);
                    return (
                      <i
                        key={l.id}
                        className={past ? "chip c-red" : "chip c-blue"}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                        title={`${str(l.f.nombre)}${str(l.f.comercial) ? ` · ${str(l.f.comercial)}` : ""}`}
                      >
                        {w?.hasTime ? `${hhmm(w.date)} ` : ""}
                        {str(l.f.nombre).split(" ")[0]}
                      </i>
                    );
                  })}
                  {items.length > 3 && <i className="chip">+{items.length - 3}</i>}
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="card">
        <h2>
          <span className="cap">{day === today ? "Hoy" : new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</span>{" "}
          <span className="count">{selected.length}</span>
        </h2>
        {selected.length === 0 ? (
          <p className="muted empty-line">Sin rellamadas este día.</p>
        ) : (
          <ul className="rows">
            {selected.map((l) => <LeadRow key={l.id} lead={l} data={data} actions={actions} meta="rellamada" showOwner />)}
          </ul>
        )}
        <p className="muted hint">Para cambiar el día o la hora de una rellamada, abre el lead y edítala en su ficha.</p>
      </section>
    </>
  );
}

/** Agenda de rellamadas de todo el equipo: en calendario o en lista por día. */
export function Agenda({ data, actions }: Props) {
  const hasCode = !!data.me.code;
  const [scope, setScope] = useState<"mias" | "todas">(hasCode ? "mias" : "todas");
  const [view, setView] = useState<"calendario" | "lista">("calendario");
  // Dirección no tiene agenda propia: elige ver la global o la de un comercial
  const [who, setWho] = useState("");
  const list = useMemo(() => {
    const code = data.me.code.trim().toLowerCase();
    return data.leads
      .filter((l) => l.f.rellamada && !isClosed(l.f.estado))
      .filter((l) => {
        const owner = str(l.f.comercial).trim().toLowerCase();
        if (!hasCode) return !who || (who === "__nadie" ? !owner : owner === who.toLowerCase());
        return scope === "todas" || owner === code;
      })
      .sort((a, b) => callbackTime(a) - callbackTime(b));
  }, [data.leads, data.me.code, scope, who, hasCode]);
  const groups = useMemo(() => {
    const out: { key: string; title: string; late: boolean; leads: Lead[] }[] = [];
    for (const l of list) {
      const w = parseWhen(l.f.rellamada);
      if (!w) continue;
      const diff = dayDiff(w.date);
      const key = diff < 0 ? "late" : String(diff);
      const title =
        diff < 0
          ? "Atrasadas"
          : diff === 0
            ? "Hoy"
            : diff === 1
              ? "Mañana"
              : w.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
      const g = out.find((x) => x.key === key);
      if (g) g.leads.push(l);
      else out.push({ key, title, late: diff < 0, leads: [l] });
    }
    return out;
  }, [list]);

  return (
    <div className="stack">
      <div className="filters">
        <div className="seg" role="group" aria-label="Cómo ver la agenda">
          <button className={view === "calendario" ? "active" : ""} onClick={() => setView("calendario")}>Calendario</button>
          <button className={view === "lista" ? "active" : ""} onClick={() => setView("lista")}>Lista</button>
        </div>
        {hasCode && (
          <div className="seg" role="group" aria-label="De quién son las rellamadas">
            <button className={scope === "mias" ? "active" : ""} onClick={() => setScope("mias")}>Personal</button>
            <button className={scope === "todas" ? "active" : ""} onClick={() => setScope("todas")}>Global</button>
          </div>
        )}
        {!hasCode && (
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="De quién es la agenda">
            <option value="">Global (todo el equipo)</option>
            {data.comerciales.map((c) => <option key={c} value={c}>Agenda de {c}</option>)}
            <option value="__nadie">Sin comercial asignado</option>
          </select>
        )}
      </div>
      {view === "calendario" && <AgendaCalendar list={list} data={data} actions={actions} />}
      {view === "lista" && groups.length === 0 && <section className="card"><p className="muted empty-line">No hay rellamadas programadas.</p></section>}
      {view === "lista" &&
        groups.map((g) => (
          <section className="card" key={g.key}>
            <h2 className={g.late ? "due" : ""}>
              <span className="cap">{g.title}</span> <span className="count">{g.leads.length}</span>
            </h2>
            <ul className="rows">
              {g.leads.slice(0, 200).map((l) => (
                <LeadRow key={l.id} lead={l} data={data} actions={actions} meta="rellamada" showOwner />
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

export function LeadList({ data, actions }: Props) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [comercial, setComercial] = useState("");
  const [limit, setLimit] = useState(60);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const admin = data.me.role === "admin";

  const list = useMemo(
    () =>
      data.leads
        .filter((l) => {
          const e = str(l.f.estado);
          if (estado === "__nuevo" ? e : estado && e !== estado) return false;
          if (comercial === "__nadie" ? l.f.comercial : comercial && str(l.f.comercial) !== comercial) return false;
          return matches(l, q);
        })
        .sort((a, b) => entryTime(b) - entryTime(a)),
    [data.leads, q, estado, comercial],
  );

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /** Asigna (o desasigna) los leads marcados, de uno en uno para no saturar Notion. */
  async function assign() {
    const ids = [...picked];
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      setProgress(i + 1);
      try {
        const { lead } = await api<{ lead: Lead }>(`/api/leads/${ids[i]}`, "PATCH", { fields: { comercial: target === "__nadie" ? null : target } });
        actions.replace(lead);
      } catch {
        failed++;
      }
    }
    setProgress(null);
    setPicked(new Set());
    setPicking(false);
    actions.toast(failed ? `${ids.length - failed} asignados; ${failed} fallaron` : `${ids.length} leads asignados`, failed > 0);
  }

  return (
    <div className="stack">
      <div className="filters">
        <input type="search" placeholder="Buscar por nombre, teléfono, email o CP" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="__nuevo">Sin contactar</option>
          {data.schema.estado.options?.map((o) => <option key={o.name}>{o.name}</option>)}
        </select>
        {admin && (
          <select value={comercial} onChange={(e) => setComercial(e.target.value)} aria-label="Comercial">
            <option value="">Todos los comerciales</option>
            <option value="__nadie">Sin asignar</option>
            {data.comerciales.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        {admin && !picking && <button className="btn" onClick={() => setPicking(true)}>Asignar varios</button>}
      </div>

      {picking && (
        <div className="card assign">
          <strong>{picked.size} seleccionados</strong>
          <button className="btn small" onClick={() => setPicked(new Set(list.map((l) => l.id)))}>Marcar los {list.length} de la lista</button>
          <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Asignar a">
            <option value="">Asignar a…</option>
            {data.comerciales.map((c) => <option key={c}>{c}</option>)}
            <option value="__nadie">Quitar comercial</option>
          </select>
          <button className="btn primary small" disabled={!picked.size || !target || progress !== null} onClick={assign}>
            {progress !== null ? `Asignando ${progress} de ${picked.size}…` : "Asignar"}
          </button>
          <button className="btn small" disabled={progress !== null} onClick={() => { setPicking(false); setPicked(new Set()); }}>Cancelar</button>
        </div>
      )}

      <section className="card">
        <p className="muted hint">{list.length} de {data.leads.length} leads</p>
        <ul className="rows">
          {list.slice(0, limit).map((l) => (
            <LeadRow
              key={l.id}
              lead={l}
              data={data}
              actions={actions}
              meta={l.f.rellamada && !isClosed(l.f.estado) ? "rellamada" : "entrada"}
              selected={picked.has(l.id)}
              onSelect={picking ? toggle : undefined}
            />
          ))}
        </ul>
        {list.length === 0 && <p className="muted empty-line">Ningún lead coincide con el filtro.</p>}
        {list.length > limit && (
          <button className="btn link" onClick={() => setLimit(limit + 100)}>Mostrar más</button>
        )}
      </section>
    </div>
  );
}

export function Pipeline({ data, actions }: Props) {
  const [over, setOver] = useState<string | null>(null);
  const columns = useMemo(() => {
    const opts = data.schema.estado.options ?? [];
    const by = new Map<string, Lead[]>();
    for (const l of data.leads) {
      const st = stageOf(l.f.estado);
      const key = st === "nuevo" ? "" : st === "perdido" ? "__perdido" : str(l.f.estado);
      by.set(key, [...(by.get(key) ?? []), l]);
    }
    const sort = (ls: Lead[] = []) => ls.sort((a, b) => entryTime(b) - entryTime(a));
    const openCols = opts.filter((o) => stageOf(o.name) === "abierto").map((o) => ({ key: o.name, title: o.name, drop: true }));
    const wonCols = opts.filter((o) => stageOf(o.name) === "ganado").map((o) => ({ key: o.name, title: o.name, drop: true }));
    return [{ key: "", title: "Sin contactar", drop: true }, ...openCols, ...wonCols, { key: "__perdido", title: "Descartados", drop: false }].map(
      (c) => ({ ...c, leads: sort(by.get(c.key)) }),
    );
  }, [data.leads, data.schema]);

  return (
    <div className="board" role="list">
      {columns.map((c) => (
        <section
          key={c.key}
          role="listitem"
          className={over === c.key ? "col over" : "col"}
          onDragOver={(e) => {
            if (!c.drop) return;
            e.preventDefault();
            setOver(c.key);
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => {
            setOver(null);
            const id = e.dataTransfer.getData("text/plain");
            const lead = data.leads.find((l) => l.id === id);
            if (c.drop && lead && str(lead.f.estado) !== c.key) actions.save(id, { estado: c.key || null });
          }}
        >
          <h2>
            {c.title} <span className="count">{c.leads.length}</span>
          </h2>
          <div className="col-body">
            {c.leads.slice(0, 40).map((l) => (
              <button key={l.id} className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)} onClick={() => actions.open(l.id)}>
                <strong>{str(l.f.nombre) || "Sin nombre"}</strong>
                {c.key === "__perdido" && <Chip value={l.f.estado} schema={data.schema} />}
                <span className="muted">{[pretty(l.f.compania), pretty(l.f.cuantoPaga)].filter(Boolean).join(" · ")}</span>
                <span className={l.f.rellamada && isDue(l.f.rellamada) && c.drop ? "due" : "muted"}>
                  {l.f.rellamada && c.drop ? `Rellamar: ${fmtWhen(l.f.rellamada)}` : fmtAgo(l.f.fecha)}
                </span>
              </button>
            ))}
            {c.leads.length > 40 && <p className="muted hint">y {c.leads.length - 40} más (ver en Leads)</p>}
            {c.leads.length === 0 && <p className="muted hint">Vacío</p>}
          </div>
        </section>
      ))}
    </div>
  );
}

