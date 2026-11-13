import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Circle, Image as ImageIcon, MessageCircle, Undo2 } from 'lucide-react';
import { escucharColeccion, guardarDoc } from '../../lib/datos';
import { explicarError } from '../../lib/errores';
import { IGLESIA_ID } from '../../lib/firebase';
import { hoyISO } from '../../lib/fechas';
import { ETIQUETA_ROL } from '../../lib/roles';
import { useSesion, type Perfil } from '../../lib/sesion';
import { numeroWhatsApp } from '../lectura/suscriptores';
import { textoFecha, type Cumple } from './datos';
import { ESTADOS_ENCARGO, RUTA_ENCARGOS, cumplesDelMes, estadoSegun, mesDelEncargo, mesesVisibles, nombreMes, type Encargo } from './encargosDatos';

export function useEncargos() {
  const [encargos, setEncargos] = useState<Encargo[] | null>(null);
  useEffect(() => escucharColeccion<Encargo>(RUTA_ENCARGOS, setEncargos), []);
  return encargos;
}

/**
 * Al compartir o descargar el banner de alguien: lo marca como felicitado en el encargo de su mes
 * (solo si quien lo hace es el encargado o un pastor; si no, no hace nada).
 */
export async function marcarFelicitado(c: Cumple, lista: Cumple[], encargos: Encargo[] | null, perfil: Perfil | null, esPastor: boolean) {
  const e = encargos?.find((x) => x.id === mesDelEncargo(c, hoyISO()));
  if (!e || !perfil || !e.diaconoUid || e.hechos.includes(c.id)) return;
  if (!esPastor && e.diaconoUid !== perfil.uid) return;
  const hechos = [...e.hechos, c.id];
  const delMes = cumplesDelMes(lista, e.mes);
  const estado = e.estado === 'completado' ? 'completado' : estadoSegun(hechos.filter((id) => delMes.some((x) => x.id === id)).length, delMes.length);
  await guardarDoc(`${RUTA_ENCARGOS}/${e.id}`, { hechos, estado, actualizado: new Date().toISOString() }).catch((err) => console.warn('encargo', err));
}

/** Aviso arriba de "Próximos": tu encargo del mes, o que falta asignar. */
export function AvisoEncargo({ lista }: { lista: Cumple[] }) {
  const { perfil, puede } = useSesion();
  const encargos = useEncargos();
  if (!perfil || !encargos) return null;
  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);
  const mios = encargos.filter((e) => e.diaconoUid === perfil.uid && e.estado !== 'completado' && e.mes >= mes).sort((a, b) => a.mes.localeCompare(b.mes));
  const actual = encargos.find((e) => e.mes === mes);
  return (
    <>
      {mios.map((e) => {
        const total = cumplesDelMes(lista, e.mes).length;
        return (
          <Link key={e.id} to="/m/cumpleanos/encargados" className="tarjeta aviso-encargo">
            <ClipboardList size={22} />
            <span>
              <strong>Tienes el encargo de los cumpleaños de {nombreMes(e.mes)}</strong>
              <span className="suave pequeno">
                {' '}
                · {e.hechos.length} de {total} felicitados{e.nota ? ` · ${e.nota}` : ''}
              </span>
            </span>
          </Link>
        );
      })}
      {puede('pastor') && !actual && cumplesDelMes(lista, mes).length > 0 && (
        <Link to="/m/cumpleanos/encargados" className="tarjeta aviso-encargo aviso-falta">
          <ClipboardList size={22} />
          <span>
            <strong>{nombreMes(mes)} no tiene encargado.</strong> <span className="suave pequeno">Asígnale los cumpleaños a un diácono.</span>
          </span>
        </Link>
      )}
    </>
  );
}

