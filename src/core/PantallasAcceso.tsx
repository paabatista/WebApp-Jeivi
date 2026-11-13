import { useState } from 'react';
import { MailCheck, ShieldOff } from 'lucide-react';
import { useSesion, mensajeErrorAuth } from '../lib/sesion';

function Marco({ children }: { children: React.ReactNode }) {
  const { iglesia } = useSesion();
  return (
    <div className="login">
      <div className="login-caja">
        <div className="login-marca">
          {iglesia.logoUrl ? <img src={iglesia.logoUrl} alt="" /> : <span className="marca-j grande">J</span>}
          <h1>Jeivi</h1>
          <p>{iglesia.nombre}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Se registró con correo y contraseña: debe confirmar su correo antes de entrar. */
export function PantallaVerificar() {
  const { usuario, reenviarVerificacion, comprobarVerificacion, salir } = useSesion();
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function comprobar() {
    setError('');
    setMsg('');
    try {
      if (!(await comprobarVerificacion())) setError('Aún no aparece confirmado. Abre el enlace del correo y vuelve a intentar.');
    } catch (e) {
      setError(mensajeErrorAuth(e));
    }
  }

  async function reenviar() {
    setError('');
    try {
      await reenviarVerificacion();
      setMsg('Te enviamos otro correo. Revisa también la carpeta de spam.');
    } catch (e) {
      setError(mensajeErrorAuth(e));
    }
  }

  return (
    <Marco>
      <div className="centrado">
        <MailCheck size={40} className="texto-acento" />
        <h2>Confirma tu correo</h2>
        <p className="suave">
          Te enviamos un enlace a <strong>{usuario?.email}</strong>. Ábrelo y luego toca “Ya lo confirmé”.
        </p>
      </div>
      {msg && <div className="exito">{msg}</div>}
      {error && <div className="error">{error}</div>}
      <button className="boton primario ancho" onClick={comprobar}>
        Ya lo confirmé
      </button>
      <div className="login-enlaces">
        <button onClick={reenviar}>Reenviar correo</button>
        <button onClick={() => salir()}>Usar otra cuenta</button>
      </div>
    </Marco>
  );
}

/** Inició sesión con un correo que nadie invitó. */
export function PantallaSinInvitacion() {
  const { usuario, salir } = useSesion();
  return (
    <Marco>
      <div className="centrado">
        <ShieldOff size={40} className="texto-error" />
        <h2>Tu correo no tiene acceso</h2>
        <p className="suave">
          <strong>{usuario?.email}</strong> no fue invitado a Jeivi. Pide a un pastor que te invite con este mismo correo y vuelve a entrar.
        </p>
      </div>
      <button className="boton primario ancho" onClick={() => salir()}>
        Salir
      </button>
    </Marco>
  );
}
