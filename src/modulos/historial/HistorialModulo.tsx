import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Download, ExternalLink, FileText, RotateCcw } from 'lucide-react';
import { Layout } from '../../core/Layout';
import { Cargando } from '../../core/Cargando';
import { moduloPorId } from '../../core/modulos';
import { escucharRecientes, guardarDoc, leerDoc } from '../../lib/datos';
import { IGLESIA_ID } from '../../lib/firebase';
import { useSesion } from '../../lib/sesion';
import { NOMBRE_MODULO, camposCambiados, rutaHistorial, type EntradaHistorial } from '../../lib/historial';
import { RUTA_ARCHIVOS, STORAGE_ACTIVO, type Archivo, type TipoArchivo } from '../../lib/almacen';

const modulo = moduloPorId('historial')!;

export function HistorialModulo() {
  return (
    <Layout
      modulo={modulo}
      pestanas={[
        { a: '/m/historial', texto: 'Actividad', fin: true },
        { a: '/m/historial/banners', texto: 'Banners' },
        { a: '/m/historial/archivos', texto: 'Fotos y comprobantes' },
      ]}
    >
      <Routes>
        <Route index element={<ListaActividad />} />
        <Route path="banners" element={<Galeria tipos={['banner']} titulo="Banners generados" />} />
        <Route path="archivos" element={<Galeria tipos={['foto', 'comprobante', 'documento']} titulo="Fotos y comprobantes subidos" />} />
        <Route path="*" element={<Navigate to="/m/historial" replace />} />
      </Routes>
    </Layout>
  );
}

const ACCIONES: Record<string, string> = {
  crear: 'Creó',
  editar: 'Editó',
  borrar: 'Borró',
  lote: 'Carga masiva',
  banner: 'Banner',
  archivo: 'Archivo',
};

const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat('es-PA', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

function valor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'string') return v.length > 140 ? v.slice(0, 140) + '…' : v;
  const t = JSON.stringify(v);
  return t.length > 140 ? t.slice(0, 140) + '…' : t;
}

