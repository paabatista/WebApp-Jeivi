import { Link } from 'react-router-dom';
import { useSesion } from '../lib/sesion';
import { tieneNivel } from '../lib/roles';
import { Layout } from './Layout';
import { MODULOS } from './modulos';
import { IconoModulo } from './IconoModulo';
import { EstadoCuentaResumen } from '../modulos/finanzas/EstadoCuenta';

export function Lanzador() {
  const { perfil, iglesia } = useSesion();
  const visibles = MODULOS.filter(
    (m) => iglesia.modulosActivos.includes(m.id) && tieneNivel(perfil?.rol, m.nivelMinimo),
  );
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <Layout>
      <section className="lanzador">
        <div className="lanzador-saludo">
          <h1>
            {saludo}, {perfil?.nombre.split(' ')[0]}
          </h1>
          <p>{iglesia.nombre}</p>
        </div>
        {perfil?.rol === 'pendiente' && (
          <div className="aviso">
            Tu cuenta está pendiente de aprobación. Un pastor debe aprobarte como diácono para que veas los módulos.
          </div>
        )}
        {perfil && perfil.rol !== 'pendiente' && iglesia.modulosActivos.includes('finanzas') && <EstadoCuentaResumen />}
        <div className="rejilla-apps">
          {visibles.map((m) => (
            <Link key={m.id} to={`/m/${m.id}`} className="app-tile">
              <IconoModulo modulo={m} />
              <span className="app-nombre">{m.nombre}</span>
              {m.estado === 'proximamente' && <span className="app-pronto">Pronto</span>}
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
