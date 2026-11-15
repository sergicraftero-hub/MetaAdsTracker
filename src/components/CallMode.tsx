"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { stageOf } from "@/lib/fields";
import type { Lead, LeadsPayload } from "@/lib/types";
import { SOURCE_LABEL, buildPools, nextPick, type Source } from "./queue";
import { api, dayKey, fmtAgo, fmtWhen, pretty, str, telHref, timeKey, waHref } from "./util";

interface Props {
  data: LeadsPayload;
  replaceLead: (l: Lead) => void;
  toast: (msg: string, error?: boolean) => void;
}

// El estado de la cola vive fuera del componente para que no se pierda al cambiar de pestaña
const session = { handled: new Set<string>(), slot: 0, done: 0, day: "" };

interface Current {
  id: string;
  source: Source;
  slots: number;
  shownAt: string;
  called: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (s: number) => `${Math.floor(s / 60)}:${pad(s % 60)}`;

export default function CallMode({ data, replaceLead, toast }: Props) {
  const [active, setActive] = useState(false);
  const [cur, setCur] = useState<Current | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [cbDate, setCbDate] = useState("");
  const [cbTime, setCbTime] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tick, setTick] = useState(0);
  const leadsRef = useRef(data.leads);
  leadsRef.current = data.leads;

  if (session.day !== dayKey(new Date())) Object.assign(session, { handled: new Set<string>(), slot: 0, done: 0, day: dayKey(new Date()) });

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pools = useMemo(() => buildPools(data.leads, session.handled), [data.leads, cur?.id, Math.floor(tick / 20)]);
  const lead = cur ? data.leads.find((l) => l.id === cur.id) : undefined;

  /** Busca el siguiente lead, lo reserva en Notion y lo enseña. */
  const advance = useCallback(async () => {
    setBusy(true);
    setPending(null);
    setFile(null);
    setCbDate("");
    setCbTime("");
    for (let tries = 0; tries < 8; tries++) {
      const pick = nextPick(buildPools(leadsRef.current, session.handled), session.slot);
      if (!pick) break;
      try {
        const { lead: fresh } = await api<{ lead: Lead }>(`/api/leads/${pick.lead.id}/reservar`, "POST");
        replaceLead(fresh);
        leadsRef.current = leadsRef.current.map((l) => (l.id === fresh.id ? fresh : l));
        // Si alguien lo ha tocado mientras tanto y ya no toca llamarlo, se pasa al siguiente
        // (se conserva la fecha de edición anterior: reservarlo no cuenta como un intento reciente)
        const still = nextPick(buildPools([{ ...fresh, edited: pick.lead.edited }], session.handled), 0);
        if (!still) {
          session.handled.add(fresh.id);
          continue;
        }
        setCur({ id: fresh.id, source: pick.source, slots: pick.slots, shownAt: new Date().toISOString(), called: false });
        setNotes(str(fresh.f.comentarios));
        setBusy(false);
        return;
      } catch (e) {
        const msg = (e as Error).message;
        if (msg === "Sin conexión") {
          toast("Sin conexión: no se puede cargar el siguiente lead", true);
          break;
        }
        session.handled.add(pick.lead.id); // lo tiene otro comercial o ya no existe
      }
    }
    setCur(null);
    setBusy(false);
  }, [replaceLead, toast]);

