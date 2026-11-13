import { IGLESIA_ID } from '../../../lib/firebase';
import { redondear, type Comprobante, type Importacion, type Pago } from '../datos';

/**
 * Proyectos e inversiones (no son gastos corrientes): ej. "PC para los directos", "Remodelación del baño".
 * Inventario de bienes: todo lo que la iglesia tiene (equipos, sonido, mobiliario…).
 */

export type EstadoProyecto = 'idea' | 'aprobado' | 'recaudando' | 'comprando' | 'completado' | 'cancelado';

export const ESTADOS_PROYECTO: Record<EstadoProyecto, string> = {
  idea: 'Idea',
  aprobado: 'Aprobado',
  recaudando: 'Recaudando fondos',
  comprando: 'Comprando',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

export const CATEGORIAS_PROYECTO = ['Equipos y tecnología', 'Sonido y multimedia', 'Mobiliario', 'Mejoras del templo', 'Vehículo', 'Misiones', 'Otro'];

export interface Proyecto {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  presupuesto: number;
  fechaObjetivo?: string;
  responsable?: string;
  estado: EstadoProyecto;
  imagen?: string;
  /** Concepto de Finanzas creado para pedir aportes a los diáconos (sus pagos cuentan como fondos). */
  conceptoId?: string;
  creado: string;
  creadoPor: string;
}

export const ORIGENES_FONDOS = ['Ofrenda especial', 'Donación', 'Fondos de la iglesia', 'Actividad / venta', 'Otro'];

export interface MovProyecto {
  id: string;
  proyectoId: string;
  tipo: 'ingreso' | 'compra';
  descripcion: string;
  fecha: string;
  /** Ingreso: monto recibido. Compra: costo real (0 si aún no se compra). */
  monto: number;
  /** Compras: costo estimado y cantidad. */
  montoEstimado?: number;
  cantidad?: number;
  proveedor?: string;
  comprado?: boolean;
  /** Ingresos: de dónde vino y de quién. */
  origen?: string;
  persona?: string;
  comprobante?: Comprobante;
  /** Si la compra se registró en el inventario. */
  bienId?: string;
  /** Detalle o link (ej. de dónde comprarlo). */
  nota?: string;
  /** Si vino de un Excel (para reemplazar esa carga sin duplicar). */
  importacion?: Importacion;
  creado: string;
  registradoPor: string;
}

export type EstadoBien = 'nuevo' | 'bueno' | 'regular' | 'reparacion' | 'baja';

export const ESTADOS_BIEN: Record<EstadoBien, string> = {
  nuevo: 'Nuevo',
  bueno: 'Bueno',
  regular: 'Regular',
  reparacion: 'En reparación',
  baja: 'Dado de baja',
};

export const CATEGORIAS_BIEN = ['Computadoras y tecnología', 'Sonido', 'Video y transmisión', 'Instrumentos', 'Iluminación', 'Mobiliario', 'Cocina', 'Herramientas', 'Vehículo', 'Otro'];

export interface Bien {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  cantidad: number;
  /** Costo total de compra. */
  costo: number;
  fechaCompra: string;
  proveedor?: string;
  ubicacion?: string;
  responsable?: string;
  estado: EstadoBien;
  garantiaHasta?: string;
  foto?: string;
  factura?: Comprobante;
  proyectoId?: string;
  proyectoNombre?: string;
  notas?: string;
  importacion?: Importacion;
  creado: string;
  registradoPor: string;
}

const base = `iglesias/${IGLESIA_ID}`;
export const RUTA_PROYECTOS = `${base}/finProyectos`;
export const RUTA_MOV_PROYECTOS = `${base}/finProyectoMovs`;
export const RUTA_BIENES = `${base}/bienes`;

export interface TotalesProyecto {
  presupuesto: number;
  /** Ingresos registrados + aportes de diáconos con el concepto del proyecto. */
  recaudado: number;
  aportesDiaconos: number;
  gastado: number;
  /** Compras pendientes (costo estimado). */
  porComprar: number;
  disponible: number;
  falta: number;
  comprasHechas: number;
  comprasTotal: number;
  /** 0..1 */
  avanceFondos: number;
}

export function totalesProyecto(p: Proyecto, movs: MovProyecto[], pagos: Pago[]): TotalesProyecto {
  const propios = movs.filter((m) => m.proyectoId === p.id);
  const ingresos = propios.filter((m) => m.tipo === 'ingreso');
  const compras = propios.filter((m) => m.tipo === 'compra');
  const aportesDiaconos = p.conceptoId ? redondear(pagos.filter((x) => x.conceptoId === p.conceptoId).reduce((s, x) => s + x.monto, 0)) : 0;
  const recaudado = redondear(ingresos.reduce((s, m) => s + m.monto, 0) + aportesDiaconos);
  const gastado = redondear(compras.filter((c) => c.comprado).reduce((s, c) => s + c.monto, 0));
  const porComprar = redondear(compras.filter((c) => !c.comprado).reduce((s, c) => s + (c.montoEstimado || 0), 0));
  const presupuesto = redondear(p.presupuesto || 0);
  return {
    presupuesto,
    recaudado,
    aportesDiaconos,
    gastado,
    porComprar,
    disponible: redondear(recaudado - gastado),
    falta: redondear(Math.max(0, presupuesto - recaudado)),
    comprasHechas: compras.filter((c) => c.comprado).length,
    comprasTotal: compras.length,
    avanceFondos: presupuesto > 0 ? Math.min(1, recaudado / presupuesto) : 0,
  };
}
