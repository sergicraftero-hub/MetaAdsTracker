/**
 * Modo demostración: datos inventados en memoria.
 * Se activa cuando no hay NOTION_TOKEN, para probar la app sin tocar Notion.
 */
import { NOTION_NAMES } from "./fields";
import { hashPassword } from "./password";
import { FIELD_KEYS } from "./types";
import type { Bonus, CallAlert, CallLog, Comment, Fields, Lead, Option, Schema, StoredUser, WaChat, WaMessage } from "./types";

const ESTADOS: Option[] = [
  { name: "RELLAMAR", color: "orange" },
  { name: "ILOCALIZABLE", color: "purple" },
  { name: "CONTACTADO E INTERESADO", color: "green" },
  { name: "HABLANDO POR WHATSAPP", color: "yellow" },
  { name: "LO ESTÁ PENSANDO AÚN", color: "yellow" },
  { name: "SCORING", color: "gray" },
  { name: "FIMADO", color: "blue" },
  { name: "CONTACTADO Y NO INTERESADO", color: "red" },
  { name: "AL FINAL NO", color: "red" },
  { name: "SIN COBERTURA", color: "brown" },
  { name: "CLIENTE EXISTENTE O2", color: "pink" },
  { name: "NUMERO ERRONEO", color: "pink" },
  { name: "PERDIDO", color: "gray" },
];
const COMERCIALES: Option[] = [
  { name: "ANA", color: "pink" },
  { name: "LUIS", color: "brown" },
];

const TYPES: Partial<Record<string, string>> = {
  nombre: "title",
  estado: "select",
  comercial: "select",
  estadoContrato: "select",
  fechaContacto: "date",
  rellamada: "date",
  whatsapp: "checkbox",
  intentos: "number",
};

export const demoSchema: Schema = Object.fromEntries(
  FIELD_KEYS.map((key) => {
    const type = TYPES[key] ?? "rich_text";
    const options =
      key === "estado"
        ? ESTADOS
        : key === "comercial"
          ? COMERCIALES
          : key === "estadoContrato"
            ? [
                { name: "SCORING", color: "orange" },
                { name: "FIRMADO", color: "green" },
                { name: "INSTALADO", color: "purple" },
                { name: "BAJA", color: "red" },
              ]
            : undefined;
    return [key, { key, name: NOTION_NAMES[key], type, options, writable: true }];
  }),
) as Schema;

function seed(): Lead[] {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const nombres = ["Lucía", "Marcos", "Elena", "Jorge", "Nuria", "Pablo", "Irene", "Sergio", "Marta", "Óscar", "Clara", "Iván"];
  const apellidos = ["Demo Uno", "Prueba Dos", "Ejemplo Tres", "Ficticio Cuatro", "Muestra Cinco", "Ensayo Seis"];
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = Date.now();
  const leads: Lead[] = [];
  for (let i = 0; i < 64; i++) {
    const created = new Date(now - i * 5.3 * 3600_000 - rnd() * 3600_000);
    const fresh = i < 9 || rnd() < 0.12;
    const estado = fresh ? null : pick(ESTADOS).name;
    const f = Object.fromEntries(FIELD_KEYS.map((k) => [k, null])) as Fields;
    f.nombre = `${pick(nombres)} ${pick(apellidos)}`;
    f.telefono = `+346000${pad(i)}${pad(Math.floor(rnd() * 99))}`;
    f.email = `lead${i + 1}@example.com`;
    f.cp = pick(["28013", "08024", "46600", "41003", "33010"]);
    f.fecha = created.toISOString();
    f.estado = estado;
    f.whatsapp = rnd() < 0.2;
    f.compania = pick(["movistar", "movistar", "orange", "vodafone", "otro"]);
    f.cuantoPaga = pick(["más_de_70_€", "50–70_€", "35–50_€", "menos_de_35_€"]);
    f.titular = pick(["sí", "sí", "no,_pero_puedo_decidir"]);
    f.quiereTele = pick(["movistar_plus+_y_netflix", "solo_movistar_plus+", "no_quiero_tele"]);
    if (estado) {
      f.fechaContacto = day(new Date(created.getTime() + 3600_000));
      f.intento1 = `${pad(10 + Math.floor(rnd() * 9))}:${pad(Math.floor(rnd() * 60))}`;
      f.intentos = 1;
      f.comercial = pick(COMERCIALES).name;
      if (estado === "RELLAMAR" || estado === "CONTACTADO E INTERESADO") {
        const when = new Date(now + (Math.floor(rnd() * 5) - 1) * 86400_000);
        when.setHours(9 + Math.floor(rnd() * 9), pick([0, 30]), 0, 0);
        f.rellamada = rnd() < 0.5 ? day(when) : when.toISOString();
      }
    }
    leads.push({ id: `demo-${i + 1}`, edited: created.toISOString(), f });
  }
  return leads;
}

