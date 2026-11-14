/**
 * Leer listas de cumpleaños desde Word (.docx), sin librerías extra:
 * un .docx es un .zip con el texto en word/document.xml; el navegador lo descomprime solo.
 * - Cada tabla del documento se vuelve una "hoja" (como en Excel).
 * - Las líneas de texto ("Juan Pérez – 15 de marzo – 6123-4567", "MARZO", "15 Ana Gómez")
 *   se convierten en filas Nombre / Fecha / WhatsApp.
 */
import type { Hoja } from '../finanzas/importar/leerArchivo';
import { sinTildes, type Celda } from '../finanzas/importar/normalizar';
import { MESES } from './datos';
import { mesExacto, parsearCumple } from './importarDatos';

/* ---------- ZIP mínimo ---------- */

async function archivoDelZip(buf: ArrayBuffer, buscado: string): Promise<string | null> {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let fin = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) return null;
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) return null;
    const metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true);
    const lNombre = v.getUint16(p + 28, true);
    const lExtra = v.getUint16(p + 30, true);
    const lComentario = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nombre = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + lNombre));
    if (nombre === buscado) {
      const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const datos = u8.slice(inicio, inicio + comprimido);
      if (metodo === 0) return new TextDecoder().decode(datos);
      if (metodo !== 8) return null;
      const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(flujo).text();
    }
    p += 46 + lNombre + lExtra + lComentario;
  }
  return null;
}

/* ---------- XML de Word → tablas y líneas ---------- */

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodificar = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTIDADES[e] ?? m,
  );

/* ---------- Árbol del documento: párrafos y tablas (con tablas dentro de tablas) ---------- */

interface Parrafo {
  tipo: 'p';
  lineas: string[];
}
interface Tabla {
  tipo: 'tabla';
  filas: Nodo[][][];
}
type Nodo = Parrafo | Tabla;

function arbol(cuerpo: string): Nodo[] {
  const raiz: Nodo[] = [];
  const pila: { tabla: Tabla; padre: Nodo[] }[] = [];
  let destino = raiz;
  let lineas: string[] | null = null;
  let actual = '';
  const re = /<w:tbl(?=[\s>])[^>]*>|<\/w:tbl>|<w:tr(?=[\s>])[^>]*>|<w:tc(?=[\s>])[^>]*>|<\/w:tc>|<w:p(?=[\s>])[^>]*>|<\/w:p>|<w:t(?=[\s>])[^>]*>([^<]*)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<w:cr\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cuerpo))) {
    const t = m[0];
    if (t.startsWith('<w:tbl')) {
      const tabla: Tabla = { tipo: 'tabla', filas: [] };
      destino.push(tabla);
      pila.push({ tabla, padre: destino });
    } else if (t === '</w:tbl>') {
      const s = pila.pop();
      if (s) destino = s.padre;
    } else if (t.startsWith('<w:tr')) {
      pila.at(-1)?.tabla.filas.push([]);
    } else if (t.startsWith('<w:tc')) {
      const fila = pila.at(-1)?.tabla.filas.at(-1);
      if (fila) {
        const celda: Nodo[] = [];
        fila.push(celda);
        destino = celda;
      }
    } else if (t === '</w:tc>') {
      destino = pila.at(-1)?.padre ?? raiz;
    } else if (t.startsWith('<w:p')) {
      lineas = [];
      actual = '';
    } else if (t === '</w:p>') {
      (lineas ??= []).push(actual);
      destino.push({ tipo: 'p', lineas: lineas.map((l) => l.replace(/\s+/g, ' ').trim()) });
      lineas = null;
      actual = '';
    } else if (m[1] !== undefined) actual += decodificar(m[1]);
    else if (t.startsWith('<w:tab')) actual += ' – ';
    else {
      (lineas ??= []).push(actual);
      actual = '';
    }
  }
  return raiz;
}