/** Lista de todo lo que se hizo en Jeivi (opcionalmente de un solo módulo). */
export function ListaActividad({ soloModulo }: { soloModulo?: string }) {
  const { puede } = useSesion();
  const [limite, setLimite] = useState(300);
  const [lista, setLista] = useState<EntradaHistorial[] | null>(null);
  const [error, setError] = useState('');
  const [mod, setMod] = useState(soloModulo || '');
  const [accion, setAccion] = useState('');
  const [persona, setPersona] = useState('');
  const [buscar, setBuscar] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  useEffect(
    () =>
      escucharRecientes<EntradaHistorial>(rutaHistorial(IGLESIA_ID), 'fecha', limite, setLista, () => {
        setError('No tienes permiso para ver el historial (solo pastores y super admin).');
        setLista([]);
      }),
    [limite],
  );

  const personas = useMemo(() => [...new Set((lista || []).map((e) => e.nombre))].sort(), [lista]);
  const modulos = useMemo(() => [...new Set((lista || []).map((e) => e.modulo))].sort(), [lista]);
  const visibles = (lista || []).filter(
    (e) =>
      (!mod || e.modulo === mod) &&
      (!accion || e.accion === accion) &&
      (!persona || e.nombre === persona) &&
      `${e.resumen} ${e.nombre}`.toLowerCase().includes(buscar.toLowerCase()),
  );

  async function restaurar(e: EntradaHistorial) {
    if (!e.antes || !e.ruta) return;
    const texto = e.accion === 'borrar' ? `¿Restaurar "${e.resumen}" tal como estaba antes de borrarse?` : `¿Volver "${e.resumen}" a como estaba antes de este cambio?`;
    if (!confirm(texto)) return;
    // Las imágenes no se copian al historial: si el registro aún existe se conserva la actual.
    const actual = (await leerDoc<Record<string, unknown>>(e.ruta).catch(() => null)) || {};
    const tieneImagen = (v: unknown): boolean =>
      v === '[imagen]' || (!!v && typeof v === 'object' && Object.values(v as Record<string, unknown>).some(tieneImagen));
    const datos = Object.fromEntries(
      Object.entries(e.antes)
        .map(([k, v]) => [k, tieneImagen(v) ? actual[k] : v])
        .filter(([, v]) => v !== undefined),
    );
    await guardarDoc(e.ruta, datos, false);
    setAviso(e.accion === 'borrar' ? 'Registro restaurado.' : 'Se volvió a la versión anterior.');
    setTimeout(() => setAviso(''), 3000);
  }

  if (!lista) return <Cargando />;

  return (
    <div className="pila">
      <section className="tarjeta">
        <h2>Historial de cambios</h2>
        <p className="suave">
          Todo lo que el equipo crea, edita, borra o importa queda aquí con quién y cuándo. El historial no se puede modificar ni borrar.
          {puede('pastor') && ' Lo borrado o cambiado por error se puede restaurar.'}
        </p>
        <div className="fila">
          {!soloModulo && (
            <label>
              Módulo
              <select value={mod} onChange={(e) => setMod(e.target.value)}>
                <option value="">Todos</option>
                {modulos.map((m) => (
                  <option key={m} value={m}>
                    {NOMBRE_MODULO[m] || m}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Acción
            <select value={accion} onChange={(e) => setAccion(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(ACCIONES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Persona
            <select value={persona} onChange={(e) => setPersona(e.target.value)}>
              <option value="">Todas</option>
              {personas.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Buscar
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Ej. Luz, Carlos, anuncio…" />
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        {aviso && <div className="exito">{aviso}</div>}
      </section>

      <section className="tarjeta">
        <ul className="historial">
          {visibles.map((e) => {
            const cambios = e.accion === 'lote' ? [] : camposCambiados(e.antes, e.despues);
            const abiertoEste = abierto === e.id;
            return (
              <li key={e.id} className={`hist-${e.accion}`}>
                <button className="hist-fila" onClick={() => setAbierto(abiertoEste ? null : e.id)}>
                  <span className="hist-fecha">{fechaHora(e.fecha)}</span>
                  <span className={`chip hist-accion-${e.accion}`}>{ACCIONES[e.accion] || e.accion}</span>
                  <span className="chip">{NOMBRE_MODULO[e.modulo] || e.modulo}</span>
                  <span className="hist-resumen">{e.resumen}</span>
                  <span className="suave pequeno">{e.nombre}</span>
                </button>
                {abiertoEste && (
                  <div className="hist-detalle">
                    {e.accion === 'lote' && e.despues && (
                      <p className="suave pequeno">
                        {e.despues.guardados} guardados · {e.despues.borrados} borrados
                      </p>
                    )}
                    {cambios.length > 0 && (
                      <table className="tabla">
                        <thead>
                          <tr>
                            <th>Campo</th>
                            <th>Antes</th>
                            <th>Después</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cambios.map((c) => (
                            <tr key={c.campo}>
                              <td>{c.campo}</td>
                              <td className="texto-error">{valor(c.antes)}</td>
                              <td className="texto-exito">{valor(c.despues)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {puede('pastor') && e.antes && e.ruta && (e.accion === 'borrar' || e.accion === 'editar') && (
                      <button className="boton pequeno" onClick={() => restaurar(e)}>
                        <RotateCcw size={14} /> {e.accion === 'borrar' ? 'Restaurar lo borrado' : 'Volver a la versión anterior'}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {!visibles.length && <li className="suave">No hay movimientos con ese filtro.</li>}
        </ul>
        {lista.length >= limite && (
          <button className="boton" onClick={() => setLimite((l) => l + 300)}>
            Cargar más antiguos
          </button>
        )}
      </section>
    </div>
  );
}

/** Galería de banners o archivos subidos (con quién y cuándo). */
export function Galeria({ tipos, titulo }: { tipos: TipoArchivo[]; titulo: string }) {
  const [limite, setLimite] = useState(120);
  const [lista, setLista] = useState<Archivo[] | null>(null);
  const [mod, setMod] = useState('');

  useEffect(() => escucharRecientes<Archivo>(RUTA_ARCHIVOS, 'creado', limite, (d) => setLista(d), () => setLista([])), [limite]);

  const propios = (lista || []).filter((a) => tipos.includes(a.tipo));
  const modulos = [...new Set(propios.map((a) => a.modulo))].sort();
  const visibles = propios.filter((a) => !mod || a.modulo === mod);

  if (!lista) return <Cargando />;

  return (
    <div className="pila">
      <section className="tarjeta fila-entre">
        <div>
          <h2>{titulo}</h2>
          <p className="suave">
            {visibles.length} archivo(s).{' '}
            {!STORAGE_ACTIVO && 'Storage no está activo: se guarda una miniatura de cada banner; al activarlo se guarda la imagen completa.'}
          </p>
        </div>
        <label>
          Módulo
          <select value={mod} onChange={(e) => setMod(e.target.value)}>
            <option value="">Todos</option>
            {modulos.map((m) => (
              <option key={m} value={m}>
                {NOMBRE_MODULO[m] || m}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="galeria">
        {visibles.map((a) => (
          <figure key={a.id} className="tarjeta galeria-item">
            {a.miniatura ? (
              <img src={a.miniatura} alt={a.titulo} loading="lazy" />
            ) : (
              <div className="galeria-icono">
                <FileText size={40} />
              </div>
            )}
            <figcaption>
              <strong>{a.titulo}</strong>
              <small className="suave">
                {NOMBRE_MODULO[a.modulo] || a.modulo} · {a.subidoPorNombre} · {fechaHora(a.creado)}
              </small>
              <span className="acciones">
                {a.url ? (
                  <a className="boton pequeno" href={a.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} /> Abrir
                  </a>
                ) : (
                  a.miniatura && (
                    <a className="boton pequeno" href={a.miniatura} download={`${a.tipo}-${a.id}.jpg`}>
                      <Download size={14} /> Miniatura
                    </a>
                  )
                )}
              </span>
            </figcaption>
          </figure>
        ))}
        {!visibles.length && <p className="tarjeta suave">Todavía no hay nada aquí.</p>}
      </div>
      {lista.length >= limite && (
        <button className="boton" onClick={() => setLimite((l) => l + 120)}>
          Cargar más
        </button>
      )}
    </div>
  );
}
