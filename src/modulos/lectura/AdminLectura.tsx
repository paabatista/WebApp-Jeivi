import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useSesion } from '../../lib/sesion';
import { borrarDoc, guardarDoc } from '../../lib/datos';
import { subirACloudinary } from '../../lib/cloudinary';
import { diaSemana, formatoCorto, formatoLargo, primerLunes } from '../../lib/fechas';
import { DIAS_SEMANA, PLAN, textoPasajes } from './plan';
import { fechaFinCiclo, type Ciclo } from './calendario';
import { LIBROS, armarCita } from './libros';
import { RUTA_AJUSTES, RUTA_CONFIG, ciclosPorDefecto, useLectura, type ImagenBanco } from './useLectura';
import { Cargando } from '../../core/Cargando';

const id = () => Math.random().toString(36).slice(2, 10);

export function AdminLectura() {
  const { puede } = useSesion();
  const lect = useLectura();
  if (lect.cargando) return <Cargando />;
  return (
    <div className="pila">
      <AjusteDia />
      {puede('pastor') && <Ciclos />}
      {puede('pastor') && <Textos />}
      {puede('pastor') && <BancoImagenes />}
    </div>
  );
}

/* ---------- Ajustar la lectura de un día ---------- */
function AjusteDia() {
  const lect = useLectura();
  const [params] = useSearchParams();
  const [indice, setIndice] = useState<number>(() => {
    const p = params.get('dia');
    if (p !== null) return Number(p);
    return lect.estado.tipo === 'lectura' ? lect.estado.dia.indice : 0;
  });
  const dia = PLAN[indice];
  const ajuste = lect.ajustes[indice];
  const [lectura, setLectura] = useState('');
  const [nota, setNota] = useState('');
  const [libro, setLibro] = useState('Génesis');
  const [cap, setCap] = useState('');
  const [vDesde, setVDesde] = useState('');
  const [vHasta, setVHasta] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setLectura(ajuste?.lectura || '');
    setNota(ajuste?.nota || '');
  }, [indice, ajuste?.lectura, ajuste?.nota]);

  const caps = LIBROS.find(([l]) => l === libro)?.[1] || 1;

  function agregarCita() {
    const cita = armarCita(libro, cap, vDesde, vHasta);
    setLectura((l) => (l.trim() ? `${l.trim()}, ${cita}` : cita));
    setCap('');
    setVDesde('');
    setVHasta('');
  }

  async function guardar() {
    if (!lectura.trim() && !nota.trim()) await borrarDoc(`${RUTA_AJUSTES}/${indice}`);
    else await guardarDoc(`${RUTA_AJUSTES}/${indice}`, { lectura: lectura.trim(), nota: nota.trim() }, false);
    setMsg('Guardado. Ya se ve en la app y en el correo del día.');
    setTimeout(() => setMsg(''), 3000);
  }

  async function restaurar() {
    await borrarDoc(`${RUTA_AJUSTES}/${indice}`);
    setMsg('Se restauró la lectura original del plan.');
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <section className="tarjeta">
      <h2>Lectura y nota de un día</h2>
      <p className="suave">
        Por defecto se usa el plan de la iglesia. Aquí puedes escribir o seleccionar la cita exacta (ej. “Génesis 1:1-8, Mateo
        1:5”) y agregar una nota o versículo para el banner. Los hermanos eligen en qué versión leerla.
      </p>
      <div className="formulario">
        <label>
          Día del plan
          <select value={indice} onChange={(e) => setIndice(Number(e.target.value))}>
            {PLAN.map((d) => (
              <option key={d.indice} value={d.indice}>
                Semana {d.semana} · {DIAS_SEMANA[d.dia - 1]} — {textoPasajes(d.pasajes)}
                {lect.ajustes[d.indice] ? ' (ajustado)' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="suave pequeno">
          Lectura original del plan: <strong>{textoPasajes(dia.pasajes)}</strong>
        </p>

        <div className="constructor-cita">
          <select value={libro} onChange={(e) => (setLibro(e.target.value), setCap(''))} aria-label="Libro">
            {LIBROS.map(([l]) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <select value={cap} onChange={(e) => setCap(e.target.value)} aria-label="Capítulo">
            <option value="">Cap.</option>
            {Array.from({ length: caps }, (_, i) => (
              <option key={i + 1}>{i + 1}</option>
            ))}
          </select>
          <input value={vDesde} onChange={(e) => setVDesde(e.target.value.replace(/\D/g, ''))} placeholder="Vers. desde" inputMode="numeric" />
          <input value={vHasta} onChange={(e) => setVHasta(e.target.value.replace(/\D/g, ''))} placeholder="hasta" inputMode="numeric" />
          <button className="boton" onClick={agregarCita} type="button">
            <Plus size={16} /> Agregar
          </button>
        </div>

        <label>
          Lectura que se mostrará (vacío = la del plan)
          <input value={lectura} onChange={(e) => setLectura(e.target.value)} placeholder={textoPasajes(dia.pasajes)} />
        </label>
        <label>
          Nota o versículo para el banner (opcional)
          <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Pega aquí un versículo o una frase de ánimo" />
        </label>
        <div className="acciones">
          <button className="boton primario" onClick={guardar}>
            Guardar
          </button>
          {ajuste && (
            <button className="boton" onClick={restaurar}>
              <RotateCcw size={16} /> Restaurar original
            </button>
          )}
        </div>
        {msg && <div className="exito">{msg}</div>}
      </div>
    </section>
  );
}

/* ---------- Ciclos ---------- */
function Ciclos() {
  const lect = useLectura();
  const ciclos = useMemo(() => [...lect.ciclos].sort((a, b) => a.inicio.localeCompare(b.inicio)), [lect.ciclos]);
  const [nombre, setNombre] = useState('');
  const [inicio, setInicio] = useState(primerLunes(new Date().getFullYear() + 1, 1));
  const [pausa, setPausa] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const guardarCiclos = (c: Ciclo[]) => guardarDoc(RUTA_CONFIG, { ciclos: c });

  async function agregar() {
    setError('');
    if (!inicio) return;
    if (diaSemana(inicio) !== 1) return setError('El ciclo debe empezar un lunes.');
    const n = nombre.trim() || `Ciclo ${formatoLargo(inicio)}`;
    await guardarCiclos([...lect.ciclos, { id: id(), nombre: n, inicio, pausas: [] }]);
    setNombre('');
  }

  async function quitar(c: Ciclo) {
    if (!confirm(`¿Eliminar el ciclo "${c.nombre}"? El progreso de los hermanos en ese ciclo deja de mostrarse.`)) return;
    await guardarCiclos(lect.ciclos.filter((x) => x.id !== c.id));
  }

  async function agregarPausa(c: Ciclo) {
    const f = pausa[c.id];
    if (!f) return;
    const d = diaSemana(f);
    if (d === 0 || d === 6) return setError('Las pausas son para días de lunes a viernes.');
    await guardarCiclos(lect.ciclos.map((x) => (x.id === c.id ? { ...x, pausas: [...new Set([...(x.pausas || []), f])].sort() } : x)));
    setPausa((p) => ({ ...p, [c.id]: '' }));
  }

  async function quitarPausa(c: Ciclo, f: string) {
    await guardarCiclos(lect.ciclos.map((x) => (x.id === c.id ? { ...x, pausas: (x.pausas || []).filter((p) => p !== f) } : x)));
  }

  return (
    <section className="tarjeta">
      <h2>Ciclos de lectura</h2>
      <p className="suave">
        Cada ciclo recorre la Biblia completa en 26 semanas. Elige el lunes en que empieza. Las <strong>pausas</strong> son días
        en los que no se avanza (feriados, retiros) y corren el plan un día.
      </p>
      {lect.usandoCiclosPorDefecto && (
        <div className="aviso">
          Aún no has guardado ciclos; se usan los automáticos (primer lunes de enero y de julio).{' '}
          <button className="enlace" onClick={() => guardarCiclos(ciclosPorDefecto())}>
            Guardarlos para poder editarlos
          </button>
        </div>
      )}
      <ul className="lista-ciclos">
        {ciclos.map((c) => (
          <li key={c.id}>
            <div className="fila-entre">
              <div>
                <strong>{c.nombre}</strong>
                <small className="suave">
                  {' '}
                  · {formatoCorto(c.inicio)} → {formatoCorto(fechaFinCiclo(c))}
                </small>
              </div>
              {!lect.usandoCiclosPorDefecto && (
                <button className="icono-boton peligro" onClick={() => quitar(c)} title="Eliminar ciclo">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {!lect.usandoCiclosPorDefecto && (
              <div className="pausas">
                {(c.pausas || []).map((f) => (
                  <span key={f} className="chip">
                    {formatoCorto(f)}
                    <button onClick={() => quitarPausa(c, f)} aria-label="Quitar pausa">
                      ×
                    </button>
                  </span>
                ))}
                <input type="date" value={pausa[c.id] || ''} onChange={(e) => setPausa((p) => ({ ...p, [c.id]: e.target.value }))} />
                <button className="boton pequeno" onClick={() => agregarPausa(c)}>
                  Agregar pausa
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!lect.usandoCiclosPorDefecto && (
        <div className="fila">
          <label>
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Enero – Junio 2027" />
          </label>
          <label>
            Inicia (lunes)
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <button className="boton primario" onClick={agregar}>
            <Plus size={16} /> Agregar ciclo
          </button>
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </section>
  );
}

/* ---------- Textos ---------- */
function Textos() {
  const { config } = useLectura();
  const [finde, setFinde] = useState(config.mensajeFinDeSemana);
  const [pie, setPie] = useState(config.pieBanner);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setFinde(config.mensajeFinDeSemana);
    setPie(config.pieBanner);
  }, [config.mensajeFinDeSemana, config.pieBanner]);

  async function guardar() {
    await guardarDoc(RUTA_CONFIG, { mensajeFinDeSemana: finde.trim(), pieBanner: pie.trim() });
    setMsg('Guardado.');
    setTimeout(() => setMsg(''), 2500);
  }

  return (
    <section className="tarjeta">
      <h2>Textos</h2>
      <div className="formulario">
        <label>
          Mensaje de fin de semana
          <textarea rows={2} value={finde} onChange={(e) => setFinde(e.target.value)} />
        </label>
        <label>
          Pie del banner (web, redes o lema)
          <input value={pie} onChange={(e) => setPie(e.target.value)} />
        </label>
        <button className="boton primario" onClick={guardar}>
          Guardar
        </button>
        {msg && <div className="exito">{msg}</div>}
      </div>
    </section>
  );
}

/* ---------- Banco de imágenes ---------- */
function BancoImagenes() {
  const { iglesia } = useSesion();
  const { config } = useLectura();
  const [titulo, setTitulo] = useState('');
  const [url, setUrl] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const cl = iglesia.cloudinary;

  const guardarLista = (imagenes: ImagenBanco[]) => guardarDoc(RUTA_CONFIG, { imagenes });

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files || []);
    e.target.value = '';
    if (!archivos.length || !cl?.cloudName || !cl.uploadPreset) return;
    setError('');
    setSubiendo(true);
    try {
      const nuevas: ImagenBanco[] = [];
      for (const f of archivos) {
        const u = await subirACloudinary(f, cl.cloudName, cl.uploadPreset, 'jeivi/lectura');
        nuevas.push({ id: id(), url: u, titulo: titulo.trim() || f.name.replace(/\.\w+$/, '') });
      }
      await guardarLista([...config.imagenes, ...nuevas]);
      setTitulo('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  async function agregarUrl() {
    if (!/^https:\/\//.test(url.trim())) return setError('La dirección debe empezar con https://');
    await guardarLista([...config.imagenes, { id: id(), url: url.trim(), titulo: titulo.trim() || 'Imagen' }]);
    setUrl('');
    setTitulo('');
  }

  return (
    <section className="tarjeta">
      <h2>Banco de imágenes</h2>
      <p className="suave">
        Además de los 8 fondos incluidos, puedes sumar fotos propias de la iglesia. Aparecen para todos al crear el banner.
      </p>
      <div className="banco">
        {config.imagenes.map((i) => (
          <figure key={i.id}>
            <img src={i.url} alt={i.titulo} />
            <figcaption>{i.titulo}</figcaption>
            <button
              className="icono-boton peligro"
              onClick={() => confirm('¿Quitar esta imagen del banco?') && guardarLista(config.imagenes.filter((x) => x.id !== i.id))}
              title="Quitar"
            >
              <Trash2 size={14} />
            </button>
          </figure>
        ))}
        {!config.imagenes.length && <p className="suave pequeno">Todavía no hay fotos propias.</p>}
      </div>
      <div className="formulario">
        <label>
          Título (opcional)
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Altar, Congregación" />
        </label>
        {cl?.cloudName && cl.uploadPreset ? (
          <label className="boton primario subir-archivo">
            <Upload size={16} /> {subiendo ? 'Subiendo…' : 'Subir fotos'}
            <input type="file" accept="image/*" multiple onChange={subir} hidden disabled={subiendo} />
          </label>
        ) : (
          <div className="aviso">
            Para subir fotos desde el equipo, el super admin debe configurar Cloudinary en Configuración. Mientras tanto puedes
            pegar el enlace de una imagen.
          </div>
        )}
        <div className="fila">
          <label>
            O pega el enlace de una imagen
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </label>
          <button className="boton" onClick={agregarUrl}>
            Agregar
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>
    </section>
  );
}