const tieneTablas = (n: Nodo[]): boolean => n.some((x) => x.tipo === 'tabla');
const esHoja = (t: Tabla) => t.filas.every((f) => f.every((c) => !tieneTablas(c)));
const textoNodos = (n: Nodo[]): string =>
  n
    .map((x) => (x.tipo === 'p' ? x.lineas.filter(Boolean).join(' ') : x.filas.map((f) => f.map(textoNodos).join(' ')).join(' ')))
    .filter(Boolean)
    .join(' ');
const filasDeTabla = (t: Tabla): Celda[][] => t.filas.map((f) => f.map(textoNodos));

/* ---------- Formato calendario: cajitas con el calendario del mes y al lado la lista "día | nombre" ---------- */

const DIA_SEMANA = /^(d|l|m|mi|x|j|v|s|do|lu|ma|mie|ju|vi|sa|dom|lun|mar|mie|jue|vie|sab)\.?$/;
const esDia = (t: string) => /^\d{1,2}$/.test(t) && Number(t) >= 1 && Number(t) <= 31;

/** Si la tabla es un calendario de un mes ("ENERO 26", fila D L M… y los números del mes), devuelve el mes. */
function mesDeCalendario(t: Tabla): number | null {
  const filas = filasDeTabla(t).map((f) => f.map((c) => sinTildes(String(c ?? '').toLowerCase()).trim()));
  let mes: number | null = null;
  for (const f of filas.slice(0, 2)) mes ??= mesDeLinea(f.filter(Boolean).join(' '));
  if (!mes) return null;
  const semana = filas.some((f) => f.filter((c) => DIA_SEMANA.test(c)).length >= 5);
  const semanasConNumeros = filas.filter((f) => f.filter(esDia).length >= 5).length;
  return semana || semanasConNumeros >= 4 ? mes : null;
}

type Ruta = { tabla: number; fila: number; celda: number }[];
type Pieza =
  | { tipo: 'mes'; mes: number; ruta: Ruta; orden: number; calendario: boolean }
  | { tipo: 'persona'; nombre: string; dia: number; mes: number | null; anio: number | null; telefono: string; ruta: Ruta; orden: number };

function piezas(nodos: Nodo[]): Pieza[] {
  const out: Pieza[] = [];
  let tablas = 0;
  let orden = 0;
  const persona = (texto: string[], ruta: Ruta) => {
    const f = separarLinea(texto.join(' – '));
    if (!f) return;
    if (f.length === 1) {
      const mes = mesDeLinea(f[0]);
      if (mes) out.push({ tipo: 'mes', mes, ruta, orden: orden++, calendario: false });
      return;
    }
    const [nombre, fecha, telefono] = f;
    if (!fecha) return;
    const completa = esDia(fecha) ? null : parsearCumple(fecha);
    if (!esDia(fecha) && !completa) return;
    out.push({ tipo: 'persona', nombre, dia: completa ? completa.dia : Number(fecha), mes: completa?.mes ?? null, anio: completa?.anio ?? null, telefono, ruta, orden: orden++ });
  };
  const recorrer = (lista: Nodo[], ruta: Ruta) => {
    for (const n of lista) {
      if (n.tipo === 'p') {
        n.lineas.forEach((l) => l && persona([l], ruta));
        continue;
      }
      const id = tablas++;
      const mes = esHoja(n) ? mesDeCalendario(n) : null;
      if (mes) {
        out.push({ tipo: 'mes', mes, ruta, orden: orden++, calendario: true });
        continue;
      }
      n.filas.forEach((fila, i) => {
        if (esHoja(n)) {
          // Lista "día | nombre" (o "nombre | fecha"): una persona por fila.
          const celdas = fila.map(textoNodos).filter(Boolean);
          if (celdas.length) persona(celdas, [...ruta, { tabla: id, fila: i, celda: 0 }]);
        } else fila.forEach((c, j) => recorrer(c, [...ruta, { tabla: id, fila: i, celda: j }]));
      });
    }
  };
  recorrer(nodos, []);
  return out;
}

