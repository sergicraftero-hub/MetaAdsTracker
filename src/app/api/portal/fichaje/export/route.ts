import { handle, requireSession } from "@/lib/auth";
import { breakMs, madridDate, madridTime, monthShifts, workedMs } from "@/lib/portal";

export const dynamic = "force-dynamic";

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const hhmm = (ms: number) => `${Math.floor(ms / 3600_000)}:${String(Math.round((ms % 3600_000) / 60_000)).padStart(2, "0")}`;

/** Registro de jornada de un mes en CSV (para el trabajador, la representación legal o la Inspección de Trabajo). */
export const GET = handle(async (req: Request) => {
  const me = await requireSession();
  const q = new URL(req.url).searchParams;
  const month = q.get("mes") ?? "";
  const who = me.role === "admin" ? (q.get("usuario") ?? "todos") : me.email;
  const shifts = (await monthShifts(month)).filter((s) => who === "todos" || s.user === who);
  const head = ["Trabajador", "Email", "Fecha", "Entrada", "Salida", "Descansos (h:mm)", "Tiempo trabajado (h:mm)", "Detalle de descansos", "Correcciones", "Integridad"];
  const lines = shifts.map((s) =>
    [
      s.name,
      s.user,
      madridDate(s.start),
      madridTime(s.start),
      s.end ? `${madridDate(s.end) !== madridDate(s.start) ? `${madridDate(s.end)} ` : ""}${madridTime(s.end)}` : "abierta",
      hhmm(breakMs(s)),
      s.end ? hhmm(workedMs(s)) : "",
      s.breaks.map((b) => `${madridTime(b.s)}-${b.e ? madridTime(b.e) : ""}`).join(" "),
      s.edits.replace(/\n/g, " | "),
      s.valid ? "correcta" : "MODIFICADO FUERA DE LA APLICACIÓN",
    ]
      .map(cell)
      .join(";"),
  );
  const csv = `﻿${head.map(cell).join(";")}\r\n${lines.join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="registro-jornada-${month}.csv"` },
  });
});
