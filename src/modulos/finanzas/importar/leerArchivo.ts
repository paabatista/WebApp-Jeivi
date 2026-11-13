import type { Celda } from './normalizar';

export interface Hoja {
  nombre: string;
  filas: Celda[][];
}

/** Valor "plano" de una celda de ExcelJS (fórmulas, texto enriquecido, enlaces…). */
function valorPlano(v: unknown): Celda {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return valorPlano(o.result);
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join('');
    if ('text' in o) return valorPlano(o.text);
    if ('error' in o) return null;
  }
  return String(v);
}

function separarCSV(textoCSV: string): Celda[][] {
  const primera = textoCSV.split(/\r?\n/)[0] || '';
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : primera.includes('\t') ? '\t' : ',';
  const filas: Celda[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < textoCSV.length; i++) {
    const ch = textoCSV[i];
    if (comillas) {
      if (ch === '"' && textoCSV[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) {
      fila.push(campo);
      campo = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && textoCSV[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += ch;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

/** Tipos de archivo que acepta el botón de subir. */
export const ACEPTA_ARCHIVOS = '.xlsx,.xlsm,.xls,.ods,.csv,.txt';

/** Excel antiguo (.xls) u OpenDocument (.ods): se leen con SheetJS (solo se descarga cuando hace falta). */
async function leerConSheetJS(archivo: File): Promise<Hoja[]> {
  const XLSX = await import('xlsx');
  let libro;
  try {
    libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: true });
  } catch {
    throw new Error('No se pudo leer el archivo. Si tiene contraseña, quítasela en Excel y vuelve a subirlo.');
  }
  const hojas: Hoja[] = [];
  for (const nombre of libro.SheetNames) {
    const filas = XLSX.utils.sheet_to_json<Celda[]>(libro.Sheets[nombre], { header: 1, raw: true, defval: null, blankrows: true, UTC: true });
    if (filas.some((f) => f.some((c) => c !== null && c !== ''))) hojas.push({ nombre, filas });
  }
  if (!hojas.length) throw new Error('El archivo no tiene datos.');
  return hojas;
}

/** Lee un .xlsx/.xlsm o .csv y devuelve sus hojas como tablas. */
export async function leerArchivo(archivo: File): Promise<Hoja[]> {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) {
    const t = (await archivo.text()).replace(/^﻿/, '');
    return [{ nombre: archivo.name.replace(/\.\w+$/, ''), filas: separarCSV(t) }];
  }
  if (nombre.endsWith('.xls') || nombre.endsWith('.ods')) return leerConSheetJS(archivo);
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  const hojas: Hoja[] = [];
  libro.eachSheet((hoja) => {
    const filas: Celda[][] = [];
    hoja.eachRow({ includeEmpty: true }, (row, n) => {
      const valores = (row.values as unknown[]).slice(1).map(valorPlano);
      filas[n - 1] = valores;
    });
    for (let i = 0; i < filas.length; i++) if (!filas[i]) filas[i] = [];
    if (filas.some((f) => f.some((c) => c !== null && c !== ''))) hojas.push({ nombre: hoja.name, filas });
  });
  if (!hojas.length) throw new Error('El archivo no tiene datos.');
  return hojas;
}
