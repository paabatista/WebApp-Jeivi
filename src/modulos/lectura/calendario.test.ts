import { describe, expect, it } from 'vitest';
import { PLAN, TOTAL_DIAS, textoPasajes } from './plan';
import { estadoDelDia, fechasDelCiclo, type Ciclo } from './calendario';

const ciclo: Ciclo = { id: 'c1', nombre: 'Enero 2027', inicio: '2027-01-04' }; // lunes

describe('plan', () => {
  it('tiene 26 semanas de lunes a viernes', () => {
    expect(TOTAL_DIAS).toBe(130);
    expect(PLAN[0].pasajes[0]).toEqual({ libro: 'Génesis', capitulos: '1-8' });
    expect(textoPasajes(PLAN[129].pasajes)).toBe('Apocalipsis 12-22');
    expect(textoPasajes(PLAN[95].pasajes)).toContain('Joel 1-3');
  });
});

describe('calendario', () => {
  it('lunes de inicio = Génesis 1-8', () => {
    const e = estadoDelDia([ciclo], '2027-01-04');
    expect(e.tipo).toBe('lectura');
    if (e.tipo === 'lectura') expect(e.dia.indice).toBe(0);
  });
  it('martes de la semana 2 = Éxodo 1-8', () => {
    const e = estadoDelDia([ciclo], '2027-01-12');
    expect(e.tipo === 'lectura' && textoPasajes(e.dia.pasajes)).toBe('Éxodo 1-8');
  });
  it('sábado = ponerse al día con la semana leída', () => {
    const e = estadoDelDia([ciclo], '2027-01-09');
    expect(e.tipo).toBe('finDeSemana');
    if (e.tipo === 'finDeSemana') {
      expect(e.semana).toHaveLength(5);
      expect(e.siguiente?.indice).toBe(5);
    }
  });
  it('las pausas no avanzan el plan', () => {
    const conPausa = { ...ciclo, pausas: ['2027-01-05'] };
    expect(estadoDelDia([conPausa], '2027-01-05').tipo).toBe('pausa');
    const e = estadoDelDia([conPausa], '2027-01-06');
    expect(e.tipo === 'lectura' && e.dia.indice).toBe(1);
  });
  it('antes del inicio cuenta los días que faltan', () => {
    const e = estadoDelDia([ciclo], '2027-01-01');
    expect(e.tipo === 'antesDeInicio' && e.faltan).toBe(3);
  });
  it('el ciclo dura 26 semanas y termina en viernes', () => {
    const f = fechasDelCiclo(ciclo);
    expect(f).toHaveLength(130);
    expect(f[129]).toBe('2027-07-02');
  });
  it('al terminar pasa al próximo ciclo', () => {
    const c2: Ciclo = { id: 'c2', nombre: 'Julio', inicio: '2027-07-05' };
    expect(estadoDelDia([ciclo, c2], '2027-07-03').tipo).toBe('finDeSemana');
    const e = estadoDelDia([ciclo, c2], '2027-07-05');
    expect(e.tipo === 'lectura' && e.ciclo.id).toBe('c2');
  });
});