export function Encargos({ lista }: { lista: Cumple[] }) {
  const { perfil, puede } = useSesion();
  const encargos = useEncargos();
  const esPastor = puede('pastor');
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  useEffect(
    () =>
      esPastor
        ? escucharColeccion<Perfil>('users', (d) => setUsuarios(d.filter((u) => u.rol !== 'pendiente').sort((a, b) => a.nombre.localeCompare(b.nombre))), ['iglesiaId', IGLESIA_ID])
        : undefined,
    [esPastor],
  );
  const hoy = hoyISO();
  const meses = useMemo(() => mesesVisibles(hoy), [hoy]);
  const [abierto, setAbierto] = useState<string>(hoy.slice(0, 7));

  if (!encargos || !perfil) return null;
  const porMes = new Map(encargos.map((e) => [e.id, e]));
  // Para el diácono: también sus encargos fuera de la ventana visible.
  const extra = encargos.filter((e) => !meses.includes(e.mes) && e.diaconoUid === perfil.uid && e.estado !== 'completado').map((e) => e.mes);

  return (
    <div className="pila">
      <section className="tarjeta">
        <h2 className="con-icono">
          <ClipboardList size={22} /> Encargados de cumpleaños
        </h2>
        <p className="suave">
          {esPastor
            ? 'Cada mes asigna a un diácono para que haga y envíe los banners de los cumpleañeros. Lo ves avanzar como un ticket: cada banner que comparte o descarga marca a esa persona como felicitada.'
            : 'Aquí ves los meses que te asignaron. Cada banner que compartes o descargas marca a esa persona como felicitada.'}
        </p>
      </section>
      {[...extra, ...meses].map((m) => (
        <TicketMes key={m} mes={m} encargo={porMes.get(m)} cumples={cumplesDelMes(lista, m)} usuarios={usuarios} abierto={abierto === m} alAbrir={() => setAbierto(abierto === m ? '' : m)} />
      ))}
    </div>
  );
}

