import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Download, MessageCircle, Plus, Trash2, X } from 'lucide-react';
import { Layout, type Pestana } from '../../core/Layout';
import { Cargando } from '../../core/Cargando';
import { moduloPorId } from '../../core/modulos';
import { borrarDoc, escucharColeccion, guardarDoc } from '../../lib/datos';
import { nuevoId } from '../../lib/enlaces';
import { IGLESIA_ID } from '../../lib/firebase';
import { formatoCorto, hoyISO } from '../../lib/fechas';
import { useSesion, type Perfil } from '../../lib/sesion';
import { numeroWhatsApp } from '../lectura/suscriptores';
import { MiEstadoCuenta } from './EstadoCuenta';
import {
  CONCEPTOS_SUGERIDOS,
  METODOS,
  RUTA_CARGOS,
  RUTA_CONCEPTOS,
  RUTA_GASTOS,
  RUTA_PAGOS,
  calcularEstado,
  dinero,
  periodoActual,
  redondear,
  repartir,
  resumenDeuda,
  textoPeriodo,
  type CampoLibre,
  type Cargo,
  type Concepto,
  type Gasto,
  type Pago,
} from './datos';
import { exportarExcel } from './exportar';

const modulo = moduloPorId('finanzas')!;

export function FinanzasModulo() {
  const { perfil, puede } = useSesion();
  const pestanas: Pestana[] = [{ a: '/m/finanzas', texto: 'Mi estado de cuenta', fin: true }];
  if (puede('pastor')) {
    pestanas.push(
      { a: '/m/finanzas/resumen', texto: 'Resumen' },
      { a: '/m/finanzas/cargos', texto: 'Cargos' },
      { a: '/m/finanzas/pagos', texto: 'Aportes' },
      { a: '/m/finanzas/gastos', texto: 'Gastos' },
      { a: '/m/finanzas/conceptos', texto: 'Conceptos' },
    );
  }
  return (
    <Layout modulo={modulo} pestanas={pestanas}>
      <Routes>
        <Route index element={perfil ? <MiEstadoCuenta uid={perfil.uid} /> : null} />
        <Route path="*" element={puede('pastor') ? <AdminFinanzas /> : <Navigate to="/m/finanzas" replace />} />
      </Routes>
    </Layout>
  );
}

/* ================= Datos para pastores ================= */

function useFinanzas() {
  const [conceptos, setConceptos] = useState<Concepto[] | null>(null);
  const [cargos, setCargos] = useState<Cargo[] | null>(null);
  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [gastos, setGastos] = useState<Gasto[] | null>(null);
  const [usuarios, setUsuarios] = useState<Perfil[] | null>(null);
  useEffect(() => {
    const fs = [
      escucharColeccion<Concepto>(RUTA_CONCEPTOS, (d) => setConceptos([...d].sort((a, b) => a.nombre.localeCompare(b.nombre)))),
      escucharColeccion<Cargo>(RUTA_CARGOS, setCargos),
      escucharColeccion<Pago>(RUTA_PAGOS, setPagos),
      escucharColeccion<Gasto>(RUTA_GASTOS, setGastos),
      escucharColeccion<Perfil>('users', (d) => setUsuarios(d.filter((u) => u.rol !== 'pendiente').sort((a, b) => a.nombre.localeCompare(b.nombre))), ['iglesiaId', IGLESIA_ID]),
    ];
    return () => fs.forEach((f) => f());
  }, []);
  const listo = conceptos && cargos && pagos && gastos && usuarios;
  return listo ? { conceptos, cargos, pagos, gastos, usuarios } : null;
}
type DatosFin = NonNullable<ReturnType<typeof useFinanzas>>;

function AdminFinanzas() {
  const d = useFinanzas();
  if (!d) return <Cargando />;
  return (
    <Routes>
      <Route path="resumen" element={<Resumen d={d} />} />
      <Route path="cargos" element={<Cargos d={d} />} />
      <Route path="pagos" element={<Pagos d={d} />} />
      <Route path="gastos" element={<Gastos d={d} />} />
      <Route path="conceptos" element={<Conceptos d={d} />} />
      <Route path="*" element={<Navigate to="/m/finanzas" replace />} />
    </Routes>
  );
}

const enMes = (fecha: string, periodo: string) => fecha.slice(0, 7) === periodo;

