"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { stageOf } from "@/lib/fields";
import type { Lead, LeadsPayload } from "@/lib/types";
import { BonusCards } from "./Bonuses";
import CallButton, { useAwayTimer } from "./CallButton";
import Icon from "./Icon";
import SaleForm from "./SaleForm";
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
  const away = useAwayTimer();
  // Código en el que conviene cargar la próxima venta (se refresca tras cada llamada)
  const [rec, setRec] = useState<Record<"Movistar" | "No Movistar", string> | null>(null);
  useEffect(() => {
    api<{ recommended: Record<"Movistar" | "No Movistar", string> }>("/api/ventas/opciones")
      .then((o) => setRec(o.recommended.Movistar ? o.recommended : null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.done]);
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
        away.reset();
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

  async function finish(fields: Record<string, unknown> | null, attach: File | null = file) {
    if (!cur || !lead) return;
    setBusy(true);
    try {
      // La nota y el contrato van primero, como comentario en la página del lead en Notion
      if (fields && (notes.trim() || attach)) await postComment(cur.id, notes.trim() || (attach ? "Contrato firmado" : ""), attach);
      const body = { fields: fields ?? {}, skipped: fields === null, shownAt: cur.shownAt, called: cur.called, source: cur.source, away: away.read() };
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
          <span className="big-ico"><Icon name="sunset" size={30} /></span>
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
  const initials = str(f.nombre)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

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

      <section className="card call-card swap" key={cur.id}>
        <header className="call-head">
          <span className="avatar" aria-hidden>{initials || "?"}</span>
          <div className="call-id">
            <h2 className="lead-name">{str(f.nombre) || "Sin nombre"}</h2>
            <p className="muted">{str(f.telefono)}{f.email ? ` · ${str(f.email)}` : ""}</p>
          </div>
        </header>

        <div className="contact">
          <CallButton lead={lead} className="btn primary big" toast={toast} onCall={() => {
              setCur({ ...cur, called: true });
              away.start();
              // Al pulsar «Llamar», un lead sin comercial pasa a ser de quien llama
              if (!lead.f.comercial && data.me.code) {
                api<{ lead: Lead }>(`/api/leads/${lead.id}`, "PATCH", { fields: { comercial: data.me.code } })
                  .then((r) => replaceLead(r.lead))
                  .catch(() => {});
              }
            }}>
            <Icon name="phone" size={20} /> Llamar
          </CallButton>
          {data.waReady ? (
            <button className="btn big" onClick={() => onChat(lead)}><Icon name="chat" size={20} /> WhatsApp</button>
          ) : (
            <a className="btn big" href={waHref(f.telefono)} target="_blank" rel="noreferrer"><Icon name="chat" size={20} /> WhatsApp</a>
          )}
        </div>

        <dl className="facts">
          {answers.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v || "—"}</dd>
            </div>
          ))}
        </dl>
        {rec && (
          <p className="code-hint">
            <Icon name="target" size={15} /> Si contrata, cárgalo en <b>{rec.Movistar}</b>
            {rec["No Movistar"] !== rec.Movistar ? <> (si no viene de Movistar, en <b>{rec["No Movistar"]}</b>)</> : null}
          </p>
        )}
        {previous.length > 0 && <p className="muted hint">Intentos anteriores: {previous.join("  ·  ")}</p>}

        <div className="field">
          <span className="label">Notas</span>
          <Comments key={cur.id} leadId={cur.id} compose={false} toast={toast} />
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Lo que te cuente el cliente (se guarda al marcar el resultado)" aria-label="Nota de esta llamada" />
        </div>

        {pending ? (
          <div className="step pop">
            <h3>{labelOf(pending).title}</h3>
            {stageOf(pending) === "ganado" ? (
              <SaleForm lead={lead} toast={toast} submitLabel="Guardar venta y siguiente" onDone={(_sale, f) => finish({ estado: pending, rellamada: null }, f)} />
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
              {stageOf(pending) !== "ganado" && (
                <button
                  className="btn primary"
                  disabled={busy || (pending.toUpperCase() === "RELLAMAR" && !cbDate) || (!!file && file.size > 4 * 1024 * 1024)}
                  onClick={confirmPending}
                >
                  {busy ? "Guardando…" : "Guardar y siguiente"}
                </button>
              )}
            </div>
            {file && file.size > 4 * 1024 * 1024 && <p className="error">El archivo supera los 4 MB.</p>}
          </div>
        ) : (
          <div className="results">
            <h3>¿Cómo ha ido la llamada?</h3>
            <div className="res-grid">
              {open.map((o) => {
                const l = labelOf(o.name);
                return (
                  <button key={o.name} className="res" disabled={busy} onClick={() => choose(o.name)}>
                    <i className={`dot d-${o.color}`} />
                    <span>
                      <b>{l.title}</b>
                      {l.hint && <small>{l.hint}</small>}
                    </span>
                  </button>
                );
              })}
            </div>
            {won.map((o) => (
              <button key={o.name} className="res won" disabled={busy} onClick={() => choose(o.name)}>
                <Icon name="check" size={22} />
                <span>
                  <b>{labelOf(o.name).title}</b>
                  <small>Ha contratado</small>
                </span>
              </button>
            ))}
            <details className="discard">
              <summary>Descartar el lead</summary>
              <div className="res-grid">
                {lost.map((o) => (
                  <button key={o.name} className="res small" disabled={busy} onClick={() => choose(o.name)}>
                    <i className="dot d-red" />
                    <span><b>{labelOf(o.name).title}</b></span>
                  </button>
                ))}
              </div>
            </details>
            <button className="btn link skip" disabled={busy} onClick={() => finish(null)}><Icon name="skip" size={15} /> Saltar sin llamar</button>
          </div>
        )}
      </section>
    </div>
  );
}

/** Nombre legible y pista de cada estado, para los botones de resultado. */
const NICE: Record<string, { title: string; hint?: string }> = {
  RELLAMAR: { title: "Rellamar", hint: "Pide que le llames luego" },
  ILOCALIZABLE: { title: "Ilocalizable", hint: "No lo coge" },
  "CONTACTADO E INTERESADO": { title: "Interesado", hint: "Quiere seguir adelante" },
  "HABLANDO POR WHATSAPP": { title: "Por WhatsApp", hint: "Seguís por chat" },
  "LO ESTÁ PENSANDO AÚN": { title: "Se lo piensa", hint: "Necesita tiempo" },
  SCORING: { title: "Scoring", hint: "En comprobación" },
  FIMADO: { title: "Firmado" },
};
function labelOf(estado: string): { title: string; hint?: string } {
  const known = NICE[estado.toUpperCase()];
  if (known) return known;
  const t = estado.toLowerCase();
  return { title: t.charAt(0).toUpperCase() + t.slice(1).replace(/\bo2\b/g, "O2") };
}
