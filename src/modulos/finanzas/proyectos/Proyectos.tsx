import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, FileSpreadsheet, Image as ImageIcon, Package, Paperclip, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Cargando } from '../../../core/Cargando';
import { borrarDoc, escucharColeccion, guardarDoc } from '../../../lib/datos';
import { nuevoId } from '../../../lib/enlaces';
import { explicarError } from '../../../lib/errores';
import { formatoCorto, hoyISO } from '../../../lib/fechas';
import { guardarFoto } from '../../../lib/fotos';
import { guardarComprobante } from '../../../lib/almacen';
import { useSesion } from '../../../lib/sesion';
import { RUTA_CONCEPTOS, dinero, redondear, type Comprobante, type Concepto, type Pago } from '../datos';
import {
  CATEGORIAS_PROYECTO,
  ESTADOS_PROYECTO,
  ORIGENES_FONDOS,
  RUTA_BIENES,
  RUTA_MOV_PROYECTOS,
  RUTA_PROYECTOS,
  totalesProyecto,
  type Bien,
  type EstadoProyecto,
  type MovProyecto,
  type Proyecto,
} from './datos';

interface DatosFin {
  pagos: Pago[];
  conceptos: Concepto[];
}

export function useProyectos() {
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [movs, setMovs] = useState<MovProyecto[] | null>(null);
  useEffect(() => {
    const a = escucharColeccion<Proyecto>(RUTA_PROYECTOS, (d) => setProyectos([...d].sort((x, y) => y.creado.localeCompare(x.creado))));
    const b = escucharColeccion<MovProyecto>(RUTA_MOV_PROYECTOS, (d) => setMovs([...d].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.creado.localeCompare(y.creado))));
    return () => {
      a();
      b();
    };
  }, []);
  return proyectos && movs ? { proyectos, movs } : null;
}

