"use client";
import { useMemo, useState } from "react";
import { isClosed, stageOf } from "@/lib/fields";
import type { Lead, LeadsPayload, Schema } from "@/lib/types";
import type { Actions } from "./App";
import { dayDiff, entryTime, fmtAgo, fmtWhen, isDue, matches, parseWhen, pretty, str, telHref } from "./util";

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

export function LeadRow({ lead, data, actions, meta }: Props & { lead: Lead; meta?: "rellamada" | "entrada" }) {
  const f = lead.f;
  const due = meta === "rellamada" && isDue(f.rellamada) && !isClosed(f.estado);
  return (
    <li className="row">
      <button className="row-main" onClick={() => actions.open(lead.id)}>
        <span className="row-title">
          <strong>{str(f.nombre) || "Sin nombre"}</strong>
          <Chip value={f.estado} schema={data.schema} />
        </span>
        <span className="row-sub muted">
          {[str(f.telefono), pretty(f.compania), pretty(f.cuantoPaga), data.me.role === "admin" ? str(f.comercial) : ""]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </button>
      <span className={due ? "row-meta due" : "row-meta muted"}>
        {meta === "rellamada" && f.rellamada ? fmtWhen(f.rellamada) : fmtAgo(f.fecha)}
      </span>
      {f.telefono && (
        <a className="icon-btn" href={telHref(f.telefono)} aria-label={`Llamar a ${str(f.nombre)}`}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
          </svg>
        </a>
      )}
    </li>
  );
}

function Section({ title, hint, leads, data, actions, meta, limit = 8 }: Props & { title: string; hint?: string; leads: Lead[]; meta?: "rellamada" | "entrada"; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? leads : leads.slice(0, limit);
  return (
    <section className="card">
      <h2>
        {title} <span className="count">{leads.length}</span>
      </h2>
      {hint && <p className="muted hint">{hint}</p>}
      {leads.length === 0 ? (
        <p className="muted empty-line">Nada pendiente aquí.</p>
      ) : (
        <ul className="rows">
          {shown.map((l) => (
            <LeadRow key={l.id} lead={l} data={data} actions={actions} meta={meta} />
          ))}
        </ul>
      )}
      {leads.length > limit && (
        <button className="btn link" onClick={() => setAll(!all)}>
          {all ? "Ver menos" : `Ver los ${leads.length}`}
        </button>
      )}
    </section>
  );
}

const callbackTime = (l: Lead) => parseWhen(l.f.rellamada)?.date.getTime() ?? Infinity;

export function Today({ data, actions }: Props) {
  const g = useMemo(() => {
    const open = data.leads.filter((l) => !isClosed(l.f.estado));
    const withCb = open.filter((l) => l.f.rellamada).sort((a, b) => callbackTime(a) - callbackTime(b));
    return {
      due: withCb.filter((l) => isDue(l.f.rellamada)),
      next: withCb.filter((l) => !isDue(l.f.rellamada)),
      fresh: open.filter((l) => stageOf(l.f.estado) === "nuevo").sort((a, b) => entryTime(b) - entryTime(a)),
      retry: open
        .filter((l) => str(l.f.estado).toUpperCase() === "ILOCALIZABLE" && !l.f.rellamada && !l.f.intento3)
        .sort((a, b) => entryTime(b) - entryTime(a)),
    };
  }, [data.leads]);
  const p = { data, actions };
  return (
    <div className="stack">
      <Section {...p} title="Rellamadas de hoy y atrasadas" leads={g.due} meta="rellamada" limit={12} />
      <Section {...p} title="Leads nuevos sin contactar" hint="Los más recientes primero: cuanto antes se llama, más se cierra." leads={g.fresh} />
      <Section {...p} title="Ilocalizables por reintentar" hint="Sin rellamada programada y con menos de tres intentos." leads={g.retry} limit={5} />
      <Section {...p} title="Próximas rellamadas" leads={g.next} meta="rellamada" limit={5} />
    </div>
  );
}

export function LeadList({ data, actions }: Props) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [comercial, setComercial] = useState("");
  const [limit, setLimit] = useState(60);
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
      </div>
      <section className="card">
        <p className="muted hint">{list.length} de {data.leads.length} leads</p>
        <ul className="rows">
          {list.slice(0, limit).map((l) => (
            <LeadRow key={l.id} lead={l} data={data} actions={actions} meta={l.f.rellamada && !isClosed(l.f.estado) ? "rellamada" : "entrada"} />
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

export { dayDiff };
