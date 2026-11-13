import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Lock, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { Layout } from '../../core/Layout';
import { Cargando } from '../../core/Cargando';
import { GestorEnlaces } from '../../core/GestorEnlaces';
import { moduloPorId } from '../../core/modulos';
import { borrarDoc, escucharColeccion, guardarDoc } from '../../lib/datos';
import { nuevoId } from '../../lib/enlaces';
import { formatoCorto } from '../../lib/fechas';
import { useSesion } from '../../lib/sesion';
import { limpiarTelefono, numeroWhatsApp } from '../lectura/suscriptores';
import { ESTADOS_SOLICITUD, RUTA_SOLICITUDES, TIPOS_SOLICITUD, type EstadoSolicitud, type Solicitud } from './datos';

const modulo = moduloPorId('solicitudes')!;

/** Diáconos ven solo las no confidenciales; pastores ven todas (las reglas lo exigen así). */
export function useSolicitudes() {
  const { puede } = useSesion();
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const pastor = puede('pastor');
  useEffect(
    () => escucharColeccion<Solicitud>(RUTA_SOLICITUDES, (d) => setLista([...d].sort((a, b) => b.creado.localeCompare(a.creado))), pastor ? undefined : ['confidencial', false]),
    [pastor],
  );
  return lista;
}

export function SolicitudesModulo() {
  const lista = useSolicitudes();
  return (
    <Layout
      modulo={modulo}
      pestanas={[
        { a: '/m/solicitudes', texto: 'Bandeja', fin: true },
        { a: '/m/solicitudes/nueva', texto: 'Nueva' },
        { a: '/m/solicitudes/link', texto: 'Link para la congregación' },
      ]}
    >
      {!lista ? (
        <Cargando />
      ) : (
        <Routes>
          <Route index element={<Bandeja lista={lista} />} />
          <Route path="s/:id" element={<Detalle lista={lista} />} />
          <Route path="nueva" element={<Nueva />} />
          <Route
            path="link"
            element={<GestorEnlaces modulo="solicitudes" mensaje="🙏 ¿Necesitas oración, una visita o consejería? Escríbenos aquí y los pastores y diáconos te atenderán:" />}
          />
          <Route path="*" element={<Navigate to="/m/solicitudes" replace />} />
        </Routes>
      )}
    </Layout>
  );
}

