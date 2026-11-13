import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { escucharDoc } from '../lib/datos';
import { RUTA_ENLACES, type Enlace } from '../lib/enlaces';
import { useSesion } from '../lib/sesion';
import { Cargando } from '../core/Cargando';
import { LecturaPublica } from './LecturaPublica';
import { RegistroCumple } from '../modulos/cumpleanos/RegistroCumple';
import { TableroPublico } from './TableroPublico';
import { InscripcionEvento } from './InscripcionEvento';
import { SolicitudPublica } from './SolicitudPublica';

/** Envoltura de las páginas públicas: marca de la iglesia, sin menú ni login. */
export function MarcoPublico({ children }: { children: ReactNode }) {
  const { iglesia } = useSesion();
  return (
    <div className="publico">
      <header className="publico-cabecera">
        {iglesia.logoUrl ? <img src={iglesia.logoUrl} alt="" /> : <span className="marca-j">J</span>}
        <div>
          <strong>{iglesia.nombre}</strong>
          {iglesia.lema && <small>{iglesia.lema}</small>}
        </div>
      </header>
      <main className="publico-contenido">{children}</main>
      <footer className="publico-pie">
        {iglesia.sitioWeb ? (
          <a href={iglesia.sitioWeb} target="_blank" rel="noopener noreferrer">
            {iglesia.sitioWeb.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          iglesia.nombreCorto
        )}
      </footer>
    </div>
  );
}

export function PaginaPublica() {
  const { token = '' } = useParams();
  const [enlace, setEnlace] = useState<Enlace | null | undefined>(undefined);

  useEffect(
    () => escucharDoc<Omit<Enlace, 'id'>>(`${RUTA_ENLACES}/${token}`, (d) => setEnlace(d ? { ...d, id: token } : null), () => setEnlace(null)),
    [token],
  );

  if (enlace === undefined) return <Cargando />;
  if (!enlace || !enlace.activo) {
    return (
      <MarcoPublico>
        <section className="tarjeta centrado">
          <h1>Link no disponible</h1>
          <p className="suave">Este link ya no está activo. Pide uno nuevo a los diáconos de la iglesia.</p>
        </section>
      </MarcoPublico>
    );
  }

  return (
    <MarcoPublico>
      {enlace.modulo === 'lectura' && <LecturaPublica enlace={enlace} />}
      {enlace.modulo === 'cumpleanos' && <RegistroCumple enlace={enlace} />}
      {enlace.modulo === 'anuncios' && <TableroPublico enlace={enlace} />}
      {enlace.modulo === 'eventos' && <InscripcionEvento enlace={enlace} />}
      {enlace.modulo === 'solicitudes' && <SolicitudPublica enlace={enlace} />}
    </MarcoPublico>
  );
}
