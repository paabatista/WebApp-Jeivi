/**
 * Conversión de lo que viene en un Excel "de la vida real" a datos limpios:
 * fechas en varios formatos, montos con $ y separadores, meses escritos ("nov 2026", "Noviembre"),
 * y nombres con o sin tildes.
 */

export type Celda = string | number | boolean | Date | null;

const pad = (n: number) => String(n).padStart(2, '0');

export function sinTildes(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** "  José  Martínez " → "jose martinez" */
export function normalizarNombre(s: string) {
  return sinTildes(String(s ?? ''))
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function texto(c: Celda): string {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return aISO(c);
  return String(c).trim();
}

function aISO(d: Date) {
  // Las fechas de Excel llegan como medianoche UTC.
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function fechaValida(a: number, m: number, d: number) {
  if (a < 1900 || a > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCMonth() === m - 1 ? `${a}-${pad(m)}-${pad(d)}` : null;
}

/** Número de serie de Excel → fecha (1 = 1900-01-01). */
function serialExcel(n: number) {
  if (n < 20000 || n > 80000) return null;
  return aISO(new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000));
}

/** Acepta Date, serial de Excel, "2026-11-13", "13/11/2026", "13-11-26", "13 nov 2026". */
export function parsearFecha(c: Celda): string | null {
  if (c instanceof Date) return isNaN(c.getTime()) ? null : aISO(c);
  if (typeof c === 'number') return serialExcel(c);
  const s = texto(c);
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return fechaValida(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let a = +m[3];
    if (a < 100) a += 2000;
    // En Panamá se escribe día/mes/año; si el "día" pasa de 12 no hay duda.
    return fechaValida(a, +m[2], +m[1]) || fechaValida(a, +m[1], +m[2]);
  }
  m = sinTildes(s.toLowerCase()).match(/^(\d{1,2})\s*(?:de\s+)?([a-z]+)\.?\s*(?:de\s+|del\s+)?(\d{2,4})$/);
  if (m) {
    const mes = numeroMes(m[2]);
    let a = +m[3];
    if (a < 100) a += 2000;
    if (mes) return fechaValida(a, mes, +m[1]);
  }
  if (/^\d+(\.\d+)?$/.test(s)) return serialExcel(Number(s));
  return null;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** "nov", "Noviembre", "setiembre", "Nov." → 11 */
export function numeroMes(s: string): number | null {
  const t = sinTildes(s.toLowerCase()).replace(/[^a-z]/g, '');
  if (t.length < 3) return null;
  if (t.startsWith('set')) return 9;
  const i = MESES.findIndex((m) => m.startsWith(t) || t.startsWith(m.slice(0, 3)));
  if (i >= 0) return i + 1;
  const j = MESES_EN.findIndex((m) => m.startsWith(t) || t.startsWith(m.slice(0, 3)));
  return j >= 0 ? j + 1 : null;
}

/** Mes de un cargo: "2026-11", "nov 2026", "Noviembre 2026", "11/2026", una fecha, o solo "Nov" (usa el año dado). */
export function parsearPeriodo(c: Celda, anioPorDefecto?: number): string | null {
  if (c instanceof Date) return aISO(c).slice(0, 7);
  const f = typeof c === 'number' ? serialExcel(c) : null;
  if (f) return f.slice(0, 7);
  const s = sinTildes(texto(c).toLowerCase());
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${pad(+m[2])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${pad(+m[1])}`;
  m = s.match(/^([a-z]+)\.?[\s\-/]*(?:de\s+|del\s+)?(\d{2,4})$/);
  if (m) {
    const mes = numeroMes(m[1]);
    let a = +m[2];
    if (a < 100) a += 2000;
    if (mes) return `${a}-${pad(mes)}`;
  }
  const soloMes = numeroMes(s);
  if (soloMes && anioPorDefecto && /^[a-z.]+$/.test(s.replace(/\s/g, ''))) return `${anioPorDefecto}-${pad(soloMes)}`;
  const fecha = parsearFecha(c);
  return fecha ? fecha.slice(0, 7) : null;
}

/** "$1,234.50", "1.234,50", "B/. 20", "(15.00)", "20" → número (o null). */
export function parsearMonto(c: Celda): number | null {
  if (typeof c === 'number') return isFinite(c) ? Math.round(c * 100) / 100 : null;
  let s = texto(c);
  if (!s) return null;
  const negativo = /^\(.*\)$/.test(s) || /^-|\s-/.test(s);
  // Quitar símbolos de moneda (incluido "B/." del balboa).
  s = s.replace(/b\/\.?|us\$|usd|pab|d[oó]lares|balboas|\$/gi, '');
  // Si queda texto ("~150-250 según peso") o un rango ("150-250"), no es un monto.
  if (/[a-zñáéíóú]/i.test(s) || /\d\s*[-–]\s*\d/.test(s)) return null;
  s = s
    .replace(/[^\d.,]/g, '')
    .replace(/^[.,]+|[.,]+$/g, '');
  if (!s) return null;
  const ultComa = s.lastIndexOf(',');
  const ultPunto = s.lastIndexOf('.');
  if (ultComa > -1 && ultPunto > -1) {
    // El separador que aparece último es el decimal.
    s = ultComa > ultPunto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (ultComa > -1) {
    // "1,234" (miles) vs "12,50" (decimal)
    s = /,\d{3}$/.test(s) && s.length > 4 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  if (!isFinite(n)) return null;
  return Math.round((negativo ? -n : n) * 100) / 100;
}

/* ---------- Detección de columnas ---------- */

export type CampoImport = 'fecha' | 'periodo' | 'persona' | 'concepto' | 'monto' | 'proveedor' | 'metodo' | 'nota';

export const SINONIMOS: Record<CampoImport, string[]> = {
  fecha: ['fecha', 'dia', 'date', 'fecha de pago', 'fecha pago'],
  periodo: ['mes', 'periodo', 'mes correspondiente', 'correspondiente a', 'month'],
  persona: ['diacono', 'nombre', 'hermano', 'persona', 'aportante', 'miembro', 'responsable', 'quien'],
  concepto: ['concepto', 'categoria', 'tipo', 'rubro', 'servicio', 'cuenta', 'detalle de gasto'],
  monto: ['monto', 'valor', 'importe', 'total', 'cantidad', 'pago', 'aporte', 'b/.', 'usd', '$'],
  proveedor: ['proveedor', 'empresa', 'pagado a', 'beneficiario', 'comercio'],
  metodo: ['metodo', 'forma de pago', 'medio', 'via'],
  nota: ['nota', 'notas', 'observacion', 'observaciones', 'descripcion', 'detalle', 'comentario', 'referencia'],
};

/** Puntaje de qué tanto se parece un encabezado a una lista de sinónimos. */
function puntajeCon(encabezado: string, sinonimos: string[]) {
  const e = normalizarNombre(encabezado);
  if (!e) return 0;
  let mejor = 0;
  for (const s of sinonimos) {
    const n = normalizarNombre(s) || s;
    if (e === n) mejor = Math.max(mejor, 3);
    else if (e.startsWith(n + ' ') || e.endsWith(' ' + n)) mejor = Math.max(mejor, 2);
    else if (n.length >= 4 && e.includes(n)) mejor = Math.max(mejor, 1);
  }
  return mejor;
}

/** Propone qué columna corresponde a cada campo (cada columna se usa una sola vez). */
export function sugerirMapeo(encabezados: string[], campos: CampoImport[]): Partial<Record<CampoImport, number>> {
  return sugerirMapeoCon(encabezados, SINONIMOS, campos);
}

/** Igual que sugerirMapeo, con cualquier juego de campos y sinónimos (proyectos, inventario…). */
export function sugerirMapeoCon<K extends string>(encabezados: string[], sinonimos: Record<K, string[]>, campos: K[]): Partial<Record<K, number>> {
  const candidatos: { campo: K; col: number; p: number }[] = [];
  encabezados.forEach((h, col) => campos.forEach((campo) => {
    const p = puntajeCon(h, sinonimos[campo]);
    if (p > 0) candidatos.push({ campo, col, p });
  }));
  candidatos.sort((a, b) => b.p - a.p || a.col - b.col);
  const out: Partial<Record<K, number>> = {};
  const usadas = new Set<number>();
  for (const c of candidatos) {
    if (out[c.campo] !== undefined || usadas.has(c.col)) continue;
    out[c.campo] = c.col;
    usadas.add(c.col);
  }
  return out;
}

/** Fila de encabezados: la primera (de las 15 primeras) que más se parece a nombres de columna. */
export function detectarFilaEncabezado(filas: Celda[][], sinonimos: Record<string, string[]> = SINONIMOS): number {
  let mejor = 0;
  let mejorP = -1;
  const listas = Object.values(sinonimos);
  filas.slice(0, 15).forEach((f, i) => {
    const textos = f.map(texto).filter((t) => t && isNaN(Number(t)));
    const p = textos.reduce((s, t) => s + Math.max(...listas.map((l) => puntajeCon(t, l)), sinonimos === SINONIMOS && numeroMes(t) ? 1 : 0), 0);
    if (p > mejorP) {
      mejorP = p;
      mejor = i;
    }
  });
  return mejor;
}

/** Columnas cuyo encabezado es un mes ("Ene", "Febrero 2026", "2026-03", fecha) → periodo YYYY-MM. */
export function columnasDeMes(encabezados: Celda[], anio: number): { col: number; periodo: string }[] {
  const out: { col: number; periodo: string }[] = [];
  encabezados.forEach((h, col) => {
    const t = texto(h);
    if (!t) return;
    const esMes = h instanceof Date || numeroMes(t.split(/[\s\-/.]/)[0] || '') !== null || /^\d{4}[-/]\d{1,2}$/.test(t);
    if (!esMes) return;
    const p = parsearPeriodo(h, anio);
    if (p) out.push({ col, periodo: p });
  });
  return out;
}

/** Huella de una fila para no importar dos veces lo mismo. */
export async function huella(partes: (string | number)[]): Promise<string> {
  const datos = new TextEncoder().encode(partes.map((p) => String(p).trim().toLowerCase()).join('|'));
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(hash))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
