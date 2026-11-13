import type { Perfil } from '../../lib/sesion';
import { calcularEstado, personasConMovimientos, resumenDeuda, type Cargo, type Concepto, type Gasto, type Pago } from './datos';

interface Datos {
  conceptos: Concepto[];
  cargos: Cargo[];
  pagos: Pago[];
  gastos: Gasto[];
  usuarios: Perfil[];
}

type Columna = { header: string; key: string; width: number; dinero?: boolean };

/** Columna con el id del registro: si se edita el Excel y se vuelve a subir, se actualiza en vez de duplicar. */
export const COLUMNA_ID = 'ID Jeivi';
const MORADO = 'FF4A2C6D';

async function nuevoLibro() {
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Jeivi';
  libro.created = new Date();
  const hoja = (nombre: string, columnas: Columna[], filas: Record<string, unknown>[]) => {
    const h = libro.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
    h.columns = columnas.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.dinero ? { numFmt: '"$"#,##0.00' } : {} }));
    h.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MORADO } };
    filas.forEach((f) => h.addRow(f));
    h.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
    const idCol = columnas.findIndex((c) => c.header === COLUMNA_ID);
    if (idCol >= 0) h.getColumn(idCol + 1).font = { color: { argb: 'FF9CA3AF' }, size: 9 };
    return h;
  };
  return { libro, hoja };
}

