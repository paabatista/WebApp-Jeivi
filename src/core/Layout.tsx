import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, LogOut, UserRound } from 'lucide-react';
import { useSesion } from '../lib/sesion';
import { ETIQUETA_ROL } from '../lib/roles';
import { MODO_DEMO } from '../lib/datos';
import type { Modulo } from './modulos';

export interface Pestana {
  a: string;
  texto: string;
  fin?: boolean;
}

export function Layout({ modulo, pestanas, children }: { modulo?: Modulo; pestanas?: Pestana[]; children: ReactNode }) {
  const { perfil, iglesia, salir, porCerrar, seguirConectado } = useSesion();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    const cerrar = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener('click', cerrar);
    return () => document.removeEventListener('click', cerrar);
  }, []);

  return (
    <div className="app">
      <header className="barra">
        <Link to="/" className="barra-inicio" title="Todas las apps">
          <LayoutGrid size={20} />
        </Link>
        <Link to="/" className="barra-marca">
          {iglesia.logoUrl ? <img src={iglesia.logoUrl} alt="" /> : <span className="marca-j">J</span>}
          <span className="marca-texto">{modulo ? modulo.nombre : 'Jeivi'}</span>
        </Link>
        {pestanas && (
          <nav className="pestanas">
            {pestanas.map((p) => (
              <NavLink key={p.a} to={p.a} end={p.fin}>
                {p.texto}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="barra-espacio" />
        {MODO_DEMO && <span className="chip chip-aviso">Modo demo</span>}
        <div className="usuario" ref={ref}>
          <button className="avatar" onClick={() => setMenu((v) => !v)} aria-label="Menú de usuario">
            {perfil?.foto ? <img src={perfil.foto} alt="" referrerPolicy="no-referrer" /> : (perfil?.nombre || '?').charAt(0).toUpperCase()}
          </button>
          {menu && perfil && (
            <div className="menu-usuario">
              <div className="menu-cabecera">
                <strong>{perfil.nombre}</strong>
                <small>{perfil.email}</small>
                <span className="chip">{ETIQUETA_ROL[perfil.rol]}</span>
              </div>
              <button onClick={() => (setMenu(false), nav('/perfil'))}>
                <UserRound size={16} /> Mi perfil y suscripción
              </button>
              <button onClick={() => salir()}>
                <LogOut size={16} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>
      {pestanas && (
        <nav className="pestanas-movil">
          {pestanas.map((p) => (
            <NavLink key={p.a} to={p.a} end={p.fin}>
              {p.texto}
            </NavLink>
          ))}
        </nav>
      )}
      {porCerrar !== null && (
        <div className="aviso-inactividad" role="alert">
          <span>
            Tu sesión se cerrará en {Math.max(1, Math.ceil(porCerrar / 60000))} min por inactividad.
          </span>
          <button className="boton pequeno" onClick={seguirConectado}>
            Seguir conectado
          </button>
        </div>
      )}
      <main className="contenido">{children}</main>
    </div>
  );
}
