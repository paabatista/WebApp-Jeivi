/**
 * Totales de Finanzas para los diáconos que NO llevan las finanzas: solo números de la iglesia,
 * sin decir quién debe ni quién aportó. Lo calcula el servidor (/api/finanzas-resumen), así que
 * este archivo no importa nada de Firebase (también lo usa la API).
 */

interface Movimiento {
  conceptoId: string;
  conceptoNombre: string;
  monto: number;
  diaconoUid: string;
}
export interface CargoTotal extends Movimiento {
  periodo: string;
}
export interface PagoTotal extends Movimiento {
  fecha: string;
}
export interface GastoTotal {
  periodo: string;
  conceptoNombre: string;
  monto: number;
}

export interface TotalesFinanzas {
  periodo: string;
  gastos: number;
  aportes: number;
  asignado: number;
  /** Lo que los diáconos deben en total (todas las fechas). */
  pendiente: number;
  conceptos: { nombre: string; gastos: number; asignado: number; aportado: number }[];
  /** Aportes de los diáconos por concepto (todas las fechas): sirve para los fondos de los proyectos. */
  aportesPorConcepto: Record<string, number>;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const suma = <T>(l: T[], f: (x: T) => number) => r2(l.reduce((s, x) => s + f(x), 0));

export function totalesFinanzas(cargos: CargoTotal[], pagos: PagoTotal[], gastos: GastoTotal[], periodo: string): TotalesFinanzas {
  const gastosMes = gastos.filter((g) => g.periodo === periodo);
  const pagosMes = pagos.filter((p) => p.fecha.slice(0, 7) === periodo);
  const cargosMes = cargos.filter((c) => c.periodo === periodo);

  // Lo que se debe: por persona y concepto (un saldo a favor en Luz no tapa una deuda de Alquiler).
  const saldo = new Map<string, number>();
  for (const c of cargos) saldo.set(`${c.diaconoUid}|${c.conceptoId}`, (saldo.get(`${c.diaconoUid}|${c.conceptoId}`) || 0) + c.monto);
  for (const p of pagos) saldo.set(`${p.diaconoUid}|${p.conceptoId}`, (saldo.get(`${p.diaconoUid}|${p.conceptoId}`) || 0) - p.monto);
  const pendiente = r2([...saldo.values()].reduce((s, v) => s + Math.max(0, r2(v)), 0));

  const nombres = [...new Set([...gastosMes, ...cargosMes, ...pagosMes].map((x) => x.conceptoNombre))].sort();
  const aportesPorConcepto: Record<string, number> = {};
  for (const p of pagos) aportesPorConcepto[p.conceptoId] = r2((aportesPorConcepto[p.conceptoId] || 0) + p.monto);

  return {
    periodo,
    gastos: suma(gastosMes, (g) => g.monto),
    aportes: suma(pagosMes, (p) => p.monto),
    asignado: suma(cargosMes, (c) => c.monto),
    pendiente,
    conceptos: nombres.map((nombre) => ({
      nombre,
      gastos: suma(gastosMes.filter((g) => g.conceptoNombre === nombre), (g) => g.monto),
      asignado: suma(cargosMes.filter((c) => c.conceptoNombre === nombre), (c) => c.monto),
      aportado: suma(pagosMes.filter((p) => p.conceptoNombre === nombre), (p) => p.monto),
    })),
    aportesPorConcepto,
  };
}
