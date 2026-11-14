import { describe, expect, it } from 'vitest';
import { calcularEstado, type Cargo, type Pago } from './datos';
import { totalesFinanzas } from './totales';

const cargo = (diaconoUid: string, conceptoId: string, monto: number, periodo: string) =>
  ({ id: `${diaconoUid}${conceptoId}${periodo}`, diaconoUid, diaconoNombre: diaconoUid, conceptoId, conceptoNombre: conceptoId, monto, periodo, creado: periodo }) as unknown as Cargo;
const pago = (diaconoUid: string, conceptoId: string, monto: number, fecha: string) =>
  ({ id: `${diaconoUid}${conceptoId}${fecha}`, diaconoUid, diaconoNombre: diaconoUid, conceptoId, conceptoNombre: conceptoId, monto, fecha }) as unknown as Pago;

describe('totalesFinanzas (resumen sin nombres)', () => {
  const cargos = [cargo('ana', 'Luz', 25, '2026-10'), cargo('ana', 'Luz', 25, '2026-11'), cargo('ana', 'Alquiler', 50, '2026-11'), cargo('luis', 'Luz', 25, '2026-11')];
  const pagos = [pago('ana', 'Luz', 60, '2026-11-05'), pago('luis', 'Luz', 25, '2026-11-02'), pago('luis', 'Proyecto PC', 40, '2026-10-20')];
  const gastos = [{ periodo: '2026-11', conceptoNombre: 'Luz', monto: 100 }];
  const t = totalesFinanzas(cargos, pagos, gastos, '2026-11');

  it('suma los movimientos del mes', () => {
    expect([t.gastos, t.aportes, t.asignado]).toEqual([100, 85, 100]);
    expect(t.conceptos).toEqual([
      { nombre: 'Alquiler', gastos: 0, asignado: 50, aportado: 0 },
      { nombre: 'Luz', gastos: 100, asignado: 50, aportado: 85 },
    ]);
  });

  it('lo pendiente coincide con el estado de cuenta de cada diácono (un saldo a favor no tapa otra deuda)', () => {
    const porPersona = ['ana', 'luis'].map((u) => calcularEstado(cargos.filter((c) => c.diaconoUid === u), pagos.filter((p) => p.diaconoUid === u)).saldo);
    expect(t.pendiente).toBe(porPersona.reduce((s, x) => s + x, 0));
    expect(t.pendiente).toBe(50);
  });

  it('aportes por concepto (para los fondos de los proyectos)', () => {
    expect(t.aportesPorConcepto).toEqual({ Luz: 85, 'Proyecto PC': 40 });
  });
});
