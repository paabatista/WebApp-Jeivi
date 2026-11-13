import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, CheckCircle2, Download, FileSpreadsheet, Package, Upload, Wallet } from 'lucide-react';
import { ejecutarLote, type OperacionLote } from '../../../lib/datos';
import { nuevoId } from '../../../lib/enlaces';
import { useSesion, type Perfil } from '../../../lib/sesion';
import {
  METODOS,
  RUTA_CARGOS,
  RUTA_CONCEPTOS,
  RUTA_GASTOS,
  RUTA_PAGOS,
  dinero,
  redondear,
  textoPeriodo,
  uidExterno,
  type Cargo,
  type Concepto,
  type Gasto,
  type Importacion,
  type Pago,
} from '../datos';
import { descargarPlantilla, exportarExcel } from '../exportar';
import { ACEPTA_ARCHIVOS, leerArchivo, type Hoja } from './leerArchivo';
import { sugerirDestino, type Destino } from './articulos';
import { ImportarArticulos } from './ImportarArticulos';
import { columnasDeMes, detectarFilaEncabezado, huella, normalizarNombre, sugerirMapeo, texto, type CampoImport } from './normalizar';
import { ETIQUETA_CAMPO, TIPOS_IMPORT, procesarHoja, type FilaProcesada, type TipoImport } from './procesar';

interface Datos {
  conceptos: Concepto[];
  cargos: Cargo[];
  pagos: Pago[];
  gastos: Gasto[];
  usuarios: Perfil[];
}

const SIN_CUENTA = '__ext__';

/** Busca al diácono por nombre: exacto, o que todas las palabras del Excel estén en su nombre. */
function emparejar(nombre: string, usuarios: Perfil[], vinculos: Map<string, string>): string {
  const n = normalizarNombre(nombre);
  const vinculado = vinculos.get(n);
  if (vinculado && usuarios.some((u) => u.uid === vinculado)) return vinculado;
  const exacto = usuarios.find((u) => normalizarNombre(u.nombre) === n);
  if (exacto) return exacto.uid;
  const palabras = n.split(' ').filter((p) => p.length > 1);
  if (palabras.length >= 2) {
    const parcial = usuarios.filter((u) => {
      const un = normalizarNombre(u.nombre).split(' ');
      return palabras.every((p) => un.includes(p));
    });
    if (parcial.length === 1) return parcial[0].uid;
  }
  return SIN_CUENTA;
}

function adivinarTipo(h: Hoja, fila: number): TipoImport {
  const enc = h.filas[fila] || [];
  if (columnasDeMes(enc, new Date().getFullYear()).length >= 3) return 'tablaMeses';
  const m = sugerirMapeo(enc.map(texto), ['fecha', 'periodo', 'persona', 'proveedor']);
  if (m.persona !== undefined && m.fecha !== undefined) return 'aportes';
  if (m.persona !== undefined) return 'cargos';
  return 'gastos';
}

