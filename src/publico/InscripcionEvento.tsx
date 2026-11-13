import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import { escucharDoc, guardarDoc } from '../lib/datos';
import { nuevoId, type Enlace } from '../lib/enlaces';
import { Cargando } from '../core/Cargando';
import { RUTA_EVENTOS, RUTA_INSCRIPCIONES, textoCuando, type Evento } from '../modulos/eventos/datos';
import { limpiarTelefono } from '../modulos/lectura/suscriptores';

/** Página pública de un evento con formulario de inscripción. */
export function InscripcionEvento({ enlace }: { enlace: Enlace }) {
  const [evento, setEvento] = useState<Evento | null | undefined>(undefined);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [personas, setPersonas] = useState(1);
  const [nota, setNota] = useState('');
  const [estado, setEstado] = useState<'' | 'enviando' | 'listo'>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enlace.eventoId) return setEvento(null);
    return escucharDoc<Omit<Evento, 'id'>>(`${RUTA_EVENTOS}/${enlace.eventoId}`, (d) => setEvento(d ? { ...d, id: enlace.eventoId! } : null), () => setEvento(null));
  }, [enlace.eventoId]);

  if (evento === undefined) return <Cargando />;
  if (!evento || evento.estado === 'cancelado') {
    return (
      <section className="tarjeta centrado">
        <h1>{evento ? 'Evento cancelado' : 'Evento no disponible'}</h1>
        <p className="suave">Consulta con los diáconos de la iglesia.</p>
      </section>
    );
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    const tel = limpiarTelefono(telefono);
    if (!tel && !email.trim()) return setError('Déjanos un teléfono o correo para contactarte.');
    setEstado('enviando');
    try {
      await guardarDoc(
        `${RUTA_INSCRIPCIONES}/${nuevoId(16)}`,
        {
          eventoId: evento!.id,
          nombre: nombre.trim(),
          telefono: tel,
          email: email.trim().toLowerCase(),
          personas: Math.max(1, Math.min(20, Math.round(personas))),
          nota: nota.trim(),
          enlace: enlace.id,
          creado: new Date().toISOString(),
        },
        false,
      );
      setEstado('listo');
    } catch {
      setEstado('');
      setError('No se pudo guardar tu inscripción. Intenta de nuevo.');
    }
  }

  return (
    <div className="pila">
      <section className="tarjeta evento-detalle">
        {evento.imagen && <img src={evento.imagen} alt="" className="evento-imagen" />}
        <span className="chip">{evento.categoria}</span>
        <h1>{evento.titulo}</h1>
        <ul className="evento-datos">
          <li>
            <CalendarDays size={16} /> {textoCuando(evento)}
          </li>
          {evento.lugar && (
            <li>
              <MapPin size={16} /> {evento.lugar}
            </li>
          )}
        </ul>
        {evento.descripcion && <p className="anuncio-texto">{evento.descripcion}</p>}
      </section>

      {estado === 'listo' ? (
        <section className="tarjeta centrado">
          <h2>¡Inscripción recibida! 🙌</h2>
          <p className="suave">Te esperamos. Si necesitas cambiar algo, comunícate con los diáconos.</p>
        </section>
      ) : !evento.inscripcion ? (
        <section className="tarjeta centrado suave">Este evento no requiere inscripción. ¡Te esperamos!</section>
      ) : (
        <form className="tarjeta formulario" onSubmit={enviar}>
          <h2>Inscríbete</h2>
          <label>
            Nombre completo
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={80} autoComplete="name" />
          </label>
          <div className="fila">
            <label>
              WhatsApp / teléfono
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" maxLength={20} placeholder="6000-0000" />
            </label>
            <label>
              Correo (opcional)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
            </label>
            <label>
              ¿Cuántas personas?
              <input type="number" min={1} max={20} value={personas} onChange={(e) => setPersonas(Number(e.target.value) || 1)} />
            </label>
          </div>
          <label>
            Comentario (opcional)
            <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} placeholder="Ej. llevo 2 niños, necesito transporte…" />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="boton primario" disabled={estado === 'enviando'}>
            {estado === 'enviando' ? 'Enviando…' : 'Inscribirme'}
          </button>
        </form>
      )}
    </div>
  );
}
