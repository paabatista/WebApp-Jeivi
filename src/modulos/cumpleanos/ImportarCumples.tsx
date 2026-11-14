import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { ejecutarLote, type OperacionLote } from '../../lib/datos';
import { nuevoId } from '../../lib/enlaces';
import { explicarError } from '../../lib/errores';
import { COLUMNA_ID, descargar, nuevoLibro } from '../finanzas/exportar';
import { ACEPTA_ARCHIVOS, leerArchivo, type Hoja } from '../finanzas/importar/leerArchivo';
import { normalizarNombre, texto } from '../finanzas/importar/normalizar';
import { MESES, ORIGEN_CUMPLE, RUTA_CUMPLES, textoFecha, type Cumple } from './datos';
import {
  CAMPOS_CUMPLE,
  ETIQUETA_CUMPLE,
  datosActualizados,
  decidirAcciones,
  filaEncabezadoCumples,
  marcarRepetidos,
  mesDeHoja,
  procesarCumples,
  sugerirMapeoCumples,
  type Accion,
  type FilaCumple,
  type MapeoCumple,
} from './importarDatos';

const pad = (n: number) => String(n).padStart(2, '0');
const fechaExcel = (c: Pick<Cumple, 'dia' | 'mes' | 'anio'>) => `${pad(c.dia)}/${pad(c.mes)}${c.anio ? `/${c.anio}` : ''}`;

const COLUMNAS = [
  { header: 'Nombre', key: 'nombre', width: 30 },
  { header: 'Fecha de nacimiento', key: 'fecha', width: 20 },
  { header: 'WhatsApp', key: 'telefono', width: 16 },
  { header: 'Familia', key: 'familia', width: 24 },
  { header: 'Tipo', key: 'tipo', width: 10 },
];

/** Excel con todos los cumpleaños: se puede editar y volver a subir (la columna ID Jeivi evita duplicados). */
export async function exportarCumples(lista: Cumple[]) {
  const { libro, hoja } = await nuevoLibro();
  hoja(
    'Cumpleaños',
    [...COLUMNAS, { header: 'Registrado por', key: 'origen', width: 14 }, { header: COLUMNA_ID, key: 'id', width: 22 }],
    [...lista]
      .sort((a, b) => a.mes - b.mes || a.dia - b.dia)
      .map((c) => ({
        nombre: c.nombre,
        fecha: fechaExcel(c),
        telefono: c.telefono || '',
        familia: c.familia || '',
        tipo: c.parentesco === 'hijo' ? 'Hijo/a' : 'Adulto',
        origen: ORIGEN_CUMPLE[c.origen] || '',
        id: c.id,
      })),
  );
  await descargar(libro, 'cumpleanos.xlsx');
}

async function descargarPlantillaCumples() {
  const { libro, hoja } = await nuevoLibro();
  const instr = libro.addWorksheet('Instrucciones');
  instr.getColumn(1).width = 100;
  [
    'PLANTILLA DE CUMPLEAÑOS — JEIVI',
    '',
    'Una fila por persona. Súbela en Cumpleaños → Registros → Importar Excel.',
    '• Fecha de nacimiento: 15/03/1985, o solo 15/03 si no quieren dar el año.',
    '• Tipo: Adulto o Hijo/a.  Familia: para agrupar a los hijos con sus papás (ej. Familia Pérez).',
    '• Si ya tienen su propia lista, súbanla tal cual: Jeivi reconoce las columnas.',
    '• Cuando la actualicen, vuelvan a subirla: lo que ya estaba se actualiza y no se duplica.',
  ].forEach((t, i) => {
    instr.getCell(i + 1, 1).value = t;
    if (i === 0) instr.getCell(i + 1, 1).font = { bold: true, size: 14 };
  });
  hoja('Cumpleaños', COLUMNAS, [
    { nombre: 'María Pérez', fecha: '15/03/1985', telefono: '61234567', familia: 'Familia Pérez', tipo: 'Adulto' },
    { nombre: 'Sofía Pérez', fecha: '02/09', telefono: '', familia: 'Familia Pérez', tipo: 'Hijo/a' },
  ]);
  await descargar(libro, 'plantilla-cumpleanos-jeivi.xlsx');
}