export function Importar({ d }: { d: Datos }) {
  const { perfil, iglesia } = useSesion();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [hojas, setHojas] = useState<Hoja[]>([]);
  const [hojaIdx, setHojaIdx] = useState(0);
  const [tipo, setTipo] = useState<TipoImport>('aportes');
  const [filaEnc, setFilaEnc] = useState(0);
  const [mapeo, setMapeo] = useState<Partial<Record<CampoImport, number>>>({});
  const [conceptoFijo, setConceptoFijo] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [cuota, setCuota] = useState('');
  const [personas, setPersonas] = useState<Record<string, string>>({});
  const [reemplazar, setReemplazar] = useState(true);
  const [existentes, setExistentes] = useState<Set<string>>(new Set());
  const [actualizan, setActualizan] = useState(0);
  const [ids, setIds] = useState<string[]>([]);
  const [progreso, setProgreso] = useState('');
  const [resultado, setResultado] = useState('');
  const [error, setError] = useState('');
  const [params] = useSearchParams();
  const destinoUrl = params.get('destino') as Destino | null;
  const [destino, setDestino] = useState<Destino | null>(null);
  const [sugerido, setSugerido] = useState<Destino | null>(null);

  const hoja = hojas[hojaIdx];
  const encabezados = hoja?.filas[filaEnc]?.map(texto) || [];

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError('');
    setResultado('');
    try {
      const hs = await leerArchivo(f);
      // Saltar hojas de resumen o instrucciones al abrir.
      const inicio = Math.max(0, hs.findIndex((h) => !/estado|instruc|resumen/i.test(h.nombre)));
      setArchivo(f);
      setHojas(hs);
      prepararHoja(hs[inicio]);
      setHojaIdx(inicio);
      // Siempre se pregunta a dónde va (salvo que se haya entrado desde un proyecto o el inventario).
      setSugerido(sugerirDestino(hs[inicio]));
      setDestino(destinoUrl && ['finanzas', 'proyecto', 'inventario'].includes(destinoUrl) ? destinoUrl : null);
    } catch (err) {
      setError((err as Error).message || 'No se pudo leer el archivo.');
    }
  }

  function prepararHoja(h: Hoja, t?: TipoImport) {
    const fila = detectarFilaEncabezado(h.filas);
    const tp = t || adivinarTipo(h, fila);
    setFilaEnc(fila);
    setTipo(tp);
    setMapeo(sugerirMapeo((h.filas[fila] || []).map(texto), TIPOS_IMPORT[tp].campos));
  }

  const filas = useMemo<FilaProcesada[]>(
    () => (hoja ? procesarHoja(hoja, { tipo, filaEncabezado: filaEnc, mapeo, conceptoFijo, anio, cuotaMensual: Number(cuota) || 0 }) : []),
    [hoja, tipo, filaEnc, mapeo, conceptoFijo, anio, cuota],
  );
  const validas = useMemo(() => filas.filter((f) => !f.error), [filas]);
  const conErrores = useMemo(() => filas.filter((f) => f.error), [filas]);

  // Nombres de Excel que un pastor ya vinculó a una cuenta.
  const vinculos = useMemo(() => {
    const m = new Map<string, string>();
    [...d.cargos, ...d.pagos].forEach((x) => x.nombreExcel && m.set(normalizarNombre(x.nombreExcel), x.diaconoUid));
    return m;
  }, [d.cargos, d.pagos]);

  // Personas del Excel → usuario (o "sin cuenta").
  const nombres = useMemo(() => [...new Set(validas.filter((f) => f.persona).map((f) => f.persona!.trim()))].sort(), [validas]);
  useEffect(() => {
    setPersonas((prev) => {
      const out: Record<string, string> = {};
      nombres.forEach((n) => (out[n] = prev[n] ?? emparejar(n, d.usuarios, vinculos)));
      return out;
    });
  }, [nombres.join('|'), d.usuarios]);

  const conceptoPorNombre = useMemo(() => new Map(d.conceptos.map((c) => [normalizarNombre(c.nombre), c])), [d.conceptos]);
  const conceptosNuevos = [...new Set(validas.map((f) => f.concepto.trim()).filter((c) => c && !conceptoPorNombre.has(normalizarNombre(c))))];

  const importacion: Importacion | null = archivo && hoja ? { archivo: archivo.name, hoja: hoja.nombre, fecha: new Date().toISOString() } : null;
  const ruta = (f: FilaProcesada) => (f.tipo === 'gasto' ? RUTA_GASTOS : f.tipo === 'pago' ? RUTA_PAGOS : RUTA_CARGOS);
  const previos = useMemo(() => {
    if (!importacion) return [] as { ruta: string; id: string }[];
    const mismo = (x: { importacion?: Importacion }) => x.importacion?.archivo === importacion.archivo && x.importacion?.hoja === importacion.hoja;
    return [
      ...d.gastos.filter(mismo).map((x) => ({ ruta: RUTA_GASTOS, id: x.id })),
      ...d.pagos.filter(mismo).map((x) => ({ ruta: RUTA_PAGOS, id: x.id })),
      ...d.cargos.filter(mismo).map((x) => ({ ruta: RUTA_CARGOS, id: x.id })),
    ];
  }, [importacion?.archivo, importacion?.hoja, d]);

  // Huella de cada fila: si ya se importó antes (mismo contenido), no se duplica.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const vistos = new Map<string, number>();
      const lista: string[] = [];
      for (const f of validas) {
        if (f.idJeivi) {
          lista.push(f.idJeivi);
          continue;
        }
        const base = [f.tipo, f.fecha || f.periodo, normalizarNombre(f.persona || ''), normalizarNombre(f.concepto), f.monto.toFixed(2), normalizarNombre(f.nota || '')].join('|');
        const n = (vistos.get(base) || 0) + 1;
        vistos.set(base, n);
        lista.push('imp-' + (await huella([base, n])));
      }
      if (!vivo) return;
      setIds(lista);
      const todos = new Set([...d.gastos, ...d.pagos, ...d.cargos].map((x) => x.id));
      setExistentes(new Set(lista.filter((id, i) => todos.has(id) && !validas[i].idJeivi)));
      setActualizan(validas.filter((f) => f.idJeivi && todos.has(f.idJeivi)).length);
    })();
    return () => {
      vivo = false;
    };
  }, [validas, d.gastos, d.pagos, d.cargos]);

  const repetidas = reemplazar ? 0 : existentes.size;
  const aImportar = validas.length - repetidas;

  async function importar() {
    if (!perfil || !importacion || !validas.length || ids.length !== validas.length) return;
    setError('');
    setResultado('');
    const ops: OperacionLote[] = [];
    const conceptos = new Map(conceptoPorNombre);
    for (const nombre of conceptosNuevos) {
      const id = nuevoId(12);
      const c: Concepto = { id, nombre, campos: [], activo: true, montoSugerido: 0 };
      conceptos.set(normalizarNombre(nombre), c);
      ops.push({ tipo: 'guardar', ruta: `${RUTA_CONCEPTOS}/${id}`, data: { nombre, campos: [], activo: true, montoSugerido: 0 } });
    }
    // No borrar lo que se va a volver a escribir (una misma operación por documento).
    const aEscribir = new Set(ids);
    if (reemplazar) previos.filter((p) => !aEscribir.has(p.id)).forEach((p) => ops.push({ tipo: 'borrar', ruta: `${p.ruta}/${p.id}` }));

    const ahora = new Date().toISOString();
    validas.forEach((f, i) => {
      const id = ids[i];
      if (!reemplazar && existentes.has(id)) return;
      const c = conceptos.get(normalizarNombre(f.concepto))!;
      const destino = f.persona ? personas[f.persona.trim()] : '';
      const u = d.usuarios.find((x) => x.uid === destino);
      const diaconoUid = u ? u.uid : uidExterno(f.persona || 'sin-nombre');
      const diaconoNombre = u ? u.nombre : (f.persona || '').trim();
      let data: Record<string, unknown>;
      if (f.tipo === 'gasto') {
        data = { conceptoId: c.id, conceptoNombre: c.nombre, monto: redondear(f.monto), fecha: f.fecha || '', periodo: f.periodo, proveedor: f.proveedor || '', nota: f.nota || '', campos: f.campos || {}, creado: ahora, registradoPor: perfil.uid, importacion } satisfies Omit<Gasto, 'id'>;
      } else if (f.tipo === 'pago') {
        const metodo = METODOS.find((m) => normalizarNombre(m) === normalizarNombre(f.metodo || '').split(' ')[0]) || 'Otro';
        data = { diaconoUid, diaconoNombre, conceptoId: c.id, conceptoNombre: c.nombre, monto: redondear(f.monto), fecha: f.fecha!, metodo, nota: f.nota || '', creado: ahora, registradoPor: perfil.uid, importacion, nombreExcel: (f.persona || '').trim() } satisfies Omit<Pago, 'id'>;
      } else {
        data = { diaconoUid, diaconoNombre, conceptoId: c.id, conceptoNombre: c.nombre, periodo: f.periodo, monto: redondear(f.monto), descripcion: f.nota || '', creado: ahora, creadoPor: perfil.uid, importacion, nombreExcel: (f.persona || '').trim() } satisfies Omit<Cargo, 'id'>;
      }
      ops.push({ tipo: 'guardar', ruta: `${ruta(f)}/${id}`, data });
    });

    try {
      await ejecutarLote(ops, (n) => setProgreso(`Guardando… ${n} de ${ops.length}`));
      const sinCuenta = Object.values(personas).filter((v) => v === SIN_CUENTA).length;
      setResultado(
        `Listo: se importaron ${aImportar} registros${reemplazar && previos.length ? ` (reemplazando ${previos.length} de la carga anterior de este archivo)` : ''}` +
          `${conceptosNuevos.length ? `, ${conceptosNuevos.length} concepto(s) nuevo(s)` : ''}` +
          `${sinCuenta ? `. ${sinCuenta} persona(s) quedaron "sin cuenta": cuando tengan usuario, vincúlalas en Resumen` : ''}.`,
      );
    } catch (err) {
      setError(`No se pudo guardar: ${(err as Error).message}`);
    } finally {
      setProgreso('');
    }
  }

  const campos = TIPOS_IMPORT[tipo].campos;
  const faltan = TIPOS_IMPORT[tipo].obligatorios.filter((c) => mapeo[c] === undefined);
  const necesitaConcepto = tipo === 'tablaMeses' || mapeo.concepto === undefined;

  return (
    <div className="pila">
      <section className="tarjeta">
        <h2 className="con-icono">
          <FileSpreadsheet size={22} /> Importar desde Excel
        </h2>
        <p className="suave">
          Sube los Excel que ya manejan (.xlsx, .xls o .csv): aportes, cuotas y gastos, la cotización de un proyecto o la lista de bienes
          del inventario. Primero te pregunta a dónde va, reconoce las columnas, te muestra una vista previa y no duplica lo que ya se
          importó. Si actualizas el Excel y lo vuelves a subir, reemplaza la carga anterior de ese mismo archivo.
        </p>
        <div className="acciones">
          <label className="boton primario subir-archivo">
            <Upload size={16} /> {archivo ? 'Subir otro archivo' : 'Elegir archivo (.xlsx o .csv)'}
            <input type="file" accept={ACEPTA_ARCHIVOS} hidden onChange={elegirArchivo} />
          </label>
          <button className="boton" onClick={() => descargarPlantilla()}>
            <Download size={16} /> Descargar plantilla
          </button>
          <button className="boton" onClick={() => exportarExcel(d, iglesia.nombre)}>
            <Download size={16} /> Descargar todo lo registrado
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {resultado && (
          <div className="exito con-icono">
            <CheckCircle2 size={18} /> {resultado}
          </div>
        )}
      </section>

      {hoja && archivo && (
        <section className="tarjeta formulario">
          <h3>¿A dónde va este Excel?</h3>
          <p className="suave pequeno">
            Archivo: <strong>{archivo.name}</strong>
            {hojas.length > 1 ? ` · ${hojas.length} hojas` : ''}
          </p>
          <div className="destinos">
            {(
              [
                ['finanzas', Wallet, 'Finanzas', 'Aportes y cuotas de los diáconos, gastos de la iglesia o la tabla por meses.'],
                ['proyecto', Package, 'Un proyecto', 'Cotización o lista de compras (ej. la PC para los directos). No cuenta como gasto.'],
                ['inventario', Boxes, 'Inventario', 'Bienes que la iglesia ya tiene: equipos, sonido, mobiliario…'],
              ] as const
            ).map(([k, Icono, titulo, ayuda]) => (
              <button key={k} type="button" className={`destino${destino === k ? ' activo' : ''}`} onClick={() => setDestino(k)}>
                <strong>
                  <Icono size={18} /> {titulo}
                </strong>
                <span className="suave">{ayuda}</span>
                {sugerido === k && destino !== k && <span className="chip mini">Parece esto</span>}
              </button>
            ))}
          </div>
          {hojas.length > 1 && (
            <div className="fila">
              <label>
                Hoja
                <select
                  value={hojaIdx}
                  onChange={(e) => {
                    const i = Number(e.target.value);
                    setHojaIdx(i);
                    prepararHoja(hojas[i]);
                  }}
                >
                  {hojas.map((h, i) => (
                    <option key={h.nombre + i} value={i}>
                      {h.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </section>
      )}

      {hoja && archivo && (destino === 'proyecto' || destino === 'inventario') && (
        <ImportarArticulos key={`${destino}-${archivo.name}-${hojaIdx}`} destino={destino} archivo={archivo} hoja={hoja} proyectoInicial={params.get('proyecto') || undefined} />
      )}

      {hoja && destino === 'finanzas' && (
        <section className="tarjeta formulario">
          <h3>1. ¿Qué contiene el archivo?</h3>
          <div className="fila">
            <label>
              Tipo de datos
              <select
                value={tipo}
                onChange={(e) => {
                  const t = e.target.value as TipoImport;
                  setTipo(t);
                  setMapeo(sugerirMapeo(encabezados, TIPOS_IMPORT[t].campos));
                }}
              >
                {(Object.keys(TIPOS_IMPORT) as TipoImport[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPOS_IMPORT[t].nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fila de los títulos
              <select
                value={filaEnc}
                onChange={(e) => {
                  const f = Number(e.target.value);
                  setFilaEnc(f);
                  setMapeo(sugerirMapeo((hoja.filas[f] || []).map(texto), campos));
                }}
              >
                {hoja.filas.slice(0, 15).map((f, i) => (
                  <option key={i} value={i}>
                    Fila {i + 1}: {f.map(texto).filter(Boolean).slice(0, 4).join(' · ').slice(0, 60) || '(vacía)'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="suave pequeno">{TIPOS_IMPORT[tipo].ayuda}</p>

          <h3>2. Columnas</h3>
          <div className="fila">
            {campos.map((c) => (
              <label key={c}>
                {ETIQUETA_CAMPO[c]}
                {TIPOS_IMPORT[tipo].obligatorios.includes(c) ? ' *' : ''}
                <select
                  value={mapeo[c] ?? ''}
                  onChange={(e) => setMapeo((m) => ({ ...m, [c]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                >
                  <option value="">— No está —</option>
                  {encabezados.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Columna ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {(necesitaConcepto || tipo === 'cargos') && (
            <div className="fila">
              {necesitaConcepto && (
                <label>
                  Concepto {tipo === 'tablaMeses' ? '*' : '(para todas las filas)'}
                  <input list="lista-conceptos" value={conceptoFijo} onChange={(e) => setConceptoFijo(e.target.value)} placeholder="Ej. Luz" />
                  <datalist id="lista-conceptos">
                    {d.conceptos.map((c) => (
                      <option key={c.id} value={c.nombre} />
                    ))}
                  </datalist>
                </label>
              )}
              {(tipo === 'tablaMeses' || tipo === 'cargos') && (
                <label>
                  Año (si los meses no lo dicen)
                  <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value) || new Date().getFullYear())} />
                </label>
              )}
              {tipo === 'tablaMeses' && (
                <label>
                  Cuota mensual por diácono (opcional)
                  <input type="number" min={0} step="0.01" value={cuota} onChange={(e) => setCuota(e.target.value)} placeholder="Para saber cuánto deben" />
                </label>
              )}
            </div>
          )}
          {tipo === 'tablaMeses' && (
            <p className="suave pequeno">
              Meses detectados:{' '}
              {columnasDeMes(hoja.filas[filaEnc] || [], anio)
                .map((m) => textoPeriodo(m.periodo))
                .join(', ') || 'ninguno (revisa la fila de títulos)'}
              . Cada monto se registra como aporte; con cuota mensual también se crea lo que le tocaba, para calcular quién debe.
            </p>
          )}
          {faltan.length > 0 && <div className="aviso">Falta indicar: {faltan.map((c) => ETIQUETA_CAMPO[c]).join(', ')}.</div>}

          {nombres.length > 0 && (
            <>
              <h3>3. Diáconos</h3>
              <p className="suave pequeno">
                Revisa a quién corresponde cada nombre. Los que aún no tienen cuenta quedan guardados con su nombre y luego los vinculas.
              </p>
              <div className="lista-elegir">
                {nombres.map((n) => (
                  <label key={n}>
                    {n}
                    <select value={personas[n] ?? SIN_CUENTA} onChange={(e) => setPersonas((p) => ({ ...p, [n]: e.target.value }))}>
                      <option value={SIN_CUENTA}>Sin cuenta todavía (guardar con este nombre)</option>
                      {d.usuarios.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </>
          )}

          <h3>{nombres.length ? '4' : '3'}. Vista previa</h3>
          <div className="kpis">
            <div className="tarjeta kpi">
              <span>Filas listas</span>
              <strong className="texto-exito">{validas.length}</strong>
            </div>
            <div className="tarjeta kpi">
              <span>Con errores (se omiten)</span>
              <strong className={conErrores.length ? 'texto-error' : ''}>{conErrores.length}</strong>
            </div>
            <div className="tarjeta kpi">
              <span>Total</span>
              <strong>{dinero(validas.reduce((s, f) => s + f.monto, 0))}</strong>
            </div>
          </div>
          {conceptosNuevos.length > 0 && <div className="aviso">Se crearán estos conceptos nuevos: {conceptosNuevos.join(', ')}.</div>}
          {previos.length > 0 && (
            <label className="interruptor">
              <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} />
              <span>
                Este archivo ya se importó antes ({previos.length} registros). Reemplazar esa carga con la versión nueva del Excel.
              </span>
            </label>
          )}
          {!reemplazar && existentes.size > 0 && <div className="aviso">{existentes.size} fila(s) ya estaban importadas y se omitirán.</div>}
          {actualizan > 0 && <div className="aviso">{actualizan} fila(s) vienen de un Excel descargado de Jeivi y se actualizarán (no se duplican).</div>}

          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Tipo</th>
                  <th>Fecha / mes</th>
                  <th>Diácono</th>
                  <th>Concepto</th>
                  <th className="num">Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, 60).map((f, i) => {
                  const destino = f.persona ? personas[f.persona.trim()] : '';
                  const u = d.usuarios.find((x) => x.uid === destino);
                  return (
                    <tr key={i} className={f.error ? 'resaltar' : ''}>
                      <td>{f.fila}</td>
                      <td>{f.tipo === 'gasto' ? 'Gasto' : f.tipo === 'pago' ? 'Aporte' : 'Cargo'}</td>
                      <td>{f.fecha || (f.periodo ? textoPeriodo(f.periodo) : '—')}</td>
                      <td>{f.persona ? (u ? u.nombre : `${f.persona} (sin cuenta)`) : '—'}</td>
                      <td>{f.concepto || '—'}</td>
                      <td className="num">{dinero(f.monto)}</td>
                      <td className={f.error ? 'texto-error' : 'texto-exito'}>{f.error || 'OK'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filas.length > 60 && <p className="suave pequeno">…y {filas.length - 60} filas más.</p>}
          </div>
          {progreso && <div className="aviso">{progreso}</div>}
          <button className="boton primario" onClick={importar} disabled={!aImportar || faltan.length > 0 || !!progreso || ids.length !== validas.length}>
            <Upload size={16} /> Importar {aImportar} registro(s)
          </button>
        </section>
      )}
    </div>
  );
}

