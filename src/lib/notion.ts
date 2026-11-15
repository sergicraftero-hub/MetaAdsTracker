import { NOTION_NAMES } from "./fields";
import { FIELD_KEYS } from "./types";
import type { Bonus, CallAlert, CallLog, Comment, FieldKey, FieldSchema, Fields, Lead, Schema, StoredUser, Value } from "./types";

const VERSION = "2022-06-28";
const READ_ONLY = new Set([
  "formula",
  "rollup",
  "created_time",
  "last_edited_time",
  "created_by",
  "last_edited_by",
  "unique_id",
  "people",
  "files",
  "relation",
  "missing",
]);

export class NotionError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* eslint-disable @typescript-eslint/no-explicit-any */
async function api(path: string, method = "GET", body?: unknown): Promise<any> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new NotionError("Falta NOTION_TOKEN", 500);
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`https://api.notion.com/v1/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": VERSION,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
    } catch {
      if (attempt < 2) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw new NotionError("No se pudo conectar con Notion");
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const wait = Number(res.headers.get("retry-after")) || attempt + 1;
      await sleep(Math.min(wait, 5) * 1000);
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new NotionError(`Notion: ${json?.message ?? res.statusText}`, res.status === 404 ? 404 : 502);
    }
    return json;
  }
}

const norm = (s: string) => s.normalize("NFC").trim().toLowerCase();
const cleanId = (s: string) => s.replace(/-/g, "").trim();

function readProp(p: any): Value {
  if (!p) return null;
  const t = p.type;
  const v = p[t];
  switch (t) {
    case "title":
    case "rich_text":
      return (v ?? []).map((x: any) => x.plain_text).join("") || null;
    case "select":
    case "status":
      return v?.name ?? null;
    case "multi_select":
      return (v ?? []).map((x: any) => x.name).join(", ") || null;
    case "date":
      return v?.start ?? null;
    case "checkbox":
      return !!v;
    case "number":
      return typeof v === "number" ? v : null;
    case "phone_number":
    case "email":
    case "url":
    case "created_time":
    case "last_edited_time":
      return v ?? null;
    case "people":
      return (v ?? []).map((x: any) => x.name).filter(Boolean).join(", ") || null;
    case "formula": {
      const inner = v?.[v?.type];
      if (inner && typeof inner === "object") return inner.start ?? null;
      return inner ?? null;
    }
    default:
      return null;
  }
}

function richText(s: string) {
  const out = [];
  for (let i = 0; i < s.length; i += 2000) out.push({ type: "text", text: { content: s.slice(i, i + 2000) } });
  return out;
}

function writeProp(type: string, value: Value): any {
  const str = value === null || value === undefined ? "" : String(value).trim();
  switch (type) {
    case "title":
      return { title: richText(str) };
    case "rich_text":
      return { rich_text: richText(str) };
    case "select":
      return { select: str ? { name: str.replace(/,/g, " ") } : null };
    case "status":
      return { status: str ? { name: str } : null };
    case "multi_select":
      return { multi_select: str.split(",").map((s) => s.trim()).filter(Boolean).map((name) => ({ name })) };
    case "date":
      return { date: str ? { start: str } : null };
    case "checkbox":
      return { checkbox: value === true || str === "true" };
    case "number": {
      const n = Number(str);
      return { number: str && Number.isFinite(n) ? n : null };
    }
    case "phone_number":
    case "email":
    case "url":
      return { [type]: str || null };
    default:
      throw new NotionError(`La columna es de tipo «${type}» y no se puede editar desde la app`, 400);
  }
}

/* ---------- Leads ---------- */

interface Cache {
  schema?: { at: number; value: Schema };
  leads: Map<string, Lead>;
  fullAt: number;
  syncAt: number;
  inflight?: Promise<void>;
  users?: { at: number; value: StoredUser[] };
  usersSchema?: Record<string, { name: string; type: string }>;
  appDbs: Partial<Record<AppDb, { at: number; id: string | null }>>;
  log: { entries: Map<string, CallLog>; from: number; syncAt: number };
  people?: { at: number; names: Map<string, string> };
}
type AppDb = "users" | "log" | "alerts" | "bonus" | "wa";
const g = globalThis as unknown as { __crmNotion?: Cache };
const cache: Cache = (g.__crmNotion ??= { leads: new Map(), fullAt: 0, syncAt: 0, appDbs: {}, log: { entries: new Map(), from: Infinity, syncAt: 0 } });

const leadsDb = () => cleanId(process.env.NOTION_LEADS_DB_ID ?? "");

export async function getSchema(force = false): Promise<Schema> {
  if (!force && cache.schema && Date.now() - cache.schema.at < 5 * 60_000) return cache.schema.value;
  const db = await api(`databases/${leadsDb()}`);
  const byName = new Map<string, any>();
  for (const [name, p] of Object.entries<any>(db.properties)) byName.set(norm(name), { ...p, name });
  const schema = {} as Schema;
  for (const key of FIELD_KEYS) {
    const p = byName.get(norm(NOTION_NAMES[key]));
    const type: string = p?.type ?? "missing";
    const fs: FieldSchema = { key, name: p?.name ?? NOTION_NAMES[key], type, writable: !READ_ONLY.has(type) };
    const opts = p?.[type]?.options;
    if (Array.isArray(opts)) fs.options = opts.map((o: any) => ({ name: o.name, color: o.color ?? "default" }));
    schema[key] = fs;
  }
  cache.schema = { at: Date.now(), value: schema };
  return schema;
}

function toLead(page: any, schema: Schema): Lead {
  const f = {} as Fields;
  for (const key of FIELD_KEYS) f[key] = readProp(page.properties?.[schema[key].name]);
  return { id: page.id, url: page.url, edited: page.last_edited_time, f };
}

async function queryAll(dbId: string, filter?: unknown): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await api(`databases/${dbId}/query`, "POST", {
      page_size: 100,
      start_cursor: cursor,
      ...(filter ? { filter } : {}),
    });
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

async function sync(): Promise<void> {
  const schema = await getSchema();
  const now = Date.now();
  if (!cache.fullAt || now - cache.fullAt > 10 * 60_000) {
    const pages = await queryAll(leadsDb());
    cache.leads = new Map(pages.map((p) => [p.id, toLead(p, schema)]));
    cache.fullAt = cache.syncAt = now;
  } else if (now - cache.syncAt > 15_000) {
    // Solo lo modificado desde la última sincronización (Notion redondea al minuto)
    const since = new Date(cache.syncAt - 2 * 60_000).toISOString();
    const pages = await queryAll(leadsDb(), {
      timestamp: "last_edited_time",
      last_edited_time: { on_or_after: since },
    });
    for (const p of pages) cache.leads.set(p.id, toLead(p, schema));
    cache.syncAt = now;
  }
}

export async function getLeads(): Promise<{ leads: Lead[]; syncedAt: number }> {
  cache.inflight ??= sync().finally(() => (cache.inflight = undefined));
  await cache.inflight;
  return { leads: [...cache.leads.values()], syncedAt: cache.syncAt };
}

export async function getLead(id: string): Promise<Lead | undefined> {
  if (!cache.fullAt) await getLeads();
  return cache.leads.get(id);
}

/** Lee el lead directamente de Notion, sin caché. */
export async function refreshLead(id: string): Promise<Lead | undefined> {
  const page = await api(`pages/${id}`);
  if (page.archived || page.in_trash) {
    cache.leads.delete(id);
    return undefined;
  }
  const lead = toLead(page, await getSchema());
  cache.leads.set(lead.id, lead);
  return lead;
}

async function toProps(fields: Partial<Fields>): Promise<Record<string, unknown>> {
  const schema = await getSchema();
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields) as [FieldKey, Value][]) {
    const fs = schema[key];
    if (!fs) continue;
    if (fs.type === "missing") throw new NotionError(`No existe la columna «${fs.name}» en Notion`, 400);
    props[fs.name] = writeProp(fs.type, value);
  }
  return props;
}

export async function updateLead(id: string, fields: Partial<Fields>): Promise<Lead> {
  const page = await api(`pages/${id}`, "PATCH", { properties: await toProps(fields) });
  const lead = toLead(page, await getSchema());
  cache.leads.set(lead.id, lead);
  return lead;
}

export async function createLead(fields: Partial<Fields>): Promise<Lead> {
  const page = await api("pages", "POST", {
    parent: { database_id: leadsDb() },
    properties: await toProps(fields),
  });
  const lead = toLead(page, await getSchema());
  cache.leads.set(lead.id, lead);
  return lead;
}

/* ---------- Usuarios (base de datos opcional en Notion) ---------- */

const USER_PROPS: Record<string, any> = {
  Email: { email: {} },
  Rol: { select: { options: [{ name: "admin", color: "blue" }, { name: "comercial", color: "green" }] } },
  Codigo: { rich_text: {} },
  Password: { rich_text: {} },
  Activo: { checkbox: {} },
};
const LOG_PROPS: Record<string, any> = {
  Fecha: { date: {} },
  Usuario: { rich_text: {} },
  Comercial: { rich_text: {} },
  Lead: { rich_text: {} },
  LeadId: { rich_text: {} },
  Origen: { select: {} },
  Resultado: { select: {} },
  Segundos: { number: {} },
  Llamo: { checkbox: {} },
};

/** Página de Notion bajo la que la app crea sus propias bases de datos. */
export const APP_PAGE = "BUT Calls";
const APP_DBS: Record<AppDb, { env: string; title: string; titleProp: string; props: Record<string, any> }> = {
  users: { env: "NOTION_USERS_DB_ID", title: "BUT Calls · Usuarios", titleProp: "Nombre", props: USER_PROPS },
  log: { env: "NOTION_LOG_DB_ID", title: "BUT Calls · Registro de llamadas", titleProp: "Evento", props: LOG_PROPS },
  bonus: {
    env: "NOTION_BONUS_DB_ID",
    title: "BUT Calls · Bonos",
    titleProp: "Bono",
    props: {
      Premio: { rich_text: {} },
      Metrica: { select: { options: [{ name: "firmados" }, { name: "llamadas" }, { name: "contactos" }] } },
      Meta: { number: {} },
      Periodo: { select: { options: [{ name: "dia" }, { name: "semana" }, { name: "mes" }] } },
      Para: { rich_text: {} },
      Activo: { checkbox: {} },
    },
  },
  wa: {
    env: "NOTION_WA_DB_ID",
    title: "BUT Calls · WhatsApp enviados",
    titleProp: "Mensaje",
    props: { Chat: { rich_text: {} }, Usuario: { rich_text: {} } },
  },
  alerts: {
    env: "NOTION_ALERTS_DB_ID",
    title: "BUT Calls · Avisos de llamada",
    titleProp: "Lead",
    props: { Para: { rich_text: {} }, Telefono: { rich_text: {} }, LeadId: { rich_text: {} } },
  },
};

/**
 * ID de una base de datos de la app. Sale de la variable de entorno si existe; si no,
 * se busca (o se crea) dentro de una página llamada «BUT Calls» compartida con la integración.
 */
async function appDb(kind: AppDb): Promise<string | null> {
  const def = APP_DBS[kind];
  const fromEnv = cleanId(process.env[def.env] ?? "");
  if (fromEnv) return fromEnv;
  const hit = cache.appDbs[kind];
  if (hit && (hit.id || Date.now() - hit.at < 60_000)) return hit.id;
  const found = await api("search", "POST", { query: APP_PAGE, filter: { property: "object", value: "page" }, page_size: 50 });
  const page = (found.results as any[]).find((r) => {
    if (r.parent?.type === "database_id" || r.archived) return false;
    const title = Object.values<any>(r.properties ?? {}).find((p) => p.type === "title");
    return norm((title?.title ?? []).map((t: any) => t.plain_text).join("")) === norm(APP_PAGE);
  });
  let id: string | null = null;
  if (page) {
    const children = await api(`blocks/${page.id}/children?page_size=100`);
    id = (children.results as any[]).find((b) => b.type === "child_database" && norm(b.child_database.title) === norm(def.title))?.id ?? null;
    if (!id) {
      const db = await api("databases", "POST", {
        parent: { type: "page_id", page_id: page.id },
        title: [{ type: "text", text: { content: def.title } }],
        properties: { [def.titleProp]: { title: {} }, ...def.props },
      });
      id = db.id;
    }
  }
  cache.appDbs[kind] = { at: Date.now(), id };
  return id;
}

export const usersConfigured = async () => !!(await appDb("users"));
export const logConfigured = async () => !!(await appDb("log"));

/** Lee las columnas de la base de usuarios y crea las que falten. */
async function usersSchema() {
  if (cache.usersSchema) return cache.usersSchema;
  const dbId = await appDb("users");
  let db = await api(`databases/${dbId}`);
  const have = new Set(Object.keys(db.properties).map(norm));
  const missing = Object.fromEntries(Object.entries(USER_PROPS).filter(([n]) => !have.has(norm(n))));
  if (Object.keys(missing).length) db = await api(`databases/${dbId}`, "PATCH", { properties: missing });
  const map: Record<string, { name: string; type: string }> = {};
  for (const [name, p] of Object.entries<any>(db.properties)) {
    map[p.type === "title" ? "title" : norm(name)] = { name, type: p.type };
  }
  cache.usersSchema = map;
  return map;
}

function toUser(page: any, s: Record<string, { name: string; type: string }>): StoredUser {
  const get = (k: string) => readProp(page.properties?.[s[k]?.name]);
  return {
    id: page.id,
    name: String(get("title") ?? ""),
    email: String(get("email") ?? "").trim().toLowerCase(),
    role: get("rol") === "admin" ? "admin" : "comercial",
    code: String(get("codigo") ?? "").trim(),
    hash: String(get("password") ?? ""),
    active: get("activo") === true,
  };
}

export async function listUsers(force = false): Promise<StoredUser[]> {
  const dbId = await appDb("users");
  if (!dbId) return [];
  if (!force && cache.users && Date.now() - cache.users.at < 60_000) return cache.users.value;
  const s = await usersSchema();
  const pages = await queryAll(dbId);
  const value = pages.map((p) => toUser(p, s)).filter((u) => u.email);
  cache.users = { at: Date.now(), value };
  return value;
}

export async function saveUser(id: string | null, u: Partial<StoredUser>): Promise<StoredUser> {
  const s = await usersSchema();
  const props: Record<string, unknown> = {};
  const set = (k: string, v: Value) => {
    if (s[k]) props[s[k].name] = writeProp(s[k].type, v);
  };
  if (u.name !== undefined) set("title", u.name);
  if (u.email !== undefined) set("email", u.email.trim().toLowerCase());
  if (u.role !== undefined) set("rol", u.role);
  if (u.code !== undefined) set("codigo", u.code);
  if (u.hash !== undefined) set("password", u.hash);
  if (u.active !== undefined) set("activo", u.active);
  const page = id
    ? await api(`pages/${id}`, "PATCH", { properties: props })
    : await api("pages", "POST", { parent: { database_id: await appDb("users") }, properties: props });
  cache.users = undefined;
  return toUser(page, s);
}

/* ---------- Registro de llamadas ---------- */

const text = (v: string) => ({ rich_text: richText(v) });

function toLog(page: any): CallLog {
  const g2 = (n: string) => readProp(page.properties?.[n]);
  return {
    id: page.id,
    at: String(g2("Fecha") ?? page.created_time),
    user: String(g2("Usuario") ?? ""),
    code: String(g2("Comercial") ?? ""),
    leadId: String(g2("LeadId") ?? ""),
    leadName: String(g2("Lead") ?? ""),
    source: String(g2("Origen") ?? ""),
    result: String(g2("Resultado") ?? ""),
    seconds: Number(g2("Segundos") ?? 0),
    called: g2("Llamo") === true,
  };
}

export async function addLog(e: Omit<CallLog, "id">): Promise<CallLog | null> {
  const dbId = await appDb("log");
  if (!dbId) return null;
  const page = await api("pages", "POST", {
    parent: { database_id: dbId },
    properties: {
      Evento: { title: richText(`${e.leadName} · ${e.result}`) },
      Fecha: { date: { start: e.at } },
      Usuario: text(e.user),
      Comercial: text(e.code),
      Lead: text(e.leadName),
      LeadId: text(e.leadId),
      Origen: { select: e.source ? { name: e.source } : null },
      Resultado: { select: e.result ? { name: e.result.replace(/,/g, " ") } : null },
      Segundos: { number: e.seconds },
      Llamo: { checkbox: e.called },
    },
  });
  const entry = toLog(page);
  cache.log.entries.set(entry.id, entry);
  return entry;
}

/** Llamadas registradas desde `from` (milisegundos). */
export async function getLog(from: number): Promise<CallLog[]> {
  const dbId = await appDb("log");
  if (!dbId) return [];
  const now = Date.now();
  const c = cache.log;
  if (from < c.from) {
    const pages = await queryAll(dbId, { property: "Fecha", date: { on_or_after: new Date(from).toISOString() } });
    c.entries = new Map(pages.map((p) => [p.id, toLog(p)]));
    c.from = from;
    c.syncAt = now;
  } else if (now - c.syncAt > 15_000) {
    const since = new Date(c.syncAt - 2 * 60_000).toISOString();
    const pages = await queryAll(dbId, { timestamp: "created_time", created_time: { on_or_after: since } });
    for (const p of pages) c.entries.set(p.id, toLog(p));
    c.syncAt = now;
  }
  return [...c.entries.values()].filter((e) => new Date(e.at).getTime() >= from);
}

/* ---------- Comentarios de la página del lead (notas y contrato) ---------- */

async function peopleNames(): Promise<Map<string, string>> {
  if (cache.people && Date.now() - cache.people.at < 10 * 60_000) return cache.people.names;
  const names = new Map<string, string>();
  try {
    const res = await api("users?page_size=100");
    for (const u of res.results as any[]) if (u.name) names.set(u.id, u.name);
  } catch {
    // sin permiso para leer usuarios: se muestra el nombre que venga en el comentario
  }
  cache.people = { at: Date.now(), names };
  return names;
}

export async function listComments(pageId: string): Promise<Comment[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await api(`comments?block_id=${pageId}&page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  const names = await peopleNames();
  return out.map((c) => ({
    id: c.id,
    at: c.created_time,
    author: names.get(c.created_by?.id) ?? c.display_name?.resolved_name ?? "",
    text: (c.rich_text ?? []).map((t: any) => t.plain_text).join(""),
    files: (c.attachments ?? []).map((a: any) => {
      const url: string = a.file?.url ?? "";
      let name = "Archivo";
      try {
        name = decodeURIComponent(new URL(url).pathname.split("/").pop() || name);
      } catch {}
      return { name, url };
    }),
  }));
}

