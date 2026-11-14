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
import { mesExacto } from './importarDatos';

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

/** Texto de un párrafo: tabuladores como " – " y saltos de línea como líneas aparte. */
function textoParrafo(xml: string): string[] {
  const partes: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<w:cr\/>/g;
  let m: RegExpExecArray | null;
  let actual = '';
  while ((m = re.exec(xml))) {
    if (m[1] !== undefined) actual += decodificar(m[1]);
    else if (m[0].startsWith('<w:tab')) actual += ' – ';
    else {
      partes.push(actual);
      actual = '';
    }
  }
  partes.push(actual);
  return partes.map((t) => t.replace(/\s+/g, ' ').trim());
}

const parrafos = (xml: string) => xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];

/** Separa el cuerpo en bloques de primer nivel: tablas y párrafos, en orden. */
function bloques(xml: string): { tipo: 'tabla' | 'texto'; xml: string }[] {
  const out: { tipo: 'tabla' | 'texto'; xml: string }[] = [];
  const re = /<w:tbl>|<w:tbl\s[^>]*>|<\/w:tbl>/g;
  let profundidad = 0;
  let inicioTabla = 0;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[0] !== '</w:tbl>') {
      if (profundidad === 0) {
        if (m.index > ultimo) out.push({ tipo: 'texto', xml: xml.slice(ultimo, m.index) });
        inicioTabla = m.index;
      }
      profundidad++;
    } else if (profundidad > 0 && --profundidad === 0) {
      ultimo = m.index + m[0].length;
      out.push({ tipo: 'tabla', xml: xml.slice(inicioTabla, ultimo) });
    }
  }
  if (ultimo < xml.length) out.push({ tipo: 'texto', xml: xml.slice(ultimo) });
  return out;
}

function filasDeTabla(xml: string): Celda[][] {
  return (xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map((tr) =>
    (tr.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || []).map((tc) =>
      parrafos(tc)
        .flatMap(textoParrafo)
        .filter(Boolean)
        .join(' '),
    ),
  );
}

/* ---------- Una línea de texto → [nombre, fecha, teléfono] ---------- */

const MES_RE = '(?:ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:tiembre)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\\.?';
const FECHAS = [
  /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/,
  new RegExp(`\\b\\d{1,2}(?:\\s*de)?[\\s-]*${MES_RE}(?:[\\s,-]*(?:de\\s+|del\\s+)?\\d{4})?(?![a-z])`),
  new RegExp(`\\b${MES_RE}[\\s-]*\\d{1,2}(?:,?\\s*\\d{4})?\\b`),
];
const RELLENO = new Set(['cumpleanos', 'cumpleaneros', 'cumpleaneras', 'cumples', 'mes', 'de', 'del', 'los', 'las', 'en']);

/** "MARZO", "Cumpleaños de marzo 2026:" → 3 (título que separa la lista por meses). */
export function mesDeLinea(linea: string): number | null {
  const palabras = sinTildes(linea.toLowerCase())
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !RELLENO.has(p));
  if (palabras.length !== 1 || /\d/.test(linea.replace(/\b\d{4}\b/, ''))) return null;
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

/** Convierte el XML del documento en hojas: una por tabla y otra con la lista escrita como texto. */
export function hojasDeWord(xml: string): Hoja[] {
  const cuerpo = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;
  const hojas: Hoja[] = [];
  const lineas: Celda[][] = [];
  let tablas = 0;
  for (const b of bloques(cuerpo)) {
    if (b.tipo === 'tabla') {
      const filas = filasDeTabla(b.xml);
      if (filas.some((f) => f.some((c) => c))) hojas.push({ nombre: `Tabla ${++tablas}`, filas });
    } else {
      for (const l of parrafos(b.xml).flatMap(textoParrafo)) {
        const fila = separarLinea(l);
        if (fila) lineas.push(fila);
      }
    }
  }
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
