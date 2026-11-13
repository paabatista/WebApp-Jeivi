import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Trash2 } from 'lucide-react';
import { GestorEnlaces } from '../../core/GestorEnlaces';
import { borrarDoc, escucharColeccion, guardarDoc } from '../../lib/datos';
import { capitalizar, formatoCorto, formatoLargo } from '../../lib/fechas';
import { useSesion } from '../../lib/sesion';
import { DIAS_SEMANA } from './plan';
import { useLectura } from './useLectura';
import { RUTA_SUSCRIPTORES, numeroWhatsApp, tieneTema, type Suscriptor } from './suscriptores';

/** Link público de la lectura + lista de personas suscritas (para enviarles la lectura por WhatsApp). */
export function SuscriptoresLectura() {
  const { iglesia, puede } = useSesion();
  const lect = useLectura();
  const [lista, setLista] = useState<Suscriptor[]>([]);
  const [filtro, setFiltro] = useState('');

  useEffect(
    () => escucharColeccion<Suscriptor>(RUTA_SUSCRIPTORES, (d) => setLista(d.filter((s) => tieneTema(s, 'lectura')).sort((a, b) => a.nombre.localeCompare(b.nombre)))),
    [],
  );

  const mensajeHoy = useMemo(() => {
    const e = lect.estado;
    if (e.tipo !== 'lectura') return `📖 ${lect.config.mensajeFinDeSemana}\n\n${iglesia.nombre}`;
    const nota = lect.notaDe(e.dia);
    return [
      '📖 *Hoy toca*',
      capitalizar(formatoLargo(lect.hoy)),
      '',
      `*${lect.lecturaDe(e.dia)}*`,
      nota ? `_${nota}_` : '',
      '',
      `Semana ${e.dia.semana} · ${DIAS_SEMANA[e.dia.dia - 1]} · Plan «La Biblia en 6 meses»`,
      iglesia.nombre,
    ]
      .filter((l, i, a) => l !== '' || a[i - 1] !== '')
      .join('\n');
  }, [lect.estado, lect.ajustes, lect.hoy, iglesia.nombre]);

  const visibles = lista.filter((s) => `${s.nombre} ${s.email} ${s.whatsapp}`.toLowerCase().includes(filtro.toLowerCase()));
  const conWa = lista.filter((s) => s.activo && s.whatsapp).length;
  const conCorreo = lista.filter((s) => s.activo && s.email).length;

  return (
    <div className="pila">
      <GestorEnlaces
        modulo="lectura"
        mensaje="📖 Te invitamos a leer la Biblia completa en 6 meses junto a la iglesia. Abre el link para ver la lectura de hoy y suscribirte:"
      />
      <section className="tarjeta">
        <div className="fila-entre">
          <div>
            <h2>Suscriptores</h2>
            <p className="suave">
              {conCorreo} reciben la lectura por correo automáticamente · {conWa} con WhatsApp (envíales con el botón verde).
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
                      <a
                        className="boton whatsapp pequeno"
                        href={`https://wa.me/${numeroWhatsApp(s.whatsapp)}?text=${encodeURIComponent(mensajeHoy)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar la lectura de hoy"
                      >
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
    </div>
  );
}
