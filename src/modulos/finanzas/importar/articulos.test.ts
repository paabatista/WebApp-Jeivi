import { describe, expect, it } from 'vitest';
import { filaEncabezadoArticulos, procesarArticulos, sugerirDestino, sugerirMapeoArticulos } from './articulos';
import { parsearMonto, texto } from './normalizar';
import type { Hoja } from './leerArchivo';

// Igual a "Presupuesto PC Iglesia.xlsx": título arriba, celdas combinadas en totales y notas.
const notaEnvio = '• Envío por casillero Miami a Panamá (~$150-250 según peso/volumen)';
const hoja: Hoja = {
  nombre: 'Cotización PC Iglesia',
  filas: [
    [],
    [null, 'COTIZACIÓN DETALLADA - PC STREAMING IGLESIA'],
    [],
    [],
    [null, '#', 'Categoría', 'Componente / Modelo', 'Cant.', 'Precio Unit.', 'Subtotal', 'Tienda', 'Link / Notas'],
    [null, 1, 'Procesador', 'Intel Core i7-14700', 1, 305, 305, 'Newegg', 'Non-K'],
    [null, 2, 'Monitor 1', 'Acer Nitro KG271U', 2, 129.99, null, 'Newegg', 'https://ejemplo.com/monitor'],
    [],
    [null, null, 'SUBTOTAL PC (componentes 1-7)', 'SUBTOTAL PC (componentes 1-7)', null, null, 565, null, null],
    [null, null, 'Presupuesto máximo aprobado', 'Presupuesto máximo aprobado', null, null, 1500, null, null],
    [null, null, 'Diferencia disponible (buffer)', null, null, null, 935, null, null],
    [null, null, 'USO SUGERIDO DEL BUFFER (opcional):'],
    [null, null, notaEnvio, notaEnvio, notaEnvio, notaEnvio, notaEnvio, notaEnvio],
  ],
};

describe('importar artículos', () => {
  it('reconoce una cotización y sus columnas', () => {
    expect(sugerirDestino(hoja)).toBe('proyecto');
    const fila = filaEncabezadoArticulos(hoja);
    expect(fila).toBe(4);
    const m = sugerirMapeoArticulos((hoja.filas[fila] || []).map(texto), 'proyecto');
    expect(m).toMatchObject({ nombre: 2, detalle: 3, cantidad: 4, precioUnit: 5, total: 6, proveedor: 7, nota: 8 });
  });

  it('salta totales y notas, toma el presupuesto y calcula precio × cantidad', () => {
    const fila = filaEncabezadoArticulos(hoja);
    const m = sugerirMapeoArticulos((hoja.filas[fila] || []).map(texto), 'proyecto');
    const r = procesarArticulos(hoja, fila, m, 'proyecto');
    const ok = r.filas.filter((f) => !f.omitida);
    expect(ok.map((f) => f.nombre)).toEqual(['Procesador', 'Monitor 1']);
    expect(ok[1].monto).toBe(259.98);
    expect(ok[1].nota).toBe('https://ejemplo.com/monitor');
    expect(r.presupuesto).toBe(1500);
    expect(r.filas.find((f) => f.nombre.startsWith('• Envío'))?.omitida).toBe('Nota del Excel');
    const inv = procesarArticulos(hoja, fila, sugerirMapeoArticulos((hoja.filas[fila] || []).map(texto), 'inventario'), 'inventario');
    expect(inv.filas.filter((f) => !f.omitida)).toHaveLength(2);
  });
});

describe('montos con texto', () => {
  it('no confunde un rango o una frase con un monto', () => {
    expect(parsearMonto('~$150-250 según peso')).toBeNull();
    expect(parsearMonto('150-250')).toBeNull();
    expect(parsearMonto('Windows 11 Pro OEM (~$40)')).toBeNull();
    expect(parsearMonto('$1,234.50')).toBe(1234.5);
    expect(parsearMonto('B/. 20')).toBe(20);
    expect(parsearMonto('20 dólares')).toBe(20);
    expect(parsearMonto('-15')).toBe(-15);
  });
});
