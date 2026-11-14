/**
 * Importar cumpleaños desde Excel: listas de la congregación con nombre, fecha de nacimiento,
 * teléfono, familia… en los formatos de la vida real ("15/03/1985", "15 de marzo", columnas Día y Mes,
 * una hoja por mes o títulos "ENERO" que separan la lista).
 */
import type { Hoja } from '../finanzas/importar/leerArchivo';
import { detectarFilaEncabezado, huella, normalizarNombre, numeroMes, sinTildes, sugerirMapeoCon, texto, type Celda } from '../finanzas/importar/normalizar';
import type { Cumple } from './datos';

export type CampoCumple = 'nombre' | 'apellido' | 'fecha' | 'dia' | 'mes' | 'anio' | 'telefono' | 'familia' | 'tipo' | 'id';

export const SINONIMOS_CUMPLE: Record<CampoCumple, string[]> = {
  nombre: ['nombre', 'nombres', 'nombre completo', 'nombre y apellido', 'nombres y apellidos', 'hermano', 'hermana', 'miembro', 'persona', 'cumpleanero', 'cumpleanera'],
  apellido: ['apellido', 'apellidos'],
  fecha: ['fecha de nacimiento', 'fecha nacimiento', 'f nacimiento', 'f nac', 'nacimiento', 'fecha de cumpleanos', 'fecha cumpleanos', 'cumpleanos', 'cumple', 'fecha'],
  dia: ['dia', 'dia de cumpleanos'],
  mes: ['mes', 'mes de cumpleanos'],
  anio: ['ano', 'anio', 'ano de nacimiento'],
  telefono: ['whatsapp', 'telefono', 'celular', 'movil', 'tel', 'cel', 'contacto'],
  familia: ['familia', 'grupo familiar', 'responsable', 'acudiente', 'padres', 'padre', 'madre'],
  tipo: ['tipo', 'parentesco', 'adulto o nino', 'adulto nino'],
  id: ['id jeivi'],
};

export const ETIQUETA_CUMPLE: Record<CampoCumple, string> = {
  nombre: 'Nombre',
  apellido: 'Apellido (si va aparte)',
  fecha: 'Fecha de nacimiento / cumpleaños',
  dia: 'Día (si va aparte)',
  mes: 'Mes (si va aparte)',
  anio: 'Año (si va aparte)',
  telefono: 'WhatsApp / teléfono',
  familia: 'Familia / responsable',
  tipo: 'Tipo (adulto o hijo/a)',
  id: 'ID Jeivi',
};

export const CAMPOS_CUMPLE: CampoCumple[] = ['nombre', 'apellido', 'fecha', 'dia', 'mes', 'anio', 'telefono', 'familia', 'tipo', 'id'];

export type MapeoCumple = Partial<Record<CampoCumple, number>>;

export interface FechaCumple {
  dia: number;
  mes: number;
  anio: number | null;
}

const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** "año escrito" (85, 1985) → año; con 2 cifras se toma el siglo que no quede en el futuro. */
function anioCompleto(a: number, actual: number) {
  if (a >= 100) return a;
  return a <= actual % 100 ? 2000 + a : 1900 + a;
}

function armar(dia: number, mes: number, anio: number | null, actual: number): FechaCumple | null {
  if (!(mes >= 1 && mes <= 12) || !(dia >= 1 && dia <= DIAS_MES[mes - 1])) return null;
  const a = anio && anio >= 1900 && anio <= actual ? anio : null;
  return { dia, mes, anio: a };
}

/** Número de serie de Excel (1 = 1900-01-01) → fecha. */
function deSerial(n: number, actual: number): FechaCumple | null {
  if (n < 1000 || n > 80000) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return deFecha(d, actual);
}

function deFecha(d: Date, actual: number): FechaCumple | null {
  if (isNaN(d.getTime())) return null;
  const a = d.getUTCFullYear();
  // Si en Excel se escribe "15-mar" sin año, Excel le pone el año en curso: eso no es el año de nacimiento.
  return armar(d.getUTCDate(), d.getUTCMonth() + 1, a >= actual ? null : a, actual);
}

/**
 * Fecha de cumpleaños de una celda: Date de Excel, "15/03/1985", "15/03", "15-mar", "15 de marzo de 1985",
 * "marzo 15", "1985-03-15"… El año es opcional.
 */