/** Mes de cada persona: el del calendario que está a su lado (misma fila de la tabla grande, la cajita más cercana);
 * si no hay, el último título de mes que apareció antes. */
function asignarMeses(lista: Pieza[]): { nombre: string; dia: number; mes: number; anio: number | null; telefono: string }[] {
  const meses = lista.filter((p): p is Extract<Pieza, { tipo: 'mes' }> => p.tipo === 'mes');
  const out: { nombre: string; dia: number; mes: number; anio: number | null; telefono: string }[] = [];
  for (const p of lista) {
    if (p.tipo !== 'persona') continue;
    let mes = p.mes;
    for (let nivel = p.ruta.length - 1; mes === null && nivel >= 0; nivel--) {
      const r = p.ruta[nivel];
      const vecinos = meses.filter((c) => c.calendario && c.ruta[nivel]?.tabla === r.tabla && c.ruta[nivel]?.fila === r.fila);
      if (!vecinos.length) continue;
      vecinos.sort((a, b) => Math.abs(a.ruta[nivel].celda - r.celda) - Math.abs(b.ruta[nivel].celda - r.celda) || Math.abs(a.orden - p.orden) - Math.abs(b.orden - p.orden));
      mes = vecinos[0].mes;
    }
    if (mes === null) mes = meses.filter((c) => c.orden < p.orden).at(-1)?.mes ?? null;
    if (mes !== null) out.push({ nombre: p.nombre, dia: p.dia, mes, anio: p.anio, telefono: p.telefono });
  }
  return out.sort((a, b) => a.mes - b.mes || a.dia - b.dia);
}

/** Todos los párrafos fuera de las tablas "de datos" (también los de tablas usadas solo para acomodar el texto). */
function lineasSueltas(nodos: Nodo[], tablasHoja: Tabla[]): string[] {
  const out: string[] = [];
  for (const n of nodos) {
    if (n.tipo === 'p') out.push(...n.lineas);
    else if (esHoja(n)) tablasHoja.push(n);
    else n.filas.forEach((f) => f.forEach((c) => out.push(...lineasSueltas(c, tablasHoja))));
  }
  return out;
}

/* ---------- Una línea de texto → [nombre, fecha, teléfono] ---------- */

const MES_RE = '(?:ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:tiembre)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\\.?';
const FECHAS = [
  /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/,
  new RegExp(`\\b\\d{1,2}(?:\\s*de)?[\\s-]*${MES_RE}(?:[\\s,-]*(?:de\\s+|del\\s+)?\\d{4})?(?![a-z])`),
  new RegExp(`\\b${MES_RE}[\\s-]*\\d{1,2}(?:,?\\s*\\d{4})?\\b`),
];
const RELLENO = new Set(['cumpleanos', 'cumpleaneros', 'cumpleaneras', 'cumples', 'mes', 'de', 'del', 'los', 'las', 'en']);

/** "MARZO", "ENERO 26", "Cumpleaños de marzo 2026:" → 3 (título que separa la lista por meses). */
export function mesDeLinea(linea: string): number | null {
  const palabras = sinTildes(linea.toLowerCase())
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !RELLENO.has(p));
  const sinAnio = linea.replace(/\b\d{4}\b/, '').replace(/\s+'?\d{2}\s*:?\s*$/, '');
  if (palabras.length !== 1 || /\d/.test(sinAnio)) return null;
  return mesExacto(palabras[0]);
}

const limpiarBordes = (s: string) => s.replace(/^[\s\-–—:|,.;)•·*]+|[\s\-–—:|,.;(•·*]+$/g, '').replace(/\s+/g, ' ');