/** Añade un comentario a la página del lead, con un archivo adjunto opcional (por ejemplo el contrato). */
export async function addComment(pageId: string, text: string, file?: File): Promise<void> {
  const body: any = { parent: { page_id: pageId }, rich_text: richText(text) };
  if (file) {
    const upload = await api("file_uploads", "POST", {
      mode: "single_part",
      filename: file.name,
      content_type: file.type || "application/octet-stream",
    });
    const form = new FormData();
    form.append("file", file, file.name);
    const sent = await fetch(`https://api.notion.com/v1/file_uploads/${upload.id}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": VERSION },
      body: form,
    });
    if (!sent.ok) {
      const j = await sent.json().catch(() => ({}));
      throw new NotionError(`Notion no aceptó el archivo: ${j?.message ?? sent.statusText}`);
    }
    body.attachments = [{ file_upload_id: upload.id, type: "file_upload" }];
  }
  await api("comments", "POST", body);
}

/* ---------- Avisos «llamar desde el móvil» ---------- */

const ALERT_TTL = 90_000;

export async function addAlert(to: string, a: Omit<CallAlert, "id">): Promise<boolean> {
  const dbId = await appDb("alerts");
  if (!dbId) return false;
  await api("pages", "POST", {
    parent: { database_id: dbId },
    properties: { Lead: { title: richText(a.name) }, Para: text(to), Telefono: text(a.phone), LeadId: text(a.leadId) },
  });
  return true;
}

/** Avisos recientes (último minuto y medio) dirigidos a este usuario. */
export async function listAlerts(to: string): Promise<CallAlert[]> {
  const dbId = await appDb("alerts");
  if (!dbId) return [];
  const res = await api(`databases/${dbId}/query`, "POST", {
    page_size: 5,
    filter: {
      and: [
        { property: "Para", rich_text: { equals: to } },
        { timestamp: "created_time", created_time: { on_or_after: new Date(Date.now() - ALERT_TTL - 60_000).toISOString() } },
      ],
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });
  return (res.results as any[])
    .filter((p) => Date.now() - new Date(p.created_time).getTime() < ALERT_TTL + 60_000)
    .map((p) => ({
      id: p.id,
      name: String(readProp(p.properties?.Lead) ?? ""),
      phone: String(readProp(p.properties?.Telefono) ?? ""),
      leadId: String(readProp(p.properties?.LeadId) ?? ""),
    }));
}

export async function removeAlert(id: string): Promise<void> {
  await api(`pages/${id}`, "PATCH", { archived: true });
}

/* ---------- Bonos ---------- */

function toBonus(page: any): Bonus {
  const g2 = (n: string) => readProp(page.properties?.[n]);
  const metric = String(g2("Metrica") ?? "firmados");
  const period = String(g2("Periodo") ?? "semana");
  return {
    id: page.id,
    title: String(g2("Bono") ?? ""),
    prize: String(g2("Premio") ?? ""),
    metric: metric === "llamadas" || metric === "contactos" ? metric : "firmados",
    goal: Number(g2("Meta") ?? 0),
    period: period === "dia" || period === "mes" ? period : "semana",
    para: String(g2("Para") ?? "").trim(),
    active: g2("Activo") === true,
  };
}

export const bonusConfigured = async () => !!(await appDb("bonus"));

export async function listBonuses(): Promise<Bonus[]> {
  const dbId = await appDb("bonus");
  if (!dbId) return [];
  return (await queryAll(dbId)).map(toBonus);
}

export async function saveBonus(id: string | null, b: Partial<Bonus>): Promise<Bonus> {
  const props: Record<string, unknown> = {};
  if (b.title !== undefined) props.Bono = { title: richText(b.title) };
  if (b.prize !== undefined) props.Premio = text(b.prize);
  if (b.metric !== undefined) props.Metrica = { select: { name: b.metric } };
  if (b.goal !== undefined) props.Meta = { number: b.goal };
  if (b.period !== undefined) props.Periodo = { select: { name: b.period } };
  if (b.para !== undefined) props.Para = text(b.para);
  if (b.active !== undefined) props.Activo = { checkbox: b.active };
  const page = id
    ? await api(`pages/${id}`, "PATCH", { properties: props })
    : await api("pages", "POST", { parent: { database_id: await appDb("bonus") }, properties: props });
  return toBonus(page);
}

export async function deleteBonus(id: string): Promise<void> {
  await api(`pages/${id}`, "PATCH", { archived: true });
}

/* ---------- WhatsApp: quién del equipo envió cada mensaje ---------- */

export async function addWaAuthor(messageId: string, chatId: string, user: string): Promise<void> {
  const dbId = await appDb("wa");
  if (!dbId || !messageId) return;
  await api("pages", "POST", {
    parent: { database_id: dbId },
    properties: { Mensaje: { title: richText(messageId) }, Chat: text(chatId), Usuario: text(user) },
  });
}

/** Mapa «id de mensaje → usuario» de un chat. */
export async function waAuthors(chatId: string): Promise<Record<string, string>> {
  const dbId = await appDb("wa");
  if (!dbId) return {};
  const res = await api(`databases/${dbId}/query`, "POST", {
    page_size: 100,
    filter: { property: "Chat", rich_text: { equals: chatId } },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });
  const out: Record<string, string> = {};
  for (const p of res.results as any[]) out[String(readProp(p.properties?.Mensaje) ?? "")] = String(readProp(p.properties?.Usuario) ?? "");
  return out;
}
