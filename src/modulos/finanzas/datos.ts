import type { Perfil } from '../../lib/sesion';
import { IGLESIA_ID } from '../../lib/firebase';

/**
 * Finanzas de la iglesia. Los diáconos aportan para luz, alquiler, mantenimiento, etc.
 *  - Concepto: categoría (Luz, Alquiler…) con campos libres para sus gastos.
 *  - Cargo:    lo que le toca aportar a un diácono en un periodo (monto fijo o parte de un recibo repartido).
 *  - Pago:     lo que el diácono entregó.
 *  - Gasto:    lo que la iglesia pagó (recibos, compras), con sus campos libres.
 * Estado de cuenta del diácono = cargos − pagos, por concepto.
 */

export interface CampoLibre {
  id: string;
  nombre: string;
  tipo: 'texto' | 'numero' | 'fecha';
}

export interface Concepto {
  id: string;
  nombre: string;
  /** Monto sugerido por diácono para cargos mensuales fijos. */
  montoSugerido?: number;
  campos: CampoLibre[];
  activo: boolean;
}

export interface Cargo {
  id: string;
  diaconoUid: string;
  diaconoNombre: string;
  conceptoId: string;
  conceptoNombre: string;
  periodo: string; // YYYY-MM
  monto: number;
  descripcion?: string;
  creado: string;
  creadoPor: string;
  /** Si vino de un Excel: de qué archivo y hoja (para poder reemplazarlo al subirlo otra vez). */
  importacion?: Importacion;
  /** Nombre con el que venía en el Excel antes de vincularlo a una cuenta. */
  nombreExcel?: string;
}

export const METODOS = ['Efectivo', 'Yappy', 'Transferencia', 'Otro'] as const;

export interface Pago {
  id: string;
  diaconoUid: string;
  diaconoNombre: string;
  conceptoId: string;
  conceptoNombre: string;
  monto: number;
  fecha: string; // YYYY-MM-DD
  metodo: (typeof METODOS)[number];
  nota?: string;
  creado: string;
  registradoPor: string;
  /** Si vino de un Excel: de qué archivo y hoja (para poder reemplazarlo al subirlo otra vez). */
  importacion?: Importacion;
  /** Nombre con el que venía en el Excel antes de vincularlo a una cuenta. */
  nombreExcel?: string;
}

export interface Gasto {
  id: string;
  conceptoId: string;
  conceptoNombre: string;
  monto: number;
  fecha: string;
  periodo: string;
  proveedor?: string;
  nota?: string;
  campos: Record<string, string>;
  creado: string;
  registradoPor: string;
  /** Si vino de un Excel: de qué archivo y hoja (para poder reemplazarlo al subirlo otra vez). */
  importacion?: Importacion;
  /** Nombre con el que venía en el Excel antes de vincularlo a una cuenta. */
  nombreExcel?: string;
}

export interface Importacion {
  archivo: string;
  hoja: string;
  fecha: string;
}

/**
 * Diáconos que aún no tienen cuenta en Jeivi (vienen de un Excel): se guardan con un id
 * "ext:nombre" y luego un pastor los vincula con su usuario.
 */
export const esExterno = (uid: string) => uid.startsWith('ext:');
export const uidExterno = (nombre: string) =>
  'ext:' +
  nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const base = `iglesias/${IGLESIA_ID}`;
export const RUTA_CONCEPTOS = `${base}/finConceptos`;
export const RUTA_CARGOS = `${base}/finCargos`;
export const RUTA_PAGOS = `${base}/finPagos`;
export const RUTA_GASTOS = `${base}/finGastos`;

export const CONCEPTOS_SUGERIDOS = ['Luz', 'Agua', 'Alquiler', 'Mantenimiento', 'Limpieza', 'Internet'];

export const redondear = (n: number) => Math.round(n * 100) / 100;

