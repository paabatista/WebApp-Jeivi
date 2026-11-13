import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, Paperclip, Send, Trash2, XCircle } from 'lucide-react';
import { borrarDoc, escucharColeccion, guardarDoc } from '../../lib/datos';
import { STORAGE_ACTIVO, guardarComprobante } from '../../lib/almacen';
import { nuevoId } from '../../lib/enlaces';
import { explicarError } from '../../lib/errores';
import { formatoCorto, hoyISO } from '../../lib/fechas';
import { useSesion } from '../../lib/sesion';
import { IGLESIA_ID } from '../../lib/firebase';
import { METODOS, RUTA_CONCEPTOS, RUTA_PAGOS, dinero, redondear, type Comprobante, type Concepto, type EstadoCuenta, type Pago } from './datos';

/**
 * Pagos que reporta el propio diácono ("ya pagué la luz de noviembre").
 * Siempre con comprobante (foto o PDF del recibo o la transferencia).
 * Quedan "en revisión" hasta que un pastor los confirma; recién ahí cuentan como aporte.
 */
export type EstadoReporte = 'pendiente' | 'confirmado' | 'rechazado';

export interface ReportePago {
  id: string;
  diaconoUid: string;
  diaconoNombre: string;
  conceptoId: string;
  conceptoNombre: string;
  monto: number;
  fecha: string;
  metodo: Pago['metodo'];
  referencia: string;
  comprobante: Comprobante;
  estado: EstadoReporte;
  creado: string;
  /** Al confirmar: el aporte creado. Al rechazar: el motivo. */
  pagoId?: string;
  motivo?: string;
  revisadoPor?: string;
  revisadoPorNombre?: string;
  revisado?: string;
}

export const RUTA_REPORTES = `iglesias/${IGLESIA_ID}/finReportes`;

/** Reportes de un diácono (uid) o todos (pastores). */
export function useReportes(uid?: string | null) {
  const [lista, setLista] = useState<ReportePago[] | null>(null);
  useEffect(() => {
    if (uid === null) return;
    return escucharColeccion<ReportePago>(RUTA_REPORTES, (d) => setLista([...d].sort((a, b) => b.creado.localeCompare(a.creado))), uid ? ['diaconoUid', uid] : undefined);
  }, [uid]);
  return lista;
}

const ESTADO: Record<EstadoReporte, { texto: string; clase: string; Icono: typeof Clock }> = {
  pendiente: { texto: 'En revisión', clase: 'chip-aviso', Icono: Clock },
  confirmado: { texto: 'Confirmado', clase: 'chip-exito', Icono: CheckCircle2 },
  rechazado: { texto: 'Rechazado', clase: 'chip-error', Icono: XCircle },
};

function Adjunto({ c }: { c: Comprobante }) {
  const interno = c.url.startsWith('data:');
  return (
    <a className="adjunto" href={c.url} {...(interno ? { download: c.nombre || 'comprobante.jpg' } : { target: '_blank', rel: 'noopener noreferrer' })}>
      <Paperclip size={14} /> comprobante
    </a>
  );
}

/* ================= Diácono: reportar un pago ================= */

