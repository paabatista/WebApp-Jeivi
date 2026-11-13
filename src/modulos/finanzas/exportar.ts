import type { Perfil } from '../../lib/sesion';
import { calcularEstado, resumenDeuda, textoPeriodo, type Cargo, type Concepto, type Gasto, type Pago } from './datos';

interface Datos {
  conceptos: Concepto[];
  cargos: Cargo[];
  pagos: Pago[];
  gastos: Gasto[];
  usuarios: Perfil[];
}

/** Genera un Excel (.xlsx) con el estado por diácono, cargos, aportes y gastos. */
export async function exportarExcel(d: Datos, iglesia: string) {
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Jeivi';
  libro.created = new Date();
  const formatoDinero = '"$"#,##0.00';

  const hoja = (nombre: string, columnas: { header: string; key: string; width: number; dinero?: boolean }[], filas: Record<string, unknown>[]) => {
    const h = libro.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
    h.columns = columnas.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.dinero ? { numFmt: formatoDinero } : {} }));
    h.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A2C6D' } };
    filas.forEach((f) => h.addRow(f));
    h.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
    return h;
  };

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
    d.usuarios.map((u) => {
      const e = calcularEstado(
        d.cargos.filter((c) => c.diaconoUid === u.uid),
        d.pagos.filter((p) => p.diaconoUid === u.uid),
      );
      return { nombre: u.nombre, cargos: e.totalCargos, pagos: e.totalPagos, debe: e.saldo, estado: e.alDia ? 'Al día' : 'Pendiente', detalle: resumenDeuda(e) };
    }),
  );

  hoja(
    'Cargos',
    [
      { header: 'Mes', key: 'mes', width: 12 },
      { header: 'Diácono', key: 'diacono', width: 28 },
      { header: 'Concepto', key: 'concepto', width: 18 },
      { header: 'Descripción', key: 'desc', width: 36 },
      { header: 'Monto', key: 'monto', width: 12, dinero: true },
    ],
    [...d.cargos]
      .sort((a, b) => a.periodo.localeCompare(b.periodo))
      .map((c) => ({ mes: textoPeriodo(c.periodo), diacono: c.diaconoNombre, concepto: c.conceptoNombre, desc: c.descripcion || '', monto: c.monto })),
  );

  hoja(
    'Aportes',
    [
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Diácono', key: 'diacono', width: 28 },
      { header: 'Concepto', key: 'concepto', width: 18 },
      { header: 'Método', key: 'metodo', width: 14 },
      { header: 'Nota', key: 'nota', width: 30 },
      { header: 'Monto', key: 'monto', width: 12, dinero: true },
    ],
    [...d.pagos]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((p) => ({ fecha: p.fecha, diacono: p.diaconoNombre, concepto: p.conceptoNombre, metodo: p.metodo, nota: p.nota || '', monto: p.monto })),
  );

  const camposLibres = [...new Set(d.gastos.flatMap((g) => Object.keys(g.campos || {})))];
  hoja(
    'Gastos',
    [
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Concepto', key: 'concepto', width: 18 },
      { header: 'Proveedor', key: 'proveedor', width: 22 },
      { header: 'Nota', key: 'nota', width: 30 },
      ...camposLibres.map((c) => ({ header: c, key: `c_${c}`, width: 18 })),
      { header: 'Monto', key: 'monto', width: 12, dinero: true },
    ],
    [...d.gastos]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((g) => ({
        fecha: g.fecha,
        concepto: g.conceptoNombre,
        proveedor: g.proveedor || '',
        nota: g.nota || '',
        monto: g.monto,
        ...Object.fromEntries(camposLibres.map((c) => [`c_${c}`, g.campos?.[c] || ''])),
      })),
  );

  const buffer = await libro.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `finanzas-${iglesia.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
