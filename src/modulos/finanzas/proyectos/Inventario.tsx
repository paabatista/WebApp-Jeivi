import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileSpreadsheet, Image as ImageIcon, Paperclip, Pencil, Plus } from 'lucide-react';
import { Cargando } from '../../../core/Cargando';
import { escucharColeccion, guardarDoc } from '../../../lib/datos';
import { nuevoId } from '../../../lib/enlaces';
import { explicarError } from '../../../lib/errores';
import { formatoCorto, hoyISO } from '../../../lib/fechas';
import { guardarFoto } from '../../../lib/fotos';
import { guardarComprobante } from '../../../lib/almacen';
import { useSesion } from '../../../lib/sesion';
import { dinero, redondear, type Comprobante } from '../datos';
import { CATEGORIAS_BIEN, ESTADOS_BIEN, RUTA_BIENES, type Bien, type EstadoBien } from './datos';
import { exportarInventario } from '../exportar';

export function Inventario() {
  const [bienes, setBienes] = useState<Bien[] | null>(null);
  const [editando, setEditando] = useState<Bien | 'nuevo' | null>(null);
  const [categoria, setCategoria] = useState('');
  const [estado, setEstado] = useState<EstadoBien | 'activos' | ''>('activos');
  const [buscar, setBuscar] = useState('');
  const { iglesia } = useSesion();

  useEffect(() => escucharColeccion<Bien>(RUTA_BIENES, (d) => setBienes([...d].sort((a, b) => a.nombre.localeCompare(b.nombre)))), []);

  const visibles = useMemo(
    () =>
      (bienes || []).filter(
        (b) =>
          (!categoria || b.categoria === categoria) &&
          (estado === '' || (estado === 'activos' ? b.estado !== 'baja' : b.estado === estado)) &&
          `${b.nombre} ${b.marca} ${b.modelo} ${b.serie} ${b.ubicacion} ${b.responsable}`.toLowerCase().includes(buscar.toLowerCase()),
      ),
    [bienes, categoria, estado, buscar],
  );

  if (!bienes) return <Cargando />;
  if (editando) return <FormBien inicial={editando === 'nuevo' ? undefined : editando} alTerminar={() => setEditando(null)} />;

  const activos = bienes.filter((b) => b.estado !== 'baja');
  const valor = redondear(activos.reduce((s, b) => s + (b.costo || 0), 0));
  const enReparacion = bienes.filter((b) => b.estado === 'reparacion').length;
  const hoy = hoyISO();
  const garantiaPorVencer = activos.filter((b) => b.garantiaHasta && b.garantiaHasta >= hoy && b.garantiaHasta <= sumarDiasISO(hoy, 60)).length;

  return (
    <div className="pila">
      <div className="tarjeta fila-entre">
        <div>
          <h2>Inventario de bienes</h2>
          <p className="suave">Todo lo que tiene la iglesia: equipos, sonido, instrumentos, mobiliario… con su costo, ubicación y responsable.</p>
        </div>
        <div className="acciones">
          <Link className="boton" to="/m/finanzas/importar?destino=inventario">
            <FileSpreadsheet size={16} /> Importar Excel
          </Link>
          <button className="boton" onClick={() => exportarInventario(bienes, iglesia.nombre)}>
            <Download size={16} /> Descargar Excel
          </button>
          <button className="boton primario" onClick={() => setEditando('nuevo')}>
            <Plus size={16} /> Registrar bien
          </button>
        </div>
      </div>
      <div className="kpis">
        <div className="tarjeta kpi">
          <span>Bienes activos</span>
          <strong>{activos.length}</strong>
        </div>
        <div className="tarjeta kpi">
          <span>Valor de compra</span>
          <strong>{dinero(valor)}</strong>
        </div>
        <div className="tarjeta kpi">
          <span>En reparación</span>
          <strong className={enReparacion ? 'texto-error' : ''}>{enReparacion}</strong>
        </div>
        <div className="tarjeta kpi">
          <span>Garantías que vencen en 60 días</span>
          <strong>{garantiaPorVencer}</strong>
        </div>
      </div>
      <section className="tarjeta">
        <div className="fila">
          <label>
            Categoría
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {CATEGORIAS_BIEN.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
              <option value="activos">Activos (sin los dados de baja)</option>
              <option value="">Todos</option>
              {Object.entries(ESTADOS_BIEN).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Buscar
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre, marca, serie, ubicación…" />
          </label>
        </div>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th />
                <th>Bien</th>
                <th>Categoría</th>
                <th>Ubicación</th>
                <th>Responsable</th>
                <th>Compra</th>
                <th className="num">Costo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((b) => (
                <tr key={b.id} className={b.estado === 'baja' ? 'apagado' : ''}>
                  <td>{b.foto ? <img src={b.foto} alt="" className="miniatura-bien" /> : null}</td>
                  <td>
                    <strong>{b.nombre}</strong>
                    {b.cantidad > 1 && ` ×${b.cantidad}`}
                    <div className="suave pequeno">
                      {[b.marca, b.modelo, b.serie && `S/N ${b.serie}`].filter(Boolean).join(' · ')}
                      {b.proyectoNombre && ` · proyecto: ${b.proyectoNombre}`}
                    </div>
                  </td>
                  <td>{b.categoria}</td>
                  <td>{b.ubicacion || '—'}</td>
                  <td>{b.responsable || '—'}</td>
                  <td>
                    {b.fechaCompra ? formatoCorto(b.fechaCompra) : '—'}
                    {b.garantiaHasta && <div className="suave pequeno">garantía hasta {formatoCorto(b.garantiaHasta)}</div>}
                  </td>
                  <td className="num">
                    {dinero(b.costo || 0)}
                    {b.factura && (
                      <a className="adjunto" href={b.factura.url} title="Ver factura" {...(b.factura.url.startsWith('data:') ? { download: 'factura.jpg' } : { target: '_blank', rel: 'noopener noreferrer' })}>
                        <Paperclip size={14} />
                      </a>
                    )}
                  </td>
                  <td>
                    <span className={`chip bien-${b.estado}`}>{ESTADOS_BIEN[b.estado]}</span>
                  </td>
                  <td>
                    <button className="icono-boton" title="Editar" onClick={() => setEditando(b)}>
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!visibles.length && (
                <tr>
                  <td colSpan={9} className="suave">
                    No hay bienes con ese filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function sumarDiasISO(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function FormBien({ inicial, alTerminar }: { inicial?: Bien; alTerminar: () => void }) {
  const { perfil, iglesia } = useSesion();
  const [f, setF] = useState({
    nombre: inicial?.nombre || '',
    categoria: inicial?.categoria || CATEGORIAS_BIEN[0],
    descripcion: inicial?.descripcion || '',
    marca: inicial?.marca || '',
    modelo: inicial?.modelo || '',
    serie: inicial?.serie || '',
    cantidad: String(inicial?.cantidad || 1),
    costo: inicial?.costo ? String(inicial.costo) : '',
    fechaCompra: inicial?.fechaCompra || hoyISO(),
    proveedor: inicial?.proveedor || '',
    ubicacion: inicial?.ubicacion || '',
    responsable: inicial?.responsable || '',
    estado: inicial?.estado || ('nuevo' as EstadoBien),
    garantiaHasta: inicial?.garantiaHasta || '',
    notas: inicial?.notas || '',
  });
  const [foto, setFoto] = useState(inicial?.foto || '');
  const [factura, setFactura] = useState<Comprobante | undefined>(inicial?.factura);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const id = useMemo(() => inicial?.id || nuevoId(16), [inicial?.id]);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const a = e.target.files?.[0];
    e.target.value = '';
    if (!a) return;
    setOcupado(true);
    try {
      setFoto(await guardarFoto(a, iglesia, 'jeivi/finanzas', { autor: perfil, titulo: `Inventario: ${f.nombre}` }));
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setOcupado(false);
    }
  }

  async function subirFactura(e: React.ChangeEvent<HTMLInputElement>) {
    const a = e.target.files?.[0];
    e.target.value = '';
    if (!a || !perfil) return;
    setOcupado(true);
    try {
      setFactura(await guardarComprobante(a, `Factura inventario · ${f.nombre}`, `${RUTA_BIENES}/${id}`, perfil));
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setOcupado(false);
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    const b: Omit<Bien, 'id'> = {
      nombre: f.nombre.trim(),
      categoria: f.categoria,
      descripcion: f.descripcion.trim(),
      marca: f.marca.trim(),
      modelo: f.modelo.trim(),
      serie: f.serie.trim(),
      cantidad: Math.max(1, Number(f.cantidad) || 1),
      costo: redondear(Number(f.costo) || 0),
      fechaCompra: f.fechaCompra,
      proveedor: f.proveedor.trim(),
      ubicacion: f.ubicacion.trim(),
      responsable: f.responsable.trim(),
      estado: f.estado,
      garantiaHasta: f.garantiaHasta,
      foto,
      ...(factura ? { factura } : {}),
      ...(inicial?.proyectoId ? { proyectoId: inicial.proyectoId, proyectoNombre: inicial.proyectoNombre } : {}),
      notas: f.notas.trim(),
      creado: inicial?.creado || new Date().toISOString(),
      registradoPor: inicial?.registradoPor || perfil.uid,
    };
    try {
      await guardarDoc(`${RUTA_BIENES}/${id}`, b, false);
      alTerminar();
    } catch (err) {
      setError(explicarError(err));
    }
  }

  return (
    <form className="tarjeta formulario estrecha" onSubmit={guardar}>
      <h2>{inicial ? 'Editar bien' : 'Registrar bien'}</h2>
      <div className="fila">
        <label>
          Nombre
          <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} required maxLength={90} placeholder="Ej. PC de transmisión" />
        </label>
        <label>
          Categoría
          <select value={f.categoria} onChange={(e) => set('categoria', e.target.value)}>
            {CATEGORIAS_BIEN.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="fila">
        <label>
          Marca
          <input value={f.marca} onChange={(e) => set('marca', e.target.value)} />
        </label>
        <label>
          Modelo
          <input value={f.modelo} onChange={(e) => set('modelo', e.target.value)} />
        </label>
        <label>
          N.º de serie
          <input value={f.serie} onChange={(e) => set('serie', e.target.value)} />
        </label>
      </div>
      <div className="fila">
        <label>
          Cantidad
          <input type="number" min={1} value={f.cantidad} onChange={(e) => set('cantidad', e.target.value)} />
        </label>
        <label>
          Costo total
          <input type="number" min={0} step="0.01" value={f.costo} onChange={(e) => set('costo', e.target.value)} />
        </label>
        <label>
          Fecha de compra
          <input type="date" value={f.fechaCompra} onChange={(e) => set('fechaCompra', e.target.value)} />
        </label>
        <label>
          Garantía hasta
          <input type="date" value={f.garantiaHasta} onChange={(e) => set('garantiaHasta', e.target.value)} />
        </label>
      </div>
      <div className="fila">
        <label>
          Proveedor
          <input value={f.proveedor} onChange={(e) => set('proveedor', e.target.value)} />
        </label>
        <label>
          Ubicación
          <input value={f.ubicacion} onChange={(e) => set('ubicacion', e.target.value)} placeholder="Ej. Cabina de sonido" />
        </label>
        <label>
          Responsable
          <input value={f.responsable} onChange={(e) => set('responsable', e.target.value)} />
        </label>
        <label>
          Estado
          <select value={f.estado} onChange={(e) => set('estado', e.target.value)}>
            {Object.entries(ESTADOS_BIEN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Descripción / notas
        <textarea rows={2} value={f.notas || f.descripcion} onChange={(e) => set('notas', e.target.value)} maxLength={1500} />
      </label>
      <div className="fila logo-fila">
        {foto && <img src={foto} alt="" className="logo-previa" />}
        <label className="boton subir-archivo">
          <ImageIcon size={16} /> {foto ? 'Cambiar foto' : 'Foto del bien'}
          <input type="file" accept="image/*" hidden onChange={subirFoto} />
        </label>
        <label className="boton subir-archivo">
          <Paperclip size={16} /> {factura ? 'Cambiar factura' : 'Factura (foto o PDF)'}
          <input type="file" accept="image/*,application/pdf" hidden onChange={subirFactura} />
        </label>
        {factura && (
          <a className="adjunto" href={factura.url} {...(factura.url.startsWith('data:') ? { download: 'factura.jpg' } : { target: '_blank', rel: 'noopener noreferrer' })}>
            ver factura
          </a>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button className="boton primario" disabled={ocupado}>
          {ocupado ? 'Subiendo…' : 'Guardar'}
        </button>
        <button type="button" className="boton" onClick={alTerminar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