type DemoRow = { id: string; created: string } & Record<string, string | number | boolean | null | undefined>;

interface DemoState {
  leads: Map<string, Lead>;
  users: StoredUser[];
  log: CallLog[];
  comments: Map<string, Comment[]>;
  alerts: (CallAlert & { to: string; at: number; away?: number })[];
  bonuses: Bonus[];
  wa: Map<string, WaMessage[]>;
  waLabels: Map<string, string[]>;
  waUnread: Map<string, boolean>;
  locks: Map<string, { user: string; at: number }>;
  /** Contrataciones de demostración (hace de «Seguimiento O2») */
  seg: Record<string, unknown>[];
  segCodes: string[];
  rows: Record<string, DemoRow[]>;
  n: number;
}

/** Historial inventado de llamadas de los últimos días, para que el panel tenga algo que enseñar. */
function seedLog(leads: Lead[]): CallLog[] {
  let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const results = ["ILOCALIZABLE", "ILOCALIZABLE", "RELLAMAR", "CONTACTADO E INTERESADO", "CONTACTADO Y NO INTERESADO", "FIMADO", "SALTADO"];
  const out: CallLog[] = [];
  for (let d = 0; d < 6; d++) {
    for (const [code, user, n] of [["ANA", "Ana (comercial demo)", 22], ["LUIS", "Luis (comercial demo)", 15]] as const) {
      const t = new Date();
      t.setDate(t.getDate() - d);
      t.setHours(9, Math.floor(rnd() * 30), 0, 0);
      for (let i = 0; i < n - d * 2; i++) {
        const seconds = 40 + Math.floor(rnd() * 320);
        const lead = leads[Math.floor(rnd() * leads.length)];
        const result = results[Math.floor(rnd() * results.length)];
        if (t.getTime() < Date.now()) {
          out.push({ id: `log-${out.length}`, at: t.toISOString(), user, code, leadId: lead.id, leadName: String(lead.f.nombre), source: ["antiguo", "antiguo", "nuevo", "rellamada"][i % 4], result, seconds, called: result !== "SALTADO" && i % 9 !== 4, away: result === "SALTADO" || i % 9 === 4 ? 0 : i % 7 === 3 ? 4 : Math.max(12, seconds - 35), phone: String(lead.f.telefono ?? "") });
        }
        t.setSeconds(t.getSeconds() + seconds + 60 + Math.floor(rnd() * 600));
      }
    }
  }
  return out;
}
const g = globalThis as unknown as { __crmDemo?: DemoState };

function state(): DemoState {
  if (g.__crmDemo) return g.__crmDemo;
  const leads = seed();
  return (g.__crmDemo = {
    leads: new Map(leads.map((l) => [l.id, l])),
    log: seedLog(leads),
    comments: new Map(),
    alerts: [],
    waLabels: new Map(),
    waUnread: new Map(),
    locks: new Map(),
    segCodes: ["LT000001 Tienda Centro", "LT000002 Tienda Norte"],
    seg: Array.from({ length: 9 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i * 2);
      const pad = (n: number) => String(n).padStart(2, "0");
      return {
        id: `seg-${i + 1}`,
        created: d.toISOString(),
        nombre: ["Lucía Demo Uno", "Marcos Prueba Dos", "Elena Ejemplo Tres", "Jorge Ficticio Cuatro", "Nuria Muestra Cinco", "Pablo Ensayo Seis", "Irene Demo Uno", "Sergio Prueba Dos", "Marta Ejemplo Tres"][i],
        dni: `0000000${i}X`,
        telefono: `60000010${i}`,
        fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        estado: ["Pdt instalación", "Listo", "Es movistar", "Listo", "Pdt cita", "Listo", "Incidencia", "Listo", "Listo"][i],
        codigo: i % 3 === 2 ? "LT000002 Tienda Norte" : "LT000001 Tienda Centro",
        comision: [105, 92, 120, 80, 117, 65, 105, 125, 83][i],
        cobrado: false,
        comentarios: "",
        productos: i < 5 ? JSON.stringify([["ftv-600-60-n"], ["ffm-1g-120"], ["ftv-1g-375-n"], ["ffm-600-60"], ["ftv-600-60-dn"]][i]) : "",
        origen: i % 2 ? "No Movistar" : "Movistar",
        primera: true,
        comercial: i % 2 ? "LUIS" : "ANA",
        leadId: "",
        baja: i === 6,
        contrato: null,
        contratoUrl: null,
      };
    }),
    rows: { fichajes: [], solicitudes: [], nominas: [], ajustes: [], anuncios: [] },
    wa: new Map(
      leads.slice(9, 14).map((l, i) => {
        const id = `${String(l.f.telefono).replace(/\D/g, "")}@s.whatsapp.net`;
        const t = Date.now() - (i + 1) * 47 * 60_000;
        const msg = (n: number, fromMe: boolean, text: string, by?: string): WaMessage => ({ id: `wa-${i}-${n}`, chatId: id, fromMe, at: new Date(t + n * 90_000).toISOString(), text, by, status: fromMe ? "read" : undefined });
        return [id, [msg(0, true, "Hola, te escribo de O2 por la oferta de fibra y móvil que pediste.", "ANA"), msg(1, false, "Hola! Sí, ¿cuánto sería con la tele?"), ...(i % 2 ? [msg(2, true, "Te paso la propuesta en un momento.", "LUIS")] : [])]];
      }),
    ),
    bonuses: [
      { id: "b-1", title: "Reto de la semana", prize: "Desayuno para todo el equipo", metric: "firmados", goal: 25, period: "semana", para: "", active: true },
      { id: "b-2", title: "Sprint de Ana", prize: "Tarde libre el viernes", metric: "llamadas", goal: 30, period: "dia", para: "ANA", active: true },
    ],
    users: [
      { id: "u-ana", name: "Ana (comercial demo)", email: "ana@demo.com", role: "comercial", code: "ANA", active: true, hours: 8, hash: hashPassword("demo") },
      { id: "u-luis", name: "Luis (comercial demo)", email: "luis@demo.com", role: "comercial", code: "LUIS", active: true, hash: hashPassword("demo") },
    ],
    n: 100,
  });
}

