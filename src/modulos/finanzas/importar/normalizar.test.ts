import { describe, expect, it } from 'vitest';
import {
  columnasDeMes,
  detectarFilaEncabezado,
  normalizarNombre,
  parsearFecha,
  parsearMonto,
  parsearPeriodo,
  sugerirMapeo,
} from './normalizar';

describe('fechas', () => {
  it('entiende los formatos comunes', () => {
    expect(parsearFecha('13/11/2026')).toBe('2026-11-13');
    expect(parsearFecha('2026-11-13')).toBe('2026-11-13');
    expect(parsearFecha('5-1-26')).toBe('2026-01-05');
    expect(parsearFecha('13 nov 2026')).toBe('2026-11-13');
    expect(parsearFecha('13 de noviembre de 2026')).toBe('2026-11-13');
    expect(parsearFecha(new Date(Date.UTC(2026, 10, 13)))).toBe('2026-11-13');
    expect(parsearFecha(46339)).toBe('2026-11-13'); // serial de Excel
    expect(parsearFecha('hola')).toBeNull();
  });
});

describe('periodos', () => {
  it('entiende meses escritos', () => {
    expect(parsearPeriodo('nov 2026')).toBe('2026-11');
    expect(parsearPeriodo('Noviembre 2026')).toBe('2026-11');
    expect(parsearPeriodo('2026-11')).toBe('2026-11');
    expect(parsearPeriodo('11/2026')).toBe('2026-11');
    expect(parsearPeriodo('Sept', 2026)).toBe('2026-09');
    expect(parsearPeriodo('13/11/2026')).toBe('2026-11');
  });
});

describe('montos', () => {
  it('limpia símbolos y separadores', () => {
    expect(parsearMonto('$1,234.50')).toBe(1234.5);
    expect(parsearMonto('1.234,50')).toBe(1234.5);
    expect(parsearMonto('B/. 20')).toBe(20);
    expect(parsearMonto('12,50')).toBe(12.5);
    expect(parsearMonto(25)).toBe(25);
    expect(parsearMonto('')).toBeNull();
  });
});

describe('columnas', () => {
  it('detecta encabezados y mapeo', () => {
    const filas = [['Iglesia Imperio de Vida'], [], ['Fecha', 'Diácono', 'Concepto', 'Monto', 'Observaciones']];
    expect(detectarFilaEncabezado(filas)).toBe(2);
    expect(sugerirMapeo(filas[2] as string[], ['fecha', 'persona', 'concepto', 'monto', 'nota'])).toEqual({
      fecha: 0,
      persona: 1,
      concepto: 2,
      monto: 3,
      nota: 4,
    });
  });
  it('detecta columnas de meses', () => {
    expect(columnasDeMes(['Nombre', 'Ene', 'Feb', 'Mar', 'Total'], 2026)).toEqual([
      { col: 1, periodo: '2026-01' },
      { col: 2, periodo: '2026-02' },
      { col: 3, periodo: '2026-03' },
    ]);
  });
  it('normaliza nombres', () => {
    expect(normalizarNombre('  José  Martínez ')).toBe('jose martinez');
  });
});
