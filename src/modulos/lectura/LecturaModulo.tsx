import { useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Check, ChevronRight, Image as ImageIcon, MessageCircle, Pencil } from 'lucide-react';
import { Layout, type Pestana } from '../../core/Layout';
import { Cargando } from '../../core/Cargando';
import { moduloPorId } from '../../core/modulos';
import { useSesion } from '../../lib/sesion';
import { capitalizar, formatoCorto, formatoLargo } from '../../lib/fechas';
import { DIAS_SEMANA, PLAN, TOTAL_DIAS, type DiaPlan } from './plan';
import { cicloVigente, fechasDelCiclo, lecturasAntesDe, type Ciclo } from './calendario';
import { useLectura } from './useLectura';
import { useProgreso } from './useProgreso';
import { GeneradorBanner, type DatosBanner } from './GeneradorBanner';
import { AdminLectura } from './AdminLectura';
import { SuscriptoresLectura } from './SuscriptoresLectura';

const modulo = moduloPorId('lectura')!;

export function LecturaModulo() {
  const { puede } = useSesion();
  const pestanas: Pestana[] = [
    { a: '/m/lectura', texto: 'Hoy', fin: true },
    { a: '/m/lectura/plan', texto: 'Plan completo' },
    { a: '/m/lectura/banner', texto: 'Banner' },
    { a: '/m/lectura/suscriptores', texto: 'Link y suscriptores' },
    { a: '/m/lectura/admin', texto: 'Administrar' },
  ];

  // El módulo solo es accesible para diácono en adelante (ver modulos.ts).
  return (
    <Layout modulo={modulo} pestanas={pestanas}>
      <Routes>
        <Route index element={<Hoy />} />
        <Route path="plan" element={<PlanCompleto />} />
        {puede('lider') && <Route path="banner" element={<PaginaBanner />} />}
        {puede('lider') && <Route path="suscriptores" element={<SuscriptoresLectura />} />}
        {puede('lider') && <Route path="admin" element={<AdminLectura />} />}
        <Route path="*" element={<Navigate to="/m/lectura" replace />} />
      </Routes>
    </Layout>
  );
}

export function etiquetaDia(d: DiaPlan) {
  return `Semana ${d.semana} · ${DIAS_SEMANA[d.dia - 1]}`;
}

export function mensajeWhatsApp(d: DatosBanner, iglesia: string) {
  const partes = [
    `📖 *${d.titulo || 'Lectura bíblica'}*`,
    d.fecha ? `${d.fecha}` : '',
    '',
    `*${d.lectura}*`,
    d.nota ? `_${d.nota}_` : '',
    '',
    `${d.etiqueta ? d.etiqueta + ' · ' : ''}Plan «La Biblia en 6 meses»`,
    iglesia,
    typeof window !== 'undefined' ? window.location.origin : '',
  ];
  return partes.filter((p, i, arr) => p !== '' || (arr[i - 1] !== '' && i > 0)).join('\n').trim();
}

function Progreso({ ciclo, leidos, hoy }: { ciclo: Ciclo; leidos: number[]; hoy: string }) {
  const esperadas = Math.min(TOTAL_DIAS, lecturasAntesDe(ciclo, hoy) + 1);
  const pct = Math.round((leidos.length / TOTAL_DIAS) * 100);
  const faltan = PLAN.slice(0, esperadas).filter((d) => !leidos.includes(d.indice)).length;
  return (
    <div className="tarjeta">
      <div className="fila-entre">
        <h3>Tu progreso · {ciclo.nombre}</h3>
        <strong>{pct}%</strong>
      </div>
      <div className="barra-progreso">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="suave">
        {leidos.length} de {TOTAL_DIAS} lecturas marcadas.{' '}
        {faltan === 0 ? '¡Vas al día! 🙌' : `Te faltan ${faltan} lectura${faltan === 1 ? '' : 's'} para ponerte al día.`}
      </p>
    </div>
  );
}

