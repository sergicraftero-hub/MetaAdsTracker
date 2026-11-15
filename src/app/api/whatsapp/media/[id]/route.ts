import { handle, requireSession } from "@/lib/auth";
import { waMedia } from "@/lib/whapi";

/** Sirve un adjunto de WhatsApp (el navegador no puede pedirlo a Whapi directamente porque necesita el token). */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await ctx.params;
  const res = await waMedia(id);
  const type = res.headers.get("content-type") ?? "application/octet-stream";
  // Solo fotos, audio y vídeo se muestran en la app; lo demás se descarga, para que un archivo
  // enviado por un desconocido (HTML, SVG…) nunca se ejecute dentro de la app.
  const inline = /^(image\/(png|jpeg|webp|gif)|audio\/|video\/)/.test(type);
  return new Response(res.body, {
    headers: {
      "Content-Type": inline ? type : "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Content-Disposition": inline ? "inline" : "attachment",
    },
  });
});
