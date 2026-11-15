import { HttpError, handle, requireSession } from "@/lib/auth";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Contrato de una contratación, servido a través de la app para poder previsualizarlo. Solo dirección. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession(true);
  const { id } = await ctx.params;
  const row = await store.segGet(id);
  if (!row.contratoUrl) throw new HttpError(404, "Esta contratación no tiene contrato adjunto");
  const res = await fetch(new URL(row.contratoUrl, req.url));
  if (!res.ok) throw new HttpError(502, "No se pudo descargar el contrato");
  const name = String(row.contrato ?? "contrato.pdf");
  const pdf = name.toLowerCase().endsWith(".pdf");
  const image = /\.(png|jpe?g|webp)$/i.test(name);
  return new Response(res.body, {
    headers: {
      "Content-Type": pdf ? "application/pdf" : image ? (res.headers.get("content-type") ?? "image/jpeg") : "application/octet-stream",
      "Content-Disposition": `${pdf || image ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
