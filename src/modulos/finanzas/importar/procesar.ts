import type { Hoja } from './leerArchivo';
import { columnasDeMes, normalizarNombre, parsearFecha, parsearMonto, parsearPeriodo, texto, type CampoImport } from './normalizar';

export type TipoImport = 'gastos' | 'aportes' | 'cargos' | 'tablaMeses';

export const TIPOS_IMPORT: Record<TipoImport, { nombre: string; ayuda: string; campos: CampoImport[]; obligatorios: CampoImport[] }> = {
  aportes: {
    nombre: 'Aportes de diáconos (lo que pagaron)',
    ayuda: 'Una fila por pago: fecha, diácono, concepto y monto.',
    campos: ['fecha', 'persona', 'concepto', 'monto', 'metodo', 'nota'],
    obligatorios: ['fecha', 'persona', 'monto'],
  },
  cargos: {
    nombre: 'Cargos / cuotas (lo que le tocaba a cada uno)',
    ayuda: 'Una fila por cuota: mes, diácono, concepto y monto.',
    campos: ['periodo', 'persona', 'concepto', 'monto', 'nota'],
    obligatorios: ['persona', 'monto'],
  },
  gastos: {
    nombre: 'Gastos de la iglesia',
    ayuda: 'Una fila por gasto: fecha, concepto y monto (proveedor y nota opcionales). Las columnas sin asignar se guardan como campos libres.',
    campos: ['fecha', 'concepto', 'monto', 'proveedor', 'nota'],
    obligatorios: ['fecha', 'monto'],
  },
  tablaMeses: {
    nombre: 'Tabla por meses (una fila por diácono, una columna por mes)',
    ayuda: 'Ej.: Nombre | Ene | Feb | Mar… con lo que aportó cada uno. Elige el concepto y el año.',
    campos: ['persona'],
    obligatorios: ['persona'],
  },
};

export const ETIQUETA_CAMPO: Record<CampoImport, string> = {
  fecha: 'Fecha',
  periodo: 'Mes',
  persona: 'Diácono / nombre',
  concepto: 'Concepto',
  monto: 'Monto',
  proveedor: 'Proveedor',
  metodo: 'Método de pago',
  nota: 'Nota / detalle',
};

export interface ConfigImport {
  tipo: TipoImport;
  filaEncabezado: number;
  mapeo: Partial<Record<CampoImport, number>>;
  /** Concepto a usar si no hay columna de concepto (o en la tabla por meses). */
  conceptoFijo: string;
  anio: number;
  /** Tabla por meses: crear también el cargo mensual con esta cuota. */
  cuotaMensual?: number;
}

export interface FilaProcesada {
  fila: number; // número de fila en Excel (1 = primera)
  tipo: 'gasto' | 'pago' | 'cargo';
  fecha?: string;
  periodo: string;
  persona?: string;
  concepto: string;
  monto: number;
  proveedor?: string;
  metodo?: string;
  nota?: string;
  campos?: Record<string, string>;
  /** Id del registro si el Excel salió de Jeivi (columna "ID Jeivi"): se actualiza en vez de duplicar. */
  idJeivi?: string;
  error?: string;
}

const esTotal = (s: string) => /^(sub)?total/.test(normalizarNombre(s));

