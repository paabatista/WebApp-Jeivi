import { describe, expect, it } from 'vitest';
import { cumplesDelMes, estadoSegun, mesDelEncargo, mesesVisibles, nombreMes } from './encargosDatos';
import type { Cumple } from './datos';

describe('encargados de cumpleaños', () => {
  it('muestra el mes anterior, el actual y los siguientes (cruzando el año)', () => {
    expect(mesesVisibles('2026-11-13', 2)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
    expect(nombreMes('2026-12')).toBe('Diciembre 2026');
  });
  it('ubica cada cumpleaños en el encargo de su próximo mes', () => {
    expect(mesDelEncargo({ mes: 12 }, '2026-11-13')).toBe('2026-12');
    expect(mesDelEncargo({ mes: 11 }, '2026-11-13')).toBe('2026-11');
    expect(mesDelEncargo({ mes: 1 }, '2026-11-13')).toBe('2027-01');
  });
  it('calcula el estado del ticket y ordena por día', () => {
    expect(estadoSegun(0, 3)).toBe('pendiente');
    expect(estadoSegun(1, 3)).toBe('en_curso');
    expect(estadoSegun(3, 3)).toBe('completado');
    const l = [{ id: 'a', nombre: 'Ana', dia: 20, mes: 12 }, { id: 'b', nombre: 'Beto', dia: 3, mes: 12 }, { id: 'c', nombre: 'Caro', dia: 1, mes: 1 }] as Cumple[];
    expect(cumplesDelMes(l, '2026-12').map((c) => c.id)).toEqual(['b', 'a']);
  });
});
