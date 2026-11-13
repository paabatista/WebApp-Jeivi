import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Upload } from 'lucide-react';
import { Cargando } from '../../../core/Cargando';
import { ejecutarLote, escucharColeccion, type OperacionLote } from '../../../lib/datos';
import { nuevoId } from '../../../lib/enlaces';
import { explicarError } from '../../../lib/errores';
import { hoyISO } from '../../../lib/fechas';
import { useSesion } from '../../../lib/sesion';
import { dinero, redondear, type Importacion } from '../datos';
import {
  CATEGORIAS_BIEN,
  CATEGORIAS_PROYECTO,
  ESTADOS_BIEN,
  RUTA_BIENES,
  RUTA_MOV_PROYECTOS,
  RUTA_PROYECTOS,
  type Bien,
  type EstadoBien,
  type MovProyecto,
  type Proyecto,
} from '../proyectos/datos';
import { useProyectos } from '../proyectos/Proyectos';
import {
  CAMPOS_DESTINO,
  ETIQUETA_ARTICULO,
  filaEncabezadoArticulos,
  procesarArticulos,
  sugerirMapeoArticulos,
  tituloDeHoja,
  type CampoArticulo,
  type FilaArticulo,
  type MapeoArticulo,
} from './articulos';
import type { Hoja } from './leerArchivo';
import { huella, normalizarNombre, texto } from './normalizar';

const NUEVO = '__nuevo__';

/** "Reparación" → 'reparacion', "Bueno" → 'bueno'… */
function estadoDeTexto(t: string, porDefecto: EstadoBien): EstadoBien {
  const n = normalizarNombre(t);
  if (!n) return porDefecto;
  const e = (Object.entries(ESTADOS_BIEN) as [EstadoBien, string][]).find(([k, v]) => n.startsWith(k) || normalizarNombre(v) === n);
  if (e) return e[0];
  if (/repar|dan|malo/.test(n)) return 'reparacion';
  if (/baja|perdid|robad/.test(n)) return 'baja';
  return porDefecto;
}

function categoriaBien(t: string, porDefecto: string) {
  const n = normalizarNombre(t);
  if (!n) return porDefecto;
  return CATEGORIAS_BIEN.find((c) => normalizarNombre(c) === n || normalizarNombre(c).startsWith(n)) || t;
}

const descripcionCompra = (f: FilaArticulo) => (f.detalle ? `${f.nombre} · ${f.detalle}` : f.nombre).slice(0, 220);

interface Props {
  destino: 'proyecto' | 'inventario';
  archivo: File;
  hoja: Hoja;
  proyectoInicial?: string;
}