async function descargar(libro: { xlsx: { writeBuffer: () => Promise<ArrayBuffer> } }, nombre: string) {
  const buffer = await libro.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const COLS_APORTES: Columna[] = [
  { header: 'Fecha', key: 'fecha', width: 12 },
  { header: 'Diácono', key: 'diacono', width: 28 },
  { header: 'Concepto', key: 'concepto', width: 18 },
  { header: 'Método', key: 'metodo', width: 14 },
  { header: 'Nota', key: 'nota', width: 30 },
  { header: 'Monto', key: 'monto', width: 12, dinero: true },
];
const COLS_CARGOS: Columna[] = [
  { header: 'Mes', key: 'mes', width: 12 },
  { header: 'Diácono', key: 'diacono', width: 28 },
  { header: 'Concepto', key: 'concepto', width: 18 },
  { header: 'Descripción', key: 'desc', width: 36 },
  { header: 'Monto', key: 'monto', width: 12, dinero: true },
];
const COLS_GASTOS: Columna[] = [
  { header: 'Fecha', key: 'fecha', width: 12 },
  { header: 'Concepto', key: 'concepto', width: 18 },
  { header: 'Proveedor', key: 'proveedor', width: 22 },
  { header: 'Nota', key: 'nota', width: 30 },
];
const ID: Columna = { header: COLUMNA_ID, key: 'id', width: 22 };

/** Excel completo: estado por diácono, aportes, cargos y gastos (se puede editar y volver a subir). */
export async function exportarExcel(d: Datos, iglesia: string) {
  const { libro, hoja } = await nuevoLibro();

  hoja(
    'Estado por diácono',
    [
      { header: 'Diácono', key: 'nombre', width: 28 },
      { header: 'Asignado', key: 'cargos', width: 14, dinero: true },
      { header: 'Aportado', key: 'pagos', width: 14, dinero: true },
      { header: 'Debe', key: 'debe', width: 14, dinero: true },
      { header: 'Estado', key: 'estado', width: 12 },
      { header: 'Detalle', key: 'detalle', width: 60 },
    ],
    personasConMovimientos(d.usuarios, d.cargos, d.pagos).map((p) => {
      const e = calcularEstado(
        d.cargos.filter((c) => c.diaconoUid === p.uid),
        d.pagos.filter((x) => x.diaconoUid === p.uid),
      );
      return { nombre: p.nombre + (p.externo ? ' (sin cuenta)' : ''), cargos: e.totalCargos, pagos: e.totalPagos, debe: e.saldo, estado: e.alDia ? 'Al día' : 'Pendiente', detalle: resumenDeuda(e) };
    }),
  );

  hoja(
    'Aportes',
    [...COLS_APORTES, ID],
    [...d.pagos]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((p) => ({ fecha: p.fecha, diacono: p.diaconoNombre, concepto: p.conceptoNombre, metodo: p.metodo, nota: p.nota || '', monto: p.monto, id: p.id })),
  );

  hoja(
    'Cargos',
    [...COLS_CARGOS, ID],
    [...d.cargos]
      .sort((a, b) => a.periodo.localeCompare(b.periodo))
      .map((c) => ({ mes: c.periodo, diacono: c.diaconoNombre, concepto: c.conceptoNombre, desc: c.descripcion || '', monto: c.monto, id: c.id })),
  );

  const camposLibres = [...new Set(d.gastos.flatMap((g) => Object.keys(g.campos || {})))];
  hoja(
    'Gastos',
    [...COLS_GASTOS, ...camposLibres.map((c) => ({ header: c, key: `c_${c}`, width: 18 })), { header: 'Monto', key: 'monto', width: 12, dinero: true }, ID],
    [...d.gastos]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((g) => ({
        fecha: g.fecha,
        concepto: g.conceptoNombre,
        proveedor: g.proveedor || '',
        nota: g.nota || '',
        monto: g.monto,
        id: g.id,
        ...Object.fromEntries(camposLibres.map((c) => [`c_${c}`, g.campos?.[c] || ''])),
      })),
  );

  await descargar(libro, `finanzas-${iglesia.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Plantilla vacía con el formato que Jeivi reconoce. */
export async function descargarPlantilla() {
  const { libro, hoja } = await nuevoLibro();
  const instr = libro.addWorksheet('Instrucciones');
  instr.getColumn(1).width = 110;
  [
    'PLANTILLA DE FINANZAS — JEIVI',
    '',
    'Llena una hoja por tipo de dato y súbela en Finanzas → Importar Excel (una hoja a la vez).',
    '• Aportes: lo que cada diácono entregó (fecha, diácono, concepto, método, nota, monto).',
    '• Cargos: lo que le tocaba a cada diácono por mes (mes como 2026-11 o "nov 2026").',
    '• Gastos: lo que pagó la iglesia. Puedes agregar columnas propias (N.º factura, kWh…): se guardan como campos libres.',
    '• Tabla por meses: una fila por diácono y una columna por mes con lo que aportó.',
    '',
    'Fechas: 13/11/2026 o 2026-11-13.  Montos: 25 o 25.00 (con o sin $).',
    'Si descargas el Excel desde Jeivi, verás la columna "ID Jeivi": no la borres. Así, al editar y volver a subir, se actualiza en vez de duplicarse.',
  ].forEach((t, i) => {
    instr.getCell(i + 1, 1).value = t;
    if (i === 0) instr.getCell(i + 1, 1).font = { bold: true, size: 14, color: { argb: MORADO } };
  });
  const hoy = new Date().toISOString().slice(0, 10);
  hoja('Aportes', COLS_APORTES, [{ fecha: hoy, diacono: 'Nombre Apellido', concepto: 'Luz', metodo: 'Efectivo', nota: '', monto: 25 }]);
  hoja('Cargos', COLS_CARGOS, [{ mes: hoy.slice(0, 7), diacono: 'Nombre Apellido', concepto: 'Luz', desc: 'Factura de luz', monto: 25 }]);
  hoja('Gastos', [...COLS_GASTOS, { header: 'N.º factura', key: 'factura', width: 14 }, { header: 'Monto', key: 'monto', width: 12, dinero: true }], [
    { fecha: hoy, concepto: 'Luz', proveedor: 'Naturgy', nota: 'Factura octubre', factura: '123456', monto: 100 },
  ]);
  hoja(
    'Tabla por meses',
    [{ header: 'Diácono', key: 'n', width: 28 }, ...['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m) => ({ header: m, key: m, width: 9, dinero: true }))],
    [{ n: 'Nombre Apellido', Ene: 25, Feb: 25, Mar: 25 }],
  );
  await descargar(libro, 'plantilla-finanzas-jeivi.xlsx');
}

/** Inventario de bienes en Excel. */
export async function exportarInventario(bienes: import('./proyectos/datos').Bien[], iglesia: string) {
  const { ESTADOS_BIEN } = await import('./proyectos/datos');
  const { libro, hoja } = await nuevoLibro();
  hoja(
    'Inventario',
    [
      { header: 'Bien', key: 'nombre', width: 28 },
      { header: 'Categoría', key: 'categoria', width: 22 },
      { header: 'Marca', key: 'marca', width: 14 },
      { header: 'Modelo', key: 'modelo', width: 16 },
      { header: 'N.º de serie', key: 'serie', width: 18 },
      { header: 'Cantidad', key: 'cantidad', width: 10 },
      { header: 'Costo', key: 'costo', width: 12, dinero: true },
      { header: 'Fecha de compra', key: 'fecha', width: 14 },
      { header: 'Proveedor', key: 'proveedor', width: 18 },
      { header: 'Ubicación', key: 'ubicacion', width: 18 },
      { header: 'Responsable', key: 'responsable', width: 18 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Garantía hasta', key: 'garantia', width: 14 },
      { header: 'Proyecto', key: 'proyecto', width: 22 },
      { header: 'Notas', key: 'notas', width: 30 },
      { header: 'Factura', key: 'factura', width: 30 },
      ID,
    ],
    bienes.map((b) => ({
      nombre: b.nombre,
      categoria: b.categoria,
      marca: b.marca || '',
      modelo: b.modelo || '',
      serie: b.serie || '',
      cantidad: b.cantidad,
      costo: b.costo,
      fecha: b.fechaCompra || '',
      proveedor: b.proveedor || '',
      ubicacion: b.ubicacion || '',
      responsable: b.responsable || '',
      estado: ESTADOS_BIEN[b.estado],
      garantia: b.garantiaHasta || '',
      proyecto: b.proyectoNombre || '',
      notas: b.notas || b.descripcion || '',
      factura: b.factura?.url.startsWith('http') ? b.factura.url : b.factura ? '(adjunta en Jeivi)' : '',
      id: b.id,
    })),
  );
  await descargar(libro, `inventario-${iglesia.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
