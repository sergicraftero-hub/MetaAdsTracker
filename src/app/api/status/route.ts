import { NextResponse } from "next/server";
import { handle, requireSession } from "@/lib/auth";
import { isDemo, store } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Diagnóstico para dirección: qué columnas de Notion se han encontrado y de qué tipo. */
export const GET = handle(async () => {
  await requireSession(true);
  const schema = await store.getSchema(true);
  return NextResponse.json({
    demo: isDemo(),
    usersConfigured: store.usersConfigured(),
    fields: Object.values(schema).map((f) => ({ name: f.name, type: f.type, writable: f.writable })),
  });
});