function Bandeja({ lista }: { lista: Solicitud[] }) {
  const { puede } = useSesion();
  const [estado, setEstado] = useState<EstadoSolicitud | 'abiertas' | ''>('abiertas');
  const [tipo, setTipo] = useState('');
  const [buscar, setBuscar] = useState('');
  const visibles = lista.filter(
    (s) =>
      (estado === '' || (estado === 'abiertas' ? s.estado === 'nueva' || s.estado === 'en_proceso' : s.estado === estado)) &&
      (!tipo || s.tipo === tipo) &&
      `${s.nombre} ${s.mensaje}`.toLowerCase().includes(buscar.toLowerCase()),
  );
  const cuenta = (e: EstadoSolicitud) => lista.filter((s) => s.estado === e).length;

  return (
    <div className="pila">
      <div className="kpis">
        {(Object.keys(ESTADOS_SOLICITUD) as EstadoSolicitud[]).map((e) => (
          <button key={e} className={`tarjeta kpi boton-kpi ${estado === e ? 'activo' : ''}`} onClick={() => setEstado(estado === e ? 'abiertas' : e)}>
            <span>{ESTADOS_SOLICITUD[e]}</span>
            <strong>{cuenta(e)}</strong>
          </button>
        ))}
      </div>
      <section className="tarjeta">
        <div className="fila">
          <label>
            Estado
            <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
              <option value="abiertas">Abiertas (nuevas y en proceso)</option>
              <option value="">Todas</option>
              {Object.entries(ESTADOS_SOLICITUD).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {TIPOS_SOLICITUD.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Buscar
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre o texto" />
          </label>
        </div>
        {!puede('pastor') && <p className="suave pequeno">Las solicitudes marcadas como confidenciales solo las ven los pastores.</p>}
        <ul className="lista-solicitudes">
          {visibles.map((s) => (
            <li key={s.id}>
              <Link to={`/m/solicitudes/s/${s.id}`} className={`solicitud estado-sol-${s.estado}`}>
                <div className="fila-entre">
                  <strong>
                    {s.confidencial && <Lock size={14} />} {s.tipo}
                  </strong>
                  <span className={`chip sol-${s.estado}`}>{ESTADOS_SOLICITUD[s.estado]}</span>
                </div>
                <p>{s.mensaje.length > 180 ? s.mensaje.slice(0, 180) + '…' : s.mensaje}</p>
                <small className="suave">
                  {s.nombre} · {formatoCorto(s.creado.slice(0, 10))}
                  {s.asignadoNombre ? ` · asignada a ${s.asignadoNombre}` : ''}
                  {s.seguimiento.length ? ` · ${s.seguimiento.length} nota(s)` : ''}
                </small>
              </Link>
            </li>
          ))}
          {!visibles.length && <li className="suave">No hay solicitudes con ese filtro.</li>}
        </ul>
      </section>
    </div>
  );
}

function Detalle({ lista }: { lista: Solicitud[] }) {
  const { id } = useParams();
  const { perfil, puede } = useSesion();
  const nav = useNavigate();
  const s = lista.find((x) => x.id === id);
  const [nota, setNota] = useState('');
  if (!s || !perfil) return <Navigate to="/m/solicitudes" replace />;
  const ruta = `${RUTA_SOLICITUDES}/${s.id}`;

  function agregarNota(e: FormEvent) {
    e.preventDefault();
    if (!nota.trim() || !s || !perfil) return;
    guardarDoc(ruta, {
      seguimiento: [...s.seguimiento, { fecha: new Date().toISOString(), autor: perfil.nombre, texto: nota.trim() }],
      ...(s.estado === 'nueva' ? { estado: 'en_proceso' } : {}),
    });
    setNota('');
  }

  return (
    <div className="pila estrecha-pila">
      <section className="tarjeta">
        <div className="fila-entre">
          <div>
            <span className="chip">{s.tipo}</span> {s.confidencial && <span className="chip chip-error">Confidencial</span>}
            <h1>{s.nombre}</h1>
            <small className="suave">
              {formatoCorto(s.creado.slice(0, 10))} · {s.origen === 'link' ? 'por link' : 'registrada por el equipo'}
            </small>
          </div>
          {puede('pastor') && (
            <button className="icono-boton peligro" title="Eliminar" onClick={() => confirm('¿Eliminar esta solicitud?') && borrarDoc(ruta).then(() => nav('/m/solicitudes'))}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <p className="anuncio-texto">{s.mensaje}</p>
        <div className="acciones">
          {s.telefono && (
            <a className="boton whatsapp" href={`https://wa.me/${numeroWhatsApp(s.telefono)}?text=${encodeURIComponent(`Hola ${s.nombre.split(' ')[0]}, Dios te bendiga. Te escribimos de la iglesia por tu solicitud.`)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} /> {s.telefono}
            </a>
          )}
          {s.email && (
            <a className="boton" href={`mailto:${s.email}`}>
              {s.email}
            </a>
          )}
        </div>
      </section>

      <section className="tarjeta">
        <div className="fila">
          <label>
            Estado
            <select value={s.estado} onChange={(e) => guardarDoc(ruta, { estado: e.target.value })}>
              {Object.entries(ESTADOS_SOLICITUD).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div>
            <small className="suave">Responsable</small>
            <div className="acciones">
              <strong>{s.asignadoNombre || 'Sin asignar'}</strong>
              {s.asignadoUid !== perfil.uid && (
                <button className="boton pequeno" onClick={() => guardarDoc(ruta, { asignadoUid: perfil.uid, asignadoNombre: perfil.nombre, ...(s.estado === 'nueva' ? { estado: 'en_proceso' } : {}) })}>
                  Me encargo yo
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="tarjeta">
        <h2>Seguimiento</h2>
        <ul className="movimientos">
          {s.seguimiento.map((n, i) => (
            <li key={i}>
              <div className="dia-info">
                <strong>{n.texto}</strong>
                <small>
                  {n.autor} · {formatoCorto(n.fecha.slice(0, 10))}
                </small>
              </div>
            </li>
          ))}
          {!s.seguimiento.length && <li className="suave">Sin notas todavía.</li>}
        </ul>
        <form className="fila" onSubmit={agregarNota}>
          <label>
            Nueva nota
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Se le llamó, visita el jueves" />
          </label>
          <button className="boton primario">
            <Plus size={16} /> Agregar
          </button>
        </form>
      </section>
    </div>
  );
}

function Nueva() {
  const nav = useNavigate();
  const { perfil } = useSesion();
  const [tipo, setTipo] = useState(TIPOS_SOLICITUD[0]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [confidencial, setConfidencial] = useState(false);

  const id = useMemo(() => nuevoId(16), []);
  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    const s: Omit<Solicitud, 'id'> = {
      tipo,
      nombre: nombre.trim(),
      telefono: limpiarTelefono(telefono),
      email: '',
      mensaje: mensaje.trim(),
      confidencial,
      estado: 'nueva',
      seguimiento: [],
      origen: 'interna',
      creado: new Date().toISOString(),
      asignadoUid: perfil.uid,
      asignadoNombre: perfil.nombre,
    };
    await guardarDoc(`${RUTA_SOLICITUDES}/${id}`, s, false);
    nav(`/m/solicitudes/s/${id}`);
  }

  return (
    <form className="tarjeta formulario estrecha" onSubmit={guardar}>
      <h2>Registrar solicitud</h2>
      <p className="suave">Para lo que te pidan en persona o por teléfono.</p>
      <label>
        Tipo
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS_SOLICITUD.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <div className="fila">
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label>
          WhatsApp / teléfono
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" />
        </label>
      </div>
      <label>
        Detalle
        <textarea rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} required />
      </label>
      <label className="interruptor">
        <input type="checkbox" checked={confidencial} onChange={(e) => setConfidencial(e.target.checked)} />
        <span>Confidencial (solo pastores)</span>
      </label>
      <div className="acciones">
        <button className="boton primario">Guardar</button>
        <button type="button" className="boton" onClick={() => nav('/m/solicitudes')}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
