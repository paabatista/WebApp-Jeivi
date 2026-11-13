import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { explicarError } from '../../lib/errores';
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Image as ImageIcon, MapPin, MessageCircle, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { Layout } from '../../core/Layout';
import { Cargando } from '../../core/Cargando';
import { GestorEnlaces } from '../../core/GestorEnlaces';
import { moduloPorId } from '../../core/modulos';
import { borrarDoc, escucharColeccion, guardarDoc } from '../../lib/datos';
import { nuevoId } from '../../lib/enlaces';
import { IGLESIA_ID } from '../../lib/firebase';
import { diaSemana, formatoCorto, hoyISO, sumarDias } from '../../lib/fechas';
import { guardarFoto } from '../../lib/fotos';
import { useSesion, type Perfil } from '../../lib/sesion';
import { GeneradorBanner } from '../lectura/GeneradorBanner';
import { useLectura } from '../lectura/useLectura';
import { numeroWhatsApp } from '../lectura/suscriptores';
import { MESES } from '../cumpleanos/datos';
import {
  CATEGORIAS_EVENTO,
  ESTADOS,
  RUTA_EVENTOS,
  RUTA_INSCRIPCIONES,
  hora12,
  mensajeEvento,
  textoCuando,
  type EstadoEvento,
  type Evento,
  type Inscripcion,
  type Tarea,
} from './datos';

const modulo = moduloPorId('eventos')!;

export function EventosModulo() {
  const [lista, setLista] = useState<Evento[] | null>(null);
  useEffect(() => escucharColeccion<Evento>(RUTA_EVENTOS, (d) => setLista([...d].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || '')))), []);
  return (
    <Layout
      modulo={modulo}
      pestanas={[
        { a: '/m/eventos', texto: 'Próximos', fin: true },
        { a: '/m/eventos/calendario', texto: 'Calendario' },
        { a: '/m/eventos/nuevo', texto: 'Nuevo evento' },
        { a: '/m/eventos/banner', texto: 'Banner' },
      ]}
    >
      {!lista ? (
        <Cargando />
      ) : (
        <Routes>
          <Route index element={<Proximos lista={lista} />} />
          <Route path="calendario" element={<Calendario lista={lista} />} />
          <Route path="nuevo" element={<Editor />} />
          <Route path="e/:id" element={<Detalle lista={lista} />} />
          <Route path="editar/:id" element={<EditarEvento lista={lista} />} />
          <Route path="banner" element={<PaginaBanner lista={lista} />} />
          <Route path="*" element={<Navigate to="/m/eventos" replace />} />
        </Routes>
      )}
    </Layout>
  );
}

function FilaEvento({ e }: { e: Evento }) {
  const hechas = e.tareas.filter((t) => t.hecho).length;
  return (
    <Link to={`/m/eventos/e/${e.id}`} className={`evento-fila estado-${e.estado}`}>
      <div className="evento-fecha">
        <strong>{Number(e.fecha.slice(8))}</strong>
        <span>{MESES[Number(e.fecha.slice(5, 7)) - 1].slice(0, 3)}</span>
      </div>
      <div className="dia-info">
        <strong>{e.titulo}</strong>
        <small>
          {e.hora ? hora12(e.hora) : 'Todo el día'}
          {e.lugar ? ` · ${e.lugar}` : ''}
          {e.responsableNombre ? ` · ${e.responsableNombre}` : ''}
        </small>
      </div>
      <span className="chip">{e.categoria}</span>
      {e.tareas.length > 0 && (
        <span className="chip" title="Tareas hechas">
          <Check size={12} /> {hechas}/{e.tareas.length}
        </span>
      )}
      {e.estado !== 'planificado' && <span className={`chip estado-chip-${e.estado}`}>{ESTADOS[e.estado]}</span>}
    </Link>
  );
}