export function ReportarPago({ estado }: { estado: EstadoCuenta }) {
  const { perfil } = useSesion();
  const reportes = useReportes(perfil?.uid || null);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  useEffect(() => escucharColeccion<Concepto>(RUTA_CONCEPTOS, (d) => setConceptos(d.filter((c) => c.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)))), []);

  // Primero lo que debe; luego el resto de conceptos activos.
  const opciones = useMemo(() => {
    const debe = estado.porConcepto.filter((c) => c.saldo > 0.004);
    const ids = new Set(debe.map((c) => c.conceptoId));
    return [...debe.map((c) => ({ id: c.conceptoId, nombre: c.conceptoNombre, saldo: c.saldo })), ...conceptos.filter((c) => !ids.has(c.id)).map((c) => ({ id: c.id, nombre: c.nombre, saldo: 0 }))];
  }, [estado, conceptos]);

  const [abierto, setAbierto] = useState(false);
  const [conceptoId, setConceptoId] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [metodo, setMetodo] = useState<Pago['metodo']>('Yappy');
  const [referencia, setReferencia] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState('');

  function elegirConcepto(id: string) {
    setConceptoId(id);
    const o = opciones.find((x) => x.id === id);
    if (o?.saldo) setMonto(String(redondear(o.saldo)));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    setError('');
    const c = opciones.find((x) => x.id === conceptoId);
    const m = redondear(Number(monto));
    if (!c) return setError('Elige qué estás pagando.');
    if (!(m > 0)) return setError('Escribe el monto que pagaste.');
    if (!fecha || fecha > hoyISO()) return setError('La fecha del pago no puede ser futura.');
    if (!archivo) return setError('Adjunta la foto o PDF del comprobante (recibo, captura de Yappy o de la transferencia). Sin comprobante no se puede reportar.');
    setEnviando(true);
    const id = nuevoId(16);
    try {
      const comprobante = await guardarComprobante(archivo, `Pago reportado · ${perfil.nombre} · ${c.nombre}`, `${RUTA_REPORTES}/${id}`, perfil);
      if (!comprobante.url) throw new Error('No se pudo subir el comprobante. Intenta de nuevo.');
      const r: Omit<ReportePago, 'id'> = {
        diaconoUid: perfil.uid,
        diaconoNombre: perfil.nombre,
        conceptoId: c.id,
        conceptoNombre: c.nombre,
        monto: m,
        fecha,
        metodo,
        referencia: referencia.trim().slice(0, 120),
        comprobante,
        estado: 'pendiente',
        creado: new Date().toISOString(),
      };
      await guardarDoc(`${RUTA_REPORTES}/${id}`, r, false);
      setListo(`Listo: tu pago de ${dinero(m)} (${c.nombre}) quedó en revisión. Cuando un pastor lo confirme, se descuenta de tu saldo.`);
      setMonto('');
      setReferencia('');
      setArchivo(null);
      setAbierto(false);
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setEnviando(false);
    }
  }

  const pendientes = (reportes || []).filter((r) => r.estado === 'pendiente');

  return (
    <section className="tarjeta">
      <div className="fila-entre">
        <div>
          <h2>Reportar un pago</h2>
          <p className="suave pequeno">¿Ya pagaste una cuota? Repórtala con la foto del comprobante; un pastor la revisa y la confirma.</p>
        </div>
        {!abierto && (
          <button className="boton primario" onClick={() => (setAbierto(true), setListo(''))}>
            <Send size={16} /> Reportar pago
          </button>
        )}
      </div>
      {listo && <div className="exito">{listo}</div>}
      {abierto && (
        <form className="formulario" onSubmit={enviar}>
          <div className="fila">
            <label>
              ¿Qué pagaste?
              <select value={conceptoId} onChange={(e) => elegirConcepto(e.target.value)} required>
                <option value="">— Elige —</option>
                {opciones.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                    {o.saldo ? ` (debes ${dinero(o.saldo)})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Monto
              <input type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            </label>
            <label>
              Fecha del pago
              <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} required />
            </label>
            <label>
              Método
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as Pago['metodo'])}>
                {METODOS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            N.º de referencia o nota (opcional)
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={120} placeholder="Ej. Yappy #483920, o 'entregado a la hermana Ana'" />
          </label>
          <div className={`campo-comprobante${archivo ? ' con-archivo' : ''}`}>
            <label className="boton subir-archivo">
              <Paperclip size={16} /> {archivo ? 'Cambiar comprobante' : `Adjuntar comprobante * (${STORAGE_ACTIVO ? 'foto o PDF' : 'foto'})`}
              <input
                type="file"
                accept={STORAGE_ACTIVO ? 'image/*,application/pdf' : 'image/*'}
                hidden
                onChange={(e) => {
                  setArchivo(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
            </label>
            <span className="suave pequeno">
              {archivo ? archivo.name : 'Obligatorio: foto del recibo o captura de la transferencia/Yappy donde se vea la fecha y el monto.'}
            </span>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="acciones">
            <button className="boton primario" disabled={enviando || !archivo} title={archivo ? '' : 'Primero adjunta el comprobante'}>
              <Send size={16} /> {enviando ? 'Enviando…' : 'Enviar para revisión'}
            </button>
            <button type="button" className="boton" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!!reportes?.length && (
        <>
          <h3>Mis pagos reportados {pendientes.length ? <span className="chip chip-aviso">{pendientes.length} en revisión</span> : null}</h3>
          <ul className="movimientos">
            {reportes.slice(0, 12).map((r) => {
              const { texto, clase, Icono } = ESTADO[r.estado];
              return (
                <li key={r.id}>
                  <span className={`chip ${clase} con-icono`}>
                    <Icono size={13} /> {texto}
                  </span>
                  <div className="dia-info">
                    <strong>{r.conceptoNombre}</strong>
                    <small>
                      {formatoCorto(r.fecha)} · {r.metodo}
                      {r.referencia ? ` · ${r.referencia}` : ''} · <Adjunto c={r.comprobante} />
                      {r.estado === 'rechazado' && r.motivo ? <span className="texto-error"> · Motivo: {r.motivo}</span> : null}
                    </small>
                  </div>
                  <strong>{dinero(r.monto)}</strong>
                  {r.estado === 'pendiente' && (
                    <button className="icono-boton peligro" title="Cancelar este reporte" onClick={() => confirm('¿Cancelar este reporte de pago?') && borrarDoc(`${RUTA_REPORTES}/${r.id}`)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/* ================= Pastor: revisar ================= */

export function RevisarReportes() {
  const { perfil } = useSesion();
  const reportes = useReportes();
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const pendientes = (reportes || []).filter((r) => r.estado === 'pendiente').sort((a, b) => a.creado.localeCompare(b.creado));
  if (!pendientes.length) return null;

  async function confirmar(r: ReportePago) {
    if (!perfil) return;
    setOcupado(r.id);
    setError('');
    const pagoId = `rep-${r.id}`;
    const ahora = new Date().toISOString();
    try {
      const p: Omit<Pago, 'id'> = {
        diaconoUid: r.diaconoUid,
        diaconoNombre: r.diaconoNombre,
        conceptoId: r.conceptoId,
        conceptoNombre: r.conceptoNombre,
        monto: r.monto,
        fecha: r.fecha,
        metodo: r.metodo,
        nota: ['Reportado por el diácono', r.referencia].filter(Boolean).join(' · '),
        comprobante: r.comprobante,
        creado: ahora,
        registradoPor: perfil.uid,
        reporteId: r.id,
      };
      await guardarDoc(`${RUTA_PAGOS}/${pagoId}`, p, false);
      await guardarDoc(`${RUTA_REPORTES}/${r.id}`, { estado: 'confirmado', pagoId, revisadoPor: perfil.uid, revisadoPorNombre: perfil.nombre, revisado: ahora });
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setOcupado('');
    }
  }

  async function rechazar(r: ReportePago) {
    if (!perfil) return;
    const motivo = prompt(`¿Por qué se rechaza el pago de ${r.diaconoNombre} (${dinero(r.monto)})? El diácono verá este motivo.`, 'El comprobante no se ve claro');
    if (motivo === null) return;
    setOcupado(r.id);
    try {
      await guardarDoc(`${RUTA_REPORTES}/${r.id}`, { estado: 'rechazado', motivo: motivo.trim().slice(0, 200), revisadoPor: perfil.uid, revisadoPorNombre: perfil.nombre, revisado: new Date().toISOString() });
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setOcupado('');
    }
  }

  return (
    <section className="tarjeta revisar-reportes">
      <h2 className="con-icono">
        <Clock size={20} /> Pagos reportados por diáconos ({pendientes.length})
      </h2>
      <p className="suave pequeno">Revisa el comprobante. Al confirmar, se registra como aporte y se descuenta de su saldo.</p>
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th>Diácono</th>
              <th>Concepto</th>
              <th>Fecha</th>
              <th>Método / ref.</th>
              <th className="num">Monto</th>
              <th>Comprobante</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pendientes.map((r) => (
              <tr key={r.id}>
                <td>{r.diaconoNombre}</td>
                <td>{r.conceptoNombre}</td>
                <td>{formatoCorto(r.fecha)}</td>
                <td>
                  {r.metodo}
                  {r.referencia ? <span className="suave pequeno"> · {r.referencia}</span> : null}
                </td>
                <td className="num">{dinero(r.monto)}</td>
                <td>
                  <Adjunto c={r.comprobante} />
                </td>
                <td className="acciones-fila">
                  <button className="boton pequeno primario" disabled={!!ocupado} onClick={() => confirmar(r)}>
                    <CheckCircle2 size={14} /> Confirmar
                  </button>
                  <button className="boton pequeno" disabled={!!ocupado} onClick={() => rechazar(r)}>
                    <XCircle size={14} /> Rechazar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <div className="error">{error}</div>}
    </section>
  );
}
