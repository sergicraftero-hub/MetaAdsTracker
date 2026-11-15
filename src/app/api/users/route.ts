import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { store } from "@/lib/store";
import type { StoredUser, User } from "@/lib/types";

export const dynamic = "force-dynamic";
const pub = ({ hash: _hash, ...u }: StoredUser): User => u;

export const GET = handle(async () => {
  await requireSession(true);
  const configured = await store.usersConfigured();
  const users = configured ? (await store.listUsers(true)).map(pub) : [];
  return NextResponse.json({ configured, users });
});

export const POST = handle(async (req: Request) => {
  await requireSession(true);
  if (!(await store.usersConfigured())) throw new HttpError(400, "Falta configurar NOTION_USERS_DB_ID");
  const b = (await req.json().catch(() => ({}))) as Partial<User> & { password?: string };
  const email = b.email?.trim().toLowerCase();
  if (!b.name?.trim() || !email || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Nombre y email válidos son obligatorios");
  if (!b.password || b.password.length < 8) throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres");
  if ((await store.listUsers(true)).some((u) => u.email === email)) throw new HttpError(409, "Ya existe un usuario con ese email");
  const role = b.role === "admin" ? "admin" : "comercial";
  const user = await store.saveUser(null, {
    name: b.name.trim(),
    email,
    role,
    code: (b.code ?? "").trim(),
    active: true,
    hash: hashPassword(b.password),
  });
  return NextResponse.json({ user: pub(user) });
});