export function ImportarArticulos({ destino, archivo, hoja, proyectoInicial }: Props) {
  const { perfil } = useSesion();
  const proyectos = useProyectos();
  const [bienes, setBienes] = useState<Bien[] | null>(null);
  useEffect(() => (destino === 'inventario' ? escucharColeccion<Bien>(RUTA_BIENES, setBienes) : undefined), [destino]);

  const [filaEnc, setFilaEnc] = useState(0);
  const [mapeo, setMapeo] = useState<MapeoArticulo>({});
  const [proyectoId, setProyectoId] = useState(proyectoInicial || '');
  const idNuevo = useMemo(() => nuevoId(16), []);
  const [nuevo, setNuevo] = useState({ nombre: '', categoria: CATEGORIAS_PROYECTO[0], presupuesto: '' });
  const [comprados, setComprados] = useState(false);
  const [estadoDefecto, setEstadoDefecto] = useState<EstadoBien>('bueno');
  const [categoriaDefecto, setCategoriaDefecto] = useState(CATEGORIAS_BIEN[0]);
  const [ubicacionDefecto, setUbicacionDefecto] = useState('');
  const [reemplazar, setReemplazar] = useState(true);
  const [ids, setIds] = useState<string[]>([]);
  const [progreso, setProgreso] = useState('');
  const [resultado, setResultado] = useState<{ texto: string; enlace?: string } | null>(null);
  const [error, setError] = useState('');

  // Al cambiar de hoja o de destino: detectar títulos y columnas.
  useEffect(() => {
    const fila = filaEncabezadoArticulos(hoja);
    setFilaEnc(fila);
    setMapeo(sugerirMapeoArticulos((hoja.filas[fila] || []).map(texto), destino));
    setResultado(null);
    const nombreArchivo = archivo.name.replace(/\.\w+$/, '');
    setNuevo((n) => ({ ...n, nombre: nombreArchivo || tituloDeHoja(hoja, fila) }));
  }, [hoja, destino, archivo]);

  const encabezados = hoja.filas[filaEnc]?.map(texto) || [];
  const { filas, presupuesto: presupuestoExcel } = useMemo(() => procesarArticulos(hoja, filaEnc, mapeo, destino), [hoja, filaEnc, mapeo, destino]);
  const validas = useMemo(() => filas.filter((f) => !f.omitida), [filas]);
  const total = redondear(validas.reduce((s, f) => s + (f.monto || 0), 0));

  // Presupuesto sugerido para el proyecto nuevo: el que trae el Excel, o el total de la cotización.
  useEffect(() => {
    setNuevo((n) => ({ ...n, presupuesto: presupuestoExcel ? String(presupuestoExcel) : total ? String(total) : '' }));
  }, [presupuestoExcel, total]);

  const destinoId = destino === 'proyecto' ? (proyectoId === NUEVO ? idNuevo : proyectoId) : 'inventario';
  const importacion: Importacion = { archivo: archivo.name, hoja: hoja.nombre, fecha: new Date().toISOString() };

  // Ids estables por fila: volver a subir el mismo Excel actualiza en vez de duplicar.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const vistos = new Map<string, number>();
      const lista: string[] = [];
      for (const f of validas) {
        const base = [destino, destinoId, normalizarNombre(f.nombre), normalizarNombre(f.detalle), normalizarNombre(f.serie), f.cantidad].join('|');
        const n = (vistos.get(base) || 0) + 1;
        vistos.set(base, n);
        lista.push('imp-' + (await huella([base, n])));
      }
      if (vivo) setIds(lista);
    })();
    return () => {
      vivo = false;
    };
  }, [validas, destino, destinoId]);

  const existentes = useMemo(() => {
    const m = new Map<string, MovProyecto | Bien>();
    if (destino === 'proyecto') proyectos?.movs.filter((x) => x.proyectoId === destinoId).forEach((x) => m.set(x.id, x));
    else bienes?.forEach((x) => m.set(x.id, x));
    return m;
  }, [destino, destinoId, proyectos, bienes]);

  const mismoArchivo = (x: { importacion?: Importacion }) => x.importacion?.archivo === archivo.name && x.importacion?.hoja === hoja.nombre;
  const previos = [...existentes.values()].filter(mismoArchivo);
  const actualizan = ids.filter((id) => existentes.has(id)).length;
  // Las compras ya hechas o pasadas al inventario no se borran al reemplazar.
  const protegido = (x: MovProyecto | Bien) => 'comprado' in x && (!!x.comprado || !!x.bienId);
  const aBorrar = reemplazar ? previos.filter((p) => !ids.includes(p.id) && !protegido(p)) : [];

  if (!proyectos || (destino === 'inventario' && !bienes)) return <Cargando />;

  const proyectosAbiertos = proyectos.proyectos.filter((p) => p.estado !== 'cancelado');
  const faltaProyecto = destino === 'proyecto' && (!proyectoId || (proyectoId === NUEVO && !nuevo.nombre.trim()));
  const faltaNombre = mapeo.nombre === undefined && mapeo.detalle === undefined;
  const listo = !faltaProyecto && !faltaNombre && validas.length > 0 && ids.length === validas.length && !progreso;

  async function importar() {
    if (!perfil || !listo) return;
    setError('');
    setResultado(null);
    const ahora = new Date().toISOString();
    const ops: OperacionLote[] = [];
    let nombreProyecto = proyectos!.proyectos.find((p) => p.id === destinoId)?.nombre || '';

    if (destino === 'proyecto' && proyectoId === NUEVO) {
      nombreProyecto = nuevo.nombre.trim();
      const p: Omit<Proyecto, 'id'> = {
        nombre: nombreProyecto,
        descripcion: `Lista importada del Excel "${archivo.name}".`,
        categoria: nuevo.categoria,
        presupuesto: redondear(Number(nuevo.presupuesto) || 0),
        estado: comprados ? 'comprando' : 'idea',
        creado: ahora,
        creadoPor: perfil.uid,
      };
      ops.push({ tipo: 'guardar', ruta: `${RUTA_PROYECTOS}/${destinoId}`, data: p });
    }

    validas.forEach((f, i) => {
      const id = ids[i];
      const antes = existentes.get(id);
      const { id: _id, ...previo } = (antes || {}) as { id?: string } & Record<string, unknown>;
      let data: Record<string, unknown>;
      if (destino === 'proyecto') {
        const m: Partial<MovProyecto> = {
          proyectoId: destinoId,
          tipo: 'compra',
          descripcion: descripcionCompra(f),
          cantidad: f.cantidad,
          montoEstimado: redondear(f.monto || 0),
          proveedor: f.proveedor,
          nota: f.nota.slice(0, 500),
          importacion,
        };
        if (comprados) Object.assign(m, { comprado: true, monto: redondear(f.monto || 0), fecha: f.fecha || hoyISO() });
        data = antes ? { ...previo, ...m } : { fecha: f.fecha || hoyISO(), monto: 0, comprado: false, ...m, creado: ahora, registradoPor: perfil!.uid };
      } else {
        const b: Partial<Bien> = {
          nombre: f.nombre.slice(0, 160),
          descripcion: f.detalle.slice(0, 500),
          categoria: categoriaBien(f.categoria, categoriaDefecto),
          marca: f.marca,
          modelo: f.modelo,
          serie: f.serie,
          cantidad: f.cantidad,
          costo: redondear(f.monto || 0),
          fechaCompra: f.fecha,
          proveedor: f.proveedor,
          ubicacion: f.ubicacion || ubicacionDefecto.trim(),
          responsable: f.responsable,
          estado: estadoDeTexto(f.estado, estadoDefecto),
          ...(f.garantia ? { garantiaHasta: f.garantia } : {}),
          notas: f.nota.slice(0, 500),
          importacion,
        };
        data = antes ? { ...previo, ...b } : { ...b, creado: ahora, registradoPor: perfil!.uid };
      }
      ops.push({ tipo: 'guardar', ruta: `${destino === 'proyecto' ? RUTA_MOV_PROYECTOS : RUTA_BIENES}/${id}`, data });
    });
    aBorrar.forEach((p) => ops.push({ tipo: 'borrar', ruta: `${destino === 'proyecto' ? RUTA_MOV_PROYECTOS : RUTA_BIENES}/${p.id}` }));

    try {
      const resumen = destino === 'proyecto' ? `Excel "${archivo.name}" → proyecto ${nombreProyecto}` : `Excel "${archivo.name}" → inventario`;
      await ejecutarLote(ops, (n) => setProgreso(`Guardando… ${n} de ${ops.length}`), resumen);
      const nuevos = validas.length - actualizan;
      const partes = [`${nuevos} artículo(s) nuevo(s)`, actualizan ? `${actualizan} actualizado(s)` : '', aBorrar.length ? `${aBorrar.length} quitado(s) porque ya no están en el Excel` : '']
        .filter(Boolean)
        .join(', ');
      setResultado(
        destino === 'proyecto'
          ? { texto: `Listo: ${partes} en el proyecto "${nombreProyecto}".`, enlace: `/m/finanzas/proyectos/${destinoId}` }
          : { texto: `Listo: ${partes} en el inventario.`, enlace: '/m/finanzas/inventario' },
      );
      if (proyectoId === NUEVO) setProyectoId(destinoId);
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setProgreso('');
    }
  }

  const campos = CAMPOS_DESTINO[destino];

  return (
    <section className="tarjeta formulario">
      {destino === 'proyecto' ? (
        <>
          <h3>1. ¿A qué proyecto?</h3>
          <div className="fila">
            <label>
              Proyecto
              <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
                <option value="">— Elige —</option>
                <option value={NUEVO}>➕ Crear un proyecto nuevo con este Excel</option>
                {proyectosAbiertos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {proyectoId === NUEVO && (
            <div className="fila">
              <label>
                Nombre del proyecto
                <input value={nuevo.nombre} maxLength={90} onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))} />
              </label>
              <label>
                Categoría
                <select value={nuevo.categoria} onChange={(e) => setNuevo((n) => ({ ...n, categoria: e.target.value }))}>
                  {CATEGORIAS_PROYECTO.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Presupuesto
                <input type="number" min={0} step="0.01" value={nuevo.presupuesto} onChange={(e) => setNuevo((n) => ({ ...n, presupuesto: e.target.value }))} />
              </label>
            </div>
          )}
          {proyectoId === NUEVO && presupuestoExcel !== null && <p className="suave pequeno">El presupuesto se tomó de la fila “Presupuesto…” del Excel.</p>}
          <label className="interruptor">
            <input type="checkbox" checked={comprados} onChange={(e) => setComprados(e.target.checked)} />
            <span>Estos artículos ya se compraron (registrar el precio como costo real). Si no, quedan como lista por comprar con su costo estimado.</span>
          </label>
        </>
      ) : (
        <>
          <h3>1. Valores por defecto</h3>
          <p className="suave pequeno">Se usan cuando el Excel no trae esa columna o la celda está vacía.</p>
          <div className="fila">
            <label>
              Categoría
              <select value={categoriaDefecto} onChange={(e) => setCategoriaDefecto(e.target.value)}>
                {CATEGORIAS_BIEN.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select value={estadoDefecto} onChange={(e) => setEstadoDefecto(e.target.value as EstadoBien)}>
                {Object.entries(ESTADOS_BIEN).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ubicación
              <input value={ubicacionDefecto} onChange={(e) => setUbicacionDefecto(e.target.value)} placeholder="Ej. Cabina de sonido" />
            </label>
          </div>
        </>
      )}

      <h3>2. Columnas</h3>
      <div className="fila">
        <label>
          Fila de los títulos
          <select
            value={filaEnc}
            onChange={(e) => {
              const f = Number(e.target.value);
              setFilaEnc(f);
              setMapeo(sugerirMapeoArticulos((hoja.filas[f] || []).map(texto), destino));
            }}
          >
            {hoja.filas.slice(0, 15).map((f, i) => (
              <option key={i} value={i}>
                Fila {i + 1}: {f.map(texto).filter(Boolean).slice(0, 4).join(' · ').slice(0, 60) || '(vacía)'}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="fila">
        {campos.map((c: CampoArticulo) => (
          <label key={c}>
            {ETIQUETA_ARTICULO[c]}
            {c === 'nombre' ? ' *' : ''}
            <select value={mapeo[c] ?? ''} onChange={(e) => setMapeo((m) => ({ ...m, [c]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
              <option value="">— No está —</option>
              {encabezados.map((h, i) => (
                <option key={i} value={i}>
                  {h || `Columna ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {faltaNombre && <div className="aviso">Indica qué columna tiene el nombre del artículo.</div>}

      <h3>3. Vista previa</h3>
      <div className="kpis">
        <div className="tarjeta kpi">
          <span>Artículos</span>
          <strong className="texto-exito">{validas.length}</strong>
        </div>
        <div className="tarjeta kpi">
          <span>Filas que se omiten</span>
          <strong>{filas.length - validas.length}</strong>
        </div>
        <div className="tarjeta kpi">
          <span>{destino === 'proyecto' ? (comprados ? 'Total comprado' : 'Total estimado') : 'Valor total'}</span>
          <strong>{dinero(total)}</strong>
        </div>
      </div>
      {previos.length > 0 && (
        <label className="interruptor">
          <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} />
          <span>
            Este Excel ya se importó aquí ({previos.length} artículos). Actualizar esa carga: lo que cambió se actualiza y lo que ya no está en
            el Excel se quita (menos lo que ya se compró).
          </span>
        </label>
      )}
      {actualizan > 0 && <div className="aviso">{actualizan} artículo(s) ya estaban y se actualizarán (no se duplican).</div>}

      <div className="tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th>Fila</th>
              <th>Artículo</th>
              <th>Cant.</th>
              <th>{destino === 'proyecto' ? 'Proveedor' : 'Ubicación'}</th>
              <th className="num">Monto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.slice(0, 80).map((f) => (
              <tr key={f.fila} className={f.omitida ? 'omitida' : ''}>
                <td>{f.fila}</td>
                <td>
                  {f.nombre || '—'}
                  {f.detalle && <span className="suave pequeno nota-compra">{f.detalle}</span>}
                </td>
                <td>{f.cantidad}</td>
                <td>{(destino === 'proyecto' ? f.proveedor : f.ubicacion || ubicacionDefecto) || '—'}</td>
                <td className="num">{f.monto !== null ? dinero(f.monto) : '—'}</td>
                <td className={f.omitida ? 'suave' : 'texto-exito'}>{f.omitida ? `Se omite: ${f.omitida.toLowerCase()}` : 'OK'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filas.length > 80 && <p className="suave pequeno">…y {filas.length - 80} filas más.</p>}
      </div>
      {faltaProyecto && <div className="aviso">Elige el proyecto (o crea uno nuevo) para poder importar.</div>}
      {progreso && <div className="aviso">{progreso}</div>}
      {error && <div className="error">{error}</div>}
      {resultado && (
        <div className="exito con-icono">
          <CheckCircle2 size={18} /> {resultado.texto}{' '}
          {resultado.enlace && (
            <Link to={resultado.enlace}>{destino === 'proyecto' ? 'Ver proyecto' : 'Ver inventario'}</Link>
          )}
        </div>
      )}
      <button className="boton primario" onClick={importar} disabled={!listo}>
        <Upload size={16} /> Importar {validas.length} artículo(s) {destino === 'proyecto' ? 'al proyecto' : 'al inventario'}
      </button>
    </section>
  );
}
