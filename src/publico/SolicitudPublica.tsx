import { useState, type FormEvent } from 'react';
import { guardarDoc } from '../lib/datos';
import { nuevoId, type Enlace } from '../lib/enlaces';
import { limpiarTelefono } from '../modulos/lectura/suscriptores';
import { RUTA_SOLICITUDES, TIPOS_SOLICITUD, type Solicitud } from '../modulos/solicitudes/datos';

/** Formulario público de solicitudes (oración, visita, consejería…). */
export function SolicitudPublica({ enlace }: { enlace: Enlace }) {
  const [tipo, setTipo] = useState(TIPOS_SOLICITUD[0]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [confidencial, setConfidencial] = useState(false);
  const [estado, setEstado] = useState<'' | 'enviando' | 'listo'>('');
  const [error, setError] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEstado('enviando');
    const s: Omit<Solicitud, 'id'> = {
      tipo,
      nombre: nombre.trim(),
      telefono: limpiarTelefono(telefono),
      email: email.trim().toLowerCase(),
      mensaje: mensaje.trim(),
      confidencial,
      estado: 'nueva',
      seguimiento: [],
      origen: 'link',
      enlace: enlace.id,
      creado: new Date().toISOString(),
    };
    try {
      await guardarDoc(`${RUTA_SOLICITUDES}/${nuevoId(16)}`, s, false);
      setEstado('listo');
    } catch {
      setEstado('');
      setError('No se pudo enviar. Intenta de nuevo en un momento.');
    }
  }

  if (estado === 'listo') {
    return (
      <section className="tarjeta centrado">
        <h1>Recibimos tu solicitud 🙏</h1>
        <p className="suave">
          {tipo === 'Petición de oración' ? 'Estaremos orando por ti.' : 'Pronto nos pondremos en contacto contigo.'}
        </p>
        <button className="boton" onClick={() => (setEstado(''), setMensaje(''))}>
          Enviar otra
        </button>
      </section>
    );
  }

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h1>🙏 ¿En qué podemos ayudarte?</h1>
      <p className="suave">Tu solicitud llega directamente a los pastores y diáconos de la iglesia.</p>
      <label>
        Tipo de solicitud
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS_SOLICITUD.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Nombre
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
      </div>
      <label>
        Cuéntanos
        <textarea rows={5} value={mensaje} onChange={(e) => setMensaje(e.target.value)} required maxLength={2000} />
      </label>
      <label className="interruptor">
        <input type="checkbox" checked={confidencial} onChange={(e) => setConfidencial(e.target.checked)} />
        <span>Es confidencial: que solo la vean los pastores</span>
      </label>
      {error && <div className="error">{error}</div>}
      <button className="boton primario" disabled={estado === 'enviando'}>
        {estado === 'enviando' ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  );
}
