import { useState, type FormEvent } from 'react';
import { useSesion, mensajeErrorAuth } from '../lib/sesion';
import { firebaseConfigurado } from '../lib/firebase';

type Modo = 'entrar' | 'registro' | 'recuperar';

export function Login() {
  const { iglesia, aviso, entrarGoogle, entrarMicrosoft, entrarCorreo, registrarCorreo, recuperarClave } = useSesion();
  const [modo, setModo] = useState<Modo>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function ejecutar(fn: () => Promise<void>) {
    setError('');
    setInfo('');
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      setError(mensajeErrorAuth(e));
    } finally {
      setOcupado(false);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (modo === 'entrar') ejecutar(() => entrarCorreo(email, clave));
    else if (modo === 'registro') ejecutar(() => registrarCorreo(nombre, email, clave));
    else
      ejecutar(async () => {
        await recuperarClave(email);
        setInfo('Te enviamos un correo para restablecer tu contraseña.');
      });
  }

  return (
    <div className="login">
      <div className="login-caja">
        <div className="login-marca">
          {iglesia.logoUrl ? <img src={iglesia.logoUrl} alt="" /> : <span className="marca-j grande">J</span>}
          <h1>Jeivi</h1>
          <p>{iglesia.nombre}</p>
        </div>

        {aviso && <div className="aviso">{aviso}</div>}
        {modo === 'registro' && (
          <div className="aviso">Solo pueden crear cuenta los correos que un pastor invitó. Usa ese mismo correo; te llegará un enlace para confirmarlo.</div>
        )}
        {!firebaseConfigurado && (
          <div className="aviso">Firebase no está configurado. Copia .env.example a .env y completa los datos.</div>
        )}

        {modo !== 'recuperar' && (
          <>
            <button className="boton-proveedor" disabled={ocupado} onClick={() => ejecutar(entrarGoogle)}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Continuar con Google
            </button>
            <button className="boton-proveedor" disabled={ocupado} onClick={() => ejecutar(entrarMicrosoft)}>
              <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Continuar con Microsoft (Outlook / Hotmail)
            </button>
            <div className="separador">o con tu correo</div>
          </>
        )}

        <form onSubmit={enviar} className="formulario">
          {modo === 'registro' && (
            <label>
              Nombre completo
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="name" />
            </label>
          )}
          <label>
            Correo electrónico
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          {modo !== 'recuperar' && (
            <label>
              Contraseña
              <input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                required
                minLength={modo === 'registro' ? 8 : 6}
                autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
              />
            </label>
          )}
          {error && <div className="error">{error}</div>}
          {info && <div className="exito">{info}</div>}
          <button className="boton primario ancho" disabled={ocupado}>
            {modo === 'entrar' ? 'Entrar' : modo === 'registro' ? 'Crear cuenta' : 'Enviar enlace'}
          </button>
        </form>

        <div className="login-enlaces">
          {modo === 'entrar' ? (
            <>
              <button onClick={() => setModo('registro')}>Tengo invitación: crear cuenta</button>
              <button onClick={() => setModo('recuperar')}>Olvidé mi contraseña</button>
            </>
          ) : (
            <button onClick={() => setModo('entrar')}>Ya tengo cuenta — entrar</button>
          )}
        </div>
      </div>
    </div>
  );
}
