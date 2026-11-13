import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { explicarError } from '../../lib/errores';
import { Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { Image as ImageIcon, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { Layout } from '../../core/Layout';
import { Cargando } from '../../core/Cargando';
import { GestorEnlaces } from '../../core/GestorEnlaces';
import { moduloPorId } from '../../core/modulos';
import { borrarDoc, escucharColeccion, guardarDoc } from '../../lib/datos';
import { nuevoId } from '../../lib/enlaces';
import { guardarFoto } from '../../lib/fotos';
import { hoyISO } from '../../lib/fechas';
import { useSesion } from '../../lib/sesion';
import { limpiarTelefono, numeroWhatsApp } from '../lectura/suscriptores';
import { BannerCumple } from './BannerCumple';
import { AvisoEncargo, Encargos, marcarFelicitado, useEncargos } from './Encargos';
import { MESES, RUTA_CUMPLES, diasParaCumple, edadQueCumple, mensajeFelicitacion, textoFecha, type Cumple } from './datos';

const modulo = moduloPorId('cumpleanos')!;

function useCumples() {
  const [lista, setLista] = useState<Cumple[] | null>(null);
  useEffect(() => escucharColeccion<Cumple>(RUTA_CUMPLES, (d) => setLista(d)), []);
  return lista;
}

export function CumpleanosModulo() {
  const lista = useCumples();
  return (
    <Layout
      modulo={modulo}
      pestanas={[
        { a: '/m/cumpleanos', texto: 'Próximos', fin: true },
        { a: '/m/cumpleanos/calendario', texto: 'Calendario' },
        { a: '/m/cumpleanos/registros', texto: 'Registros' },
        { a: '/m/cumpleanos/banner', texto: 'Banner' },
        { a: '/m/cumpleanos/encargados', texto: 'Encargados' },
        { a: '/m/cumpleanos/link', texto: 'Link de registro' },
      ]}
    >
      {!lista ? (
        <Cargando />
      ) : (
        <Routes>
          <Route index element={<Proximos lista={lista} />} />
          <Route path="calendario" element={<Calendario lista={lista} />} />
          <Route path="registros" element={<Registros lista={lista} />} />
          <Route path="banner" element={<PaginaBanner lista={lista} />} />
          <Route path="encargados" element={<Encargos lista={lista} />} />
          <Route
            path="link"
            element={
              <GestorEnlaces
                modulo="cumpleanos"
                mensaje="🎂 ¡Queremos celebrar tu cumpleaños! Registra tu fecha y la de tus hijos (con foto si quieres) en este link:"
              />
            }
          />
          <Route path="*" element={<Navigate to="/m/cumpleanos" replace />} />
        </Routes>
      )}
    </Layout>
  );
}

function Avatar({ c, tam = 48 }: { c: Cumple; tam?: number }) {
  return c.foto ? (
    <img className="avatar-cumple" src={c.foto} alt="" style={{ width: tam, height: tam }} />
  ) : (
    <span className="avatar-cumple vacio" style={{ width: tam, height: tam, fontSize: tam * 0.42 }}>
      {c.nombre.charAt(0).toUpperCase()}
    </span>
  );
}

function TarjetaCumple({ c, hoy }: { c: Cumple; hoy: string }) {
  const { iglesia } = useSesion();
  const dias = diasParaCumple(c, hoy);
  const edad = edadQueCumple(c, hoy);
  return (
    <li className={`cumple ${dias === 0 ? 'es-hoy' : ''}`}>
      <Avatar c={c} />
      <div className="dia-info">
        <strong>{c.nombre}</strong>
        <small>
          {textoFecha(c)}
          {edad ? ` · cumple ${edad}` : ''}
          {c.parentesco === 'hijo' && c.familia ? ` · hijo/a de ${c.familia}` : ''}
        </small>
      </div>
      <span className="chip">{dias === 0 ? '¡Hoy! 🎉' : dias === 1 ? 'Mañana' : `En ${dias} días`}</span>
      <Link to={`/m/cumpleanos/banner?id=${c.id}`} className="icono-boton" title="Crear banner">
        <ImageIcon size={18} />
      </Link>
      {c.telefono && (
        <a
          className="icono-boton"
          href={`https://wa.me/${numeroWhatsApp(c.telefono)}?text=${encodeURIComponent(mensajeFelicitacion(c, iglesia.nombre))}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Felicitar por WhatsApp"
        >
          <MessageCircle size={18} />
        </a>
      )}
    </li>
  );
}

function Proximos({ lista }: { lista: Cumple[] }) {
  const hoy = hoyISO();
  const orden = useMemo(() => [...lista].sort((a, b) => diasParaCumple(a, hoy) - diasParaCumple(b, hoy)), [lista, hoy]);
  const deHoy = orden.filter((c) => diasParaCumple(c, hoy) === 0);
  const semana = orden.filter((c) => {
    const d = diasParaCumple(c, hoy);
    return d > 0 && d <= 7;
  });
  const mes = orden.filter((c) => {
    const d = diasParaCumple(c, hoy);
    return d > 7 && d <= 31;
  });

  if (!lista.length) {
    return (
      <section className="tarjeta centrado">
        <h2>Aún no hay cumpleaños registrados</h2>
        <p className="suave">Crea un link de registro y compártelo con la congregación, o agrégalos tú en “Registros”.</p>
        <div className="acciones centrar">
          <Link className="boton primario" to="/m/cumpleanos/link">
            Crear link de registro
          </Link>
          <Link className="boton" to="/m/cumpleanos/registros">
            Agregar manualmente
          </Link>
        </div>
      </section>
    );
  }

  const bloque = (titulo: string, items: Cumple[], vacio: string) => (
    <section className="tarjeta">
      <h2>{titulo}</h2>
      {items.length ? (
        <ul className="lista-cumples">
          {items.map((c) => (
            <TarjetaCumple key={c.id} c={c} hoy={hoy} />
          ))}
        </ul>
      ) : (
        <p className="suave">{vacio}</p>
      )}
    </section>
  );

  return (
    <div className="pila">
      <AvisoEncargo lista={lista} />
      {bloque('🎉 Hoy', deHoy, 'Nadie cumple años hoy.')}
      {bloque('Próximos 7 días', semana, 'Sin cumpleaños esta semana.')}
      {bloque('Resto del mes', mes, 'Sin más cumpleaños en los próximos 30 días.')}
    </div>
  );
}

function Calendario({ lista }: { lista: Cumple[] }) {
  const mesActual = new Date().getMonth() + 1;
  return (
    <div className="rejilla-semanas">
      {MESES.map((m, i) => {
        const del = lista.filter((c) => c.mes === i + 1).sort((a, b) => a.dia - b.dia);
        return (
          <section key={m} className={`tarjeta semana ${mesActual === i + 1 ? 'mes-actual' : ''}`}>
            <h3>
              {m} <small>· {del.length}</small>
            </h3>
            <ul className="lista-dias compacta">
              {del.map((c) => (
                <li key={c.id}>
                  <span className="dia-numero">{c.dia}</span>
                  <Avatar c={c} tam={28} />
                  <div className="dia-info">
                    <strong>{c.nombre}</strong>
                  </div>
                  <Link to={`/m/cumpleanos/banner?id=${c.id}`} className="icono-boton" title="Banner">
                    <ImageIcon size={15} />
                  </Link>
                </li>
              ))}
              {!del.length && <li className="suave pequeno">—</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

function FormCumple({ inicial, alTerminar }: { inicial?: Cumple; alTerminar: () => void }) {
  const { iglesia, perfil } = useSesion();
  const [nombre, setNombre] = useState(inicial?.nombre || '');
  const [dia, setDia] = useState(inicial ? String(inicial.dia) : '');
  const [mes, setMes] = useState(inicial ? String(inicial.mes) : '');
  const [anio, setAnio] = useState(inicial?.anio ? String(inicial.anio) : '');
  const [telefono, setTelefono] = useState(inicial?.telefono || '');
  const [familia, setFamilia] = useState(inicial?.familia || '');
  const [parentesco, setParentesco] = useState<Cumple['parentesco']>(inicial?.parentesco || 'titular');
  const [foto, setFoto] = useState(inicial?.foto || '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setOcupado(true);
    try {
      setFoto(await guardarFoto(f, iglesia, 'jeivi/cumpleanos', { autor: perfil, titulo: `Foto de cumpleaños: ${nombre}` }));
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setOcupado(false);
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const d = Number(dia);
    const m = Number(mes);
    if (!nombre.trim() || !(d >= 1 && d <= 31) || !(m >= 1 && m <= 12)) return setError('Nombre, día y mes son obligatorios.');
    const datos: Omit<Cumple, 'id'> = {
      nombre: nombre.trim(),
      dia: d,
      mes: m,
      anio: anio ? Number(anio) : null,
      foto,
      telefono: limpiarTelefono(telefono),
      familia: familia.trim(),
      grupo: inicial?.grupo || nuevoId(12),
      parentesco,
      origen: inicial?.origen || 'manual',
      enlace: inicial?.enlace || '',
      autorizaFoto: inicial?.autorizaFoto ?? true,
      creado: inicial?.creado || new Date().toISOString(),
    };
    await guardarDoc(`${RUTA_CUMPLES}/${inicial?.id || nuevoId(16)}`, datos, false);
    alTerminar();
  }

  return (
    <form className="tarjeta formulario" onSubmit={guardar}>
      <h2>{inicial ? 'Editar cumpleaños' : 'Agregar cumpleaños'}</h2>
      <div className="persona-cuerpo">
        <label className="foto-circulo">
          {foto ? <img src={foto} alt="" /> : <Plus size={24} />}
          <span>{ocupado ? 'Subiendo…' : foto ? 'Cambiar' : 'Foto'}</span>
          <input type="file" accept="image/*" hidden onChange={subirFoto} />
        </label>
        <div className="formulario crece">
          <label>
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </label>
          <div className="fila">
            <label>
              Día
              <input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} required />
            </label>
            <label>
              Mes
              <select value={mes} onChange={(e) => setMes(e.target.value)} required>
                <option value="">—</option>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Año (opcional)
              <input type="number" min={1900} max={new Date().getFullYear()} value={anio} onChange={(e) => setAnio(e.target.value)} />
            </label>
          </div>
        </div>
      </div>
      <div className="fila">
        <label>
          Tipo
          <select value={parentesco} onChange={(e) => setParentesco(e.target.value as Cumple['parentesco'])}>
            <option value="titular">Adulto</option>
            <option value="hijo">Hijo/a</option>
          </select>
        </label>
        <label>
          Familia / responsable
          <input value={familia} onChange={(e) => setFamilia(e.target.value)} placeholder="Ej. Familia Pérez" />
        </label>
        <label>
          WhatsApp
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" />
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button className="boton primario" disabled={ocupado}>
          Guardar
        </button>
        <button type="button" className="boton" onClick={alTerminar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Registros({ lista }: { lista: Cumple[] }) {
  const { puede } = useSesion();
  const [filtro, setFiltro] = useState('');
  const [editando, setEditando] = useState<Cumple | 'nuevo' | null>(null);
  const visibles = lista
    .filter((c) => `${c.nombre} ${c.familia}`.toLowerCase().includes(filtro.toLowerCase()))
    .sort((a, b) => a.mes - b.mes || a.dia - b.dia);

  function exportarCSV() {
    const filas = [['Nombre', 'Fecha', 'Año', 'Tipo', 'Familia', 'WhatsApp', 'Registrado por']];
    visibles.forEach((c) =>
      filas.push([c.nombre, `${pad(c.dia)}/${pad(c.mes)}`, c.anio ? String(c.anio) : '', c.parentesco === 'hijo' ? 'Hijo/a' : 'Adulto', c.familia || '', c.telefono || '', c.origen === 'link' ? 'Link' : 'Diácono']),
    );
    const csv = '﻿' + filas.map((f) => f.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'cumpleanos.csv';
    a.click();
  }

  if (editando) return <FormCumple inicial={editando === 'nuevo' ? undefined : editando} alTerminar={() => setEditando(null)} />;

  return (
    <section className="tarjeta">
      <div className="fila-entre">
        <div>
          <h2>Registros</h2>
          <p className="suave">{lista.length} personas</p>
        </div>
        <div className="acciones">
          <button className="boton" onClick={exportarCSV}>
            Exportar a Excel
          </button>
          <button className="boton primario" onClick={() => setEditando('nuevo')}>
            <Plus size={16} /> Agregar
          </button>
        </div>
      </div>
      <label>
        Buscar
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nombre o familia" />
      </label>
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th />
              <th>Nombre</th>
              <th>Fecha</th>
              <th>Familia</th>
              <th>WhatsApp</th>
              <th>Origen</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibles.map((c) => (
              <tr key={c.id}>
                <td>
                  <Avatar c={c} tam={32} />
                </td>
                <td>
                  {c.nombre}
                  {c.parentesco === 'hijo' && <span className="chip mini">hijo/a</span>}
                </td>
                <td>
                  {textoFecha(c)}
                  {c.anio ? ` ${c.anio}` : ''}
                </td>
                <td>{c.familia || '—'}</td>
                <td>{c.telefono || '—'}</td>
                <td>{c.origen === 'link' ? 'Link' : 'Diácono'}</td>
                <td className="acciones-fila">
                  <button className="icono-boton" title="Editar" onClick={() => setEditando(c)}>
                    <Pencil size={15} />
                  </button>
                  {puede('pastor') && (
                    <button className="icono-boton peligro" title="Eliminar" onClick={() => confirm(`¿Eliminar a ${c.nombre}?`) && borrarDoc(`${RUTA_CUMPLES}/${c.id}`)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!visibles.length && (
              <tr>
                <td colSpan={7} className="suave">
                  Sin registros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PaginaBanner({ lista }: { lista: Cumple[] }) {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const hoy = hoyISO();
  const orden = useMemo(() => [...lista].sort((a, b) => diasParaCumple(a, hoy) - diasParaCumple(b, hoy)), [lista, hoy]);
  const persona = lista.find((c) => c.id === params.get('id')) || orden[0];
  const encargos = useEncargos();
  const { perfil, puede } = useSesion();

  if (!persona) {
    return (
      <section className="tarjeta centrado">
        <p className="suave">Primero registra al menos un cumpleaños.</p>
        <button className="boton primario" onClick={() => nav('/m/cumpleanos/registros')}>
          Ir a registros
        </button>
      </section>
    );
  }

  return (
    <div className="pila">
      <div className="tarjeta fila-entre">
        <div>
          <h2>Banner de cumpleaños</h2>
          <p className="suave">Elige a la persona, ajusta y compártelo por WhatsApp.</p>
        </div>
        <label>
          Cumpleañero
          <select value={persona.id} onChange={(e) => setParams({ id: e.target.value })}>
            {orden.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} — {textoFecha(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <BannerCumple persona={persona} alEnviar={() => marcarFelicitado(persona, lista, encargos, perfil, puede('pastor'))} />
    </div>
  );
}