export function dinero(n: number) {
  return `$${redondear(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function textoPeriodo(p: string) {
  const [a, m] = p.split('-').map(Number);
  return `${MESES_CORTOS[m - 1]} ${a}`;
}

export function periodoActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Reparte un total en partes iguales sin perder centavos. */
export function repartir(total: number, n: number): number[] {
  if (n <= 0) return [];
  const centavos = Math.round(total * 100);
  const baseC = Math.floor(centavos / n);
  const resto = centavos - baseC * n;
  return Array.from({ length: n }, (_, i) => (baseC + (i < resto ? 1 : 0)) / 100);
}

export interface Pendiente {
  cargo: Cargo;
  pendiente: number;
}

export interface EstadoConcepto {
  conceptoId: string;
  conceptoNombre: string;
  cargos: number;
  pagos: number;
  saldo: number; // > 0 debe, < 0 a favor
  pendientes: Pendiente[];
}

export interface EstadoCuenta {
  totalCargos: number;
  totalPagos: number;
  saldo: number;
  alDia: boolean;
  porConcepto: EstadoConcepto[];
}

/** Calcula el estado de cuenta aplicando los pagos a los cargos más antiguos de cada concepto. */
export function calcularEstado(cargos: Cargo[], pagos: Pago[]): EstadoCuenta {
  const ids = new Set([...cargos.map((c) => c.conceptoId), ...pagos.map((p) => p.conceptoId)]);
  const porConcepto: EstadoConcepto[] = [...ids].map((id) => {
    const cs = cargos.filter((c) => c.conceptoId === id).sort((a, b) => a.periodo.localeCompare(b.periodo) || a.creado.localeCompare(b.creado));
    const ps = pagos.filter((p) => p.conceptoId === id);
    const totC = redondear(cs.reduce((s, c) => s + c.monto, 0));
    const totP = redondear(ps.reduce((s, p) => s + p.monto, 0));
    let disponible = totP;
    const pendientes: Pendiente[] = [];
    for (const c of cs) {
      const aplicado = Math.min(disponible, c.monto);
      disponible = redondear(disponible - aplicado);
      const pend = redondear(c.monto - aplicado);
      if (pend > 0.004) pendientes.push({ cargo: c, pendiente: pend });
    }
    return {
      conceptoId: id,
      conceptoNombre: cs[0]?.conceptoNombre || ps[0]?.conceptoNombre || 'Concepto',
      cargos: totC,
      pagos: totP,
      saldo: redondear(totC - totP),
      pendientes,
    };
  });
  const totalCargos = redondear(porConcepto.reduce((s, c) => s + c.cargos, 0));
  const totalPagos = redondear(porConcepto.reduce((s, c) => s + c.pagos, 0));
  // Se debe lo pendiente de cada concepto (un saldo a favor en Luz no tapa una deuda de Alquiler).
  const deuda = redondear(porConcepto.reduce((s, c) => s + Math.max(0, c.saldo), 0));
  return {
    totalCargos,
    totalPagos,
    saldo: deuda,
    alDia: deuda <= 0.004,
    porConcepto: porConcepto.sort((a, b) => b.saldo - a.saldo),
  };
}

/** "Luz $20.00 (nov 2026), Mantenimiento $15.00 (oct–nov 2026)" */
export function resumenDeuda(e: EstadoCuenta): string {
  return e.porConcepto
    .filter((c) => c.saldo > 0.004)
    .map((c) => {
      const per = c.pendientes.map((p) => p.cargo.periodo);
      const rango = per.length ? (per[0] === per[per.length - 1] ? textoPeriodo(per[0]) : `${textoPeriodo(per[0])} – ${textoPeriodo(per[per.length - 1])}`) : '';
      return `${c.conceptoNombre} ${dinero(c.saldo)}${rango ? ` (${rango})` : ''}`;
    })
    .join(', ');
}

export interface PersonaFin {
  uid: string;
  nombre: string;
  whatsapp?: string;
  /** Aún no tiene cuenta en Jeivi (vino de un Excel). */
  externo: boolean;
}

/** Usuarios del equipo + personas "sin cuenta" que aparecen en cargos o aportes. */
export function personasConMovimientos(usuarios: Perfil[], cargos: Cargo[], pagos: Pago[]): PersonaFin[] {
  const out: PersonaFin[] = usuarios.map((u) => ({ uid: u.uid, nombre: u.nombre, whatsapp: u.whatsapp, externo: false }));
  const vistos = new Set(out.map((p) => p.uid));
  for (const m of [...cargos, ...pagos]) {
    if (vistos.has(m.diaconoUid)) continue;
    vistos.add(m.diaconoUid);
    out.push({ uid: m.diaconoUid, nombre: m.diaconoNombre, externo: true });
  }
  return out.sort((a, b) => Number(a.externo) - Number(b.externo) || a.nombre.localeCompare(b.nombre));
}