function Proximos({ lista }: { lista: Evento[] }) {
  const hoy = hoyISO();
  const [pasados, setPasados] = useState(false);
  const proximos = lista.filter((e) => (e.fechaFin || e.fecha) >= hoy && e.estado !== 'cancelado');
  const anteriores = lista.filter((e) => (e.fechaFin || e.fecha) < hoy || e.estado === 'cancelado').reverse();

  return (
    <div className="pila">
      <div className="tarjeta fila-entre">
        <div>
          <h2>Próximos eventos</h2>
          <p className="suave">{proximos.length} programados</p>
        </div>
        <Link className="boton primario" to="/m/eventos/nuevo">
          <Plus size={16} /> Nuevo evento
        </Link>
      </div>
      <section className="tarjeta">
        <div className="lista-eventos">
          {proximos.map((e) => (
            <FilaEvento key={e.id} e={e} />
          ))}
          {!proximos.length && <p className="suave">No hay eventos próximos.</p>}
        </div>
      </section>
      {anteriores.length > 0 && (
        <button className="enlace" onClick={() => setPasados((v) => !v)}>
          {pasados ? 'Ocultar' : 'Ver'} eventos anteriores ({anteriores.length})
        </button>
      )}
      {pasados && (
        <section className="tarjeta">
          <div className="lista-eventos">
            {anteriores.map((e) => (
              <FilaEvento key={e.id} e={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Calendario({ lista }: { lista: Evento[] }) {
  const hoy = hoyISO();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const nav = useNavigate();
  const primero = `${mes}-01`;
  const inicio = sumarDias(primero, -((diaSemana(primero) + 6) % 7)); // lunes
  const dias = Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
  const mover = (n: number) => {
    const [a, m] = mes.split('-').map(Number);
    const d = new Date(a, m - 1 + n, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const delDia = (iso: string) => lista.filter((e) => e.fecha <= iso && (e.fechaFin || e.fecha) >= iso);

  return (
    <section className="tarjeta">
      <div className="fila-entre">
        <button className="icono-boton" onClick={() => mover(-1)} aria-label="Mes anterior">
          <ChevronLeft />
        </button>
        <h2>
          {MESES[Number(mes.slice(5)) - 1]} {mes.slice(0, 4)}
        </h2>
        <button className="icono-boton" onClick={() => mover(1)} aria-label="Mes siguiente">
          <ChevronRight />
        </button>
      </div>
      <div className="calendario">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="cal-cabecera">
            {d}
          </div>
        ))}
        {dias.map((iso) => (
          <div
            key={iso}
            className={`cal-dia ${iso.slice(0, 7) !== mes ? 'fuera' : ''} ${iso === hoy ? 'hoy' : ''}`}
            onDoubleClick={() => nav(`/m/eventos/nuevo?fecha=${iso}`)}
            title="Doble clic para crear un evento este día"
          >
            <span className="cal-num">{Number(iso.slice(8))}</span>
            {delDia(iso).map((e) => (
              <Link key={e.id} to={`/m/eventos/e/${e.id}`} className={`cal-evento estado-${e.estado}`}>
                {e.hora ? `${hora12(e.hora).replace(' ', '')} ` : ''}
                {e.titulo}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function useEquipo() {
  const { puede, perfil } = useSesion();
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  useEffect(() => {
    // Solo los pastores pueden leer la lista de usuarios; un diácono se ve a sí mismo.
    if (!puede('pastor')) return setUsuarios(perfil ? [perfil] : []);
    return escucharColeccion<Perfil>('users', (d) => setUsuarios(d.filter((u) => u.rol !== 'pendiente').sort((a, b) => a.nombre.localeCompare(b.nombre))), ['iglesiaId', IGLESIA_ID]);
  }, [perfil?.uid]);
  return usuarios;
}

function EditarEvento({ lista }: { lista: Evento[] }) {
  const { id } = useParams();
  const e = lista.find((x) => x.id === id);
  return e ? <Editor inicial={e} /> : <Navigate to="/m/eventos" replace />;
}

function Editor({ inicial }: { inicial?: Evento }) {
  const { perfil, iglesia } = useSesion();
  const equipo = useEquipo();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [f, setF] = useState<Omit<Evento, 'id' | 'creado' | 'creadoPor' | 'tareas'>>({
    titulo: inicial?.titulo || '',
    descripcion: inicial?.descripcion || '',
    categoria: inicial?.categoria || 'Culto especial',
    fecha: inicial?.fecha || params.get('fecha') || hoyISO(),
    hora: inicial?.hora || '',
    fechaFin: inicial?.fechaFin || '',
    horaFin: inicial?.horaFin || '',
    lugar: inicial?.lugar || '',
    responsableUid: inicial?.responsableUid || perfil?.uid || '',
    responsableNombre: inicial?.responsableNombre || perfil?.nombre || '',
    estado: inicial?.estado || 'planificado',
    inscripcion: inicial?.inscripcion ?? false,
    cupo: inicial?.cupo ?? null,
    imagen: inicial?.imagen || '',
    publico: inicial?.publico ?? false,
  });
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSubiendo(true);
    try {
      set('imagen', await guardarFoto(file, iglesia, 'jeivi/eventos', { autor: perfil, titulo: `Imagen de evento: ${f.titulo}` }));
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    if (!perfil) return;
    if (f.fechaFin && f.fechaFin < f.fecha) return setError('La fecha de fin no puede ser antes del inicio.');
    const id = inicial?.id || nuevoId(16);
    const resp = equipo.find((u) => u.uid === f.responsableUid);
    await guardarDoc(
      `${RUTA_EVENTOS}/${id}`,
      {
        ...f,
        titulo: f.titulo.trim(),
        descripcion: f.descripcion.trim(),
        lugar: f.lugar?.trim(),
        responsableNombre: resp?.nombre || f.responsableNombre || '',
        cupo: f.cupo ? Number(f.cupo) : null,
        tareas: inicial?.tareas || [],
        creado: inicial?.creado || new Date().toISOString(),
        creadoPor: inicial?.creadoPor || perfil.uid,
      },
      false,
    );
    nav(`/m/eventos/e/${id}`);
  }

  return (
    <form className="tarjeta formulario estrecha" onSubmit={guardar}>
      <h2>{inicial ? 'Editar evento' : 'Nuevo evento'}</h2>
      <label>
        Nombre del evento
        <input value={f.titulo} onChange={(e) => set('titulo', e.target.value)} required maxLength={90} />
      </label>
      <div className="fila">
        <label>
          Tipo
          <select value={f.categoria} onChange={(e) => set('categoria', e.target.value)}>
            {CATEGORIAS_EVENTO.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select value={f.estado} onChange={(e) => set('estado', e.target.value as EstadoEvento)}>
            {Object.entries(ESTADOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="fila">
        <label>
          Fecha
          <input type="date" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} required />
        </label>
        <label>
          Hora
          <input type="time" value={f.hora} onChange={(e) => set('hora', e.target.value)} />
        </label>
        <label>
          Termina (fecha)
          <input type="date" value={f.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} />
        </label>
        <label>
          Termina (hora)
          <input type="time" value={f.horaFin} onChange={(e) => set('horaFin', e.target.value)} />
        </label>
      </div>
      <div className="fila">
        <label>
          Lugar
          <input value={f.lugar} onChange={(e) => set('lugar', e.target.value)} placeholder="Templo, salón, dirección…" />
        </label>
        <label>
          Responsable
          <select value={f.responsableUid} onChange={(e) => set('responsableUid', e.target.value)}>
            <option value="">—</option>
            {equipo.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.nombre}
              </option>
            ))}
            {f.responsableUid && !equipo.some((u) => u.uid === f.responsableUid) && <option value={f.responsableUid}>{f.responsableNombre}</option>}
          </select>
        </label>
      </div>
      <label>
        Descripción
        <textarea rows={4} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} maxLength={1500} />
      </label>
      <label className="interruptor">
        <input type="checkbox" checked={f.inscripcion} onChange={(e) => set('inscripcion', e.target.checked)} />
        <span>Recibir inscripciones por link</span>
      </label>
      {f.inscripcion && (
        <label>
          Cupo (opcional)
          <input type="number" min={1} value={f.cupo ?? ''} onChange={(e) => set('cupo', e.target.value ? Number(e.target.value) : null)} />
        </label>
      )}
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
        <button type="button" className="boton" onClick={() => nav(inicial ? `/m/eventos/e/${inicial.id}` : '/m/eventos')}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Detalle({ lista }: { lista: Evento[] }) {
  const { id } = useParams();
  const { iglesia, puede } = useSesion();
  const nav = useNavigate();
  const e = lista.find((x) => x.id === id);
  const [inscritos, setInscritos] = useState<Inscripcion[]>([]);
  const [nuevaTarea, setNuevaTarea] = useState('');
  const [respTarea, setRespTarea] = useState('');

  useEffect(() => {
    if (!id) return;
    return escucharColeccion<Inscripcion>(RUTA_INSCRIPCIONES, (d) => setInscritos([...d].sort((a, b) => a.creado.localeCompare(b.creado))), ['eventoId', id]);
  }, [id]);

  if (!e) return <Navigate to="/m/eventos" replace />;
  const ruta = `${RUTA_EVENTOS}/${e.id}`;
  const totalPersonas = inscritos.reduce((s, i) => s + (i.personas || 1), 0);
  const guardarTareas = (tareas: Tarea[]) => guardarDoc(ruta, { tareas });

  function agregarTarea(ev: FormEvent) {
    ev.preventDefault();
    if (!nuevaTarea.trim() || !e) return;
    guardarTareas([...e.tareas, { id: nuevoId(8), texto: nuevaTarea.trim(), responsable: respTarea.trim(), hecho: false }]);
    setNuevaTarea('');
    setRespTarea('');
  }

  function exportar() {
    if (!e) return;
    const filas = [['Nombre', 'Teléfono', 'Correo', 'Personas', 'Nota', 'Fecha']].concat(
      inscritos.map((i) => [i.nombre, i.telefono, i.email, String(i.personas), i.nota, i.creado.slice(0, 10)]),
    );
    const csv = '﻿' + filas.map((f) => f.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `inscritos-${e.titulo.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}.csv`;
    a.click();
  }

  return (
    <div className="pila">
      <section className="tarjeta evento-detalle">
        {e.imagen && <img src={e.imagen} alt="" className="evento-imagen" />}
        <div className="fila-entre">
          <div>
            <span className="chip">{e.categoria}</span> <span className={`chip estado-chip-${e.estado}`}>{ESTADOS[e.estado]}</span>
            <h1>{e.titulo}</h1>
          </div>
          <div className="acciones">
            <button className="boton" onClick={() => nav(`/m/eventos/banner?id=${e.id}`)}>
              <ImageIcon size={16} /> Banner
            </button>
            <a className="boton whatsapp" href={`https://wa.me/?text=${encodeURIComponent(mensajeEvento(e, iglesia.nombre))}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} /> Compartir
            </a>
            <Link className="boton" to={`/m/eventos/editar/${e.id}`}>
              <Pencil size={16} /> Editar
            </Link>
            {puede('pastor') && (
              <button
                className="icono-boton peligro"
                title="Eliminar evento"
                onClick={() => confirm('¿Eliminar este evento?') && borrarDoc(ruta).then(() => nav('/m/eventos'))}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
        <ul className="evento-datos">
          <li>
            <CalendarDays size={16} /> {textoCuando(e)}
          </li>
          {e.lugar && (
            <li>
              <MapPin size={16} /> {e.lugar}
            </li>
          )}
          {e.responsableNombre && (
            <li>
              <Clock size={16} /> Responsable: {e.responsableNombre}
            </li>
          )}
          {e.inscripcion && (
            <li>
              <Users size={16} /> {totalPersonas} inscrito(s){e.cupo ? ` de ${e.cupo}` : ''}
            </li>
          )}
        </ul>
        {e.descripcion && <p className="anuncio-texto">{e.descripcion}</p>}
      </section>

      <section className="tarjeta">
        <h2>Tareas</h2>
        <ul className="lista-tareas">
          {e.tareas.map((t) => (
            <li key={t.id} className={t.hecho ? 'hecha' : ''}>
              <button className={`check ${t.hecho ? 'marcado' : ''}`} onClick={() => guardarTareas(e.tareas.map((x) => (x.id === t.id ? { ...x, hecho: !x.hecho } : x)))}>
                {t.hecho && <Check size={14} />}
              </button>
              <div className="dia-info">
                <strong>{t.texto}</strong>
                {t.responsable && <small>{t.responsable}</small>}
              </div>
              <button className="icono-boton peligro" onClick={() => guardarTareas(e.tareas.filter((x) => x.id !== t.id))} title="Quitar">
                <X size={15} />
              </button>
            </li>
          ))}
          {!e.tareas.length && <li className="suave">Sin tareas. Agrega lo que hay que preparar (sonido, decoración, comida…).</li>}
        </ul>
        <form className="fila" onSubmit={agregarTarea}>
          <label>
            Nueva tarea
            <input value={nuevaTarea} onChange={(ev) => setNuevaTarea(ev.target.value)} placeholder="Ej. Preparar el sonido" />
          </label>
          <label>
            Encargado
            <input value={respTarea} onChange={(ev) => setRespTarea(ev.target.value)} placeholder="Nombre" />
          </label>
          <button className="boton primario">
            <Plus size={16} /> Agregar
          </button>
        </form>
      </section>

      {e.inscripcion && (
        <>
          <GestorEnlaces
            modulo="eventos"
            eventoId={e.id}
            tituloInicial={`Inscripción: ${e.titulo}`}
            alCrear={() => (e.publico ? undefined : guardarDoc(ruta, { publico: true }))}
            mensaje={`🗓️ *${e.titulo}*\n${textoCuando(e)}${e.lugar ? `\n📍 ${e.lugar}` : ''}\n\nInscríbete en este link:`}
          />
          <section className="tarjeta">
            <div className="fila-entre">
              <h2>
                Inscritos · {totalPersonas}
                {e.cupo ? ` / ${e.cupo}` : ''}
              </h2>
              <button className="boton" onClick={exportar} disabled={!inscritos.length}>
                Exportar a Excel
              </button>
            </div>
            {e.cupo && totalPersonas >= e.cupo && <div className="aviso">Se alcanzó el cupo. Puedes desactivar el link.</div>}
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Personas</th>
                    <th>Nota</th>
                    <th>Fecha</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {inscritos.map((i) => (
                    <tr key={i.id}>
                      <td>{i.nombre}</td>
                      <td>
                        {i.telefono ? (
                          <a href={`https://wa.me/${numeroWhatsApp(i.telefono)}`} target="_blank" rel="noopener noreferrer">
                            {i.telefono}
                          </a>
                        ) : (
                          i.email || '—'
                        )}
                      </td>
                      <td>{i.personas}</td>
                      <td>{i.nota || '—'}</td>
                      <td>{formatoCorto(i.creado.slice(0, 10))}</td>
                      <td>
                        {puede('pastor') && (
                          <button className="icono-boton peligro" onClick={() => confirm(`¿Quitar a ${i.nombre}?`) && borrarDoc(`${RUTA_INSCRIPCIONES}/${i.id}`)}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!inscritos.length && (
                    <tr>
                      <td colSpan={6} className="suave">
                        Aún no hay inscritos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PaginaBanner({ lista }: { lista: Evento[] }) {
  const { iglesia } = useSesion();
  const { config } = useLectura();
  const [params, setParams] = useSearchParams();
  const hoy = hoyISO();
  const proximos = lista.filter((e) => (e.fechaFin || e.fecha) >= hoy);
  const e = lista.find((x) => x.id === params.get('id')) || proximos[0];
  const inicial = useMemo(
    () => (e ? { etiqueta: e.categoria, titulo: 'Te invitamos', lectura: e.titulo, nota: [e.lugar ? `📍 ${e.lugar}` : '', e.descripcion.slice(0, 200)].filter(Boolean).join(' · '), fecha: textoCuando(e) } : null),
    [e?.id, e?.titulo, e?.descripcion, e?.fecha, e?.hora, e?.lugar],
  );

  if (!e || !inicial) {
    return (
      <section className="tarjeta centrado">
        <p className="suave">Primero crea un evento.</p>
        <Link className="boton primario" to="/m/eventos/nuevo">
          Nuevo evento
        </Link>
      </section>
    );
  }

  return (
    <div className="pila">
      <div className="tarjeta fila-entre">
        <h2>Banner del evento</h2>
        <label>
          Evento
          <select value={e.id} onChange={(ev) => setParams({ id: ev.target.value })}>
            {lista.map((x) => (
              <option key={x.id} value={x.id}>
                {x.titulo} — {formatoCorto(x.fecha)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <GeneradorBanner
        inicial={inicial}
        pie={config.pieBanner}
        imagenesBanco={e.imagen ? [{ id: `evento-${e.id}`, url: e.imagen, titulo: 'Imagen del evento' }, ...config.imagenes] : config.imagenes}
        textoMensaje={() => mensajeEvento(e, iglesia.nombre)}
        nombreArchivo={`evento-${e.titulo.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}`}
        etiquetas={{ etiqueta: 'Tipo', titulo: 'Encabezado', lectura: 'Nombre del evento', nota: 'Detalle', fecha: 'Cuándo' }}
        separarComas={false}
        moduloHistorial="eventos"
      />
    </div>
  );
}