export function parsearCumple(c: Celda, actual = new Date().getFullYear()): FechaCumple | null {
  if (c instanceof Date) return deFecha(c, actual);
  if (typeof c === 'number') return deSerial(c, actual);
  const s = sinTildes(texto(c).toLowerCase()).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return armar(+m[3], +m[2], +m[1], actual);
  m = s.match(/^(\d{1,2})[-/. ](\d{1,2})(?:[-/. ](\d{2,4}))?$/);
  if (m) {
    let [d, me] = [+m[1], +m[2]];
    // En Panamá se escribe día/mes; si el segundo número pasa de 12, venía mes/día.
    if (me > 12 && d <= 12) [d, me] = [me, d];
    return armar(d, me, m[3] ? anioCompleto(+m[3], actual) : null, actual);
  }
  m = s.match(/^(\d{1,2})[\s\-/.]*(?:de\s+)?([a-z]+)\.?(?:[\s\-/.,]*(?:de\s+|del\s+)?(\d{2,4}))?$/);
  if (m && numeroMes(m[2])) return armar(+m[1], numeroMes(m[2])!, m[3] ? anioCompleto(+m[3], actual) : null, actual);
  m = s.match(/^([a-z]+)\.?[\s\-/.]*(\d{1,2})(?:[\s,]+(?:de\s+)?(\d{4}))?$/);
  if (m && numeroMes(m[1])) return armar(+m[2], numeroMes(m[1])!, m[3] ? +m[3] : null, actual);
  if (/^\d{4,5}(\.\d+)?$/.test(s)) return deSerial(Number(s), actual);
  return null;
}

/** "JUAN PÉREZ" → "Juan Pérez" (las listas en mayúsculas se ven mal en el banner). */
export function arreglarNombre(s: string) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!/[a-záéíóúñ]/i.test(t) || t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

/** "Hna. María Gómez", "Hermano Luis" → sin el tratamiento (el banner usa el primer nombre). */
export function sinTitulo(nombre: string) {
  const sin = nombre.replace(/^(herman[oa]s?|hn[oa]s?|hmn[oa]|hno|hna)\.?\s+/i, '');
  return sin.trim() ? sin : nombre;
}

function esHijo(t: string) {
  return /hij|nin|menor|bebe|kid|child/.test(normalizarNombre(t));
}

/** Título de mes suelto ("ENERO", "Marzo:") que separa la lista. */
function mesDeTitulo(t: string): number | null {
  const s = sinTildes(t.toLowerCase()).replace(/[^a-z ]/g, '').trim();
  if (!s || s.length > 12 || s.includes(' ')) return null;
  return mesExacto(s);
}

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Solo el nombre del mes completo ("marzo", "setiembre") o su abreviatura de 3 letras ("mar").
 * Así un nombre suelto como "Mario", "Marta" o "Julio César" no se toma por un título de mes.
 */
export function mesExacto(palabra: string): number | null {
  const p = sinTildes(palabra.toLowerCase()).replace(/[^a-z]/g, '');
  if (p === 'setiembre' || p === 'set' || p === 'sept') return 9;
  const i = NOMBRES_MES.findIndex((m) => m === p || m.slice(0, 3) === p);
  return i >= 0 ? i + 1 : null;
}

/** Mes según el nombre de la hoja ("Marzo", "03 - Marzo"), para listas con una hoja por mes. */
export function mesDeHoja(nombre: string): number | null {
  const palabras = sinTildes(nombre.toLowerCase()).split(/[^a-z]+/).filter((p) => p.length >= 3);
  for (const p of palabras) {
    const n = numeroMes(p);
    if (n && (p.length >= 4 || p === nombre.toLowerCase().trim())) return n;
  }
  return null;
}

export interface FilaCumple {
  hoja: string;
  fila: number;
  nombre: string;
  dia: number;
  mes: number;
  anio: number | null;
  telefono: string;
  familia: string;
  /** null = el Excel no dice si es adulto o hijo. */
  parentesco: Cumple['parentesco'] | null;
  /** Id de Jeivi si el Excel se descargó de la app. */
  idJeivi: string;
  /** Texto original de la fecha (para mostrar por qué no se entendió). */
  fechaTexto: string;
  omitida?: string;
}

export function filaEncabezadoCumples(hoja: Hoja) {
  return detectarFilaEncabezado(hoja.filas, SINONIMOS_CUMPLE);
}