function Progreso({ valor, max, etiqueta }: { valor: number; max: number; etiqueta: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((valor / max) * 100)) : 0;
  return (
    <div>
      <div className="fila-entre pequeno">
        <span className="suave">{etiqueta}</span>
        <strong>
          {dinero(valor)} / {dinero(max)} ({pct}%)
        </strong>
      </div>
      <div className="barra-progreso">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ================= Lista ================= */

export function Proyectos({ d }: { d: DatosFin }) {
  const datos = useProyectos();
  const [nuevo, setNuevo] = useState(false);
  const [verCerrados, setVerCerrados] = useState(false);
  if (!datos) return <Cargando />;
  if (nuevo) return <EditorProyecto alTerminar={() => setNuevo(false)} />;

  const abiertos = datos.proyectos.filter((p) => p.estado !== 'completado' && p.estado !== 'cancelado');
  const cerrados = datos.proyectos.filter((p) => p.estado === 'completado' || p.estado === 'cancelado');
  const tarjeta = (p: Proyecto) => {
    const t = totalesProyecto(p, datos.movs, d.pagos);
    return (
      <Link key={p.id} to={`/m/finanzas/proyectos/${p.id}`} className="tarjeta proyecto">
        {p.imagen && <img src={p.imagen} alt="" className="proyecto-imagen" />}
        <div className="fila-entre">
          <span className="chip">{p.categoria}</span>
          <span className={`chip proy-${p.estado}`}>{ESTADOS_PROYECTO[p.estado]}</span>
        </div>
        <h3>{p.nombre}</h3>
        {p.presupuesto > 0 && <Progreso valor={t.recaudado} max={t.presupuesto} etiqueta="Recaudado" />}
        <p className="suave pequeno">
          Gastado {dinero(t.gastado)} · Disponible {dinero(t.disponible)} · Compras {t.comprasHechas}/{t.comprasTotal}
          {p.fechaObjetivo ? ` · meta ${formatoCorto(p.fechaObjetivo)}` : ''}
        </p>
      </Link>
    );
  };

  return (
    <div className="pila">
      <div className="tarjeta fila-entre">
        <div>
          <h2>Proyectos e inversiones</h2>
          <p className="suave">Compras grandes y mejoras (ej. la PC para los directos). No cuentan como gastos corrientes.</p>
        </div>
        <button className="boton primario" onClick={() => setNuevo(true)}>
          <Plus size={16} /> Nuevo proyecto
        </button>
      </div>
      {abiertos.length ? <div className="rejilla-anuncios">{abiertos.map(tarjeta)}</div> : <p className="tarjeta suave">No hay proyectos en curso.</p>}
      {cerrados.length > 0 && (
        <button className="enlace" onClick={() => setVerCerrados((v) => !v)}>
          {verCerrados ? 'Ocultar' : 'Ver'} proyectos completados o cancelados ({cerrados.length})
        </button>
      )}
      {verCerrados && <div className="rejilla-anuncios">{cerrados.map(tarjeta)}</div>}
    </div>
  );
}

/* ================= Editor ================= */

function EditorProyecto({ inicial, alTerminar }: { inicial?: Proyecto; alTerminar: (id?: string) => void }) {
  const { perfil, iglesia } = useSesion();
  const [f, setF] = useState({
    nombre: inicial?.nombre || '',
    descripcion: inicial?.descripcion || '',
    categoria: inicial?.categoria || CATEGORIAS_PROYECTO[0],
    presupuesto: inicial?.presupuesto ? String(inicial.presupuesto) : '',
    fechaObjetivo: inicial?.fechaObjetivo || '',
    responsable: inicial?.responsable || '',
    estado: inicial?.estado || ('idea' as EstadoProyecto),
    imagen: inicial?.imagen || '',
  });
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setSubiendo(true);
    try {
      set('imagen', await guardarFoto(archivo, iglesia, 'jeivi/finanzas', { autor: perfil, titulo: `Proyecto: ${f.nombre}` }));
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    const id = inicial?.id || nuevoId(16);
    const datos: Omit<Proyecto, 'id'> = {
      nombre: f.nombre.trim(),
      descripcion: f.descripcion.trim(),
      categoria: f.categoria,
      presupuesto: redondear(Number(f.presupuesto) || 0),
      fechaObjetivo: f.fechaObjetivo,
      responsable: f.responsable.trim(),
      estado: f.estado,
      imagen: f.imagen,
      ...(inicial?.conceptoId ? { conceptoId: inicial.conceptoId } : {}),
      creado: inicial?.creado || new Date().toISOString(),
      creadoPor: inicial?.creadoPor || perfil.uid,
    };
    try {
      await guardarDoc(`${RUTA_PROYECTOS}/${id}`, datos, false);
      alTerminar(id);
    } catch (err) {
      setError(explicarError(err));
    }
  }

  return (
    <form className="tarjeta formulario estrecha" onSubmit={guardar}>
      <h2>{inicial ? 'Editar proyecto' : 'Nuevo proyecto'}</h2>
      <label>
        Nombre
        <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} required maxLength={90} placeholder="Ej. PC gaming para los directos" />
      </label>
      <div className="fila">
        <label>
          Categoría
          <select value={f.categoria} onChange={(e) => set('categoria', e.target.value)}>
            {CATEGORIAS_PROYECTO.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select value={f.estado} onChange={(e) => set('estado', e.target.value)}>
            {Object.entries(ESTADOS_PROYECTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="fila">
        <label>
          Presupuesto
          <input type="number" min={0} step="0.01" value={f.presupuesto} onChange={(e) => set('presupuesto', e.target.value)} placeholder="Ej. 1500" />
        </label>
        <label>
          Fecha meta (opcional)
          <input type="date" value={f.fechaObjetivo} onChange={(e) => set('fechaObjetivo', e.target.value)} />
        </label>
        <label>
          Responsable
          <input value={f.responsable} onChange={(e) => set('responsable', e.target.value)} placeholder="Quién lo coordina" />
        </label>
      </div>
      <label>
        Descripción / para qué es
        <textarea rows={3} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} maxLength={1500} />
      </label>
      <div className="fila logo-fila">
        {f.imagen && <img src={f.imagen} alt="" className="logo-previa" />}
        <label className="boton subir-archivo">
          <ImageIcon size={16} /> {subiendo ? 'Subiendo…' : f.imagen ? 'Cambiar imagen' : 'Imagen (opcional)'}
          <input type="file" accept="image/*" hidden onChange={subir} />
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button className="boton primario" disabled={subiendo}>
          Guardar
        </button>
        <button type="button" className="boton" onClick={() => alTerminar()}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* ================= Detalle ================= */

export function DetalleProyecto({ d }: { d: DatosFin }) {
  const { id } = useParams();
  const datos = useProyectos();
  const nav = useNavigate();
  const { perfil, puede } = useSesion();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState('');
  const p = datos?.proyectos.find((x) => x.id === id);
  const movs = useMemo(() => (datos && p ? datos.movs.filter((m) => m.proyectoId === p.id) : []), [datos, p]);

  if (!datos) return <Cargando />;
  if (!p)
    return (
      <section className="tarjeta">
        <p className="suave">El proyecto no existe.</p>
        <Link to="/m/finanzas/proyectos">Volver</Link>
      </section>
    );
  if (editando) return <EditorProyecto inicial={p} alTerminar={() => setEditando(false)} />;

  const t = totalesProyecto(p, datos.movs, d.pagos);
  const compras = movs.filter((m) => m.tipo === 'compra');
  const ingresos = movs.filter((m) => m.tipo === 'ingreso');
  const aportes = p.conceptoId ? d.pagos.filter((x) => x.conceptoId === p.conceptoId) : [];

  async function pedirAporte() {
    if (!p || !perfil) return;
    setError('');
    try {
      let conceptoId = p.conceptoId;
      if (!conceptoId || !d.conceptos.some((c) => c.id === conceptoId)) {
        conceptoId = nuevoId(12);
        await guardarDoc(`${RUTA_CONCEPTOS}/${conceptoId}`, { nombre: `Proyecto · ${p.nombre}`.slice(0, 80), campos: [], activo: true, montoSugerido: 0 }, false);
        await guardarDoc(`${RUTA_PROYECTOS}/${p.id}`, { conceptoId });
      }
      nav(`/m/finanzas/cargos?concepto=${conceptoId}`);
    } catch (err) {
      setError(explicarError(err));
    }
  }

  async function borrarProyecto() {
    if (!p) return;
    if (!confirm(`¿Eliminar el proyecto "${p.nombre}" y sus ${movs.length} movimientos? Quedará en el Historial por si hay que restaurarlo.`)) return;
    for (const m of movs) await borrarDoc(`${RUTA_MOV_PROYECTOS}/${m.id}`);
    await borrarDoc(`${RUTA_PROYECTOS}/${p.id}`);
    nav('/m/finanzas/proyectos');
  }

  return (
    <div className="pila">
      <Link to="/m/finanzas/proyectos" className="enlace">
        ← Todos los proyectos
      </Link>
      <section className="tarjeta evento-detalle">
        {p.imagen && <img src={p.imagen} alt="" className="evento-imagen" />}
        <div className="fila-entre">
          <div>
            <span className="chip">{p.categoria}</span> <span className={`chip proy-${p.estado}`}>{ESTADOS_PROYECTO[p.estado]}</span>
            <h1>{p.nombre}</h1>
            <p className="suave pequeno">
              {p.responsable ? `Responsable: ${p.responsable}` : ''}
              {p.fechaObjetivo ? ` · Meta: ${formatoCorto(p.fechaObjetivo)}` : ''}
            </p>
          </div>
          <div className="acciones">
            <button className="boton" onClick={pedirAporte} title="Asignar una cuota a los diáconos para este proyecto">
              <Users size={16} /> Pedir aporte a diáconos
            </button>
            <button className="boton" onClick={() => setEditando(true)}>
              <Pencil size={16} /> Editar
            </button>
            {puede('superadmin') && (
              <button className="icono-boton peligro" title="Eliminar proyecto" onClick={borrarProyecto}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
        {p.descripcion && <p className="anuncio-texto">{p.descripcion}</p>}
        {error && <div className="error">{error}</div>}
      </section>

      <div className="kpis">
        <div className="tarjeta kpi">
          <span>Presupuesto</span>
          <strong>{dinero(t.presupuesto)}</strong>
        </div>
        <div className="tarjeta kpi">
          <span>Recaudado</span>
          <strong className="texto-exito">{dinero(t.recaudado)}</strong>
        </div>
        <div className="tarjeta kpi">
          <span>Gastado</span>
          <strong>{dinero(t.gastado)}</strong>
        </div>
        <div className="tarjeta kpi">
          <span>Disponible</span>
          <strong className={t.disponible < 0 ? 'texto-error' : ''}>{dinero(t.disponible)}</strong>
        </div>
      </div>
      {t.presupuesto > 0 && (
        <section className="tarjeta pila">
          <Progreso valor={t.recaudado} max={t.presupuesto} etiqueta="Fondos recaudados" />
          <Progreso valor={t.gastado} max={t.presupuesto} etiqueta="Ejecutado (comprado)" />
          {t.falta > 0 && <p className="suave pequeno">Faltan {dinero(t.falta)} para completar el presupuesto. Por comprar (estimado): {dinero(t.porComprar)}.</p>}
        </section>
      )}

      <Compras proyecto={p} compras={compras} />
      <Fondos proyecto={p} ingresos={ingresos} aportes={aportes} />
    </div>
  );
}

/* ================= Compras ================= */

function Compras({ proyecto, compras }: { proyecto: Proyecto; compras: MovProyecto[] }) {
  const { perfil, puede } = useSesion();
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [estimado, setEstimado] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [comprando, setComprando] = useState<MovProyecto | null>(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  async function agregar(e: FormEvent) {
    e.preventDefault();
    if (!perfil || !descripcion.trim()) return;
    const m: Omit<MovProyecto, 'id'> = {
      proyectoId: proyecto.id,
      tipo: 'compra',
      descripcion: descripcion.trim(),
      fecha: hoyISO(),
      monto: 0,
      montoEstimado: redondear(Number(estimado) || 0),
      cantidad: Math.max(1, Number(cantidad) || 1),
      proveedor: proveedor.trim(),
      comprado: false,
      creado: new Date().toISOString(),
      registradoPor: perfil.uid,
    };
    try {
      await guardarDoc(`${RUTA_MOV_PROYECTOS}/${nuevoId(16)}`, m, false);
      setDescripcion('');
      setCantidad('1');
      setEstimado('');
      setProveedor('');
    } catch (err) {
      setError(explicarError(err));
    }
  }

  /** Pasa la compra al inventario de bienes (con su costo, fecha, proveedor y factura). */
  async function aInventario(c: MovProyecto) {
    if (!perfil) return;
    const bienId = nuevoId(16);
    const b: Omit<Bien, 'id'> = {
      nombre: c.descripcion,
      categoria: proyecto.categoria === 'Sonido y multimedia' ? 'Sonido' : proyecto.categoria === 'Equipos y tecnología' ? 'Computadoras y tecnología' : proyecto.categoria === 'Mobiliario' ? 'Mobiliario' : 'Otro',
      descripcion: `Comprado para el proyecto "${proyecto.nombre}"`,
      cantidad: c.cantidad || 1,
      costo: c.monto,
      fechaCompra: c.fecha,
      proveedor: c.proveedor || '',
      ubicacion: '',
      responsable: proyecto.responsable || '',
      estado: 'nuevo',
      ...(c.comprobante ? { factura: c.comprobante } : {}),
      proyectoId: proyecto.id,
      proyectoNombre: proyecto.nombre,
      creado: new Date().toISOString(),
      registradoPor: perfil.uid,
    };
    try {
      await guardarDoc(`${RUTA_BIENES}/${bienId}`, b, false);
      await guardarDoc(`${RUTA_MOV_PROYECTOS}/${c.id}`, { bienId });
      setAviso(`"${c.descripcion}" quedó registrado en el Inventario. Completa allí la ubicación, serie y garantía.`);
      setTimeout(() => setAviso(''), 5000);
    } catch (err) {
      setError(explicarError(err));
    }
  }

  const totalEstimado = redondear(compras.reduce((s, c) => s + (c.montoEstimado || 0), 0));
  const totalReal = redondear(compras.filter((c) => c.comprado).reduce((s, c) => s + c.monto, 0));

  return (
    <section className="tarjeta">
      <div className="fila-entre">
        <h2 className="con-icono">
          <Package size={20} /> Lista de compras
        </h2>
        <Link className="boton pequeno" to={`/m/finanzas/importar?destino=proyecto&proyecto=${proyecto.id}`}>
          <FileSpreadsheet size={14} /> Importar desde Excel
        </Link>
      </div>
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th>Artículo</th>
              <th>Cant.</th>
              <th>Proveedor</th>
              <th className="num">Estimado</th>
              <th className="num">Real</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.descripcion}
                  {c.nota &&
                    (/^https?:\/\//.test(c.nota) ? (
                      <a className="pequeno nota-compra" href={c.nota} target="_blank" rel="noopener noreferrer">
                        Ver enlace
                      </a>
                    ) : (
                      <span className="suave pequeno nota-compra">{c.nota}</span>
                    ))}
                  {c.comprobante && (
                    <a className="adjunto" href={c.comprobante.url} title="Ver factura" {...(c.comprobante.url.startsWith('data:') ? { download: 'factura.jpg' } : { target: '_blank', rel: 'noopener noreferrer' })}>
                      <Paperclip size={14} />
                    </a>
                  )}
                </td>
                <td>{c.cantidad || 1}</td>
                <td>{c.proveedor || '—'}</td>
                <td className="num">{dinero(c.montoEstimado || 0)}</td>
                <td className="num">{c.comprado ? dinero(c.monto) : '—'}</td>
                <td>
                  {c.comprado ? (
                    <span className="chip chip-exito">Comprado {formatoCorto(c.fecha)}</span>
                  ) : (
                    <button className="boton pequeno" onClick={() => setComprando(c)}>
                      <CheckCircle2 size={14} /> Marcar comprado
                    </button>
                  )}
                </td>
                <td className="acciones-fila">
                  {c.comprado && !c.bienId && (
                    <button className="boton pequeno" onClick={() => aInventario(c)} title="Registrar en el inventario de bienes">
                      → Inventario
                    </button>
                  )}
                  {c.bienId && (
                    <Link className="chip" to="/m/finanzas/inventario">
                      En inventario
                    </Link>
                  )}
                  {puede('pastor') && (
                    <button className="icono-boton peligro" title="Quitar" onClick={() => confirm(`¿Quitar "${c.descripcion}"?`) && borrarDoc(`${RUTA_MOV_PROYECTOS}/${c.id}`)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!compras.length && (
              <tr>
                <td colSpan={7} className="suave">
                  Agrega lo que hay que comprar (ej. procesador, tarjeta de video, monitor…).
                </td>
              </tr>
            )}
          </tbody>
          {compras.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>
                  <strong>Total</strong>
                </td>
                <td className="num">
                  <strong>{dinero(totalEstimado)}</strong>
                </td>
                <td className="num">
                  <strong>{dinero(totalReal)}</strong>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {comprando && <MarcarComprado compra={comprando} proyecto={proyecto} alTerminar={() => setComprando(null)} />}
      <form className="fila" onSubmit={agregar}>
        <label>
          Artículo
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Tarjeta de video RTX" required />
        </label>
        <label>
          Cantidad
          <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </label>
        <label>
          Costo estimado
          <input type="number" min={0} step="0.01" value={estimado} onChange={(e) => setEstimado(e.target.value)} />
        </label>
        <label>
          Proveedor (opcional)
          <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
        </label>
        <button className="boton primario">
          <Plus size={16} /> Agregar
        </button>
      </form>
      {aviso && <div className="exito">{aviso}</div>}
      {error && <div className="error">{error}</div>}
    </section>
  );
}

function MarcarComprado({ compra, proyecto, alTerminar }: { compra: MovProyecto; proyecto: Proyecto; alTerminar: () => void }) {
  const { perfil } = useSesion();
  const [monto, setMonto] = useState(compra.montoEstimado ? String(compra.montoEstimado) : '');
  const [fecha, setFecha] = useState(hoyISO());
  const [proveedor, setProveedor] = useState(compra.proveedor || '');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!perfil || !(Number(monto) >= 0)) return;
    setOcupado(true);
    setError('');
    try {
      let comprobante: Comprobante | undefined;
      if (archivo) comprobante = await guardarComprobante(archivo, `Factura · ${proyecto.nombre} · ${compra.descripcion}`, `${RUTA_MOV_PROYECTOS}/${compra.id}`, perfil);
      await guardarDoc(`${RUTA_MOV_PROYECTOS}/${compra.id}`, {
        comprado: true,
        monto: redondear(Number(monto)),
        fecha,
        proveedor: proveedor.trim(),
        ...(comprobante ? { comprobante } : {}),
      });
      alTerminar();
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="tarjeta formulario marcar-comprado" onSubmit={guardar}>
      <h3>Compra realizada: {compra.descripcion}</h3>
      <div className="fila">
        <label>
          Costo real
          <input type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
        </label>
        <label>
          Fecha de compra
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
        <label>
          Proveedor
          <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
        </label>
      </div>
      <label className="boton subir-archivo">
        <Paperclip size={16} /> {archivo ? archivo.name : 'Adjuntar factura (foto o PDF)'}
        <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
      </label>
      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button className="boton primario" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar compra'}
        </button>
        <button type="button" className="boton" onClick={alTerminar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* ================= Fondos ================= */

function Fondos({ proyecto, ingresos, aportes }: { proyecto: Proyecto; ingresos: MovProyecto[]; aportes: Pago[] }) {
  const { perfil, puede } = useSesion();
  const [fecha, setFecha] = useState(hoyISO());
  const [origen, setOrigen] = useState(ORIGENES_FONDOS[0]);
  const [persona, setPersona] = useState('');
  const [monto, setMonto] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function agregar(e: FormEvent) {
    e.preventDefault();
    if (!perfil || !(Number(monto) > 0)) return;
    setOcupado(true);
    setError('');
    const id = nuevoId(16);
    try {
      let comprobante: Comprobante | undefined;
      if (archivo) comprobante = await guardarComprobante(archivo, `Fondos · ${proyecto.nombre} · ${origen}`, `${RUTA_MOV_PROYECTOS}/${id}`, perfil);
      const m: Omit<MovProyecto, 'id'> = {
        proyectoId: proyecto.id,
        tipo: 'ingreso',
        descripcion: origen,
        fecha,
        monto: redondear(Number(monto)),
        origen,
        persona: persona.trim(),
        ...(comprobante ? { comprobante } : {}),
        creado: new Date().toISOString(),
        registradoPor: perfil.uid,
      };
      await guardarDoc(`${RUTA_MOV_PROYECTOS}/${id}`, m, false);
      setMonto('');
      setPersona('');
      setArchivo(null);
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setOcupado(false);
    }
  }

  const filas = [
    ...ingresos.map((i) => ({ id: i.id, fecha: i.fecha, origen: i.origen || i.descripcion, persona: i.persona || '', monto: i.monto, comprobante: i.comprobante, borrable: true })),
    ...aportes.map((a) => ({ id: a.id, fecha: a.fecha, origen: 'Aporte de diácono', persona: a.diaconoNombre, monto: a.monto, comprobante: a.comprobante, borrable: false })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <section className="tarjeta">
      <h2>Fondos del proyecto</h2>
      <p className="suave pequeno">
        Ofrendas especiales, donaciones, actividades… Los aportes de los diáconos pedidos con “Pedir aporte a diáconos” se suman solos
        cuando se registran en Finanzas → Aportes.
      </p>
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Origen</th>
              <th>De quién</th>
              <th className="num">Monto</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td>{formatoCorto(f.fecha)}</td>
                <td>
                  {f.origen}
                  {f.comprobante && (
                    <a className="adjunto" href={f.comprobante.url} {...(f.comprobante.url.startsWith('data:') ? { download: 'comprobante.jpg' } : { target: '_blank', rel: 'noopener noreferrer' })}>
                      <Paperclip size={14} />
                    </a>
                  )}
                </td>
                <td>{f.persona || '—'}</td>
                <td className="num">{dinero(f.monto)}</td>
                <td>
                  {f.borrable && puede('pastor') && (
                    <button className="icono-boton peligro" title="Quitar" onClick={() => confirm('¿Quitar este ingreso?') && borrarDoc(`${RUTA_MOV_PROYECTOS}/${f.id}`)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!filas.length && (
              <tr>
                <td colSpan={5} className="suave">
                  Aún no hay fondos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form className="fila" onSubmit={agregar}>
        <label>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
        <label>
          Origen
          <select value={origen} onChange={(e) => setOrigen(e.target.value)}>
            {ORIGENES_FONDOS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          De quién (opcional)
          <input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Ej. Familia Pérez" />
        </label>
        <label>
          Monto
          <input type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
        </label>
        <label className="boton subir-archivo">
          <Paperclip size={16} /> {archivo ? 'Comprobante ✓' : 'Comprobante'}
          <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
        </label>
        <button className="boton primario" disabled={ocupado}>
          <Plus size={16} /> {ocupado ? 'Guardando…' : 'Registrar'}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
    </section>
  );
}
