import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { escucharColeccion } from '../lib/datos';
import type { Enlace } from '../lib/enlaces';
import { hoyISO } from '../lib/fechas';
import { useSesion } from '../lib/sesion';
import { Cargando } from '../core/Cargando';
import { RUTA_ANUNCIOS, mensajeAnuncio, ordenarAnuncios, vigente, type Anuncio } from '../modulos/anuncios/datos';
import { FormSuscripcion } from './FormSuscripcion';

/** Tablero informativo que ve la congregación al abrir el link de anuncios. */
export function TableroPublico({ enlace }: { enlace: Enlace }) {
  const { iglesia } = useSesion();
  const [lista, setLista] = useState<Anuncio[] | null>(null);
  useEffect(
    () =>
      escucharColeccion<Anuncio>(
        RUTA_ANUNCIOS,
        (d) => setLista(ordenarAnuncios(d.filter((a) => vigente(a, hoyISO())))),
        ['publico', true],
      ),
    [],
  );

  if (!lista) return <Cargando />;

  return (
    <div className="pila">
      <section className="tarjeta">
        <h1>📢 Tablero informativo</h1>
        <p className="suave">Anuncios y actividades de {iglesia.nombreCorto}.</p>
      </section>
      {lista.map((a) => (
        <article key={a.id} className={`anuncio ${a.destacado ? 'destacado' : ''}`}>
          {a.imagen && <img src={a.imagen} alt="" />}
          <div className="anuncio-cuerpo">
            <span className="chip">{a.categoria}</span>
            <h3>{a.titulo}</h3>
            {a.cuando && <p className="anuncio-cuando">🗓️ {a.cuando}</p>}
            <p className="anuncio-texto">{a.texto}</p>
            <div className="acciones">
              <a className="boton whatsapp pequeno" href={`https://wa.me/?text=${encodeURIComponent(mensajeAnuncio(a, iglesia.nombre))}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={14} /> Compartir
              </a>
            </div>
          </div>
        </article>
      ))}
      {!lista.length && <p className="tarjeta suave centrado">No hay anuncios en este momento.</p>}
      <FormSuscripcion enlace={enlace} tema="anuncios" titulo="Recibe los avisos" descripcion="Te avisaremos de cultos especiales, actividades y noticias de la iglesia." />
    </div>
  );
}