function textoAccion(f: FilaCumple, a: Accion | null | undefined): { texto: string; clase: string } {
  if (f.omitida) return { texto: `Se omite: ${f.omitida}`, clase: 'suave' };
  if (!a) return { texto: '…', clase: 'suave' };
  if (a.tipo === 'nuevo') return { texto: 'Nuevo', clase: 'texto-exito' };
  if (a.tipo === 'actualizar') return { texto: 'Se actualiza', clase: 'texto-exito' };
  if (a.tipo === 'completar') return { texto: `Se completa: ${a.campos.join(', ')}`, clase: 'texto-exito' };
  return { texto: a.detalle, clase: 'suave' };
}

export function ImportarCumples({ lista }: { lista: Cumple[] }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [hojas, setHojas] = useState<Hoja[]>([]);
  const [hojaIdx, setHojaIdx] = useState(0);
  const [juntar, setJuntar] = useState(false);
  const [filaEnc, setFilaEnc] = useState(0);
  const [mapeo, setMapeo] = useState<MapeoCumple>({});
  const [mesHoja, setMesHoja] = useState<number | null>(null);
  const [acciones, setAcciones] = useState<(Accion | null)[]>([]);
  const [progreso, setProgreso] = useState('');
  const [resultado, setResultado] = useState('');
  const [error, setError] = useState('');

  const hoja = hojas[hojaIdx];
  const hojasDeMes = useMemo(() => hojas.filter((h) => mesDeHoja(h.nombre)), [hojas]);

  function prepararHoja(h: Hoja) {
    const fila = filaEncabezadoCumples(h);
    setFilaEnc(fila);
    setMapeo(sugerirMapeoCumples((h.filas[fila] || []).map(texto)));
    setMesHoja(mesDeHoja(h.nombre));
  }

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError('');
    setResultado('');
    try {
      const hs = await leerArchivo(f);
      const inicio = Math.max(0, hs.findIndex((h) => !/instruc|resumen/i.test(h.nombre)));
      setArchivo(f);
      setHojas(hs);
      setHojaIdx(inicio);
      setJuntar(hs.filter((h) => mesDeHoja(h.nombre)).length >= 2);
      prepararHoja(hs[inicio]);
    } catch (err) {
      setError((err as Error).message || 'No se pudo leer el archivo.');
    }
  }

  const filas = useMemo<FilaCumple[]>(() => {
    if (!hoja) return [];
    if (juntar && hojasDeMes.length >= 2) {
      return marcarRepetidos(
        hojasDeMes.flatMap((h) => {
          const fe = filaEncabezadoCumples(h);
          return procesarCumples(h, fe, sugerirMapeoCumples((h.filas[fe] || []).map(texto)), mesDeHoja(h.nombre));
        }),
      );
    }
    return marcarRepetidos(procesarCumples(hoja, filaEnc, mapeo, mesHoja));
  }, [hoja, juntar, hojasDeMes, filaEnc, mapeo, mesHoja]);

  useEffect(() => {
    let vivo = true;
    setAcciones([]);
    decidirAcciones(filas, lista).then((a) => vivo && setAcciones(a));
    return () => {
      vivo = false;
    };
  }, [filas, lista]);

  const cuenta = (t: Accion['tipo']) => acciones.filter((a) => a?.tipo === t).length;
  const nuevos = cuenta('nuevo');
  const actualizan = cuenta('actualizar');
  const completan = cuenta('completar');
  const yaEstan = cuenta('existe');
  const omitidas = filas.filter((f) => f.omitida).length;
  const porGuardar = nuevos + actualizan + completan;
  const encabezados = hoja?.filas[filaEnc]?.map(texto) || [];
  const faltaNombre = !juntar && mapeo.nombre === undefined;
  const faltaFecha = !juntar && mapeo.fecha === undefined && mapeo.dia === undefined;
  const listo = !!archivo && acciones.length === filas.length && porGuardar > 0 && !progreso && !faltaNombre;

  async function importar() {
    if (!archivo || !listo) return;
    setError('');
    setResultado('');
    const ahora = new Date().toISOString();
    const importacion = { archivo: archivo.name, hoja: juntar ? 'Hojas por mes' : hoja.nombre, fecha: ahora };
    const porId = new Map(lista.map((c) => [c.id, c]));
    // Hijos y papás de la misma familia quedan en el mismo grupo.
    const grupos = new Map<string, string>();
    lista.forEach((c) => c.familia && c.grupo && grupos.set(normalizarNombre(c.familia), c.grupo));
    const grupoDe = (familia: string) => {
      const k = normalizarNombre(familia);
      if (!k) return nuevoId(12);
      if (!grupos.has(k)) grupos.set(k, nuevoId(12));
      return grupos.get(k)!;
    };

    const ops: OperacionLote[] = [];
    filas.forEach((f, i) => {
      const a = acciones[i];
      if (!a || a.tipo === 'existe') return;
      const antes = porId.get(a.id);
      const { id: _id, ...previo } = (antes || {}) as Partial<Cumple>;
      let data: Record<string, unknown>;
      if (a.tipo === 'nuevo' || !antes) {
        const nuevo: Omit<Cumple, 'id'> = {
          nombre: f.nombre,
          dia: f.dia,
          mes: f.mes,
          anio: f.anio,
          foto: '',
          telefono: f.telefono,
          familia: f.familia,
          grupo: grupoDe(f.familia),
          parentesco: f.parentesco || 'titular',
          origen: 'excel',
          enlace: '',
          autorizaFoto: true,
          creado: ahora,
          importacion,
        };
        data = nuevo;
      } else if (a.tipo === 'completar') {
        data = {
          ...previo,
          telefono: previo.telefono || f.telefono,
          anio: previo.anio || f.anio,
          familia: previo.familia || f.familia,
        };
      } else {
        data = { ...previo, ...datosActualizados(antes, f), ...(previo.importacion ? { importacion } : {}) };
      }
      ops.push({ tipo: 'guardar', ruta: `${RUTA_CUMPLES}/${a.id}`, data });
    });

    try {
      await ejecutarLote(ops, (n) => setProgreso(`Guardando… ${n} de ${ops.length}`), `Excel "${archivo.name}" → cumpleaños`);
      setResultado(
        [`${nuevos} nuevo(s)`, actualizan ? `${actualizan} actualizado(s)` : '', completan ? `${completan} completado(s)` : '', yaEstan ? `${yaEstan} ya estaban (no se tocaron)` : '']
          .filter(Boolean)
          .join(', '),
      );
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setProgreso('');
    }
  }

  return (
    <div className="pila">
      <section className="tarjeta">
        <h2 className="con-icono">
          <FileSpreadsheet size={22} /> Importar cumpleaños desde Excel
        </h2>
        <p className="suave">
          Sube la lista que ya tienen (.xlsx, .xls o .csv). Jeivi reconoce las columnas y te muestra una vista previa antes de guardar. Cuando
          la actualicen, vuelvan a subirla: lo nuevo se agrega, lo que cambió se actualiza y nadie se duplica. A quien ya se registró por el
          link solo se le completan los datos que le falten.
        </p>
        <div className="acciones">
          <label className="boton primario subir-archivo">
            <Upload size={16} /> {archivo ? 'Subir otro archivo' : 'Elegir archivo'}
            <input type="file" accept={ACEPTA_ARCHIVOS} hidden onChange={elegirArchivo} />
          </label>
          <button className="boton" onClick={() => descargarPlantillaCumples()}>
            <Download size={16} /> Descargar plantilla
          </button>
          {lista.length > 0 && (
            <button className="boton" onClick={() => exportarCumples(lista)}>
              <Download size={16} /> Descargar la lista actual
            </button>
          )}
        </div>
        {error && <div className="error">{error}</div>}
      </section>

      {hoja && archivo && (
        <section className="tarjeta formulario">
          <p className="suave pequeno">
            Archivo: <strong>{archivo.name}</strong>
            {hojas.length > 1 ? ` · ${hojas.length} hojas` : ''}
          </p>
          {hojasDeMes.length >= 2 && (
            <label className="interruptor">
              <input type="checkbox" checked={juntar} onChange={(e) => setJuntar(e.target.checked)} />
              <span>El Excel tiene una hoja por mes ({hojasDeMes.length} hojas). Importarlas todas juntas.</span>
            </label>
          )}
          {!juntar && (
            <>
              <div className="fila">
                {hojas.length > 1 && (
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
                )}
                <label>
                  Fila de los títulos
                  <select
                    value={filaEnc}
                    onChange={(e) => {
                      const f = Number(e.target.value);
                      setFilaEnc(f);
                      setMapeo(sugerirMapeoCumples((hoja.filas[f] || []).map(texto)));
                    }}
                  >
                    {hoja.filas.slice(0, 15).map((f, i) => (
                      <option key={i} value={i}>
                        Fila {i + 1}: {f.map(texto).filter(Boolean).slice(0, 4).join(' · ').slice(0, 60) || '(vacía)'}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Mes de la lista (si solo trae el día)
                  <select value={mesHoja ?? ''} onChange={(e) => setMesHoja(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">— Viene en el Excel —</option>
                    {MESES.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <h3>Columnas</h3>
              <div className="fila">
                {CAMPOS_CUMPLE.filter((c) => c !== 'id' || mapeo.id !== undefined).map((c) => (
                  <label key={c}>
                    {ETIQUETA_CUMPLE[c]}
                    {c === 'nombre' ? ' *' : ''}
                    <select value={mapeo[c] ?? ''} onChange={(e) => setMapeo((m) => ({ ...m, [c]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
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
              {faltaNombre && <div className="aviso">Indica qué columna tiene el nombre.</div>}
              {!faltaNombre && faltaFecha && !mesHoja && <div className="aviso">Indica qué columna tiene la fecha de cumpleaños (o el día y el mes).</div>}
            </>
          )}

          <h3>Vista previa</h3>
          <div className="kpis">
            <div className="tarjeta kpi">
              <span>Nuevos</span>
              <strong className="texto-exito">{nuevos}</strong>
            </div>
            <div className="tarjeta kpi">
              <span>Se actualizan / completan</span>
              <strong>{actualizan + completan}</strong>
            </div>
            <div className="tarjeta kpi">
              <span>Sin cambios / ya estaban</span>
              <strong>{yaEstan}</strong>
            </div>
            <div className="tarjeta kpi">
              <span>Filas que se omiten</span>
              <strong>{omitidas}</strong>
            </div>
          </div>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Nombre</th>
                  <th>Cumpleaños</th>
                  <th>WhatsApp</th>
                  <th>Familia</th>
                  <th>Qué pasa</th>
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, 150).map((f, i) => {
                  const e = textoAccion(f, acciones[i]);
                  return (
                    <tr key={`${f.hoja}-${f.fila}`} className={f.omitida ? 'omitida' : ''}>
                      <td>{juntar ? `${f.hoja} · ${f.fila}` : f.fila}</td>
                      <td>
                        {f.nombre || '—'}
                        {f.parentesco === 'hijo' && <span className="chip mini">hijo/a</span>}
                      </td>
                      <td>{f.dia ? `${textoFecha(f)}${f.anio ? ` ${f.anio}` : ''}` : '—'}</td>
                      <td>{f.telefono || '—'}</td>
                      <td>{f.familia || '—'}</td>
                      <td className={e.clase}>{e.texto}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filas.length > 150 && <p className="suave pequeno">…y {filas.length - 150} filas más.</p>}
          </div>
          {progreso && <div className="aviso">{progreso}</div>}
          {resultado && (
            <div className="exito con-icono">
              <CheckCircle2 size={18} /> Listo: {resultado}. <Link to="/m/cumpleanos/registros">Ver registros</Link>
            </div>
          )}
          <button className="boton primario" onClick={importar} disabled={!listo}>
            <Upload size={16} /> Guardar {porGuardar} cumpleaños
          </button>
        </section>
      )}
    </div>
  );
}