export const demo = {
  getLeads: () => ({ leads: [...state().leads.values()], syncedAt: Date.now() }),
  getLead: (id: string) => state().leads.get(id),
  updateLead(id: string, fields: Partial<Fields>): Lead {
    const cur = state().leads.get(id);
    if (!cur) throw new Error("Lead no encontrado");
    const next = { ...cur, edited: new Date().toISOString(), f: { ...cur.f, ...fields } };
    state().leads.set(id, next);
    return next;
  },
  createLead(fields: Partial<Fields>): Lead {
    const st = state();
    const f = { ...(Object.fromEntries(FIELD_KEYS.map((k) => [k, null])) as Fields), whatsapp: false, ...fields };
    const lead = { id: `demo-${++st.n}`, edited: new Date().toISOString(), f };
    st.leads.set(lead.id, lead);
    return lead;
  },
  addLog(e: Omit<CallLog, "id">): CallLog {
    const entry = { ...e, id: `log-${++state().n}` };
    state().log.push(entry);
    return entry;
  },
  getLog: (from: number) => state().log.filter((e) => new Date(e.at).getTime() >= from),
  waChats(): WaChat[] {
    const st = state();
    const names = new Map([...st.leads.values()].map((l) => [String(l.f.telefono).replace(/\D/g, ""), String(l.f.nombre)]));
    return [...st.wa.entries()]
      .map(([id, ms]) => {
        const last = ms[ms.length - 1];
        const phone = id.replace(/@.*/, "");
        return { id, phone, name: names.get(phone) ?? "", at: last.at, unread: st.waUnread.has(id) ? (st.waUnread.get(id) ? -1 : 0) : last.fromMe ? 0 : 1, last: last.text || "[Documento]", lastFromMe: last.fromMe, labels: st.waLabels.get(id) ?? (st.wa.get(id)?.length === 3 ? ["Nuevo cliente"] : []) };
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  },
  segOptions: () => ({ estados: ["Pdt cita", "Es movistar", "Pdt instalación", "Pdt portabilidad", "Incidencia", "Listo"], codigos: state().segCodes }),
  segList: () => state().seg,
  segGet(id: string) {
    const row = state().seg.find((r) => r.id === id);
    if (!row) throw new Error("Contratación no encontrada");
    return row;
  },
  segAdd(values: Record<string, unknown>, file?: File) {
    const st = state();
    const row = { id: `seg-${++st.n}`, created: new Date().toISOString(), cobrado: false, baja: false, ...values, contrato: file?.name ?? null, contratoUrl: file ? "/icon-192.png" : null };
    st.seg.unshift(row);
    return row;
  },
  segSet(id: string, values: Record<string, unknown>, file?: File) {
    const row = demo.segGet(id);
    Object.assign(row, Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)), file ? { contrato: file.name, contratoUrl: "/icon-192.png" } : {});
    return row;
  },
  segAddCode(name: string) {
    const st = state();
    if (!st.segCodes.includes(name)) st.segCodes.push(name);
  },
  lockLead(leadId: string, user: string): boolean {
    const st = state();
    const cur = st.locks.get(leadId);
    if (cur && cur.user !== user && Date.now() - cur.at < 20 * 60_000) return false;
    st.locks.set(leadId, { user, at: Date.now() });
    return true;
  },
  unlockLead(leadId: string, user: string) {
    const st = state();
    if (st.locks.get(leadId)?.user === user) st.locks.delete(leadId);
  },
  rowsList: (kind: string) => state().rows[kind] ?? [],
  rowGet(id: string): DemoRow {
    const row = Object.values(state().rows).flat().find((r) => r.id === id);
    if (!row) throw new Error("No encontrado");
    return row;
  },
  rowAdd(kind: string, values: Record<string, unknown>, file?: { prop: string; file: File }): DemoRow {
    const st = state();
    const row = { id: `row-${++st.n}`, created: new Date().toISOString(), ...values, ...(file ? { [file.prop]: file.file.name, [`${file.prop}Url`]: "/icon-192.png" } : {}) } as DemoRow;
    (st.rows[kind] ??= []).push(row);
    return row;
  },
  rowSet(_kind: string, id: string, values: Record<string, unknown>): DemoRow {
    const row = demo.rowGet(id);
    Object.assign(row, Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)), { edited: new Date().toISOString() });
    return row;
  },
  rowDel(id: string) {
    const st = state();
    for (const k of Object.keys(st.rows)) st.rows[k] = st.rows[k].filter((r) => r.id !== id);
  },
  waSetUnread(chatId: string, unread: boolean) {
    state().waUnread.set(chatId, unread);
  },
  waAssign(chatId: string, owner: string, comerciales: string[]): string[] {
    const st = state();
    const kept = (st.waLabels.get(chatId) ?? []).filter((l) => !comerciales.includes(l));
    const next = owner ? [...kept, owner] : kept;
    st.waLabels.set(chatId, next);
    return next;
  },
  waMessages: (chatId: string) => state().wa.get(chatId) ?? [],
  waSend(chatId: string, text: string, file: File | undefined, by: string): WaMessage {
    const st = state();
    const m: WaMessage = { id: `wa-${++st.n}`, chatId, fromMe: true, at: new Date().toISOString(), text, by, status: "sent", file: file ? { id: "demo", name: file.name, mime: file.type, kind: "Documento" } : undefined };
    st.wa.set(chatId, [...(st.wa.get(chatId) ?? []), m]);
    return m;
  },
  listBonuses: () => state().bonuses,
  saveBonus(id: string | null, b: Partial<Bonus>): Bonus {
    const st = state();
    if (id) {
      const i = st.bonuses.findIndex((x) => x.id === id);
      if (i < 0) throw new Error("Bono no encontrado");
      return (st.bonuses[i] = { ...st.bonuses[i], ...b });
    }
    const bonus: Bonus = { id: `b-${++st.n}`, title: "", prize: "", metric: "firmados", goal: 1, period: "semana", para: "", active: true, ...b };
    st.bonuses.push(bonus);
    return bonus;
  },
  deleteBonus(id: string) {
    const st = state();
    st.bonuses = st.bonuses.filter((b) => b.id !== id);
  },
  addAlert(to: string, a: Omit<CallAlert, "id">) {
    const st = state();
    st.alerts.push({ ...a, id: `al-${++st.n}`, to, at: Date.now() });
    return true;
  },
  listAlerts: (to: string): CallAlert[] =>
    state()
      .alerts.filter((a) => a.to === to && Date.now() - a.at < 90_000)
      .map(({ id, leadId, name, phone }) => ({ id, leadId, name, phone })),
  setAlertAway(to: string, id: string, seconds: number) {
    const a = state().alerts.find((x) => x.id === id && x.to === to);
    if (a) a.away = seconds;
  },
  takeAlertAway(to: string, leadId: string): number {
    const st = state();
    const mine = st.alerts.filter((a) => a.to === to && a.leadId === leadId);
    st.alerts = st.alerts.filter((a) => !mine.includes(a));
    return mine.reduce((n, a) => n + (a.away ?? 0), 0);
  },
  removeAlert(id: string) {
    const st = state();
    st.alerts = st.alerts.filter((a) => a.id !== id);
  },
  listComments: (id: string) => state().comments.get(id) ?? [],
  addComment(id: string, text: string, file?: File) {
    const st = state();
    const c: Comment = { id: `c-${++st.n}`, at: new Date().toISOString(), author: "BUT CRM", text, files: file ? [{ name: file.name, url: "#" }] : [] };
    st.comments.set(id, [...(st.comments.get(id) ?? []), c]);
  },
  listUsers: () => state().users,
  saveUser(id: string | null, u: Partial<StoredUser>): StoredUser {
    const st = state();
    if (id) {
      const i = st.users.findIndex((x) => x.id === id);
      if (i < 0) throw new Error("Usuario no encontrado");
      return (st.users[i] = { ...st.users[i], ...u });
    }
    const user: StoredUser = { id: `u-${++st.n}`, name: "", email: "", role: "comercial", code: "", active: true, hash: "", ...u };
    st.users.push(user);
    return user;
  },
};
