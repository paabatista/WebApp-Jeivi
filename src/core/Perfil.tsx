import { useState } from 'react';
import { Layout } from './Layout';
import { useSesion } from '../lib/sesion';
import { ETIQUETA_ROL } from '../lib/roles';

export function Perfil() {
  const { perfil, actualizarPerfil } = useSesion();
  const [nombre, setNombre] = useState(perfil?.nombre || '');
  const [whatsapp, setWhatsapp] = useState(perfil?.whatsapp || '');
  const [guardado, setGuardado] = useState('');
  if (!perfil) return null;

  async function guardar() {
    await actualizarPerfil({ nombre: nombre.trim(), whatsapp: whatsapp.replace(/[^\d+]/g, '') });
    setGuardado('Cambios guardados.');
    setTimeout(() => setGuardado(''), 2500);
  }

  return (
    <Layout>
      <section className="tarjeta estrecha">
        <h1>Mi perfil</h1>
        <p className="suave">
          {perfil.email} · <span className="chip">{ETIQUETA_ROL[perfil.rol]}</span>
        </p>
        <div className="formulario">
          <label>
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label>
            WhatsApp (opcional)
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+507 6000-0000" inputMode="tel" />
            <small className="suave">Para que los líderes puedan contactarte.</small>
          </label>
          <button className="boton primario" onClick={guardar}>
            Guardar
          </button>
          {guardado && <div className="exito">{guardado}</div>}
        </div>

        <hr />
        <h2>Lectura diaria por correo</h2>
        <p className="suave">
          Cada mañana (lunes a viernes) te llega a <strong>{perfil.email}</strong> la lectura del día con un botón para
          reenviarla por WhatsApp a tus hermanos y grupos.
        </p>
        <label className="interruptor">
          <input
            type="checkbox"
            checked={!!perfil.suscritoCorreo}
            onChange={(e) => actualizarPerfil({ suscritoCorreo: e.target.checked })}
          />
          <span>{perfil.suscritoCorreo ? 'Suscrito: recibirás la lectura cada día' : 'No suscrito'}</span>
        </label>
      </section>
    </Layout>
  );
}
