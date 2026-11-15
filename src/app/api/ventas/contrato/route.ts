import { NextResponse } from "next/server";
import { HttpError, handle, requireSession } from "@/lib/auth";
import { parseContract } from "@/lib/contract";
import { aliasOf } from "@/lib/sales";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
const MAX = 4 * 1024 * 1024;

/** Lee un contrato de O2 en PDF y devuelve sus datos para rellenar la contratación. */
export const POST = handle(async (req: Request) => {
  const me = await requireSession();
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || !file.size) throw new HttpError(400, "Adjunta el contrato en PDF");
  if (file.size > MAX) throw new HttpError(413, "El contrato supera los 4 MB");
  let data;
  try {
    data = await parseContract(file);
  } catch (e) {
    throw new HttpError(422, (e as Error).message);
  }
  const { codigos } = await store.segOptions();
  // El punto de venta del contrato (LT00…) dice en qué código se ha cargado de verdad
  const real = data.pdv ? codigos.find((c) => c.toUpperCase().startsWith(data.pdv.toUpperCase())) : undefined;
  return NextResponse.json({ contract: { ...data, pdv: me.role === "admin" ? data.pdv : "", code: real ? aliasOf(real, codigos) : "" } });
});
