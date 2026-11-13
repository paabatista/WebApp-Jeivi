/**
 * Importar listas de artículos desde Excel: cotizaciones/compras de un proyecto
 * (ej. "Presupuesto PC Iglesia.xlsx") o bienes para el inventario.
 */
import type { Hoja } from './leerArchivo';
import { columnasDeMes, detectarFilaEncabezado, normalizarNombre, parsearFecha, parsearMonto, sugerirMapeo, sugerirMapeoCon, texto } from './normalizar';

export type Destino = 'finanzas' | 'proyecto' | 'inventario';

export type CampoArticulo =
  | 'nombre'
  | 'detalle'
  | 'categoria'
  | 'marca'
  | 'modelo'
  | 'serie'
  | 'cantidad'
  | 'precioUnit'
  | 'total'
  | 'proveedor'
  | 'fecha'
  | 'ubicacion'
  | 'responsable'
  | 'estado'
  | 'garantia'
  | 'nota';

export const SINONIMOS_ARTICULO: Record<CampoArticulo, string[]> = {
  nombre: ['articulo', 'producto', 'item', 'equipo', 'nombre', 'bien', 'componente'],
  detalle: ['componente modelo', 'descripcion', 'detalle', 'especificacion', 'especificaciones', 'caracteristicas'],
  categoria: ['categoria', 'tipo', 'clase', 'area'],
  marca: ['marca', 'fabricante'],
  modelo: ['modelo', 'componente modelo', 'referencia'],
  serie: ['serie', 'numero de serie', 'no serie', 'serial', 's n', 'sn'],
  cantidad: ['cantidad', 'cant', 'qty', 'unidades', 'uds', 'unid'],
  precioUnit: ['precio unit', 'precio unitario', 'costo unitario', 'valor unitario', 'unitario', 'p unit', 'precio'],
  total: ['subtotal', 'total', 'monto', 'importe', 'costo total', 'precio total', 'costo', 'valor'],
  proveedor: ['tienda', 'proveedor', 'comercio', 'vendedor', 'lugar de compra', 'donde comprar'],
  fecha: ['fecha', 'fecha de compra', 'fecha compra', 'comprado el'],
  ubicacion: ['ubicacion', 'lugar', 'donde esta', 'salon', 'area de uso'],
  responsable: ['responsable', 'encargado', 'a cargo', 'custodio'],
  estado: ['estado', 'condicion'],
  garantia: ['garantia', 'garantia hasta', 'vence garantia'],
  nota: ['notas', 'nota', 'link notas', 'link', 'enlace', 'observaciones', 'observacion', 'comentario', 'comentarios'],
};

export const ETIQUETA_ARTICULO: Record<CampoArticulo, string> = {
  nombre: 'Artículo / nombre',
  detalle: 'Modelo o detalle',
  categoria: 'Categoría',
  marca: 'Marca',
  modelo: 'Modelo',
  serie: 'Número de serie',
  cantidad: 'Cantidad',
  precioUnit: 'Precio unitario',
  total: 'Total / subtotal',
  proveedor: 'Proveedor / tienda',
  fecha: 'Fecha de compra',
  ubicacion: 'Ubicación',
  responsable: 'Responsable',
  estado: 'Estado',
  garantia: 'Garantía hasta',
  nota: 'Notas / link',
};

export const CAMPOS_DESTINO: Record<'proyecto' | 'inventario', CampoArticulo[]> = {
  proyecto: ['nombre', 'detalle', 'cantidad', 'precioUnit', 'total', 'proveedor', 'fecha', 'nota'],
  inventario: ['nombre', 'detalle', 'categoria', 'marca', 'modelo', 'serie', 'cantidad', 'precioUnit', 'total', 'proveedor', 'fecha', 'ubicacion', 'responsable', 'estado', 'garantia', 'nota'],
};

export type MapeoArticulo = Partial<Record<CampoArticulo, number>>;

export interface FilaArticulo {
  fila: number;
  nombre: string;
  detalle: string;
  cantidad: number;
  /** Costo total de la fila (total, o precio unitario × cantidad). null = sin precio. */
  monto: number | null;
  proveedor: string;
  fecha: string;
  nota: string;
  categoria: string;
  marca: string;
  modelo: string;
  serie: string;
  ubicacion: string;
  responsable: string;
  estado: string;
  garantia: string;
  /** Por qué no se importa (fila de totales, sin precio…). */
  omitida?: string;
}

export interface ResultadoArticulos {
  filas: FilaArticulo[];
  /** Si el Excel trae una fila "Presupuesto…", su monto. */
  presupuesto: number | null;
}

/** Filas que son totales o notas del Excel, no artículos. */
const RESUMEN = /^(sub ?total|total|gran total|presupuesto|diferencia|buffer|disponible|saldo|resumen|uso sugerido|nota|notas|observacion)/;
const PRESUPUESTO = /^presupuesto/;

