import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { escucharColeccion } from '../../lib/datos';
import { useSesion } from '../../lib/sesion';
import { formatoCorto } from '../../lib/fechas';
import { RUTA_CARGOS, RUTA_PAGOS, calcularEstado, dinero, resumenDeuda, textoPeriodo, type Cargo, type Pago } from './datos';

/** Cargos y pagos de un usuario (las reglas solo dejan ver los propios, salvo a los pastores). */
export function useCuenta(uid?: string) {
  const [cargos, setCargos] = useState<Cargo[] | null>(null);
  const [pagos, setPagos] = useState<Pago[] | null>(null);
  useEffect(() => {
    if (!uid) return;
    const a = escucharColeccion<Cargo>(RUTA_CARGOS, setCargos, ['diaconoUid', uid]);
    const b = escucharColeccion<Pago>(RUTA_PAGOS, setPagos, ['diaconoUid', uid]);
    return () => {
      a();
      b();
    };
  }, [uid]);
  const estado = useMemo(() => (cargos && pagos ? calcularEstado(cargos, pagos) : null), [cargos, pagos]);
  return { cargos: cargos || [], pagos: pagos || [], estado, cargando: !cargos || !pagos };
}

/** Tarjeta que ve cada diácono al entrar: "Estás al día" o "Debes tanto de tal cosa". */
export function EstadoCuentaResumen() {
  const { perfil } = useSesion();
  const { estado, cargos } = useCuenta(perfil?.uid);
  if (!estado || !cargos.length) return null;
  return (
    <Link to="/m/finanzas" className={`estado-cuenta ${estado.alDia ? 'al-dia' : 'debe'}`}>
      {estado.alDia ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
      <div>
        <strong>{estado.alDia ? '¡Estás al día con tus aportes! 🙌' : `Debes ${dinero(estado.saldo)}`}</strong>
        <span>{estado.alDia ? 'Gracias por tu fidelidad.' : resumenDeuda(estado)}</span>
      </div>
    </Link>
  );
}

/** Página "Mi estado de cuenta". */
export function MiEstadoCuenta({ uid, nombre }: { uid: string; nombre?: string }) {
  const { cargos, pagos, estado, cargando } = useCuenta(uid);
  if (cargando || !estado) return <p className="suave">Cargando…</p>;

  const movimientos = [
    ...cargos.map((c) => ({ fecha: `${c.periodo}-01`, tipo: 'cargo' as const, concepto: c.conceptoNombre, detalle: `${textoPeriodo(c.periodo)}${c.descripcion ? ' · ' + c.descripcion : ''}`, monto: c.monto, id: c.id, adjunto: '' })),
    ...pagos.map((p) => ({ fecha: p.fecha, tipo: 'pago' as const, concepto: p.conceptoNombre, detalle: `${p.metodo}${p.nota ? ' · ' + p.nota : ''}`, monto: p.monto, id: p.id, adjunto: p.comprobante?.url || '' })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="pila">
      <section className={`tarjeta estado-grande ${estado.alDia ? 'al-dia' : 'debe'}`}>
        {estado.alDia ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
        <div>
          {nombre && <small className="suave">{nombre}</small>}
          <h1>{estado.alDia ? 'Al día ✓' : `Debes ${dinero(estado.saldo)}`}</h1>
          <p className="suave">{estado.alDia ? 'No tienes aportes pendientes.' : resumenDeuda(estado)}</p>
        </div>
      </section>

      <section className="tarjeta">
        <h2>Por concepto</h2>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Te tocó</th>
                <th>Aportaste</th>
                <th>Saldo</th>
                <th>Meses pendientes</th>
              </tr>
            </thead>
            <tbody>
              {estado.porConcepto.map((c) => (
                <tr key={c.conceptoId}>
                  <td>{c.conceptoNombre}</td>
                  <td>{dinero(c.cargos)}</td>
                  <td>{dinero(c.pagos)}</td>
                  <td className={c.saldo > 0.004 ? 'texto-error' : 'texto-exito'}>
                    {c.saldo > 0.004 ? `Debes ${dinero(c.saldo)}` : c.saldo < -0.004 ? `A favor ${dinero(-c.saldo)}` : 'Al día'}
                  </td>
                  <td>{c.pendientes.map((p) => `${textoPeriodo(p.cargo.periodo)} (${dinero(p.pendiente)})`).join(', ') || '—'}</td>
                </tr>
              ))}
              {!estado.porConcepto.length && (
                <tr>
                  <td colSpan={5} className="suave">
                    Aún no tienes cargos asignados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tarjeta">
        <h2>Movimientos</h2>
        <ul className="movimientos">
          {movimientos.map((m) => (
            <li key={m.tipo + m.id}>
              <span className={`chip ${m.tipo === 'pago' ? 'chip-exito' : ''}`}>{m.tipo === 'pago' ? 'Aporte' : 'Cargo'}</span>
              <div className="dia-info">
                <strong>{m.concepto}</strong>
                <small>
                  {m.tipo === 'pago' ? formatoCorto(m.fecha) + ' · ' : ''}
                  {m.detalle}
                  {m.adjunto && (
                    <a
                      className="adjunto"
                      href={m.adjunto}
                      {...(m.adjunto.startsWith('data:') ? { download: 'comprobante.jpg' } : { target: '_blank', rel: 'noopener noreferrer' })}
                    >
                      {' '}
                      · ver comprobante
                    </a>
                  )}
                </small>
              </div>
              <strong className={m.tipo === 'pago' ? 'texto-exito' : ''}>
                {m.tipo === 'pago' ? '−' : '+'}
                {dinero(m.monto)}
              </strong>
            </li>
          ))}
          {!movimientos.length && <li className="suave">Sin movimientos.</li>}
        </ul>
      </section>
    </div>
  );
}
