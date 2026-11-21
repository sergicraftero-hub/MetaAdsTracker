import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { aliasOf, realOf } from "@/lib/sales";
import { store } from "@/lib/store";
import { loadKeys, saveKey } from "@/lib/vault";

export const dynamic = "force-dynamic";

/**
 * Claves de los códigos de carga (SFID, usuario, contraseña y enlace del portal).
 * - Sin parámetros (solo dirección): todos los códigos con su clave, para editarlas.
 * - ?codigo=Código 1 (cualquier usuario): la clave de ese código, pedida por su alias. No lleva el nombre real.
 */
export const GET = handle(async (req: Request) => {
  const alias = new URL(req.url).searchParams.get("codigo");
  const me = await requireSession(!alias);
  // Dirección lee la lista fresca, para que un código recién añadido aparezca ya
  const [{ codigos }, keys] = await Promise.all([store.segOptions(!alias), loadKeys()]);
  if (alias) {
    const k = keys[realOf(alias, codigos)];
    return NextResponse.json({ code: alias, key: k && (k.sfid || k.user || k.password || k.url) ? k : null, admin: me.role === "admin" });
  }
  const empty = { sfid: "", user: "", password: "", url: "" };
  return NextResponse.json({ codes: codigos.map((real) => ({ alias: aliasOf(real, codigos), real, ...(keys[real] ?? empty) })) });
});

/** Dirección guarda la clave de un código. */
export const PUT = handle(async (req: Request) => {
  await requireSession(true);
  const b = (await req.json().catch(() => ({}))) as { real?: string; sfid?: string; user?: string; password?: string; url?: string };
  const { codigos } = await store.segOptions(true);
  if (!b.real || !codigos.includes(b.real)) throw new HttpError(400, "Código no válido");
  if (b.url && !/^https:\/\//i.test(b.url.trim())) throw new HttpError(400, "El enlace tiene que empezar por https://");
  await saveKey(b.real, b);
  return NextResponse.json({ ok: true });
});
