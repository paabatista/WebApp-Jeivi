import { useEffect, useState } from 'react';
import { Copy, Link2, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { borrarDoc, escucharColeccion, guardarDoc } from '../lib/datos';
import { useSesion } from '../lib/sesion';
import { DESCRIPCION_ENLACE, RUTA_ENLACES, crearEnlace, urlEnlace, type Enlace, type ModuloEnlace } from '../lib/enlaces';
import { formatoCorto } from '../lib/fechas';

/** Lista y crea los links públicos de un módulo (para compartir por WhatsApp). */
export function GestorEnlaces({ modulo, mensaje }: { modulo: ModuloEnlace; mensaje: string }) {
  const { perfil, iglesia, puede } = useSesion();
  const [enlaces, setEnlaces] = useState<Enlace[]>([]);
  const [titulo, setTitulo] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(
    () => escucharColeccion<Enlace>(RUTA_ENLACES, (d) => setEnlaces([...d].sort((a, b) => b.creado.localeCompare(a.creado))), ['modulo', modulo]),
    [modulo],
  );

  async function crear() {
    if (!perfil) return;
    await crearEnlace(modulo, titulo, perfil);
    setTitulo('');
  }

  async function copiar(e: Enlace) {
    try {
      await navigator.clipboard.writeText(urlEnlace(e.id));
      setAviso('Link copiado.');
    } catch {
      setAviso(urlEnlace(e.id));
    }
    setTimeout(() => setAviso(''), 2500);
  }

  const textoWa = (e: Enlace) => `${mensaje}\n\n👉 ${urlEnlace(e.id)}\n\n${iglesia.nombre}`;

  return (
    <section className="tarjeta">
      <h2 className="con-icono">
        <Link2 size={20} /> Link para compartir
      </h2>
      <p className="suave">
        {DESCRIPCION_ENLACE[modulo]}. Quien lo abra no necesita cuenta y solo ve ese formulario. Puedes desactivarlo cuando quieras.
      </p>
      <ul className="lista-enlaces">
        {enlaces.map((e) => (
          <li key={e.id} className={e.activo ? '' : 'inactivo'}>
            <div className="enlace-info">
              <strong>{e.titulo}</strong>
              <small className="suave">
                {urlEnlace(e.id)} · {e.creadoPorNombre} · {formatoCorto(e.creado.slice(0, 10))}
              </small>
            </div>
            <div className="acciones">
              {e.activo && (
                <>
                  <a className="boton whatsapp pequeno" href={`https://wa.me/?text=${encodeURIComponent(textoWa(e))}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                  <button className="boton pequeno" onClick={() => copiar(e)}>
                    <Copy size={16} /> Copiar
                  </button>
                </>
              )}
              <label className="interruptor">
                <input type="checkbox" checked={e.activo} onChange={(ev) => guardarDoc(`${RUTA_ENLACES}/${e.id}`, { activo: ev.target.checked })} />
                <span>{e.activo ? 'Activo' : 'Desactivado'}</span>
              </label>
              {puede('pastor') && (
                <button
                  className="icono-boton peligro"
                  title="Eliminar"
                  onClick={() => confirm('¿Eliminar este link? Dejará de funcionar.') && borrarDoc(`${RUTA_ENLACES}/${e.id}`)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </li>
        ))}
        {!enlaces.length && <li className="suave">Todavía no hay links. Crea uno abajo.</li>}
      </ul>
      <div className="fila">
        <label>
          Nombre del link (opcional)
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Congregación, Grupo de jóvenes" />
        </label>
        <button className="boton primario" onClick={crear}>
          <Plus size={16} /> Crear link
        </button>
      </div>
      {aviso && <div className="exito">{aviso}</div>}
    </section>
  );
}
