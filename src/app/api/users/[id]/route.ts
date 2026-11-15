import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { cleanHours } from "@/lib/people";
import { store } from "@/lib/store";
import type { StoredUser, User } from "@/lib/types";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireSession(true);
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Partial<User> & { password?: string };
  if (!(await store.listUsers(true)).some((u) => u.id === id)) throw new HttpError(404, "Usuario no encontrado");
  const patch: Partial<StoredUser> = {};
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim();
  if (b.role === "admin" || b.role === "comercial") patch.role = b.role;
  if (typeof b.code === "string") patch.code = b.code.trim();
  if (b.hours !== undefined) patch.hours = cleanHours(b.hours);
  if (typeof b.active === "boolean") patch.active = b.active;
  if (b.password !== undefined) {
    if (b.password.length < 8) throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres");
    patch.hash = hashPassword(b.password);
  }
  if (id === me.uid && (patch.active === false || patch.role === "comercial")) {
    throw new HttpError(400, "No puedes quitarte a ti mismo el acceso de dirección");
  }
  const { hash: _hash, ...user } = await store.saveUser(id, patch);
  return NextResponse.json({ user });
});