export function procesarHoja(hoja: Hoja, cfg: ConfigImport): FilaProcesada[] {
  const enc = hoja.filas[cfg.filaEncabezado] || [];
  const datos = hoja.filas.slice(cfg.filaEncabezado + 1);
  const col = (f: (typeof datos)[number], c: CampoImport) => (cfg.mapeo[c] === undefined ? null : f[cfg.mapeo[c]!] ?? null);
  const out: FilaProcesada[] = [];
  const conceptoDe = (f: (typeof datos)[number]) => texto(col(f, 'concepto')) || cfg.conceptoFijo.trim();

  if (cfg.tipo === 'tablaMeses') {
    const meses = columnasDeMes(enc, cfg.anio);
    datos.forEach((f, i) => {
      const persona = texto(col(f, 'persona'));
      if (!persona || esTotal(persona)) return;
      for (const m of meses) {
        const monto = parsearMonto(f[m.col] ?? null);
        if (monto && monto > 0) {
          out.push({ fila: cfg.filaEncabezado + i + 2, tipo: 'pago', fecha: `${m.periodo}-01`, periodo: m.periodo, persona, concepto: cfg.conceptoFijo.trim(), monto, metodo: 'Otro', nota: 'Importado de tabla por meses' });
        }
        if (cfg.cuotaMensual && cfg.cuotaMensual > 0) {
          out.push({ fila: cfg.filaEncabezado + i + 2, tipo: 'cargo', periodo: m.periodo, persona, concepto: cfg.conceptoFijo.trim(), monto: cfg.cuotaMensual });
        }
      }
    });
    return out.map((r) => (r.concepto ? r : { ...r, error: 'Elige el concepto' }));
  }

  const colId = enc.findIndex((h) => normalizarNombre(texto(h)) === 'id jeivi');
  const mapeadas = new Set([...Object.values(cfg.mapeo), colId]);
  const idDe = (f: (typeof datos)[number]) => {
    const v = colId >= 0 ? texto(f[colId] ?? null) : '';
    return /^[A-Za-z0-9_-]{6,40}$/.test(v) ? v : undefined;
  };
  datos.forEach((f, i) => {
    const filaExcel = cfg.filaEncabezado + i + 2;
    if (!f.some((c) => texto(c) !== '')) return; // fila vacía
    const persona = texto(col(f, 'persona'));
    const concepto = conceptoDe(f);
    if (esTotal(persona) || esTotal(texto(col(f, 'concepto'))) || esTotal(texto(f[0] ?? null))) return;
    const montoBruto = parsearMonto(col(f, 'monto'));
    const fecha = parsearFecha(col(f, 'fecha'));
    const nota = texto(col(f, 'nota'));
    let error = '';
    if (montoBruto === null) error = 'Monto vacío o no válido';
    const monto = Math.abs(montoBruto ?? 0);

    if (cfg.tipo === 'gastos') {
      if (!fecha) error ||= 'Fecha no válida';
      if (!concepto) error ||= 'Falta el concepto';
      const campos: Record<string, string> = {};
      enc.forEach((h, c) => {
        const nombre = texto(h);
        if (!mapeadas.has(c) && nombre && texto(f[c] ?? null)) campos[nombre] = texto(f[c] ?? null);
      });
      out.push({ fila: filaExcel, tipo: 'gasto', fecha: fecha || '', periodo: (fecha || '').slice(0, 7), concepto, monto, proveedor: texto(col(f, 'proveedor')), nota, campos, idJeivi: idDe(f), error: error || undefined });
    } else if (cfg.tipo === 'aportes') {
      if (!fecha) error ||= 'Fecha no válida';
      if (!persona) error ||= 'Falta el diácono';
      if (!concepto) error ||= 'Falta el concepto';
      out.push({ fila: filaExcel, tipo: 'pago', fecha: fecha || '', periodo: (fecha || '').slice(0, 7), persona, concepto, monto, metodo: texto(col(f, 'metodo')), nota, idJeivi: idDe(f), error: error || undefined });
    } else {
      const periodo = parsearPeriodo(col(f, 'periodo'), cfg.anio) || (fecha ? fecha.slice(0, 7) : null);
      if (!periodo) error ||= 'Mes no válido';
      if (!persona) error ||= 'Falta el diácono';
      if (!concepto) error ||= 'Falta el concepto';
      out.push({ fila: filaExcel, tipo: 'cargo', periodo: periodo || '', persona, concepto, monto, nota, idJeivi: idDe(f), error: error || undefined });
    }
  });
  return out;
}
