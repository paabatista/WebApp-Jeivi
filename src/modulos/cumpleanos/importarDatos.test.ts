import { describe, expect, it } from 'vitest';
import type { Hoja } from '../finanzas/importar/leerArchivo';
import type { Cumple } from './datos';
import { arreglarNombre, decidirAcciones, filaEncabezadoCumples, marcarRepetidos, mesDeHoja, parsearCumple, procesarCumples, sugerirMapeoCumples } from './importarDatos';

const A = 2026;

describe('parsearCumple', () => {
  it('entiende los formatos comunes', () => {
    expect(parsearCumple('15/03/1985', A)).toEqual({ dia: 15, mes: 3, anio: 1985 });
    expect(parsearCumple('15/03', A)).toEqual({ dia: 15, mes: 3, anio: null });
    expect(parsearCumple('03/25/1990', A)).toEqual({ dia: 25, mes: 3, anio: 1990 });
    expect(parsearCumple('15 de marzo', A)).toEqual({ dia: 15, mes: 3, anio: null });
    expect(parsearCumple('15-mar-85', A)).toEqual({ dia: 15, mes: 3, anio: 1985 });
    expect(parsearCumple('Marzo 15', A)).toEqual({ dia: 15, mes: 3, anio: null });
    expect(parsearCumple('1985-03-15', A)).toEqual({ dia: 15, mes: 3, anio: 1985 });
    expect(parsearCumple('29/02', A)).toEqual({ dia: 29, mes: 2, anio: null });
  });
  it('fechas de Excel: el año en curso es el que Excel pone solo', () => {
    expect(parsearCumple(new Date(Date.UTC(1979, 6, 4)), A)).toEqual({ dia: 4, mes: 7, anio: 1979 });
    expect(parsearCumple(new Date(Date.UTC(2026, 6, 4)), A)).toEqual({ dia: 4, mes: 7, anio: null });
    expect(parsearCumple(31121, A)).toEqual({ dia: 15, mes: 3, anio: 1985 });
  });
  it('rechaza lo que no es fecha', () => {
    expect(parsearCumple('31/02', A)).toBeNull();
    expect(parsearCumple('pendiente', A)).toBeNull();
    expect(parsearCumple('', A)).toBeNull();
  });
});

describe('procesarCumples', () => {
  it('lista con títulos de mes, apellido aparte y columnas Día', () => {
    const hoja: Hoja = {
      nombre: 'Cumpleaños 2026',
      filas: [
        ['LISTA DE CUMPLEAÑOS'],
        ['Nombre', 'Apellido', 'Día', 'Celular', 'Tipo'],
        ['ENERO'],
        ['JUAN', 'PÉREZ', 5, '6123-4567', 'Adulto'],
        ['Sofía', 'Pérez', '12', '', 'Hija'],
        ['FEBRERO'],
        ['Ana', 'Gómez', 'pendiente', '', ''],
        ['Ana', 'Ríos', 20, '', ''],
      ],
    };
    const fe = filaEncabezadoCumples(hoja);
    expect(fe).toBe(1);
    const filas = procesarCumples(hoja, fe, sugerirMapeoCumples(hoja.filas[fe].map(String)), null, A);
    expect(filas.map((f) => [f.nombre, f.dia, f.mes, f.parentesco, f.omitida || ''])).toEqual([
      ['Juan Pérez', 5, 1, 'titular', ''],
      ['Sofía Pérez', 12, 1, 'hijo', ''],
      ['Ana Gómez', 0, 0, null, 'No se entiende la fecha “pendiente”'],
      ['Ana Ríos', 20, 2, null, ''],
    ]);
    expect(filas[0].telefono).toBe('61234567');
  });

  it('marca repetidos y reconoce hojas por mes', () => {
    expect(mesDeHoja('03 - Marzo')).toBe(3);
    expect(mesDeHoja('Hoja1')).toBeNull();
    const hoja: Hoja = { nombre: 'x', filas: [['Nombre', 'Fecha de nacimiento'], ['Ana', '01/02'], ['ana', '1/2']] };
    const filas = marcarRepetidos(procesarCumples(hoja, 0, { nombre: 0, fecha: 1 }, null, A));
    expect(filas[1].omitida).toBe('Repetido en el Excel');
  });

  it('arreglarNombre solo cambia lo que está todo en mayúsculas', () => {
    expect(arreglarNombre('MARÍA DE LOS ÁNGELES')).toBe('María De Los Ángeles');
    expect(arreglarNombre('María de los Ángeles')).toBe('María de los Ángeles');
    expect(arreglarNombre('TIA MARCELA')).toBe('Tía Marcela');
    expect(arreglarNombre('TIO ANDRES')).toBe('Tío Andres');
  });
});

describe('decidirAcciones', () => {
  const base: Omit<Cumple, 'id' | 'nombre' | 'dia' | 'mes'> = { parentesco: 'titular', origen: 'link', autorizaFoto: true, creado: '' };
  it('nuevo, ya registrado por link (completa lo que falta), y volver a subir el mismo Excel actualiza', async () => {
    const hoja: Hoja = { nombre: 'x', filas: [['Nombre', 'Fecha', 'WhatsApp'], ['Luis Mora', '10/10', '61112222'], ['Eva Paz', '3/4', ''], ['Leo Paz', '7/7', '']] };
    const filas = procesarCumples(hoja, 0, { nombre: 0, fecha: 1, telefono: 2 }, null, A);
    const primera = await decidirAcciones(filas, [
      { ...base, id: 'l1', nombre: 'luis mora', dia: 10, mes: 10 },
      { ...base, id: 'l2', nombre: 'Eva Paz', dia: 3, mes: 5 },
    ]);
    expect(primera[0]).toEqual({ tipo: 'completar', id: 'l1', campos: ['WhatsApp'] });
    expect(primera[1]?.tipo).toBe('existe');
    expect(primera[2]?.tipo).toBe('nuevo');
    const idLeo = primera[2]!.id;
    const segunda = await decidirAcciones(filas, [{ ...base, id: idLeo, nombre: 'Leo Paz', dia: 7, mes: 6, origen: 'excel', importacion: { archivo: 'a', hoja: 'x', fecha: '' } }]);
    expect(segunda[2]).toEqual({ tipo: 'actualizar', id: idLeo });
  });
});

describe('sinTitulo', () => {
  it('quita hermano/hermana del nombre', async () => {
    const { sinTitulo } = await import('./importarDatos');
    expect(sinTitulo('Hna. María Gómez')).toBe('María Gómez');
    expect(sinTitulo('Hermano Luis Mora')).toBe('Luis Mora');
    expect(sinTitulo('Hernán Pérez')).toBe('Hernán Pérez');
  });
});

describe('nombreDeSaludo', () => {
  it('usa el primer nombre, o el tratamiento con el nombre', async () => {
    const { nombreDeSaludo } = await import('./datos');
    expect(nombreDeSaludo('Ana Paula Ríos')).toBe('Ana');
    expect(nombreDeSaludo('Tía Marcela')).toBe('Tía Marcela');
    expect(nombreDeSaludo('Pastora Eliza')).toBe('Pastora Eliza');
    expect(nombreDeSaludo('Pastor')).toBe('Pastor');
  });
});