  async function finish(fields: Record<string, unknown> | null) {
    if (!cur || !lead) return;
    setBusy(true);
    try {
      const body = { fields: fields ?? {}, skipped: fields === null, shownAt: cur.shownAt, called: cur.called, source: cur.source };
      const r = await api<{ lead: Lead; logged: boolean }>(`/api/leads/${cur.id}/llamada`, "POST", body);
      let saved = r.lead;
      if (file && fields) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/leads/${cur.id}/contrato`, { method: "POST", body: form });
        const j = await res.json().catch(() => ({}));
        if (res.ok) saved = j.lead;
        else toast(`El lead se guardó, pero el contrato no se subió: ${j.error ?? "error"}`, true);
      }
      replaceLead(saved);
      leadsRef.current = leadsRef.current.map((l) => (l.id === saved.id ? saved : l));
      session.handled.add(cur.id);
      session.slot += cur.slots;
      if (fields) session.done++;
      await advance();
    } catch (e) {
      toast(`No se guardó: ${(e as Error).message}`, true);
      setBusy(false);
    }
  }

  function choose(estado: string) {
    const stage = stageOf(estado);
    const up = estado.toUpperCase();
    const needsStep = stage === "ganado" || (stage === "abierto" && up !== "ILOCALIZABLE" && up !== "SCORING");
    if (!needsStep) {
      finish({ estado, comentarios: notes, rellamada: null });
      return;
    }
    setPending(estado);
    setCbDate("");
    setCbTime("");
  }

  function confirmPending() {
    if (!pending) return;
    const rellamada = cbDate ? (cbTime ? new Date(`${cbDate}T${cbTime}:00`).toISOString() : cbDate) : null;
    finish({ estado: pending, comentarios: notes, rellamada });
  }

  function quick(days: number, time: string) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setCbDate(dayKey(d));
    setCbTime(time);
  }

  const total = pools.timed.length + pools.backlog.length + pools.fresh.length + pools.iloc.length;
  const options = data.schema.estado.options ?? [];
  const open = options.filter((o) => stageOf(o.name) === "abierto");
  const won = options.filter((o) => stageOf(o.name) === "ganado");
  const lost = options.filter((o) => stageOf(o.name) === "perdido");

  /* ----- Pantalla de inicio ----- */
  if (!active || !cur || !lead) {
    return (
      <div className="call-wrap">
        <section className="card call-start">
          <h2 className="lead-name">{active && !busy ? "No queda nadie por llamar" : "Modo llamadas"}</h2>
          <p className="muted">
            Los leads salen de uno en uno. Al marcar el resultado de la llamada se guarda en Notion y aparece el siguiente: dos
            antiguos sin llamar, uno nuevo, y las rellamadas a su hora. Cuando se acaban los leads sin llamar, entran los
            ilocalizables.
          </p>
          <dl className="call-counts">
            <div><dt>Rellamadas que tocan</dt><dd>{pools.timed.length + pools.backlog.length}</dd></div>
            <div><dt>Sin llamar</dt><dd>{pools.fresh.length}</dd></div>
            <div><dt>Ilocalizables</dt><dd>{pools.iloc.length}</dd></div>
            <div><dt>Hechas hoy en esta sesión</dt><dd>{session.done}</dd></div>
          </dl>
          {!data.logReady && (
            <p className="notice">
              Las llamadas aún no se registran para las métricas. Para activarlo, crea en Notion una página llamada «BUT Calls» y
              compártela con la integración; la app crea ahí el registro sola.
            </p>
          )}
          <button
            className="btn primary big"
            disabled={busy || total === 0}
            onClick={() => {
              setActive(true);
              advance();
            }}
          >
            {busy ? "Cargando…" : total === 0 ? "Nada pendiente" : active ? "Volver a empezar" : "Empezar a llamar"}
          </button>
        </section>
      </div>
    );
  }

  /* ----- Lead actual ----- */
  const f = lead.f;
  const elapsed = Math.max(0, Math.round((Date.now() - new Date(cur.shownAt).getTime()) / 1000));
  const previous = [f.intento1, f.intento2, f.intento3].filter(Boolean).map(str);
  const answers: [string, string][] = [
    ["Compañía actual", pretty(f.compania)],
    ["Paga al mes", pretty(f.cuantoPaga)],
    ["Titular", pretty(f.titular)],
    ["Tele", pretty(f.quiereTele)],
    ["Código postal", str(f.cp)],
    ["Entró", fmtAgo(f.fecha)],
  ];

  return (
    <div className="call-wrap">
      <div className="call-bar">
        <span className={`pill src-${cur.source}`}>
          {SOURCE_LABEL[cur.source]}
          {cur.source === "rellamada" && f.rellamada ? ` · ${fmtWhen(f.rellamada)}` : ""}
        </span>
        <span className="muted">
          {session.done} hechas · quedan {total} · {clock(elapsed)}
        </span>
        <button className="btn small" onClick={() => setActive(false)}>Pausar</button>
      </div>

      <section className="card call-card">
        <div>
          <h2 className="lead-name">{str(f.nombre) || "Sin nombre"}</h2>
          <p className="muted">{str(f.telefono)}{f.email ? ` · ${str(f.email)}` : ""}</p>
        </div>

        <div className="contact">
          <a
            className="btn primary big"
            href={telHref(f.telefono)}
            onClick={() => setCur({ ...cur, called: true })}
          >
            Llamar
          </a>
          <a className="btn big" href={waHref(f.telefono)} target="_blank" rel="noreferrer">WhatsApp</a>
        </div>

        <dl className="info">
          {answers.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v || "—"}</dd>
            </div>
          ))}
        </dl>
        {previous.length > 0 && <p className="muted hint">Intentos anteriores: {previous.join("  ·  ")}</p>}

        <label>
          Notas
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Lo que te cuente el cliente" />
        </label>

        {pending ? (
          <div className="step">
            <h3>{pending}</h3>
            {stageOf(pending) === "ganado" ? (
              <label>
                Contrato firmado (opcional, PDF o foto de hasta 4 MB)
                <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            ) : (
              <div className="field">
                <span className="label">
                  ¿Cuándo le vuelves a llamar?{pending.toUpperCase() === "RELLAMAR" ? "" : " (opcional)"}
                </span>
                <div className="quick">
                  <button className="btn small" onClick={() => quick(0, timeKey(new Date(Date.now() + 3600_000)))}>En 1 h</button>
                  <button className="btn small" onClick={() => quick(0, timeKey(new Date(Date.now() + 2 * 3600_000)))}>En 2 h</button>
                  <button className="btn small" onClick={() => quick(1, "10:00")}>Mañana 10:00</button>
                  <button className="btn small" onClick={() => quick(1, "17:00")}>Mañana 17:00</button>
                </div>
                <div className="inline">
                  <input type="date" aria-label="Día" value={cbDate} onChange={(e) => setCbDate(e.target.value)} />
                  <input type="time" aria-label="Hora" value={cbTime} disabled={!cbDate} onChange={(e) => setCbTime(e.target.value)} />
                </div>
              </div>
            )}
            <div className="contact">
              <button className="btn" disabled={busy} onClick={() => setPending(null)}>Atrás</button>
              <button
                className="btn primary"
                disabled={busy || (pending.toUpperCase() === "RELLAMAR" && !cbDate) || (!!file && file.size > 4 * 1024 * 1024)}
                onClick={confirmPending}
              >
                {busy ? "Guardando…" : "Guardar y siguiente"}
              </button>
            </div>
            {file && file.size > 4 * 1024 * 1024 && <p className="error">El archivo supera los 4 MB.</p>}
          </div>
        ) : (
          <div className="results">
            <h3>Resultado de la llamada</h3>
            <div className="result-grid">
              {open.map((o) => (
                <button key={o.name} className={`btn result chip c-${o.color}`} disabled={busy} onClick={() => choose(o.name)}>
                  {o.name.toUpperCase() === "ILOCALIZABLE" ? "NO CONTESTA" : o.name}
                </button>
              ))}
              {won.map((o) => (
                <button key={o.name} className="btn result primary" disabled={busy} onClick={() => choose(o.name)}>
                  {o.name === "FIMADO" ? "FIRMADO" : o.name}
                </button>
              ))}
            </div>
            <details>
              <summary>Descartar el lead</summary>
              <div className="result-grid">
                {lost.map((o) => (
                  <button key={o.name} className={`btn result chip c-${o.color}`} disabled={busy} onClick={() => choose(o.name)}>
                    {o.name}
                  </button>
                ))}
              </div>
            </details>
            <button className="btn link" disabled={busy} onClick={() => finish(null)}>Saltar sin llamar</button>
          </div>
        )}
      </section>
    </div>
  );
}
