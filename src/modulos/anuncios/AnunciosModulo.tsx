import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { explicarError } from '../../lib/errores';
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Image as ImageIcon, Mail, MessageCircle, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { Layout } from '../../core/Layout';
import { Cargando } from '../../core/Cargando';
import { GestorEnlaces } from '../../core/GestorEnlaces';
import { ListaSuscriptores } from '../../core/ListaSuscriptores';
import { moduloPorId } from '../../core/modulos';
import { llamarApi } from '../../lib/api';
import { borrarDoc, escucharColeccion, guardarDoc } from '../../lib/datos';
import { nuevoId } from '../../lib/enlaces';
import { formatoCorto, hoyISO } from '../../lib/fechas';
import { guardarFoto } from '../../lib/fotos';
import { useSesion } from '../../lib/sesion';
import { GeneradorBanner } from '../lectura/GeneradorBanner';
import { useLectura } from '../lectura/useLectura';
import { CATEGORIAS_ANUNCIO, RUTA_ANUNCIOS, mensajeAnuncio, ordenarAnuncios, vigente, type Anuncio } from './datos';

const modulo = moduloPorId('anuncios')!;

export function AnunciosModulo() {
  const [lista, setLista] = useState<Anuncio[] | null>(null);
  useEffect(() => escucharColeccion<Anuncio>(RUTA_ANUNCIOS, (d) => setLista(ordenarAnuncios(d))), []);
  return (
    <Layout
      modulo={modulo}
      pestanas={[
        { a: '/m/anuncios', texto: 'Tablero', fin: true },
        { a: '/m/anuncios/nuevo', texto: 'Nuevo anuncio' },
        { a: '/m/anuncios/banner', texto: 'Banner' },
        { a: '/m/anuncios/link', texto: 'Link y suscriptores' },
      ]}
    >
      {!lista ? (
        <Cargando />
      ) : (
        <Routes>
          <Route index element={<Tablero lista={lista} />} />
          <Route path="nuevo" element={<Editor />} />
          <Route path="editar/:id" element={<EditarAnuncio lista={lista} />} />
          <Route path="banner" element={<PaginaBanner lista={lista} />} />
          <Route
            path="link"
            element={
              <div className="pila">
                <GestorEnlaces modulo="anuncios" mensaje="📢 Mira los anuncios de la iglesia y suscríbete para recibir los avisos:" />
                <ListaSuscriptores tema="anuncios" titulo="Suscritos a los avisos" mensaje={lista.filter((a) => vigente(a, hoyISO())).map((a) => `• ${a.titulo}${a.cuando ? ` (${a.cuando})` : ''}`).join('\n') || 'Avisos de la iglesia'} />
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/m/anuncios" replace />} />
        </Routes>
      )}
    </Layout>
  );
}

function TarjetaAnuncio({ a }: { a: Anuncio }) {
  const { iglesia, puede } = useSesion();
  const nav = useNavigate();
  const [estado, setEstado] = useState('');

  async function enviarCorreo() {
    if (!confirm(`¿Enviar "${a.titulo}" por correo a todos los suscritos a los avisos?`)) return;
    setEstado('Enviando…');
    try {
      const r = await llamarApi<{ enviado: number }>('/api/enviar-anuncio', { anuncioId: a.id });
      setEstado(`Enviado a ${r.enviado} correo(s).`);
    } catch (e) {
      setEstado((e as Error).message);
    }
  }

  return (
    <article className={`anuncio ${a.destacado ? 'destacado' : ''}`}>
      {a.imagen && <img src={a.imagen} alt="" />}
      <div className="anuncio-cuerpo">
        <div className="fila-entre">
          <span className="chip">{a.categoria}</span>
          <span className="acciones-fila">
            {a.destacado && <Pin size={15} className="texto-acento" />}
            {a.publico ? <Eye size={15} aria-label="En el tablero público" /> : <EyeOff size={15} aria-label="Solo equipo" />}
          </span>
        </div>
        <h3>{a.titulo}</h3>
        {a.cuando && <p className="anuncio-cuando">🗓️ {a.cuando}</p>}
        <p className="anuncio-texto">{a.texto}</p>
        <small className="suave">
          {a.creadoPorNombre} · desde {formatoCorto(a.desde)}
          {a.hasta ? ` hasta ${formatoCorto(a.hasta)}` : ''}
          {a.enviado ? ` · enviado por correo a ${a.enviadoA ?? 0}` : ''}
        </small>
        <div className="acciones">
          <button className="boton pequeno" onClick={() => nav(`/m/anuncios/banner?id=${a.id}`)}>
            <ImageIcon size={14} /> Banner
          </button>
          <a className="boton whatsapp pequeno" href={`https://wa.me/?text=${encodeURIComponent(mensajeAnuncio(a, iglesia.nombre))}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={14} /> WhatsApp
          </a>
          <button className="boton pequeno" onClick={enviarCorreo}>
            <Mail size={14} /> Correo
          </button>
          <Link className="icono-boton" to={`/m/anuncios/editar/${a.id}`} title="Editar">
            <Pencil size={15} />
          </Link>
          {puede('pastor') && (
            <button className="icono-boton peligro" title="Eliminar" onClick={() => confirm('¿Eliminar este anuncio?') && borrarDoc(`${RUTA_ANUNCIOS}/${a.id}`)}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
        {estado && <div className="aviso">{estado}</div>}
      </div>
    </article>
  );
}

function Tablero({ lista }: { lista: Anuncio[] }) {
  const hoy = hoyISO();
  const [verPasados, setVerPasados] = useState(false);
  const vigentes = lista.filter((a) => vigente(a, hoy));
  const programados = lista.filter((a) => a.desde > hoy);
  const pasados = lista.filter((a) => a.hasta && a.hasta < hoy);

  return (
    <div className="pila">
      <div className="tarjeta fila-entre">
        <div>
          <h2>Tablero informativo</h2>
          <p className="suave">
            {vigentes.length} vigentes · {programados.length} programados. Los marcados con 👁 se ven en el link público.
          </p>
        </div>
        <Link className="boton primario" to="/m/anuncios/nuevo">
          <Plus size={16} /> Nuevo anuncio
        </Link>
      </div>
      {vigentes.length ? (
        <div className="rejilla-anuncios">
          {vigentes.map((a) => (
            <TarjetaAnuncio key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <p className="tarjeta suave">No hay anuncios vigentes.</p>
      )}
      {programados.length > 0 && (
        <>
          <h3>Programados</h3>
          <div className="rejilla-anuncios">
            {programados.map((a) => (
              <TarjetaAnuncio key={a.id} a={a} />
            ))}
          </div>
        </>
      )}
      {pasados.length > 0 && (
        <button className="enlace" onClick={() => setVerPasados((v) => !v)}>
          {verPasados ? 'Ocultar' : 'Ver'} anuncios vencidos ({pasados.length})
        </button>
      )}
      {verPasados && (
        <div className="rejilla-anuncios apagado">
          {pasados.map((a) => (
            <TarjetaAnuncio key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function EditarAnuncio({ lista }: { lista: Anuncio[] }) {
  const { id } = useParams();
  const a = lista.find((x) => x.id === id);
  return a ? <Editor inicial={a} /> : <Navigate to="/m/anuncios" replace />;
}

function Editor({ inicial }: { inicial?: Anuncio }) {
  const { perfil } = useSesion();
  const nav = useNavigate();
  const [titulo, setTitulo] = useState(inicial?.titulo || '');
  const [texto, setTexto] = useState(inicial?.texto || '');
  const [categoria, setCategoria] = useState(inicial?.categoria || 'General');
  const [cuando, setCuando] = useState(inicial?.cuando || '');
  const [imagen, setImagen] = useState(inicial?.imagen || '');
  const [publico, setPublico] = useState(inicial?.publico ?? true);
  const [destacado, setDestacado] = useState(inicial?.destacado ?? false);
  const [desde, setDesde] = useState(inicial?.desde || hoyISO());
  const [hasta, setHasta] = useState(inicial?.hasta || '');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setSubiendo(true);
    try {
      setImagen(await guardarFoto(f, 'jeivi/anuncios', { autor: perfil, titulo: `Imagen de anuncio: ${titulo}` }));
    } catch (err) {
      setError(explicarError(err));
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    if (hasta && hasta < desde) return setError('La fecha "hasta" no puede ser antes de "desde".');
    const datos: Omit<Anuncio, 'id'> = {
      titulo: titulo.trim(),
      texto: texto.trim(),
      categoria,
      cuando: cuando.trim(),
      imagen,
      publico,
      destacado,
      desde,
      hasta: hasta || '',
      creado: inicial?.creado || new Date().toISOString(),
      creadoPor: inicial?.creadoPor || perfil.uid,
      creadoPorNombre: inicial?.creadoPorNombre || perfil.nombre,
      ...(inicial?.enviado ? { enviado: inicial.enviado, enviadoA: inicial.enviadoA } : {}),
    };
    await guardarDoc(`${RUTA_ANUNCIOS}/${inicial?.id || nuevoId(16)}`, datos, false);
    nav('/m/anuncios');
  }

  return (
    <form className="tarjeta formulario estrecha" onSubmit={guardar}>
      <h2>{inicial ? 'Editar anuncio' : 'Nuevo anuncio'}</h2>
      <label>
        Título
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={90} placeholder="Ej. Vigilia de oración" />
      </label>
      <div className="fila">
        <label>
          Categoría
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS_ANUNCIO.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Cuándo (opcional)
          <input value={cuando} onChange={(e) => setCuando(e.target.value)} placeholder="Viernes 21 · 7:00 p.m." />
        </label>
      </div>
      <label>
        Texto
        <textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} required maxLength={1200} />
      </label>
      <div className="fila">
        <label>
          Mostrar desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
        </label>
        <label>
          Hasta (opcional)
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
      </div>
      <div className="fila logo-fila">
        {imagen && <img src={imagen} alt="" className="logo-previa" />}
        <label className="boton subir-archivo">
          <ImageIcon size={16} /> {subiendo ? 'Subiendo…' : imagen ? 'Cambiar imagen' : 'Agregar imagen (opcional)'}
          <input type="file" accept="image/*" hidden onChange={subir} />
        </label>
        {imagen && (
          <button type="button" className="enlace" onClick={() => setImagen('')}>
            Quitar
          </button>
        )}
      </div>
      <label className="interruptor">
        <input type="checkbox" checked={publico} onChange={(e) => setPublico(e.target.checked)} />
        <span>Mostrar en el tablero público (link para la congregación)</span>
      </label>
      <label className="interruptor">
        <input type="checkbox" checked={destacado} onChange={(e) => setDestacado(e.target.checked)} />
        <span>Destacar (aparece primero)</span>
      </label>
      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button className="boton primario" disabled={subiendo}>
          Guardar
        </button>
        <button type="button" className="boton" onClick={() => nav('/m/anuncios')}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function PaginaBanner({ lista }: { lista: Anuncio[] }) {
  const { iglesia } = useSesion();
  const { config } = useLectura();
  const [params, setParams] = useSearchParams();
  const hoy = hoyISO();
  const opciones = lista.filter((a) => vigente(a, hoy) || a.desde > hoy);
  const a = lista.find((x) => x.id === params.get('id')) || opciones[0];
  const inicial = useMemo(
    () => (a ? { etiqueta: a.categoria, titulo: 'Anuncio', lectura: a.titulo, nota: a.texto.slice(0, 280), fecha: a.cuando || '' } : null),
    [a?.id, a?.titulo, a?.texto, a?.cuando, a?.categoria],
  );

  if (!a || !inicial) {
    return (
      <section className="tarjeta centrado">
        <p className="suave">Primero crea un anuncio.</p>
        <Link className="boton primario" to="/m/anuncios/nuevo">
          Nuevo anuncio
        </Link>
      </section>
    );
  }

  return (
    <div className="pila">
      <div className="tarjeta fila-entre">
        <div>
          <h2>Banner del anuncio</h2>
          <p className="suave">Usa la imagen del anuncio con “Subir mi foto” o un fondo del banco.</p>
        </div>
        <label>
          Anuncio
          <select value={a.id} onChange={(e) => setParams({ id: e.target.value })}>
            {lista.map((x) => (
              <option key={x.id} value={x.id}>
                {x.titulo}
              </option>
            ))}
          </select>
        </label>
      </div>
      <GeneradorBanner
        inicial={inicial}
        pie={config.pieBanner}
        imagenesBanco={a.imagen ? [{ id: `anuncio-${a.id}`, url: a.imagen, titulo: 'Imagen del anuncio' }, ...config.imagenes] : config.imagenes}
        textoMensaje={() => mensajeAnuncio(a, iglesia.nombre)}
        nombreArchivo={`anuncio-${a.titulo.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}`}
        etiquetas={{ etiqueta: 'Categoría', titulo: 'Encabezado', lectura: 'Título del anuncio', nota: 'Texto', fecha: 'Cuándo' }}
        separarComas={false}
        moduloHistorial="anuncios"
      />
    </div>
  );
}
