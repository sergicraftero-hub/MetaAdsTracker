import { NextResponse } from "next/server";
import { COOKIE, HttpError, clearThrottle, cookieOptions, handle, login, makeToken, throttle } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!email || !password) throw new HttpError(400, "Escribe tu email y tu contraseña");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const key = `${ip}|${email.trim().toLowerCase()}`;
  throttle(key);
  const user = await login(email, password);
  if (!user) throw new HttpError(401, "Email o contraseña incorrectos");
  clearThrottle(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, makeToken(user), cookieOptions);
  return res;
});