export function procesarArticulos(hoja: Hoja, filaEncabezado: number, mapeo: MapeoArticulo, destino: 'proyecto' | 'inventario'): ResultadoArticulos {
  const datos = hoja.filas.slice(filaEncabezado + 1);
  const filas: FilaArticulo[] = [];
  let presupuesto: number | null = null;
  datos.forEach((f, i) => {
    if (!f.some((c) => texto(c) !== '')) return;
    const val = (c: CampoArticulo) => (mapeo[c] === undefined ? null : f[mapeo[c]!] ?? null);
    const txt = (c: CampoArticulo) => texto(val(c)).replace(/\s+/g, ' ');
    let nombre = txt('nombre');
    let detalle = txt('detalle');
    if (!nombre && detalle) [nombre, detalle] = [detalle, ''];
    if (detalle === nombre) detalle = '';
    const cantidad = Math.max(1, Math.round(parsearMonto(val('cantidad')) || 1));
    const unit = parsearMonto(val('precioUnit'));
    const total = parsearMonto(val('total'));
    const monto = total !== null ? Math.abs(total) : unit !== null ? Math.round(Math.abs(unit) * cantidad * 100) / 100 : null;
    const fila: FilaArticulo = {
      fila: filaEncabezado + i + 2,
      nombre,
      detalle,
      cantidad,
      monto,
      proveedor: txt('proveedor'),
      fecha: parsearFecha(val('fecha')) || '',
      nota: txt('nota'),
      categoria: txt('categoria'),
      marca: txt('marca'),
      modelo: txt('modelo'),
      serie: txt('serie'),
      ubicacion: txt('ubicacion'),
      responsable: txt('responsable'),
      estado: txt('estado'),
      garantia: parsearFecha(val('garantia')) || '',
    };
    const clave = normalizarNombre(nombre || texto(f.find((c) => texto(c) !== '') ?? null));
    if (!nombre) fila.omitida = 'Sin nombre';
    else if (/^[•·*–-]/.test(nombre) || (monto === null && val('cantidad') === null && nombre.length > 70)) fila.omitida = 'Nota del Excel';
    else if (RESUMEN.test(clave)) {
      fila.omitida = 'Fila de totales o resumen';
      if (PRESUPUESTO.test(clave) && monto) presupuesto = monto;
    } else if (destino === 'proyecto' && monto === null) fila.omitida = 'Sin precio';
    filas.push(fila);
  });
  return { filas, presupuesto };
}

export function filaEncabezadoArticulos(hoja: Hoja) {
  return detectarFilaEncabezado(hoja.filas, SINONIMOS_ARTICULO);
}

export function sugerirMapeoArticulos(encabezados: string[], destino: 'proyecto' | 'inventario'): MapeoArticulo {
  const m = sugerirMapeoCon(encabezados, SINONIMOS_ARTICULO, CAMPOS_DESTINO[destino]);
  if (destino === 'proyecto' && m.nombre === undefined) {
    // En una cotización la "Categoría" (Procesador, Monitor…) hace de nombre del artículo.
    const usadas = new Set(Object.values(m));
    const col = sugerirMapeoCon(encabezados, { nombre: ['categoria', 'concepto', 'rubro'] }, ['nombre']).nombre;
    if (col !== undefined && !usadas.has(col)) m.nombre = col;
  }
  return m;
}

/** Título del Excel (lo que hay arriba de los encabezados): sirve de nombre para un proyecto nuevo. */
export function tituloDeHoja(hoja: Hoja, filaEncabezado: number): string {
  for (const f of hoja.filas.slice(0, filaEncabezado)) {
    const t = f.map(texto).find((x) => x.length > 4 && isNaN(Number(x)));
    if (t) return t;
  }
  return '';
}

/** Adivina a dónde va el archivo según sus encabezados (solo como sugerencia: siempre se pregunta). */
export function sugerirDestino(hoja: Hoja): Destino {
  const fila = detectarFilaEncabezado(hoja.filas);
  const enc = (hoja.filas[filaEncabezadoArticulos(hoja)] || []).map((c) => normalizarNombre(texto(c)));
  const tiene = (...p: string[]) => enc.some((e) => p.some((x) => e === x || e.startsWith(x + ' ') || e.endsWith(' ' + x)));
  if (tiene('serie', 'ubicacion', 'garantia', 'inventario')) return 'inventario';
  if (tiene('cant', 'cantidad', 'unit', 'unitario', 'tienda', 'modelo', 'componente', 'articulo', 'producto')) return 'proyecto';
  const fin = (hoja.filas[fila] || []).map(texto);
  if (columnasDeMes(hoja.filas[fila] || [], new Date().getFullYear()).length >= 3) return 'finanzas';
  const m = sugerirMapeo(fin, ['fecha', 'persona', 'monto']);
  return m.monto !== undefined || m.persona !== undefined ? 'finanzas' : 'proyecto';
}