export function sugerirMapeoCumples(encabezados: string[]): MapeoCumple {
  return sugerirMapeoCon(encabezados, SINONIMOS_CUMPLE, CAMPOS_CUMPLE);
}

/** Convierte una hoja en filas de cumpleaños. `mesPorDefecto`: para hojas de un solo mes que solo traen el día. */
export function procesarCumples(hoja: Hoja, filaEncabezado: number, mapeo: MapeoCumple, mesPorDefecto: number | null = null, actual = new Date().getFullYear()): FilaCumple[] {
  const out: FilaCumple[] = [];
  let mesSeccion = mesPorDefecto;
  hoja.filas.slice(filaEncabezado + 1).forEach((f, i) => {
    const llenas = f.map(texto).filter(Boolean);
    if (!llenas.length) return;
    if (llenas.length === 1 && mesDeTitulo(llenas[0])) {
      mesSeccion = mesDeTitulo(llenas[0]);
      return;
    }
    const val = (c: CampoCumple) => (mapeo[c] === undefined ? null : f[mapeo[c]!] ?? null);
    const txt = (c: CampoCumple) => texto(val(c)).replace(/\s+/g, ' ').trim();

    const nombre = sinTitulo(arreglarNombre([txt('nombre'), txt('apellido')].filter(Boolean).join(' ')));
    let fecha = mapeo.fecha !== undefined ? parsearCumple(val('fecha'), actual) : null;
    if (!fecha && (mapeo.dia !== undefined || mapeo.mes !== undefined)) {
      const celdaDia = val('dia');
      // A veces la columna "Día" trae la fecha completa.
      fecha = celdaDia instanceof Date ? parsearCumple(celdaDia, actual) : null;
      if (!fecha) {
        const dia = Number(txt('dia').replace(/[^\d]/g, ''));
        const tMes = txt('mes');
        const mes = /^\d{1,2}$/.test(tMes) ? Number(tMes) : val('mes') instanceof Date ? (val('mes') as Date).getUTCMonth() + 1 : numeroMes(tMes) || (tMes ? null : mesSeccion);
        if (dia && mes) fecha = armar(dia, mes, null, actual);
      }
    }
    if (!fecha && mapeo.fecha !== undefined && mesSeccion) {
      // Lista de un mes donde la columna de fecha solo trae el día ("15").
      const t = txt('fecha');
      if (/^\d{1,2}$/.test(t)) fecha = armar(Number(t), mesSeccion, null, actual);
    }
    if (fecha && mapeo.anio !== undefined) {
      const a = Number(txt('anio').replace(/[^\d]/g, ''));
      if (a) fecha = { ...fecha, anio: armar(fecha.dia, fecha.mes, anioCompleto(a, actual), actual)?.anio ?? fecha.anio };
    }
    const tipo = txt('tipo');
    const fila: FilaCumple = {
      hoja: hoja.nombre,
      fila: filaEncabezado + i + 2,
      nombre: nombre.slice(0, 80),
      dia: fecha?.dia || 0,
      mes: fecha?.mes || 0,
      anio: fecha?.anio ?? null,
      telefono: txt('telefono').replace(/[^\d+]/g, '').slice(0, 20),
      familia: txt('familia').slice(0, 80),
      parentesco: tipo ? (esHijo(tipo) ? 'hijo' : 'titular') : null,
      idJeivi: txt('id'),
      fechaTexto: [txt('fecha'), txt('dia'), txt('mes')].filter(Boolean).join(' / '),
    };
    const clave = normalizarNombre(nombre);
    if (!nombre) fila.omitida = 'Sin nombre';
    else if (/^(sub ?total|total|cantidad|nota|notas)\b/.test(clave) || clave === 'nombre') fila.omitida = 'No es una persona';
    else if (!fecha) fila.omitida = fila.fechaTexto ? `No se entiende la fecha “${fila.fechaTexto}”` : 'Sin fecha';
    out.push(fila);
  });
  return out;
}

/* ---------- Qué hacer con cada fila: nueva, actualizar o ya registrada ---------- */

export type Accion =
  | { tipo: 'nuevo'; id: string }
  | { tipo: 'actualizar'; id: string }
  /** Ya se registró por el link o a mano: solo se llenan los datos que le faltan (WhatsApp, año, familia). */
  | { tipo: 'completar'; id: string; campos: string[] }
  | { tipo: 'existe'; id: string; detalle: string };

