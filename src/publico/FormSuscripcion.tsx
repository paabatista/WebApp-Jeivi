import { useState, type FormEvent } from 'react';
import { guardarDoc } from '../lib/datos';
import { nuevoId, type Enlace } from '../lib/enlaces';
import { RUTA_SUSCRIPTORES, limpiarTelefono, type Tema } from '../modulos/lectura/suscriptores';

/** Formulario público para suscribirse (correo y/o WhatsApp) a un tema. */
export function FormSuscripcion({ enlace, tema, titulo, descripcion }: { enlace: Enlace; tema: Tema; titulo: string; descripcion: string }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [estado, setEstado] = useState<'' | 'enviando' | 'listo'>('');
  const [error, setError] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    const correo = email.trim().toLowerCase();
    const tel = limpiarTelefono(whatsapp);
    if (!correo && !tel) return setError('Escribe tu correo o tu número de WhatsApp.');
    setEstado('enviando');
    try {
      await guardarDoc(
        `${RUTA_SUSCRIPTORES}/${nuevoId(16)}`,
        { nombre: nombre.trim(), email: correo, whatsapp: tel, enlace: enlace.id, activo: true, creado: new Date().toISOString(), temas: [tema] },
        false,
      );
      setEstado('listo');
    } catch {
      setEstado('');
      setError('No se pudo guardar. Intenta de nuevo en un momento.');
    }
  }

  if (estado === 'listo') {
    return (
      <section className="tarjeta centrado">
        <h2>¡Listo, {nombre.split(' ')[0]}! 🙌</h2>
        <p className="suave">{email ? 'Te llegarán los avisos a tu correo.' : 'Los diáconos te enviarán los avisos por WhatsApp.'}</p>
      </section>
    );
  }

  return (
    <section className="tarjeta">
      <h2>{titulo}</h2>
      <p className="suave">{descripcion}</p>
      <form className="formulario" onSubmit={enviar}>
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={80} autoComplete="name" />
        </label>
        <div className="fila">
          <label>
            Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" />
          </label>
          <label>
            WhatsApp
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="6000-0000" inputMode="tel" maxLength={20} />
          </label>
        </div>
        <small className="suave">Basta con uno de los dos.</small>
        {error && <div className="error">{error}</div>}
        <button className="boton primario" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Guardando…' : 'Suscribirme'}
        </button>
      </form>
    </section>
  );
}
