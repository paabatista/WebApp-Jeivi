import { useEffect, useState } from 'react';
import { MessageCircle, Trash2 } from 'lucide-react';
import { borrarDoc, escucharColeccion, guardarDoc } from '../lib/datos';
import { formatoCorto } from '../lib/fechas';
import { useSesion } from '../lib/sesion';
import { RUTA_SUSCRIPTORES, numeroWhatsApp, tieneTema, type Suscriptor, type Tema } from '../modulos/lectura/suscriptores';

/** Personas suscritas por link a un tema, con botón para enviarles un mensaje por WhatsApp. */
export function ListaSuscriptores({ tema, mensaje, titulo = 'Suscriptores' }: { tema: Tema; mensaje: string; titulo?: string }) {
  const { puede } = useSesion();
  const [lista, setLista] = useState<Suscriptor[]>([]);
  const [filtro, setFiltro] = useState('');

  useEffect(
    () => escucharColeccion<Suscriptor>(RUTA_SUSCRIPTORES, (d) => setLista(d.filter((s) => tieneTema(s, tema)).sort((a, b) => a.nombre.localeCompare(b.nombre)))),
    [tema],
  );

  const visibles = lista.filter((s) => `${s.nombre} ${s.email} ${s.whatsapp}`.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <section className="tarjeta">
      <div className="fila-entre">
        <div>
          <h2>{titulo}</h2>
          <p className="suave">
            {lista.filter((s) => s.activo && s.email).length} con correo · {lista.filter((s) => s.activo && s.whatsapp).length} con WhatsApp
          </p>
        </div>
        <label>
          Buscar
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nombre, correo o número" />
        </label>
      </div>
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>WhatsApp</th>
              <th>Desde</th>
              <th>Activo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibles.map((s) => (
              <tr key={s.id} className={s.activo ? '' : 'apagado'}>
                <td>{s.nombre}</td>
                <td>{s.email || '—'}</td>
                <td>
                  {s.whatsapp ? (
                    <a className="boton whatsapp pequeno" href={`https://wa.me/${numeroWhatsApp(s.whatsapp)}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={14} /> {s.whatsapp}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{formatoCorto(s.creado.slice(0, 10))}</td>
                <td>
                  <input type="checkbox" checked={s.activo} onChange={(e) => guardarDoc(`${RUTA_SUSCRIPTORES}/${s.id}`, { activo: e.target.checked })} />
                </td>
                <td>
                  {puede('pastor') && (
                    <button className="icono-boton peligro" title="Eliminar" onClick={() => confirm(`¿Eliminar a ${s.nombre}?`) && borrarDoc(`${RUTA_SUSCRIPTORES}/${s.id}`)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!visibles.length && (
              <tr>
                <td colSpan={6} className="suave">
                  Aún no hay suscriptores. Comparte el link de arriba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
