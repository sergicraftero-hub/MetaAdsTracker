import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { store } from "@/lib/store";
import type { Template } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Mensajes con los que empieza cada usuario hasta que los cambia a su gusto. */
const DEFAULTS: Template[] = [
  {
    title: "No localizado",
    text: "Hola {nombre}, soy {yo}. Te he llamado por la oferta de O2 de fibra y móvil que pediste, pero no he podido localizarte. ¿A qué hora te viene bien que te llame? Si lo prefieres, cuéntame por aquí y te lo preparo. ¡Gracias!",
  },
  {
    title: "Segundo intento",
    text: "Hola {nombre}, soy {yo} otra vez. He vuelto a llamarte sin suerte. Sigo teniendo tu oferta de O2 reservada: dime un día y una hora que te vengan bien y te llamo yo. Si ya no te interesa, dímelo y no te molesto más.",
  },
  {
    title: "Te paso la oferta",
    text: "Hola {nombre}, soy {yo}. Como quedamos, te dejo por aquí el resumen de la oferta de O2. Cualquier duda me dices y lo vemos.",
  },
];

async function myRow(email: string) {
  const rows = await store.rowsList("ajustes", { property: "Usuario", title: { equals: email } });
  return rows.find((r) => String(r.Usuario ?? "").toLowerCase() === email);
}

function parse(raw: unknown): Template[] | null {
  try {
    const list = JSON.parse(String(raw ?? ""));
    if (!Array.isArray(list)) return null;
    return list.filter((t) => t && typeof t.title === "string" && typeof t.text === "string").map((t) => ({ title: t.title, text: t.text }));
  } catch {
    return null;
  }
}

/** Mensajes preparados del usuario (o los de partida si aún no ha guardado los suyos). */
export const GET = handle(async () => {
  const me = await requireSession();
  if (!(await store.portalReady())) return NextResponse.json({ templates: DEFAULTS, saved: false, canSave: false });
  const mine = parse((await myRow(me.email))?.Plantillas);
  return NextResponse.json({ templates: mine ?? DEFAULTS, saved: !!mine, canSave: true });
});

export const PUT = handle(async (req: Request) => {
  const me = await requireSession();
  const body = (await req.json().catch(() => ({}))) as { templates?: unknown };
  if (!Array.isArray(body.templates)) throw new HttpError(400, "Formato no válido");
  const templates = body.templates
    .map((t) => ({ title: String((t as Template)?.title ?? "").trim().slice(0, 40), text: String((t as Template)?.text ?? "").trim().slice(0, 900) }))
    .filter((t) => t.title && t.text)
    .slice(0, 8);
  const json = JSON.stringify(templates);
  const row = await myRow(me.email);
  if (row) await store.rowSet("ajustes", row.id, { Plantillas: json });
  else await store.rowAdd("ajustes", { Usuario: me.email, Plantillas: json });
  return NextResponse.json({ templates, saved: true, canSave: true });
});
