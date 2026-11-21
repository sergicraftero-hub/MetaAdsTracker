import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { store } from "./store";

/**
 * Datos de acceso de cada código de carga: su SFID (la numeración del código), usuario, contraseña y enlace del portal
 * donde se carga el contrato.
 * Las pone dirección. Se guardan cifradas en la fila «__claves» de Ajustes: en Notion solo se ve texto ilegible,
 * y solo la app, con su SESSION_SECRET, puede descifrarlas.
 */
export interface CodeKey {
  /** Numeración del código (SFID) */
  sfid: string;
  user: string;
  password: string;
  url: string;
}

const ROW = "__claves";
const key = () => createHash("sha256").update(`${process.env.SESSION_SECRET || "solo-para-desarrollo-no-usar-en-produccion"}:claves`).digest();

function seal(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

function open(sealed: string): string {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Formato desconocido");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

async function row() {
  const rows = await store.rowsList("ajustes", { property: "Usuario", title: { equals: ROW } });
  return rows.find((r) => String(r.Usuario) === ROW);
}

/** Claves guardadas, por nombre real del código. Si no se pueden descifrar (cambió el secreto), se dan por vacías. */
export async function loadKeys(): Promise<Record<string, CodeKey>> {
  try {
    const raw = String((await row())?.Plantillas ?? "");
    if (!raw) return {};
    const saved = JSON.parse(open(raw)) as Record<string, Partial<CodeKey>>;
    return Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, { sfid: String(v.sfid ?? ""), user: String(v.user ?? ""), password: String(v.password ?? ""), url: String(v.url ?? "") }]));
  } catch {
    return {};
  }
}

const cleanUrl = (u: unknown) => {
  const s = String(u ?? "").trim().slice(0, 300);
  return /^https:\/\/[^\s]+$/i.test(s) ? s : "";
};

/** Guarda (o borra, si va vacía) la clave de un código. */
export async function saveKey(real: string, input: Partial<CodeKey>): Promise<void> {
  const all = await loadKeys();
  const next: CodeKey = { sfid: String(input.sfid ?? "").trim().slice(0, 60), user: String(input.user ?? "").trim().slice(0, 120), password: String(input.password ?? "").slice(0, 200), url: cleanUrl(input.url) };
  if (next.sfid || next.user || next.password || next.url) all[real] = next;
  else delete all[real];
  const sealed = seal(JSON.stringify(all));
  const cur = await row();
  if (cur) await store.rowSet("ajustes", cur.id, { Plantillas: sealed });
  else await store.rowAdd("ajustes", { Usuario: ROW, Plantillas: sealed });
}