function TicketMes({
  mes,
  encargo,
  cumples,
  usuarios,
  abierto,
  alAbrir,
}: {
  mes: string;
  encargo?: Encargo;
  cumples: Cumple[];
  usuarios: Perfil[];
  abierto: boolean;
  alAbrir: () => void;
}) {
  const { perfil, puede, iglesia } = useSesion();
  const esPastor = puede('pastor');
  const esMio = !!encargo && encargo.diaconoUid === perfil?.uid;
  const [nota, setNota] = useState(encargo?.nota || '');
  const [error, setError] = useState('');
  useEffect(() => setNota(encargo?.nota || ''), [encargo?.nota]);

  const hechos = encargo?.hechos.filter((id) => cumples.some((c) => c.id === id)) || [];
  const pasado = mes < hoyISO().slice(0, 7);

  async function asignar(uid: string) {
    if (!perfil) return;
    setError('');
    try {
      if (!uid) {
        if (encargo && confirm(`¿Quitar el encargo de ${nombreMes(mes)} a ${encargo.diaconoNombre}?`))
          await guardarDoc(`${RUTA_ENCARGOS}/${mes}`, { ...sinId(encargo), diaconoUid: '', diaconoNombre: '', actualizado: new Date().toISOString() }, false);
        return;
      }
      const u = usuarios.find((x) => x.uid === uid);
      if (!u) return;
      const ahora = new Date().toISOString();
      const datos: Omit<Encargo, 'id'> = {
        mes,
        diaconoUid: u.uid,
        diaconoNombre: u.nombre,
        asignadoPor: perfil.uid,
        asignadoPorNombre: perfil.nombre,
        nota: nota.trim(),
        estado: encargo?.estado || 'pendiente',
        hechos: encargo?.hechos || [],
        creado: encargo?.creado || ahora,
        actualizado: ahora,
      };
      await guardarDoc(`${RUTA_ENCARGOS}/${mes}`, datos, false);
    } catch (err) {
      setError(explicarError(err));
    }
  }

  async function guardarNota() {
    if (!encargo || nota.trim() === encargo.nota) return;
    try {
      await guardarDoc(`${RUTA_ENCARGOS}/${mes}`, { nota: nota.trim(), actualizado: new Date().toISOString() });
    } catch (err) {
      setError(explicarError(err));
    }
  }

  async function alternar(c: Cumple) {
    if (!encargo) return;
    const ya = encargo.hechos.includes(c.id);
    const nuevos = ya ? encargo.hechos.filter((x) => x !== c.id) : [...encargo.hechos, c.id];
    const total = cumples.length;
    try {
      await guardarDoc(`${RUTA_ENCARGOS}/${mes}`, {
        hechos: nuevos,
        estado: estadoSegun(nuevos.filter((id) => cumples.some((x) => x.id === id)).length, total),
        actualizado: new Date().toISOString(),
      });
    } catch (err) {
      setError(explicarError(err));
    }
  }

  async function cerrar(completado: boolean) {
    if (!encargo) return;
    try {
      await guardarDoc(`${RUTA_ENCARGOS}/${mes}`, {
        estado: completado ? 'completado' : estadoSegun(hechos.length, cumples.length),
        actualizado: new Date().toISOString(),
      });
    } catch (err) {
      setError(explicarError(err));
    }
  }

  const estado = encargo?.diaconoUid ? encargo.estado : null;
  const pct = cumples.length ? Math.round((hechos.length / cumples.length) * 100) : 0;
  const puedeMarcar = esPastor || esMio;
  const mensajeAviso = encargo?.diaconoUid
    ? `Hola ${encargo.diaconoNombre.split(' ')[0]} 🙌 Te toca el encargo de los cumpleaños de ${nombreMes(mes)} (${cumples.length} cumpleañero${cumples.length === 1 ? '' : 's'}). ` +
      `Entra a Jeivi → Cumpleaños → Encargados para hacer y enviar los banners.${encargo.nota ? ` Nota: ${encargo.nota}` : ''} ${location.origin}/m/cumpleanos/encargados`
    : '';
  const tel = usuarios.find((u) => u.uid === encargo?.diaconoUid)?.whatsapp;

  return (
    <section className={`tarjeta ticket${esMio ? ' ticket-mio' : ''}${pasado ? ' ticket-pasado' : ''}`}>
      <button type="button" className="ticket-cabecera" onClick={alAbrir}>
        <div>
          <h3>
            {nombreMes(mes)} <span className="suave pequeno">· {cumples.length} cumpleañero{cumples.length === 1 ? '' : 's'}</span>
          </h3>
          <span className="suave pequeno">
            {encargo?.diaconoUid ? (
              <>
                Encargado: <strong>{encargo.diaconoNombre}</strong>
                {esMio ? ' (tú)' : ''}
              </>
            ) : (
              'Sin encargado'
            )}
          </span>
        </div>
        <div className="ticket-estado">
          {estado && <span className={`chip encargo-${estado}`}>{ESTADOS_ENCARGO[estado]}</span>}
          {encargo?.diaconoUid && cumples.length > 0 && (
            <span className="suave pequeno">
              {hechos.length}/{cumples.length}
            </span>
          )}
        </div>
      </button>
      {encargo?.diaconoUid && cumples.length > 0 && (
        <div className="barra-progreso">
          <span style={{ width: `${pct}%` }} />
        </div>
      )}

      {abierto && (
        <div className="pila ticket-cuerpo">
          {esPastor && (
            <div className="fila">
              <label>
                Encargado
                <select value={encargo?.diaconoUid || ''} onChange={(e) => asignar(e.target.value)}>
                  <option value="">— Sin asignar —</option>
                  {usuarios.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.nombre} ({ETIQUETA_ROL[u.rol]})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nota para el encargado (opcional)
                <input value={nota} onChange={(e) => setNota(e.target.value)} onBlur={guardarNota} placeholder="Ej. Usar el fondo Realeza y enviar al grupo general" maxLength={200} />
              </label>
            </div>
          )}
          {!esPastor && encargo?.nota && <div className="aviso">Nota: {encargo.nota}</div>}
          {esPastor && encargo?.diaconoUid && (
            <a className="boton whatsapp pequeno" href={`https://wa.me/${tel ? numeroWhatsApp(tel) : ''}?text=${encodeURIComponent(mensajeAviso)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} /> Avisarle por WhatsApp
            </a>
          )}
          {encargo?.asignadoPorNombre && encargo.diaconoUid && (
            <p className="suave pequeno">
              Asignado por {encargo.asignadoPorNombre} · {iglesia.nombre}
            </p>
          )}

          {cumples.length ? (
            <ul className="lista-ticket">
              {cumples.map((c) => {
                const hecho = !!encargo?.hechos.includes(c.id);
                return (
                  <li key={c.id} className={hecho ? 'hecho' : ''}>
                    <button
                      type="button"
                      className="icono-boton"
                      disabled={!encargo?.diaconoUid || !puedeMarcar}
                      title={hecho ? 'Desmarcar' : 'Marcar como felicitado'}
                      onClick={() => alternar(c)}
                    >
                      {hecho ? <CheckCircle2 size={20} className="texto-exito" /> : <Circle size={20} />}
                    </button>
                    <span className="ticket-persona">
                      <strong>{c.nombre}</strong> <span className="suave pequeno">· {textoFecha(c)}</span>
                    </span>
                    <Link className="boton pequeno" to={`/m/cumpleanos/banner?id=${c.id}`}>
                      <ImageIcon size={14} /> Banner
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="suave">No hay cumpleaños registrados en este mes.</p>
          )}

          {encargo?.diaconoUid && puedeMarcar && cumples.length > 0 && (
            <div className="acciones">
              {encargo.estado !== 'completado' ? (
                <button className="boton" onClick={() => cerrar(true)}>
                  <CheckCircle2 size={16} /> Marcar el mes como terminado
                </button>
              ) : (
                <button className="boton" onClick={() => cerrar(false)}>
                  <Undo2 size={16} /> Reabrir
                </button>
              )}
            </div>
          )}
          {error && <div className="error">{error}</div>}
        </div>
      )}
    </section>
  );
}

function sinId(e: Encargo): Omit<Encargo, 'id'> {
  const { id: _id, ...resto } = e;
  return resto;
}
