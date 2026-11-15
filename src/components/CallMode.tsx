"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { stageOf } from "@/lib/fields";
import type { Lead, LeadsPayload } from "@/lib/types";
import { BonusCards } from "./Bonuses";
import CallButton from "./CallButton";
import Comments, { postComment } from "./Comments";
import { SOURCE_LABEL, buildPools, nextPick, type Source } from "./queue";
import { SHIFT_WARN_MS, api, dayKey, fmtAgo, fmtWhen, pretty, shiftRemaining, str, telHref, timeKey, waHref } from "./util";

interface Props {
  data: LeadsPayload;
  replaceLead: (l: Lead) => void;
  toast: (msg: string, error?: boolean) => void;
  onChat: (lead: Lead) => void;
  /** Vuelve a cargar los datos (tras fichar la entrada) */
  reload: () => void;
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


export default function CallMode({ data, replaceLead, toast, onChat, reload }: Props) {
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
  const meRef = useRef(data.me);
  meRef.current = data.me;
  const workingRef = useRef(data.working);
  workingRef.current = data.working;
  const clockRef = useRef(data.clock);
  clockRef.current = data.clock;

  if (session.day !== dayKey(new Date())) Object.assign(session, { handled: new Set<string>(), slot: 0, done: 0, day: dayKey(new Date()) });

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pools = useMemo(() => buildPools(data.leads, session.handled, data.me, data.working), [data.leads, data.me, data.working, cur?.id, Math.floor(tick / 20)]);
  const lead = cur ? data.leads.find((l) => l.id === cur.id) : undefined;

  /** Busca el siguiente lead, lo reserva en Notion y lo enseña. */
  const advance = useCallback(async () => {
    setBusy(true);
    setPending(null);
    setFile(null);
    setCbDate("");
    setCbTime("");
    for (let tries = 0; tries < 8; tries++) {
      const pick = nextPick(buildPools(leadsRef.current, session.handled, meRef.current, workingRef.current), session.slot);
      if (!pick) break;
      try {
        const { lead: fresh, edited } = await api<{ lead: Lead; edited: string }>(`/api/leads/${pick.lead.id}/reservar`, "POST");
        replaceLead(fresh);
        leadsRef.current = leadsRef.current.map((l) => (l.id === fresh.id ? fresh : l));
        // Si alguien lo ha tocado mientras tanto y ya no toca llamarlo, se pasa al siguiente
        // (se conserva la fecha de edición anterior: reservarlo no cuenta como un intento reciente)
        const still = nextPick(buildPools([{ ...fresh, edited: edited ?? pick.lead.edited }], session.handled, meRef.current, workingRef.current), 0);
        if (!still) {
          session.handled.add(fresh.id);
          continue;
        }
        setCur({ id: fresh.id, source: pick.source, slots: pick.slots, shownAt: new Date().toISOString(), called: false });
        setNotes("");
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
      // La nota y el contrato van primero, como comentario en la página del lead en Notion
      if (fields && (notes.trim() || file)) await postComment(cur.id, notes.trim() || (file ? "Contrato firmado" : ""), file);
      const body = { fields: fields ?? {}, skipped: fields === null, shownAt: cur.shownAt, called: cur.called, source: cur.source };
      const saved = (await api<{ lead: Lead; logged: boolean }>(`/api/leads/${cur.id}/llamada`, "POST", body)).lead;
      replaceLead(saved);
      leadsRef.current = leadsRef.current.map((l) => (l.id === saved.id ? saved : l));
      session.handled.add(cur.id);
      session.slot += cur.slots;
      if (fields) session.done++;
      const left = meRef.current.role === "admin" ? null : shiftRemaining(clockRef.current);
      if (left !== null && left <= SHIFT_WARN_MS) {
        setCur(null);
        setBusy(false);
      } else await advance();
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
      finish({ estado, rellamada: null });
      return;
    }
    setPending(estado);
    setCbDate("");
    setCbTime("");
  }

  function confirmPending() {
    if (!pending) return;
    const rellamada = cbDate ? (cbTime ? new Date(`${cbDate}T${cbTime}:00`).toISOString() : cbDate) : null;
    finish({ estado: pending, rellamada });
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

  /* ----- Sin fichar: los comerciales no entran en el reparto ----- */
  if (data.clockedIn === false && data.me.role !== "admin") {
    return (
      <div className="call-wrap">
        <section className="card call-start">
          <h2 className="lead-name">Ficha la entrada para empezar</h2>
          <p className="muted">Los leads se reparten entre quienes están trabajando. En cuanto fiches la entrada te empiezan a salir llamadas.</p>
          <button
            className="btn primary big"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/portal/fichaje", "POST", { action: "entrar" });
                toast("Entrada registrada");
                reload();
              } catch (e) {
                toast((e as Error).message, true);
              }
              setBusy(false);
            }}
          >
            Fichar entrada
          </button>
        </section>
      </div>
    );
  }

  /* ----- Fin de jornada: en los últimos 5 minutos no se dan más llamadas ----- */
  const remaining = data.me.role === "admin" ? null : shiftRemaining(data.clock);
  const ending = remaining !== null && remaining <= SHIFT_WARN_MS;
  if (ending && (!cur || !lead || !active)) {
    return (
      <div className="call-wrap">
        <section className="card call-start">
          <span className="mascot" aria-hidden>🌇</span>
          <h2 className="lead-name">{remaining > 0 ? "Tu jornada termina enseguida" : "Has cumplido tu jornada"}</h2>
          <p className="muted">
            {remaining > 0
              ? `Te quedan ${Math.max(1, Math.ceil(remaining / 60_000))} minutos, así que ya no te damos más llamadas: no daría tiempo a atenderlas bien.`
              : "Por hoy ya no te damos más llamadas."}{" "}
            Deja anotado lo que tengas pendiente y ficha la salida en el Portal. ¡Buen trabajo hoy!
          </p>
        </section>
      </div>
    );
  }

  /* ----- Pantalla de inicio ----- */
  if (!active || !cur || !lead) {
    return (
      <div className="call-wrap">
        <BonusCards data={data} refreshKey={session.done} />
        <section className="card call-start">
          <h2 className="lead-name">{active && !busy ? "No queda nadie por llamar" : "Modo llamadas"}</h2>
          <p className="muted">
            {data.me.role === "admin"
              ? "Los leads salen de uno en uno. Al marcar el resultado de la llamada se guarda en Notion y aparece el siguiente: dos antiguos sin llamar, uno nuevo, y las rellamadas a su hora. Cuando se acaban los leads sin llamar, entran los ilocalizables."
              : "Te va saliendo un lead cada vez. Llama, marca el resultado y aparece el siguiente."}
          </p>
          {data.me.role === "admin" && (
            <dl className="call-counts">
              <div><dt>Rellamadas que tocan</dt><dd>{pools.timed.length + pools.backlog.length}</dd></div>
              <div><dt>Sin llamar</dt><dd>{pools.fresh.length}</dd></div>
              <div><dt>Ilocalizables</dt><dd>{pools.iloc.length}</dd></div>
              <div><dt>Hechas hoy en esta sesión</dt><dd>{session.done}</dd></div>
            </dl>
          )}
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
      <BonusCards data={data} refreshKey={session.done} />
      <div className="call-bar">
        <span className={`pill src-${cur.source}`}>
          {SOURCE_LABEL[cur.source]}
          {cur.source === "rellamada" && f.rellamada ? ` · ${fmtWhen(f.rellamada)}` : ""}
        </span>
        <button className="btn small" onClick={() => setActive(false)}>Pausar</button>
      </div>

      <section className="card call-card">
        <div>
          <h2 className="lead-name">{str(f.nombre) || "Sin nombre"}</h2>
          <p className="muted">{str(f.telefono)}{f.email ? ` · ${str(f.email)}` : ""}</p>
        </div>

        <div className="contact">
          <CallButton lead={lead} className="btn primary big" toast={toast} onCall={() => {
              setCur({ ...cur, called: true });
              // Al pulsar «Llamar», un lead sin comercial pasa a ser de quien llama
              if (!lead.f.comercial && data.me.code) {
                api<{ lead: Lead }>(`/api/leads/${lead.id}`, "PATCH", { fields: { comercial: data.me.code } })
                  .then((r) => replaceLead(r.lead))
                  .catch(() => {});
              }
            }}>
            Llamar
          </CallButton>
          {data.waReady ? (
            <button className="btn big" onClick={() => onChat(lead)}>WhatsApp</button>
          ) : (
            <a className="btn big" href={waHref(f.telefono)} target="_blank" rel="noreferrer">WhatsApp</a>
          )}
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

        <div className="field">
          <span className="label">Notas</span>
          <Comments key={cur.id} leadId={cur.id} compose={false} toast={toast} />
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Lo que te cuente el cliente (se guarda al marcar el resultado)" aria-label="Nota de esta llamada" />
        </div>

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
