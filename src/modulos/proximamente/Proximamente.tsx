import { Link } from 'react-router-dom';
import { Layout } from '../../core/Layout';
import { IconoModulo } from '../../core/IconoModulo';
import type { Modulo } from '../../core/modulos';

export function Proximamente({ modulo }: { modulo: Modulo }) {
  return (
    <Layout modulo={modulo}>
      <section className="tarjeta proximamente">
        <IconoModulo modulo={modulo} tam={88} />
        <h1>{modulo.nombre}</h1>
        <p className="suave">{modulo.descripcion}</p>
        <span className="chip">En desarrollo</span>
        {modulo.funciones && (
          <ul className="lista-check">
            {modulo.funciones.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        <Link to="/" className="boton">
          Volver a las apps
        </Link>
      </section>
    </Layout>
  );
}