function SemanaActual({ ciclo, semana, leidos, alternar, hoy, lecturaDe, conBanner }: { ciclo: Ciclo; semana: number; leidos: number[]; alternar: (i: number) => void; hoy: string; lecturaDe: (d: DiaPlan) => string; conBanner: boolean }) {
  const fechas = useMemo(() => fechasDelCiclo(ciclo), [ciclo]);
  const dias = PLAN.filter((d) => d.semana === semana);
  return (
    <div className="tarjeta">
      <h3>Semana {semana} de 26</h3>
      <ul className="lista-dias">
        {dias.map((d) => {
          const f = fechas[d.indice];
          const leido = leidos.includes(d.indice);
          return (
            <li key={d.indice} className={f === hoy ? 'hoy' : ''}>
              <button className={`check ${leido ? 'marcado' : ''}`} onClick={() => alternar(d.indice)} aria-label={leido ? 'Desmarcar' : 'Marcar como leído'}>
                {leido && <Check size={16} />}
              </button>
              <div className="dia-info">
                <small>{f ? capitalizar(formatoCorto(f)) : DIAS_SEMANA[d.dia - 1]}</small>
                <strong>{lecturaDe(d)}</strong>
              </div>
              {conBanner && (
                <Link to={`/m/lectura/banner?dia=${d.indice}`} className="icono-boton" title="Crear banner">
                  <ImageIcon size={18} />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Hoy() {
  const { iglesia, puede } = useSesion();
  const lect = useLectura();
  const { estado, hoy, config } = lect;
  const ciclo = 'ciclo' in estado ? estado.ciclo : undefined;
  const { leidos, alternar } = useProgreso(estado.tipo === 'antesDeInicio' ? undefined : ciclo?.id);
  const nav = useNavigate();

  if (lect.cargando) return <Cargando />;

  if (estado.tipo === 'sinCiclo' || estado.tipo === 'completado') {
    return (
      <section className="tarjeta">
        <h2>{estado.tipo === 'completado' ? '¡Ciclo completado! 🎉' : 'No hay un ciclo de lectura activo'}</h2>
        <p className="suave">Un pastor o administrador debe programar la fecha de inicio del próximo ciclo en “Administrar”.</p>
      </section>
    );
  }

  if (estado.tipo === 'antesDeInicio') {
    return (
      <section className="hero">
        <small>{estado.ciclo.nombre}</small>
        <h1>Faltan {estado.faltan} día{estado.faltan === 1 ? '' : 's'}</h1>
        <p>El próximo ciclo de lectura comienza el {formatoLargo(estado.ciclo.inicio)} con {lect.lecturaDe(PLAN[0])}.</p>
      </section>
    );
  }

  if (estado.tipo === 'finDeSemana' || estado.tipo === 'pausa') {
    const sig = estado.siguiente;
    return (
      <div className="pila">
        <section className="hero">
          <small>{capitalizar(formatoLargo(hoy))}</small>
          <h1>{estado.tipo === 'pausa' ? 'Hoy no hay lectura asignada' : 'Día para ponerte al día'}</h1>
          <p>{estado.tipo === 'pausa' ? 'Aprovecha para repasar o ponerte al día.' : config.mensajeFinDeSemana}</p>
          {sig && (
            <p className="hero-sig">
              Próxima lectura: <strong>{lect.lecturaDe(sig)}</strong>
            </p>
          )}
          {puede('lider') && (
            <div className="acciones">
              <button className="boton claro" onClick={() => nav('/m/lectura/banner?finde=1')}>
                <ImageIcon size={18} /> Crear banner
              </button>
            </div>
          )}
        </section>
        {estado.tipo === 'finDeSemana' && estado.semana.length > 0 && (
          <SemanaActual ciclo={estado.ciclo} semana={estado.semana[0].semana} leidos={leidos} alternar={alternar} hoy={hoy} lecturaDe={lect.lecturaDe} conBanner={puede('lider')} />
        )}
        <Progreso ciclo={estado.ciclo} leidos={leidos} hoy={hoy} />
      </div>
    );
  }

  const dia = estado.dia;
  const lectura = lect.lecturaDe(dia);
  const nota = lect.notaDe(dia);
  const leido = leidos.includes(dia.indice);
  const datos: DatosBanner = {
    etiqueta: etiquetaDia(dia),
    titulo: 'Hoy toca',
    lectura,
    nota,
    fecha: capitalizar(formatoLargo(hoy)),
  };

  return (
    <div className="pila">
      <section className="hero">
        <small>
          {etiquetaDia(dia)} · Día {dia.indice + 1} de {TOTAL_DIAS}
        </small>
        <h2 className="hero-titulo">Hoy toca</h2>
        <h1>{lectura}</h1>
        {nota && <p className="hero-nota">“{nota}”</p>}
        <p>{capitalizar(formatoLargo(hoy))}</p>
        <div className="acciones">
          {puede('lider') && (
            <button className="boton claro" onClick={() => nav(`/m/lectura/banner?dia=${dia.indice}`)}>
              <ImageIcon size={18} /> Crear banner para WhatsApp
            </button>
          )}
          <a className="boton transparente" href={`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp(datos, iglesia.nombre))}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} /> Enviar texto
          </a>
          <button className={`boton transparente ${leido ? 'activo' : ''}`} onClick={() => alternar(dia.indice)}>
            <CalendarCheck size={18} /> {leido ? 'Leído ✓' : 'Marcar como leído'}
          </button>
        </div>
      </section>
      <SemanaActual ciclo={estado.ciclo} semana={dia.semana} leidos={leidos} alternar={alternar} hoy={hoy} lecturaDe={lect.lecturaDe} conBanner={puede('lider')} />
      <Progreso ciclo={estado.ciclo} leidos={leidos} hoy={hoy} />
    </div>
  );
}

function PlanCompleto() {
  const lect = useLectura();
  const { puede } = useSesion();
  const { actual, proximo } = cicloVigente(lect.ciclos, lect.hoy);
  const [cicloId, setCicloId] = useState<string>('');
  const ciclo = lect.ciclos.find((c) => c.id === cicloId) || actual || proximo || lect.ciclos[0];
  const fechas = useMemo(() => (ciclo ? fechasDelCiclo(ciclo) : []), [ciclo]);
  const { leidos, alternar } = useProgreso(ciclo?.id);
  const semanas = Array.from({ length: 26 }, (_, i) => PLAN.filter((d) => d.semana === i + 1));

  if (lect.cargando) return <Cargando />;

  return (
    <div className="pila">
      <div className="tarjeta fila-entre">
        <div>
          <h2>La Biblia en 6 meses</h2>
          <p className="suave">26 semanas · lunes a viernes · {leidos.length}/{TOTAL_DIAS} leídas</p>
        </div>
        <label>
          Ciclo
          <select value={ciclo?.id} onChange={(e) => setCicloId(e.target.value)}>
            {[...lect.ciclos]
              .sort((a, b) => a.inicio.localeCompare(b.inicio))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="rejilla-semanas">
        {semanas.map((dias) => (
          <div key={dias[0].semana} className="tarjeta semana">
            <h3>
              Semana {dias[0].semana}
              {fechas[dias[0].indice] && <small> · {formatoCorto(fechas[dias[0].indice])}</small>}
            </h3>
            <ul className="lista-dias compacta">
              {dias.map((d) => {
                const f = fechas[d.indice];
                const ajustado = !!lect.ajustes[d.indice];
                return (
                  <li key={d.indice} className={f === lect.hoy ? 'hoy' : ''}>
                    <button className={`check ${leidos.includes(d.indice) ? 'marcado' : ''}`} onClick={() => alternar(d.indice)} aria-label="Marcar">
                      {leidos.includes(d.indice) && <Check size={14} />}
                    </button>
                    <div className="dia-info">
                      <small>{DIAS_SEMANA[d.dia - 1].slice(0, 3)}</small>
                      <strong>
                        {lect.lecturaDe(d)}
                        {ajustado && <span className="chip mini">ajustado</span>}
                      </strong>
                    </div>
                    {puede('lider') && (
                      <Link to={`/m/lectura/banner?dia=${d.indice}`} className="icono-boton" title="Banner">
                        <ChevronRight size={16} />
                      </Link>
                    )}
                    {puede('lider') && (
                      <Link to={`/m/lectura/admin?dia=${d.indice}`} className="icono-boton" title="Ajustar">
                        <Pencil size={14} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaginaBanner() {
  const { iglesia } = useSesion();
  const lect = useLectura();
  const [params, setParams] = useSearchParams();
  const { estado, config } = lect;

  const datos = useMemo<DatosBanner | null>(() => {
    const ciclo = 'ciclo' in estado ? estado.ciclo : lect.ciclos[0];
    const fechas = ciclo ? fechasDelCiclo(ciclo) : [];
    const paramDia = params.get('dia');
    const finde = params.get('finde') === '1' || (!paramDia && (estado.tipo === 'finDeSemana' || estado.tipo === 'pausa'));

    if (finde && (estado.tipo === 'finDeSemana' || estado.tipo === 'pausa')) {
      const semana = estado.tipo === 'finDeSemana' ? estado.semana : [];
      return {
        etiqueta: semana[0] ? `Repaso semana ${semana[0].semana}` : 'Fin de semana',
        titulo: 'Ponte al día',
        lectura: semana.map((d) => lect.lecturaDe(d)).join(', ') || (estado.siguiente ? lect.lecturaDe(estado.siguiente) : ''),
        nota: config.mensajeFinDeSemana,
        fecha: capitalizar(formatoLargo(lect.hoy)),
      };
    }

    let dia: DiaPlan | undefined;
    if (paramDia !== null) dia = PLAN[Number(paramDia)];
    else if (estado.tipo === 'lectura') dia = estado.dia;
    else if ('siguiente' in estado) dia = estado.siguiente;
    dia = dia || PLAN[0];
    const fecha = fechas[dia.indice];
    return {
      etiqueta: etiquetaDia(dia),
      titulo: fecha === lect.hoy ? 'Hoy toca' : 'Lectura del día',
      lectura: lect.lecturaDe(dia),
      nota: lect.notaDe(dia),
      fecha: fecha ? capitalizar(formatoLargo(fecha)) : '',
    };
  }, [estado, params, lect.ajustes, config.mensajeFinDeSemana, lect.hoy]);

  if (lect.cargando || !datos) return <Cargando />;

  return (
    <div className="pila">
      <div className="tarjeta fila-entre">
        <div>
          <h2>Banner para compartir</h2>
          <p className="suave">Elige un fondo, ajusta los textos y compártelo por WhatsApp.</p>
        </div>
        <label>
          Día del plan
          <select
            value={params.get('dia') ?? ''}
            onChange={(e) => setParams(e.target.value === '' ? {} : { dia: e.target.value })}
          >
            <option value="">Hoy</option>
            {PLAN.map((d) => (
              <option key={d.indice} value={d.indice}>
                S{d.semana} {DIAS_SEMANA[d.dia - 1].slice(0, 3)} — {lect.lecturaDe(d)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <GeneradorBanner
        inicial={datos}
        pie={config.pieBanner}
        imagenesBanco={config.imagenes}
        textoMensaje={(d) => mensajeWhatsApp(d, iglesia.nombre)}
        nombreArchivo={`lectura-${datos.lectura.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}`}
      />
    </div>
  );
}