/** "Juan Pérez – 15 de marzo – 6123-4567" → ['Juan Pérez', '15 de marzo', '6123-4567']. Título de mes → ['Marzo']. */
export function separarLinea(linea: string): string[] | null {
  let t = linea.replace(/^\s*[•·*▪►–—-]\s*/, '').trim();
  if (!t) return null;
  const mes = mesDeLinea(t);
  if (mes) return [MESES[mes - 1]];
  const bajo = sinTildes(t.toLowerCase());
  let fecha = '';
  for (const re of FECHAS) {
    const m = re.exec(bajo);
    if (m) {
      fecha = t.slice(m.index, m.index + m[0].length);
      t = `${t.slice(0, m.index)} – ${t.slice(m.index + m[0].length)}`;
      break;
    }
  }
  let telefono = '';
  const tel = /\+?\d[\d\s-]{5,}\d/.exec(t);
  if (tel && tel[0].replace(/\D/g, '').length >= 7) {
    telefono = tel[0];
    t = t.replace(tel[0], ' – ');
  }
  if (fecha) {
    // Numeración de la lista ("1. Juan Pérez – 15/03").
    t = t.replace(/^\s*\d{1,3}[.)]\s+/, '');
  } else {
    // Lista dentro de un mes: "15 – Juan Pérez" o "15. Juan Pérez".
    const dia = /^\s*(\d{1,2})(?!\d)[\s.:)\-–]*/.exec(t);
    if (dia && Number(dia[1]) >= 1 && Number(dia[1]) <= 31) {
      fecha = dia[1];
      t = t.slice(dia[0].length);
    }
  }
  const nombre = limpiarBordes(t.replace(/\s[-–—|]\s|\s*[|;]\s*/g, ' ').replace(/\(\s*\)/g, ''));
  if (!nombre || !/[a-záéíóúñ]/i.test(nombre)) return null;
  if (!fecha && !telefono) return [nombre, '', ''];
  return [nombre, fecha, telefono];
}

/** Convierte el XML del documento en hojas: el calendario completo, o una hoja por tabla y otra con la lista escrita. */
export function hojasDeWord(xml: string): Hoja[] {
  const cuerpo = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;
  const nodos = arbol(cuerpo);
  const lista = piezas(nodos);
  if (lista.some((p) => p.tipo === 'mes' && p.calendario)) {
    const personas = asignarMeses(lista);
    if (personas.length) {
      return [
        {
          nombre: 'Calendario de cumpleaños',
          filas: [
            ['Nombre', 'Fecha de nacimiento', 'WhatsApp'],
            ...personas.map((p) => [p.nombre, `${p.dia} de ${MESES[p.mes - 1].toLowerCase()}${p.anio ? ` de ${p.anio}` : ''}`, p.telefono]),
          ],
        },
      ];
    }
  }
  const hojas: Hoja[] = [];
  const tablasHoja: Tabla[] = [];
  const lineas: Celda[][] = [];
  for (const l of lineasSueltas(nodos, tablasHoja)) {
    const fila = separarLinea(l);
    if (fila) lineas.push(fila);
  }
  tablasHoja.forEach((t, i) => {
    const filas = filasDeTabla(t);
    if (filas.some((f) => f.some((c) => c))) hojas.push({ nombre: `Tabla ${i + 1}`, filas });
  });
  // El texto cuenta como lista si al menos 2 líneas traen fecha o día.
  if (lineas.filter((f) => f.length === 3 && f[1]).length >= 2) {
    hojas.push({ nombre: 'Lista escrita en el documento', filas: [['Nombre', 'Fecha de nacimiento', 'WhatsApp'], ...lineas] });
  }
  return hojas;
}

export async function leerWord(archivo: File): Promise<Hoja[]> {
  if (/\.doc$/i.test(archivo.name)) {
    throw new Error('Ese es un Word antiguo (.doc). Ábrelo en Word, elige "Guardar como" → "Documento de Word (.docx)" y súbelo de nuevo.');
  }
  const xml = await archivoDelZip(await archivo.arrayBuffer(), 'word/document.xml');
  if (!xml) throw new Error('No se pudo leer el documento de Word. Si tiene contraseña, quítasela y vuelve a subirlo.');
  const hojas = hojasDeWord(xml);
  if (!hojas.length) throw new Error('No encontré una lista de cumpleaños en el documento (ni tablas ni líneas con fechas).');
  return hojas;
}
