import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { filaEncabezadoCumples, procesarCumples, sugerirMapeoCumples } from './importarDatos';
import { hojasDeWord, leerWord, mesDeLinea, separarLinea } from './leerWord';

const p = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const tc = (t: string) => `<w:tc><w:tcPr/>${p(t)}</w:tc>`;
const tr = (...c: string[]) => `<w:tr>${c.map(tc).join('')}</w:tr>`;
const doc = (cuerpo: string) => `<?xml version="1.0"?><w:document><w:body>${cuerpo}<w:sectPr/></w:body></w:document>`;

/** .docx mínimo (zip con word/document.xml comprimido). */
function docx(xml: string): File {
  const nombre = Buffer.from('word/document.xml');
  const datos = deflateRawSync(Buffer.from(xml));
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(datos.length, 18);
  local.writeUInt16LE(nombre.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(datos.length, 20);
  central.writeUInt16LE(nombre.length, 28);
  central.writeUInt32LE(0, 42);
  const inicioCentral = 30 + nombre.length + datos.length;
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(1, 10);
  fin.writeUInt32LE(46 + nombre.length, 12);
  fin.writeUInt32LE(inicioCentral, 16);
  return new File([Buffer.concat([local, nombre, datos, central, nombre, fin])], 'lista.docx');
}

describe('separarLinea', () => {
  it('saca nombre, fecha y teléfono de una línea escrita', () => {
    expect(separarLinea('Juan Pérez – 15 de marzo – 6123-4567')).toEqual(['Juan Pérez', '15 de marzo', '6123-4567']);
    expect(separarLinea('• María Gómez: 03/11/1985')).toEqual(['María Gómez', '03/11/1985', '']);
    expect(separarLinea('1. Rosa Vega 24 dic')).toEqual(['Rosa Vega', '24 dic', '']);
    expect(separarLinea('15 - Ana Ríos')).toEqual(['Ana Ríos', '15', '']);
    expect(separarLinea('Marta Díaz (Familia Díaz) 7/8')).toEqual(['Marta Díaz (Familia Díaz)', '7/8', '']);
  });
  it('reconoce los títulos de mes, sin confundir nombres como Abril', () => {
    expect(mesDeLinea('MARZO')).toBe(3);
    expect(mesDeLinea('Cumpleaños de Septiembre 2026:')).toBe(9);
    expect(mesDeLinea('Abril Gómez')).toBeNull();
    expect(mesDeLinea('Mario')).toBeNull();
    expect(mesDeLinea('Julio')).toBe(7);
    expect(separarLinea('Marta')).toEqual(['Marta', '', '']);
    expect(separarLinea('ENERO')).toEqual(['Enero']);
  });
});

describe('hojasDeWord', () => {
  it('tabla de Word → hoja con sus columnas', () => {
    const hojas = hojasDeWord(doc(p('Lista de cumpleaños') + `<w:tbl>${tr('Nombre', 'Fecha', 'Celular')}${tr('Luis Mora', '10/10/1990', '61112222')}</w:tbl>`));
    expect(hojas).toEqual([{ nombre: 'Tabla 1', filas: [['Nombre', 'Fecha', 'Celular'], ['Luis Mora', '10/10/1990', '61112222']] }]);
  });
  it('lista escrita por meses → filas que el importador entiende', () => {
    const hojas = hojasDeWord(doc([p('Cumpleaños de la iglesia'), p('ENERO'), p('5 – Juan Pérez'), p('12. Sofía Pérez 6555-1212'), p('Febrero'), p('Ana Ríos 20 de febrero de 1979')].join('')));
    expect(hojas).toHaveLength(1);
    const h = hojas[0];
    const fe = filaEncabezadoCumples(h);
    const filas = procesarCumples(h, fe, sugerirMapeoCumples(h.filas[fe].map(String)), null, 2026).filter((f) => !f.omitida);
    expect(filas.map((f) => [f.nombre, f.dia, f.mes, f.anio, f.telefono])).toEqual([
      ['Juan Pérez', 5, 1, null, ''],
      ['Sofía Pérez', 12, 1, null, '65551212'],
      ['Ana Ríos', 20, 2, 1979, ''],
    ]);
  });
});

describe('formato calendario', () => {
  const tbl = (...filas: string[]) => `<w:tbl>${filas.join('')}</w:tbl>`;
  const calendario = (mes: string) => tbl(tr(mes), tr('D', 'L', 'M', 'MI', 'J', 'V', 'S'), tr('', '', '', '', '', '1', '2'), tr('3', '4', '5', '6', '7', '8', '9'), tr('10', '11', '12', '13', '14', '15', '16'), tr('17', '18', '19', '20', '21', '22', '23'));
  const celda = (contenido: string) => `<w:tc><w:tcPr/>${contenido}<w:p/></w:tc>`;
  it('cada lista toma el mes del calendario que tiene al lado', () => {
    // Fila de la tabla grande: [lista enero][calendario enero][espacio][calendario julio][lista julio]
    const fila = (a: string, b: string, c: string, d: string) => `<w:tr>${celda(a)}${celda(b)}${celda('')}${celda(c)}${celda(d)}</w:tr>`;
    const xml = doc(
      tbl(
        fila(tbl(tr('5', 'ANDRES'), tr('7', 'OMAIRA')), calendario('ENERO 26'), calendario('JULIO 26'), tbl(tr('16', 'PASTORA CARMEN'), tr('16', 'TIO ANDRES'))),
        fila(tbl(tr('19', 'TIA MARCELA')), calendario('FEBRERO 26'), calendario('AGOSTO 26'), tbl(tr('3', 'KRISTEL'))),
      ) + p('2026 CUMPLEAÑERO JEIVI'),
    );
    const hojas = hojasDeWord(xml);
    expect(hojas).toHaveLength(1);
    expect(hojas[0].filas.slice(1).map((f) => `${f[1]} ${f[0]}`)).toEqual([
      '5 de enero ANDRES',
      '7 de enero OMAIRA',
      '19 de febrero TIA MARCELA',
      '16 de julio PASTORA CARMEN',
      '16 de julio TIO ANDRES',
      '3 de agosto KRISTEL',
    ]);
  });
});

describe('leerWord', () => {
  it('abre un .docx de verdad', async () => {
    const hojas = await leerWord(docx(doc(`<w:tbl>${tr('Nombre', 'Cumpleaños')}${tr('Eva &amp; Leo Paz', '3 de abril')}</w:tbl>`)));
    expect(hojas[0].filas[1]).toEqual(['Eva & Leo Paz', '3 de abril']);
  });
  it('Word antiguo (.doc): explica cómo guardarlo como .docx', async () => {
    await expect(leerWord(new File(['x'], 'lista.doc'))).rejects.toThrow(/Guardar como/);
  });
});