function SelectorPeriodo({ periodo, setPeriodo }: { periodo: string; setPeriodo: (p: string) => void }) {
  return (
    <label>
      Mes
      <input type="month" value={periodo} onChange={(e) => e.target.value && setPeriodo(e.target.value)} />
    </label>
  );
}

function SinConceptos() {
  const { perfil } = useSesion();
  async function crear() {
    for (const n of CONCEPTOS_SUGERIDOS) await guardarDoc(`${RUTA_CONCEPTOS}/${nuevoId(12)}`, { nombre: n, campos: [], activo: true, montoSugerido: 0, creadoPor: perfil?.uid });
  }
  return (
    <div className="aviso">
      Aún no hay conceptos. <button className="enlace" onClick={crear}>Crear los sugeridos</button> ({CONCEPTOS_SUGERIDOS.join(', ')}) o
      créalos en la pestaña Conceptos.
    </div>
  );
}

/* ================= Resumen ================= */

function Resumen({ d }: { d: DatosFin }) {
  const { iglesia } = useSesion();
  const [periodo, setPeriodo] = useState(periodoActual());
  const [verUid, setVerUid] = useState<string | null>(null);

  const porDiacono = useMemo(
    () =>
      d.usuarios.map((u) => {
        const e = calcularEstado(
          d.cargos.filter((c) => c.diaconoUid === u.uid),
          d.pagos.filter((p) => p.diaconoUid === u.uid),
        );
        return { u, e };
      }),
    [d],
  );
  const conCargos = porDiacono.filter((x) => x.e.totalCargos > 0 || x.e.totalPagos > 0);
  const gastosMes = d.gastos.filter((g) => g.periodo === periodo);
  const pagosMes = d.pagos.filter((p) => enMes(p.fecha, periodo));
  const cargosMes = d.cargos.filter((c) => c.periodo === periodo);
  const suma = <T,>(l: T[], f: (x: T) => number) => redondear(l.reduce((s, x) => s + f(x), 0));
  const pendienteTotal = suma(porDiacono, (x) => x.e.saldo);
  const conceptosMes = [...new Set([...gastosMes.map((g) => g.conceptoNombre), ...cargosMes.map((c) => c.conceptoNombre), ...pagosMes.map((p) => p.conceptoNombre)])].sort();

  const recordatorio = (u: Perfil, deuda: string, total: number) =>
    `Hola ${u.nombre.split(' ')[0]}, Dios te bendiga. Te recordamos que tienes pendiente ${dinero(total)} en aportes: ${deuda}. Puedes ver tu estado de cuenta en Jeivi: ${window.location.origin}/m/finanzas\n\n${iglesia.nombre}`;

  if (verUid) {
    const u = d.usuarios.find((x) => x.uid === verUid);
    return (
      <div className="pila">
        <button className="boton" onClick={() => setVerUid(null)}>
          ← Volver al resumen
        </button>
        {u && <MiEstadoCuenta uid={u.uid} nombre={u.nombre} />}
      </div>
    );
  }

  return (
    <div className="pila">
      {!d.conceptos.length && <SinConceptos />}
      <div className="tarjeta fila-entre">
        <SelectorPeriodo periodo={periodo} setPeriodo={setPeriodo} />
        <button className="boton" onClick={() => exportarExcel(d, iglesia.nombre)}>
          <Download size={16} /> Descargar Excel
        </button>
      </div>
      <div className="kpis">
        <div className="tarjeta kpi">
          <span>Gastos de {textoPeriodo(periodo)}</span>
          <strong>{dinero(suma(gastosMes, (g) => g.monto))}</strong>
        </div>
        <div className="tarjeta kpi">
          <span>Aportes recibidos en {textoPeriodo(periodo)}</span>
          <strong className="texto-exito">{dinero(suma(pagosMes, (p) => p.monto))}</strong>
        </div>
        <div className="tarjeta kpi">
          <span>Asignado a diáconos en {textoPeriodo(periodo)}</span>
          <strong>{dinero(suma(cargosMes, (c) => c.monto))}</strong>
        </div>
        <div className="tarjeta kpi">
          <span>Pendiente total por cobrar</span>
          <strong className={pendienteTotal > 0 ? 'texto-error' : 'texto-exito'}>{dinero(pendienteTotal)}</strong>
        </div>
      </div>

      <section className="tarjeta">
        <h2>Estado de cada diácono</h2>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Diácono</th>
                <th>Asignado</th>
                <th>Aportado</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {conCargos.map(({ u, e }) => (
                <tr key={u.uid}>
                  <td>
                    <button className="enlace" onClick={() => setVerUid(u.uid)}>
                      {u.nombre}
                    </button>
                  </td>
                  <td>{dinero(e.totalCargos)}</td>
                  <td>{dinero(e.totalPagos)}</td>
                  <td>{e.alDia ? <span className="chip chip-exito">Al día</span> : <span className="chip chip-error" title={resumenDeuda(e)}>Debe {dinero(e.saldo)}</span>}</td>
                  <td>
                    {!e.alDia && u.whatsapp && (
                      <a
                        className="icono-boton"
                        title="Recordar por WhatsApp"
                        href={`https://wa.me/${numeroWhatsApp(u.whatsapp)}?text=${encodeURIComponent(recordatorio(u, resumenDeuda(e), e.saldo))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle size={16} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {!conCargos.length && (
                <tr>
                  <td colSpan={5} className="suave">
                    Aún no hay cargos. Ve a “Cargos” para asignar los aportes de los diáconos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tarjeta">
        <h2>Por concepto · {textoPeriodo(periodo)}</h2>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Gastos</th>
                <th>Asignado</th>
                <th>Aportado</th>
              </tr>
            </thead>
            <tbody>
              {conceptosMes.map((n) => (
                <tr key={n}>
                  <td>{n}</td>
                  <td>{dinero(suma(gastosMes.filter((g) => g.conceptoNombre === n), (g) => g.monto))}</td>
                  <td>{dinero(suma(cargosMes.filter((c) => c.conceptoNombre === n), (c) => c.monto))}</td>
                  <td>{dinero(suma(pagosMes.filter((p) => p.conceptoNombre === n), (p) => p.monto))}</td>
                </tr>
              ))}
              {!conceptosMes.length && (
                <tr>
                  <td colSpan={4} className="suave">
                    Sin movimientos este mes.
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

/* ================= Cargos ================= */

function Cargos({ d }: { d: DatosFin }) {
  const { perfil } = useSesion();
  const activos = d.conceptos.filter((c) => c.activo);
  const [conceptoId, setConceptoId] = useState(activos[0]?.id || '');
  const [periodo, setPeriodo] = useState(periodoActual());
  const [modo, setModo] = useState<'fijo' | 'repartir'>('repartir');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [registrarGasto, setRegistrarGasto] = useState(true);
  const [elegidos, setElegidos] = useState<string[]>(() => d.usuarios.filter((u) => u.rol === 'diacono').map((u) => u.uid));
  const [filtroPeriodo, setFiltroPeriodo] = useState(periodoActual());
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const concepto = d.conceptos.find((c) => c.id === conceptoId);
  useEffect(() => {
    if (concepto?.montoSugerido && modo === 'fijo') setMonto(String(concepto.montoSugerido));
  }, [conceptoId, modo]);

  const valor = Number(monto) || 0;
  const montos = modo === 'repartir' ? repartir(valor, elegidos.length) : elegidos.map(() => redondear(valor));
  const total = redondear(montos.reduce((s, m) => s + m, 0));

  async function crear(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!concepto || !perfil) return setError('Elige un concepto.');
    if (valor <= 0 || !elegidos.length) return setError('Indica el monto y al menos un diácono.');
    const ya = d.cargos.filter((c) => c.conceptoId === concepto.id && c.periodo === periodo && elegidos.includes(c.diaconoUid));
    if (ya.length && !confirm(`Ya hay ${ya.length} cargo(s) de ${concepto.nombre} en ${textoPeriodo(periodo)} para esas personas. ¿Agregar otros de todas formas?`)) return;
    const ahora = new Date().toISOString();
    await Promise.all(
      elegidos.map((uid, i) => {
        const u = d.usuarios.find((x) => x.uid === uid)!;
        const c: Omit<Cargo, 'id'> = {
          diaconoUid: uid,
          diaconoNombre: u.nombre,
          conceptoId: concepto.id,
          conceptoNombre: concepto.nombre,
          periodo,
          monto: montos[i],
          descripcion: descripcion.trim(),
          creado: ahora,
          creadoPor: perfil.uid,
        };
        return guardarDoc(`${RUTA_CARGOS}/${nuevoId(16)}`, c, false);
      }),
    );
    if (modo === 'repartir' && registrarGasto) {
      const g: Omit<Gasto, 'id'> = {
        conceptoId: concepto.id,
        conceptoNombre: concepto.nombre,
        monto: redondear(valor),
        fecha: hoyISO(),
        periodo,
        proveedor: '',
        nota: descripcion.trim() || `Recibo repartido entre ${elegidos.length}`,
        campos: {},
        creado: ahora,
        registradoPor: perfil.uid,
      };
      await guardarDoc(`${RUTA_GASTOS}/${nuevoId(16)}`, g, false);
    }
    setMsg(`Se asignaron ${elegidos.length} cargos de ${concepto.nombre} (${textoPeriodo(periodo)}) por ${dinero(total)}.`);
    setMonto('');
    setDescripcion('');
    setTimeout(() => setMsg(''), 4000);
  }

  const lista = d.cargos.filter((c) => !filtroPeriodo || c.periodo === filtroPeriodo).sort((a, b) => a.conceptoNombre.localeCompare(b.conceptoNombre) || a.diaconoNombre.localeCompare(b.diaconoNombre));

  return (
    <div className="pila">
      {!d.conceptos.length && <SinConceptos />}
      <form className="tarjeta formulario" onSubmit={crear}>
        <h2>Asignar aportes a los diáconos</h2>
        <p className="suave">
          <strong>Repartir un recibo:</strong> escribe el total (ej. la factura de luz) y se divide en partes iguales.{' '}
          <strong>Monto fijo:</strong> cada diácono aporta la misma cuota.
        </p>
        <div className="fila">
          <label>
            Concepto
            <select value={conceptoId} onChange={(e) => setConceptoId(e.target.value)} required>
              <option value="">—</option>
              {activos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mes
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} required />
          </label>
          <label>
            Modo
            <select value={modo} onChange={(e) => setModo(e.target.value as 'fijo' | 'repartir')}>
              <option value="repartir">Repartir un total</option>
              <option value="fijo">Monto fijo por diácono</option>
            </select>
          </label>
          <label>
            {modo === 'repartir' ? 'Total del recibo' : 'Monto por diácono'}
            <input type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </label>
        </div>
        <label>
          Descripción (opcional)
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Factura Naturgy octubre" />
        </label>
        <div>
          <div className="fila-entre">
            <strong>¿A quiénes?</strong>
            <div className="acciones">
              <button type="button" className="enlace" onClick={() => setElegidos(d.usuarios.map((u) => u.uid))}>
                Todos
              </button>
              <button type="button" className="enlace" onClick={() => setElegidos([])}>
                Ninguno
              </button>
            </div>
          </div>
          <div className="lista-elegir">
            {d.usuarios.map((u) => {
              const idx = elegidos.indexOf(u.uid);
              return (
                <label key={u.uid} className="interruptor">
                  <input
                    type="checkbox"
                    checked={idx >= 0}
                    onChange={(e) => setElegidos((l) => (e.target.checked ? [...l, u.uid] : l.filter((x) => x !== u.uid)))}
                  />
                  <span>
                    {u.nombre} {idx >= 0 && valor > 0 && <small className="suave">· {dinero(montos[idx] ?? 0)}</small>}
                    {u.rol !== 'diacono' && <span className="chip mini">{u.rol}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        {modo === 'repartir' && (
          <label className="interruptor">
            <input type="checkbox" checked={registrarGasto} onChange={(e) => setRegistrarGasto(e.target.checked)} />
            <span>Registrar también el recibo como gasto de la iglesia</span>
          </label>
        )}
        {valor > 0 && elegidos.length > 0 && (
          <div className="aviso">
            Se crearán {elegidos.length} cargos por un total de <strong>{dinero(total)}</strong>
            {modo === 'repartir' ? ` (${dinero(montos[montos.length - 1])} – ${dinero(montos[0])} c/u)` : ''}.
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {msg && <div className="exito">{msg}</div>}
        <button className="boton primario">
          <Plus size={16} /> Asignar
        </button>
      </form>

      <section className="tarjeta">
        <div className="fila-entre">
          <h2>Cargos asignados</h2>
          <SelectorPeriodo periodo={filtroPeriodo} setPeriodo={setFiltroPeriodo} />
        </div>
        <TablaMov
          filas={lista.map((c) => ({ id: c.id, a: c.diaconoNombre, b: c.conceptoNombre, c: c.descripcion || '', fecha: textoPeriodo(c.periodo), monto: c.monto }))}
          columnas={['Diácono', 'Concepto', 'Descripción', 'Mes']}
          borrar={(id) => borrarDoc(`${RUTA_CARGOS}/${id}`)}
        />
      </section>
    </div>
  );
}

function TablaMov({
  filas,
  columnas,
  borrar,
}: {
  filas: { id: string; a: string; b: string; c: string; fecha: string; monto: number }[];
  columnas: [string, string, string, string];
  borrar: (id: string) => void;
}) {
  const total = redondear(filas.reduce((s, f) => s + f.monto, 0));
  return (
    <div className="tabla-envoltura">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th className="num">Monto</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <td>{f.a}</td>
              <td>{f.b}</td>
              <td>{f.c || '—'}</td>
              <td>{f.fecha}</td>
              <td className="num">{dinero(f.monto)}</td>
              <td>
                <button className="icono-boton peligro" title="Eliminar" onClick={() => confirm('¿Eliminar este registro?') && borrar(f.id)}>
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
          {!filas.length && (
            <tr>
              <td colSpan={6} className="suave">
                Sin registros.
              </td>
            </tr>
          )}
        </tbody>
        {filas.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={4}>
                <strong>Total</strong>
              </td>
              <td className="num">
                <strong>{dinero(total)}</strong>
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ================= Aportes (pagos) ================= */

function Pagos({ d }: { d: DatosFin }) {
  const { perfil } = useSesion();
  const [uid, setUid] = useState('');
  const [conceptoId, setConceptoId] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [metodo, setMetodo] = useState<Pago['metodo']>('Efectivo');
  const [nota, setNota] = useState('');
  const [filtro, setFiltro] = useState(periodoActual());
  const [msg, setMsg] = useState('');

  const estado = useMemo(
    () => (uid ? calcularEstado(d.cargos.filter((c) => c.diaconoUid === uid), d.pagos.filter((p) => p.diaconoUid === uid)) : null),
    [uid, d.cargos, d.pagos],
  );
  const pendienteConcepto = estado?.porConcepto.find((c) => c.conceptoId === conceptoId)?.saldo || 0;

  useEffect(() => {
    if (pendienteConcepto > 0) setMonto(String(pendienteConcepto));
  }, [uid, conceptoId]);

  async function registrar(e: FormEvent) {
    e.preventDefault();
    const u = d.usuarios.find((x) => x.uid === uid);
    const c = d.conceptos.find((x) => x.id === conceptoId);
    if (!u || !c || !perfil || !(Number(monto) > 0)) return;
    const p: Omit<Pago, 'id'> = {
      diaconoUid: u.uid,
      diaconoNombre: u.nombre,
      conceptoId: c.id,
      conceptoNombre: c.nombre,
      monto: redondear(Number(monto)),
      fecha,
      metodo,
      nota: nota.trim(),
      creado: new Date().toISOString(),
      registradoPor: perfil.uid,
    };
    await guardarDoc(`${RUTA_PAGOS}/${nuevoId(16)}`, p, false);
    setMsg(`Aporte de ${dinero(p.monto)} de ${u.nombre} registrado.`);
    setMonto('');
    setNota('');
    setTimeout(() => setMsg(''), 3500);
  }

  const lista = d.pagos.filter((p) => !filtro || enMes(p.fecha, filtro)).sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="pila">
      <form className="tarjeta formulario" onSubmit={registrar}>
        <h2>Registrar aporte de un diácono</h2>
        <div className="fila">
          <label>
            Diácono
            <select value={uid} onChange={(e) => setUid(e.target.value)} required>
              <option value="">—</option>
              {d.usuarios.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Concepto
            <select value={conceptoId} onChange={(e) => setConceptoId(e.target.value)} required>
              <option value="">—</option>
              {d.conceptos.map((c) => {
                const s = estado?.porConcepto.find((x) => x.conceptoId === c.id)?.saldo || 0;
                return (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {s > 0 ? ` — debe ${dinero(s)}` : ''}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Monto
            <input type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </label>
        </div>
        <div className="fila">
          <label>
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label>
            Método
            <select value={metodo} onChange={(e) => setMetodo(e.target.value as Pago['metodo'])}>
              {METODOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Nota
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. comprobante Yappy #123" />
          </label>
        </div>
        {estado && (
          <div className={estado.alDia ? 'exito' : 'aviso'}>
            {estado.alDia ? 'Este diácono está al día.' : `Pendiente: ${resumenDeuda(estado)}`}
          </div>
        )}
        {msg && <div className="exito">{msg}</div>}
        <button className="boton primario">
          <Plus size={16} /> Registrar aporte
        </button>
      </form>

      <section className="tarjeta">
        <div className="fila-entre">
          <h2>Aportes recibidos</h2>
          <SelectorPeriodo periodo={filtro} setPeriodo={setFiltro} />
        </div>
        <TablaMov
          filas={lista.map((p) => ({ id: p.id, a: p.diaconoNombre, b: p.conceptoNombre, c: [p.metodo, p.nota].filter(Boolean).join(' · '), fecha: formatoCorto(p.fecha), monto: p.monto }))}
          columnas={['Diácono', 'Concepto', 'Método / nota', 'Fecha']}
          borrar={(id) => borrarDoc(`${RUTA_PAGOS}/${id}`)}
        />
      </section>
    </div>
  );
}

/* ================= Gastos ================= */

function Gastos({ d }: { d: DatosFin }) {
  const { perfil } = useSesion();
  const [conceptoId, setConceptoId] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [proveedor, setProveedor] = useState('');
  const [nota, setNota] = useState('');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState(periodoActual());
  const concepto = d.conceptos.find((c) => c.id === conceptoId);

  async function registrar(e: FormEvent) {
    e.preventDefault();
    if (!concepto || !perfil || !(Number(monto) > 0)) return;
    const etiquetados: Record<string, string> = {};
    concepto.campos.forEach((c) => campos[c.id] && (etiquetados[c.nombre] = campos[c.id]));
    const g: Omit<Gasto, 'id'> = {
      conceptoId: concepto.id,
      conceptoNombre: concepto.nombre,
      monto: redondear(Number(monto)),
      fecha,
      periodo: fecha.slice(0, 7),
      proveedor: proveedor.trim(),
      nota: nota.trim(),
      campos: etiquetados,
      creado: new Date().toISOString(),
      registradoPor: perfil.uid,
    };
    await guardarDoc(`${RUTA_GASTOS}/${nuevoId(16)}`, g, false);
    setMonto('');
    setProveedor('');
    setNota('');
    setCampos({});
  }

  const lista = d.gastos.filter((g) => !filtro || g.periodo === filtro).sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="pila">
      {!d.conceptos.length && <SinConceptos />}
      <form className="tarjeta formulario" onSubmit={registrar}>
        <h2>Registrar gasto</h2>
        <div className="fila">
          <label>
            Concepto
            <select value={conceptoId} onChange={(e) => (setConceptoId(e.target.value), setCampos({}))} required>
              <option value="">—</option>
              {d.conceptos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Monto
            <input type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </label>
          <label>
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
        </div>
        <div className="fila">
          <label>
            Proveedor
            <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej. Naturgy, ferretería" />
          </label>
          <label>
            Nota
            <input value={nota} onChange={(e) => setNota(e.target.value)} />
          </label>
        </div>
        {concepto && concepto.campos.length > 0 && (
          <div className="fila">
            {concepto.campos.map((c) => (
              <label key={c.id}>
                {c.nombre}
                <input
                  type={c.tipo === 'numero' ? 'number' : c.tipo === 'fecha' ? 'date' : 'text'}
                  value={campos[c.id] || ''}
                  onChange={(e) => setCampos((x) => ({ ...x, [c.id]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        )}
        <button className="boton primario">
          <Plus size={16} /> Registrar gasto
        </button>
      </form>
      <section className="tarjeta">
        <div className="fila-entre">
          <h2>Gastos</h2>
          <SelectorPeriodo periodo={filtro} setPeriodo={setFiltro} />
        </div>
        <TablaMov
          filas={lista.map((g) => ({
            id: g.id,
            a: g.conceptoNombre,
            b: g.proveedor || '—',
            c: [g.nota, ...Object.entries(g.campos || {}).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join(' · '),
            fecha: formatoCorto(g.fecha),
            monto: g.monto,
          }))}
          columnas={['Concepto', 'Proveedor', 'Detalle', 'Fecha']}
          borrar={(id) => borrarDoc(`${RUTA_GASTOS}/${id}`)}
        />
      </section>
    </div>
  );
}

/* ================= Conceptos ================= */

function EditorConcepto({ inicial, alTerminar }: { inicial?: Concepto; alTerminar: () => void }) {
  const [nombre, setNombre] = useState(inicial?.nombre || '');
  const [monto, setMonto] = useState(inicial?.montoSugerido ? String(inicial.montoSugerido) : '');
  const [campos, setCampos] = useState<CampoLibre[]>(inicial?.campos || []);
  const [activo, setActivo] = useState(inicial?.activo ?? true);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    await guardarDoc(
      `${RUTA_CONCEPTOS}/${inicial?.id || nuevoId(12)}`,
      { nombre: nombre.trim(), montoSugerido: Number(monto) || 0, campos: campos.filter((c) => c.nombre.trim()), activo },
      false,
    );
    alTerminar();
  }

  return (
    <form className="tarjeta formulario" onSubmit={guardar}>
      <h2>{inicial ? `Editar ${inicial.nombre}` : 'Nuevo concepto'}</h2>
      <div className="fila">
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Luz, Alquiler, Sonido" required />
        </label>
        <label>
          Cuota sugerida por diácono (opcional)
          <input type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </label>
      </div>
      <div>
        <strong>Campos libres para los gastos de este concepto</strong>
        <p className="suave pequeno">Ej. para Luz: “N.º de factura”, “kWh consumidos”, “Fecha de vencimiento”.</p>
        {campos.map((c) => (
          <div key={c.id} className="fila campo-libre">
            <input value={c.nombre} onChange={(e) => setCampos((l) => l.map((x) => (x.id === c.id ? { ...x, nombre: e.target.value } : x)))} placeholder="Nombre del campo" />
            <select value={c.tipo} onChange={(e) => setCampos((l) => l.map((x) => (x.id === c.id ? { ...x, tipo: e.target.value as CampoLibre['tipo'] } : x)))}>
              <option value="texto">Texto</option>
              <option value="numero">Número</option>
              <option value="fecha">Fecha</option>
            </select>
            <button type="button" className="icono-boton peligro" onClick={() => setCampos((l) => l.filter((x) => x.id !== c.id))}>
              <X size={16} />
            </button>
          </div>
        ))}
        <button type="button" className="boton pequeno" onClick={() => setCampos((l) => [...l, { id: nuevoId(8), nombre: '', tipo: 'texto' }])}>
          <Plus size={14} /> Agregar campo
        </button>
      </div>
      <label className="interruptor">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        <span>Activo</span>
      </label>
      <div className="acciones">
        <button className="boton primario">Guardar</button>
        <button type="button" className="boton" onClick={alTerminar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Conceptos({ d }: { d: DatosFin }) {
  const [editando, setEditando] = useState<Concepto | 'nuevo' | null>(null);
  if (editando) return <EditorConcepto inicial={editando === 'nuevo' ? undefined : editando} alTerminar={() => setEditando(null)} />;
  return (
    <div className="pila">
      {!d.conceptos.length && <SinConceptos />}
      <section className="tarjeta">
        <div className="fila-entre">
          <h2>Conceptos</h2>
          <button className="boton primario" onClick={() => setEditando('nuevo')}>
            <Plus size={16} /> Nuevo concepto
          </button>
        </div>
        <ul className="lista-conceptos">
          {d.conceptos.map((c) => (
            <li key={c.id} className={c.activo ? '' : 'apagado'}>
              <div className="dia-info">
                <strong>{c.nombre}</strong>
                <small>
                  {c.montoSugerido ? `Cuota sugerida ${dinero(c.montoSugerido)} · ` : ''}
                  {c.campos.length ? `Campos: ${c.campos.map((x) => x.nombre).join(', ')}` : 'Sin campos libres'}
                  {!c.activo ? ' · inactivo' : ''}
                </small>
              </div>
              <button className="boton pequeno" onClick={() => setEditando(c)}>
                Editar
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
