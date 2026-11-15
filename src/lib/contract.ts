/** Lector de contratos de O2 en PDF: saca los datos de la primera página. Solo servidor. */
import { extractText, getDocumentProxy } from "unpdf";
import { type Catalog, loadCatalog } from "./catalog";
import type { ContractData, SaleOrigin } from "./types";

const one = (text: string, re: RegExp) => (text.match(re)?.[1] ?? "").trim();

/** Reconoce el producto principal por lo que dice el contrato (fibra, móvil, tele) y su cuota con IVA. */
function matchProducts(cat: Catalog, productText: string, price: number, extras: string): string[] {
  const CATALOG = cat.products.filter((p) => p.active !== false);
  const t = productText.toLowerCase();
  const fiber = /fibra/.test(t);
  const mobile = /l[ií]nea m[oó]vil/.test(t);
  const tv = /movistar plus|m\+|netflix|disney/.test(t);
  const family = fiber ? (tv ? "Fibra + fijo + móvil + TV" : mobile ? "Fibra + fijo + móvil" : "Fibra + fijo") : "Móvil";
  const pool = CATALOG.filter((p) => p.family === family);
  const speed = /1\s?gb|1000\s?mb/.test(t.split("+")[0]) ? "1 Gb" : `${t.match(/(\d{3})\s?mb/)?.[1] ?? ""} Mb`;
  const gb = t.match(/m[oó]vil principal\s+(\d+)\s?gb/)?.[1] ?? t.match(/(\d+)\s?gb/)?.[1] ?? "";
  // Puntúa cada candidato: la cuota manda, y la velocidad, los gigas y la tele desempatan
  const score = (p: (typeof pool)[number]) => {
    const n = p.name.toLowerCase();
    return (
      (p.price === price ? 4 : 0) +
      (fiber && p.name.startsWith(speed) ? 2 : 0) +
      (gb && new RegExp(`(^|\\+ )${gb} gb`).test(n) ? 2 : 0) +
      (/netflix/.test(n) === /netflix/.test(t) ? 1 : 0) +
      (/disney/.test(n) === /disney/.test(t) ? 1 : 0)
    );
  };
  const ranked = [...pool].sort((a, b) => score(b) - score(a));
  // Solo se propone si la cuota coincide o, al menos, coinciden velocidad y gigas
  const main = ranked[0] && score(ranked[0]) >= 4 ? ranked[0] : undefined;
  const out = main ? [main.id] : [];
  // Líneas móviles adicionales: «1 líneas móviles adicionales 40 GB …»
  for (const m of extras.matchAll(/(\d+)\s+l[ií]neas?\s+m[oó]viles?\s+adicionales?\s+(\d+)\s?GB/gi)) {
    const extra = CATALOG.find((p) => p.family === "Móvil adicional" && p.name.startsWith(`${m[2]} GB`));
    if (extra) for (let i = 0; i < Math.min(Number(m[1]), 6); i++) out.push(extra.id);
  }
  return out;
}

export async function parseContract(file: File): Promise<Omit<ContractData, "code">> {
  let text = "";
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text: pages } = await extractText(pdf, { mergePages: false });
    text = pages.slice(0, 2).join(" ");
  } catch {
    throw new Error("No se pudo leer el PDF del contrato");
  }
  const flat = text.replace(/\s+/g, " ");
  if (!/CONTRATO DEL SERVICIO/i.test(flat) || !/O2/.test(flat)) throw new Error("El archivo no parece un contrato de O2");

  const d = flat.match(/contrataci[oó]n:\s*(\d{2})\/(\d{2})\/(\d{2,4})/);
  const productText = one(flat, /Producto\s+contratado:\s*(.*?)\s*Cuota mensual:/i);
  const extras = one(flat, /L[ií]neas M[oó]viles Adicionales:\s*(.*?)\s*(?:Tipo de N[uú]mero|Compromiso de permanencia)/i);
  const price = Math.round(Number(one(flat, /Cuota mensual:.*?\((\d+(?:,\d+)?)\s?€\/mes con IVA/i).replace(",", ".")) || 0);
  const contact = flat.match(/Tel[eé]fono de contacto y E-mail:\s*([+\d ]{9,15}),?\s*(\S+@\S+)?/i);
  // Viene de Movistar si alguna línea es portabilidad interna o el operador donante es Telefónica
  const donors = [...flat.matchAll(/Operador donante[^:]*:\s*(.*?)\s*Fecha deseada/gi)].map((m) => m[1]);
  const origin: SaleOrigin = /Portabilidad interna/i.test(flat) || donors.some((x) => /telef[oó]nica|movistar/i.test(x)) ? "Movistar" : "No Movistar";

  return {
    pdv: one(flat, /Punto de\s+Venta:\s*([A-Z]{2}\d{4,})/i),
    date: d ? `${d[3].length === 2 ? `20${d[3]}` : d[3]}-${d[2]}-${d[1]}` : "",
    name: one(flat, /Nombre completo del cliente:\s*(.+?)\s*Tipo y n[uú]mero/i),
    dni: one(flat, /Documento Identificativo:\s*(?:DNI|NIE|NIF|CIF|Pasaporte)?\s*([A-Z0-9]{6,12})/i),
    phone: (contact?.[1] ?? "").replace(/\s/g, ""),
    email: contact?.[2] ?? "",
    address: one(flat, /Direcci[oó]n de instalaci[oó]n:\s*(.+?)\s*DATOS DE FACTURACI/i),
    productText,
    price,
    origin,
    products: matchProducts(await loadCatalog(), productText, price, extras),
  };
}