/** Datos que el Excel trae y el registro no tiene. */
export function camposQueFaltan(c: Cumple, f: FilaCumple): string[] {
  const out: string[] = [];
  if (!c.telefono && f.telefono) out.push('WhatsApp');
  if (!c.anio && f.anio) out.push('año');
  if (!c.familia && f.familia) out.push('familia');
  return out;
}

const textoCorto = (c: Pick<Cumple, 'dia' | 'mes'>) => `${c.dia}/${c.mes}`;

/** Cómo queda un registro al actualizarlo con la fila del Excel (lo vacío en el Excel no borra lo que ya había). */
export function datosActualizados(c: Cumple, f: FilaCumple) {
  return {
    nombre: f.nombre,
    dia: f.dia,
    mes: f.mes,
    anio: f.anio ?? c.anio ?? null,
    telefono: f.telefono || c.telefono || '',
    familia: f.familia || c.familia || '',
    parentesco: f.parentesco || c.parentesco || 'titular',
  };
}

function sinCambios(c: Cumple, f: FilaCumple) {
  const d = datosActualizados(c, f);
  return (Object.keys(d) as (keyof typeof d)[]).every((k) => (c[k] ?? '') === (d[k] ?? ''));
}

/**
 * Decide para cada fila válida si es nueva, si actualiza un registro (mismo ID Jeivi, o algo que ya vino de un Excel)
 * o si esa persona ya se había registrado por el link o a mano (no se toca).
 */
export async function decidirAcciones(filas: FilaCumple[], existentes: Cumple[]): Promise<(Accion | null)[]> {
  const porId = new Map(existentes.map((c) => [c.id, c]));
  const porNombre = new Map<string, Cumple[]>();
  existentes.forEach((c) => {
    const k = normalizarNombre(c.nombre);
    porNombre.set(k, [...(porNombre.get(k) || []), c]);
  });
  const vistos = new Map<string, number>();
  const usados = new Set<string>();
  const out: (Accion | null)[] = [];
  for (const f of filas) {
    if (f.omitida) {
      out.push(null);
      continue;
    }
    const k = normalizarNombre(f.nombre);
    const n = (vistos.get(k) || 0) + 1;
    vistos.set(k, n);
    const idImp = 'imp-' + (await huella(['cumple', k, n]));
    let accion: Accion;
    if (f.idJeivi && porId.has(f.idJeivi)) accion = { tipo: 'actualizar', id: f.idJeivi };
    else if (porId.has(idImp)) accion = { tipo: 'actualizar', id: idImp };
    else {
      const mismos = (porNombre.get(k) || []).filter((c) => !usados.has(c.id));
      const igual = mismos.find((c) => c.dia === f.dia && c.mes === f.mes) || mismos[0];
      if (!igual) accion = { tipo: 'nuevo', id: idImp };
      else if (igual.importacion) accion = { tipo: 'actualizar', id: igual.id };
      else if (igual.dia !== f.dia || igual.mes !== f.mes)
        accion = { tipo: 'existe', id: igual.id, detalle: `Ya está registrado con otra fecha (${textoCorto(igual)}): revísalo a mano` };
      else {
        const campos = camposQueFaltan(igual, f);
        accion = campos.length ? { tipo: 'completar', id: igual.id, campos } : { tipo: 'existe', id: igual.id, detalle: 'Ya está registrado igual' };
      }
    }
    if (accion.tipo === 'actualizar' && sinCambios(porId.get(accion.id)!, f)) accion = { tipo: 'existe', id: accion.id, detalle: 'Sin cambios' };
    usados.add(accion.id);
    out.push(accion);
  }
  return out;
}

/** La misma persona con la misma fecha dos veces en el Excel (o en dos hojas): solo cuenta la primera. */
export function marcarRepetidos(filas: FilaCumple[]): FilaCumple[] {
  const vistos = new Set<string>();
  return filas.map((f) => {
    if (f.omitida) return f;
    const k = `${normalizarNombre(f.nombre)}|${f.dia}|${f.mes}`;
    if (vistos.has(k)) return { ...f, omitida: 'Repetido en el Excel' };
    vistos.add(k);
    return f;
  });
}
