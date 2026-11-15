/**
 * Notificaciones push (llegan al móvil aunque la app esté cerrada). Solo se usan para lo importante:
 * una rellamada que toca, el fin de la jornada y una jornada que alguien dejó abierta.
 */
import { createECDH, createHash } from "node:crypto";
import webpush from "web-push";
import { seal } from "./auth";
import { demo } from "./demo";
import { isClosed } from "./fields";
import { breakMs, madridTime } from "./portal";
import { isDemo, store } from "./store";
import { working } from "./working";

export interface PushMessage {
  title: string;
  body: string;
  /** Las notificaciones con la misma etiqueta se sustituyen en vez de acumularse */
  tag: string;
}

const b64 = (b: Buffer) => b.toString("base64url");

/** Claves del servidor para push. Se derivan de SESSION_SECRET, así no hay que configurar nada más. */
function vapid() {
  const secret = process.env.SESSION_SECRET || "solo-para-desarrollo-no-usar-en-produccion";
  const priv = createHash("sha256").update(`vapid:${secret}`).digest();
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(priv);
  return { publicKey: b64(ecdh.getPublicKey()), privateKey: b64(priv) };
}
export const pushPublicKey = () => vapid().publicKey;

/** Clave que protege la dirección que dispara las comprobaciones periódicas. */
export const cronToken = () => seal("cron-push");

interface Sub {
  id: string;
  user: string;
  sub: webpush.PushSubscription;
}

async function subs(): Promise<Sub[]> {
  const rows = await store.rowsList("push");
  const out: Sub[] = [];
  for (const r of rows) {
    try {
      out.push({ id: r.id, user: String(r.Usuario ?? "").toLowerCase(), sub: JSON.parse(String(r.Suscripcion ?? "")) });
    } catch {}
  }
  return out;
}

export async function saveSubscription(user: string, sub: webpush.PushSubscription): Promise<void> {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error("Suscripción no válida");
  const all = await subs();
  for (const s of all) if (s.sub.endpoint === sub.endpoint) await store.rowDel(s.id);
  await store.rowAdd("push", { Dispositivo: createHash("sha256").update(sub.endpoint).digest("hex").slice(0, 16), Usuario: user, Suscripcion: JSON.stringify(sub) });
}

export async function removeSubscription(user: string, endpoint: string): Promise<void> {
  for (const s of await subs()) if (s.user === user && s.sub.endpoint === endpoint) await store.rowDel(s.id);
}

export const deviceCount = async (user: string) => (await subs()).filter((s) => s.user === user).length;

/** Envía una notificación a todos los dispositivos de esos usuarios. Devuelve cuántas salieron. */
export async function sendPush(to: string[], msg: PushMessage): Promise<number> {
  const targets = new Set(to.map((e) => e.toLowerCase()));
  if (!targets.size) return 0;
  const list = (await subs()).filter((s) => targets.has(s.user));
  if (isDemo()) {
    for (const email of targets) demo.recordPush(email, msg.title, msg.body);
    return targets.size;
  }
  const keys = vapid();
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "but-calls.example";
  let sent = 0;
  for (const s of list) {
    try {
      await webpush.sendNotification(s.sub, JSON.stringify(msg), { vapidDetails: { subject: `https://${site}`, ...keys }, TTL: 15 * 60, urgency: "high" });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // El dispositivo ya no existe o quitó el permiso: se olvida
      if (status === 404 || status === 410) await store.rowDel(s.id).catch(() => {});
      else console.error("Push no enviado", status, (e as Error).message);
    }
  }
  return sent;
}

/* ---------- Comprobación periódica: qué hay que avisar desde la última vez ---------- */

const STATE_ROW = "__push";
const SHIFT_WARN = 5 * 60_000;
const LONG_SHIFT = 10 * 3600_000;

async function lastRun(now: number): Promise<{ id?: string; last: number }> {
  const rows = await store.rowsList("ajustes", { property: "Usuario", title: { equals: STATE_ROW } });
  const row = rows.find((r) => String(r.Usuario) === STATE_ROW);
  let last = 0;
  try {
    last = new Date(JSON.parse(String(row?.Plantillas ?? "{}")).last).getTime() || 0;
  } catch {}
  // Tras una parada larga no se envía de golpe todo lo atrasado
  if (!last || now - last > 20 * 60_000) last = now - 5 * 60_000;
  return { id: row?.id, last };
}

/**
 * Mira qué ha pasado entre la comprobación anterior y ahora, y avisa de:
 * 1. rellamadas con hora cuya hora ha llegado → a su comercial;
 * 2. jornadas a las que les quedan 5 minutos → al trabajador;
 * 3. jornadas que superan las 10 horas abiertas → al trabajador y a dirección.
 */
export async function runPushChecks(): Promise<{ sent: number; checked: string }> {
  if (!(await store.portalReady())) return { sent: 0, checked: "sin portal" };
  const now = Date.now();
  const state = await lastRun(now);
  const stamp = JSON.stringify({ last: new Date(now).toISOString() });
  if (state.id) await store.rowSet("ajustes", state.id, { Plantillas: stamp });
  else await store.rowAdd("ajustes", { Usuario: STATE_ROW, Plantillas: stamp });
  const crossed = (t: number) => t > state.last && t <= now;

  const [{ leads }, users, w] = await Promise.all([store.getLeads(), store.listUsers(), working()]);
  const active = users.filter((u) => u.active);
  const admins = active.filter((u) => u.role === "admin").map((u) => u.email);
  if (process.env.ADMIN_EMAIL) admins.push(process.env.ADMIN_EMAIL.trim().toLowerCase());
  let sent = 0;

  // 1. Rellamadas
  for (const l of leads) {
    const v = String(l.f.rellamada ?? "");
    if (!v.includes("T") || isClosed(l.f.estado) || !crossed(new Date(v).getTime())) continue;
    const owner = String(l.f.comercial ?? "").trim().toLowerCase();
    const to = active.filter((u) => u.code && u.code.trim().toLowerCase() === owner).map((u) => u.email);
    sent += await sendPush(to, { title: "📞 Rellamada ahora", body: `Te toca llamar a ${String(l.f.nombre ?? "un lead")} (${madridTime(v)}).`, tag: `rellamada-${l.id}` });
  }

  // 2 y 3. Jornadas
  for (const s of w.shifts) {
    const start = new Date(s.start).getTime();
    const hours = w.hours.get(s.user) ?? 0;
    if (hours) {
      // Momento en que al trabajador le quedan 5 minutos (si ahora está en descanso, aún no llega)
      const onBreak = s.breaks.some((b) => !b.e);
      const warnAt = start + breakMs(s, now) + hours * 3600_000 - SHIFT_WARN;
      if (!onBreak && crossed(warnAt)) {
        sent += await sendPush([s.user], { title: "⏳ Tu jornada termina en 5 minutos", body: "Ve cerrando lo que tengas abierto y ficha la salida.", tag: "fin-jornada" });
      }
    }
    if (crossed(start + LONG_SHIFT)) {
      sent += await sendPush([s.user], { title: "⏰ ¿Olvidaste fichar la salida?", body: "Tu jornada lleva más de 10 horas abierta.", tag: "jornada-abierta" });
      sent += await sendPush(admins.filter((a) => a !== s.user), { title: "⏰ Jornada sin cerrar", body: `${s.name} lleva más de 10 horas con la jornada abierta.`, tag: `jornada-abierta-${s.id}` });
    }
  }
  return { sent, checked: new Date(now).toISOString() };
}
