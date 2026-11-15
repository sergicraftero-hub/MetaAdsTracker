import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { NotionError } from "./notion";
import { checkPassword, safeEqual } from "./password";
import { isDemo, store } from "./store";
import type { Session } from "./types";

export const COOKIE = "crm_session";
const MAX_AGE = 60 * 60 * 24 * 14;
const ENV_ADMIN_ID = "env-admin";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (isDemo() || process.env.NODE_ENV !== "production") return "solo-para-desarrollo-no-usar-en-produccion";
  throw new HttpError(500, "Falta SESSION_SECRET (mínimo 16 caracteres) en la configuración del servidor");
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function makeToken(s: Omit<Session, "exp">): string {
  const data = Buffer.from(JSON.stringify({ ...s, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${data}.${sign(data)}`;
}

function readToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [data, mac] = token.split(".");
  if (!data || !mac || !safeEqual(mac, sign(data))) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString()) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function envAdmin() {
  if (isDemo()) return { email: "demo@demo.com", password: "demo", name: "Dirección (demo)" };
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password, name: process.env.ADMIN_NAME || "Dirección" };
}

/** Sesión actual, o null. Comprueba que el usuario siga activo y refresca su rol. */
export async function getSession(): Promise<Session | null> {
  const s = readToken((await cookies()).get(COOKIE)?.value);
  if (!s) return null;
  if (s.uid === ENV_ADMIN_ID) return envAdmin()?.email === s.email ? s : null;
  try {
    const u = (await store.listUsers()).find((x) => x.id === s.uid);
    if (!u || !u.active) return null;
    return { ...s, name: u.name, role: u.role, code: u.code };
  } catch {
    return s; // Notion no responde: se mantiene la sesión firmada
  }
}

export async function requireSession(admin = false): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Sesión caducada. Vuelve a entrar.");
  if (admin && s.role !== "admin") throw new HttpError(403, "Solo dirección puede hacer esto");
  return s;
}

export async function login(email: string, password: string): Promise<Omit<Session, "exp"> | null> {
  email = email.trim().toLowerCase();
  const admin = envAdmin();
  if (admin && email === admin.email) {
    return safeEqual(password, admin.password)
      ? { uid: ENV_ADMIN_ID, name: admin.name, email, role: "admin", code: "" }
      : null;
  }
  const u = (await store.listUsers(true)).find((x) => x.email === email);
  if (!u || !u.active || !u.hash || !checkPassword(password, u.hash)) return null;
  return { uid: u.id, name: u.name, email: u.email, role: u.role, code: u.code };
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

/** Envuelve un manejador de API y convierte los errores en respuestas JSON. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError || e instanceof NotionError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error(e);
      return NextResponse.json({ error: "Error inesperado del servidor" }, { status: 500 });
    }
  };
}

/* Límite de intentos de login por IP+email (en memoria) */
const attempts = new Map<string, { n: number; until: number }>();
export function throttle(key: string): void {
  const now = Date.now();
  const a = attempts.get(key);
  if (a && a.until > now && a.n >= 8) throw new HttpError(429, "Demasiados intentos. Espera unos minutos.");
  if (!a || a.until <= now) attempts.set(key, { n: 1, until: now + 10 * 60_000 });
  else a.n++;
  if (attempts.size > 5000) attempts.clear();
}
export const clearThrottle = (key: string) => attempts.delete(key);
