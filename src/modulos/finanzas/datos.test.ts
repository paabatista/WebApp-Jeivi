import { describe, expect, it } from 'vitest';
import { calcularEstado, repartir, resumenDeuda, type Cargo, type Pago } from './datos';

const cargo = (conceptoId: string, conceptoNombre: string, periodo: string, monto: number): Cargo => ({
  id: `${conceptoId}-${periodo}`,
  diaconoUid: 'u1',
  diaconoNombre: 'Juan',
  conceptoId,
  conceptoNombre,
  periodo,
  monto,
  creado: `${periodo}-01T00:00:00Z`,
  creadoPor: 'p',
});
const pago = (conceptoId: string, monto: number): Pago => ({
  id: `p-${conceptoId}-${monto}`,
  diaconoUid: 'u1',
  diaconoNombre: 'Juan',
  conceptoId,
  conceptoNombre: conceptoId,
  monto,
  fecha: '2026-11-10',
  metodo: 'Efectivo',
  creado: '',
  registradoPor: 'p',
});

describe('repartir', () => {
  it('no pierde centavos', () => {
    const partes = repartir(100, 3);
    expect(partes).toEqual([33.34, 33.33, 33.33]);
    expect(partes.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });
});

describe('estado de cuenta', () => {
  it('al día cuando pagó todo', () => {
    const e = calcularEstado([cargo('luz', 'Luz', '2026-10', 20)], [pago('luz', 20)]);
    expect(e.alDia).toBe(true);
    expect(e.saldo).toBe(0);
  });
  it('aplica pagos a los meses más antiguos y resume la deuda', () => {
    const e = calcularEstado(
      [cargo('luz', 'Luz', '2026-10', 20), cargo('luz', 'Luz', '2026-11', 20), cargo('man', 'Mantenimiento', '2026-11', 15)],
      [pago('luz', 20)],
    );
    expect(e.alDia).toBe(false);
    expect(e.saldo).toBe(35);
    const luz = e.porConcepto.find((c) => c.conceptoId === 'luz')!;
    expect(luz.pendientes.map((p) => p.cargo.periodo)).toEqual(['2026-11']);
    expect(resumenDeuda(e)).toBe('Luz $20.00 (nov 2026), Mantenimiento $15.00 (nov 2026)');
  });
  it('un saldo a favor en un concepto no tapa la deuda de otro', () => {
    const e = calcularEstado([cargo('luz', 'Luz', '2026-11', 20), cargo('alq', 'Alquiler', '2026-11', 50)], [pago('luz', 70)]);
    expect(e.saldo).toBe(50);
  });
});
