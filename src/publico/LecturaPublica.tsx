import { useState, type FormEvent } from 'react';
import { MessageCircle } from 'lucide-react';
import { guardarDoc } from '../lib/datos';
import { nuevoId, type Enlace } from '../lib/enlaces';
import { capitalizar, formatoLargo } from '../lib/fechas';
import { useSesion } from '../lib/sesion';
import { Cargando } from '../core/Cargando';
import { useLectura } from '../modulos/lectura/useLectura';
import { PLAN, TOTAL_DIAS, DIAS_SEMANA } from '../modulos/lectura/plan';
import { RUTA_SUSCRIPTORES, limpiarTelefono } from '../modulos/lectura/suscriptores';

/** Lo que ve la congregación al abrir el link de lectura: la lectura de hoy y el formulario para suscribirse. */
export function LecturaPublica({ enlace }: { enlace: Enlace }) {
  const { iglesia } = useSesion();
  const lect = useLectura();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [estadoForm, setEstadoForm] = useState<'' | 'enviando' | 'listo' | 'error'>('');
  const [error, setError] = useState('');

  if (lect.cargando) return <Cargando />;
  const { estado, hoy } = lect;

  let titulo = 'Hoy toca';
  let lectura = '';
  let nota = '';
  let etiqueta = '';
  if (estado.tipo === 'lectura') {
    lectura = lect.lecturaDe(estado.dia);
    nota = lect.notaDe(estado.dia);
    etiqueta = `Semana ${estado.dia.semana} · ${DIAS_SEMANA[estado.dia.dia - 1]} · Día ${estado.dia.indice + 1} de ${TOTAL_DIAS}`;
  } else if (estado.tipo === 'finDeSemana' || estado.tipo === 'pausa') {
    titulo = 'Día para ponerte al día';
    nota = lect.config.mensajeFinDeSemana;
    lectura = estado.siguiente ? `Próxima: ${lect.lecturaDe(estado.siguiente)}` : '';
  } else if (estado.tipo === 'antesDeInicio') {
    titulo = `Comenzamos en ${estado.faltan} día${estado.faltan === 1 ? '' : 's'}`;
    lectura = lect.lecturaDe(PLAN[0]);
    nota = `El plan inicia el ${formatoLargo(estado.ciclo.inicio)}.`;
  } else {
    titulo = 'Plan de lectura';
    lectura = 'La Biblia en 6 meses';
  }

  const textoCompartir = [`📖 *${titulo}*`, capitalizar(formatoLargo(hoy)), '', `*${lectura}*`, nota ? `_${nota}_` : '', '', iglesia.nombre, window.location.href]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');

  async function suscribir(e: FormEvent) {
    e.preventDefault();
    setError('');
    const correo = email.trim().toLowerCase();
    const tel = limpiarTelefono(whatsapp);
    if (!correo && !tel) return setError('Escribe tu correo o tu número de WhatsApp.');
    setEstadoForm('enviando');
    try {
      await guardarDoc(
        `${RUTA_SUSCRIPTORES}/${nuevoId(16)}`,
        { nombre: nombre.trim(), email: correo, whatsapp: tel, enlace: enlace.id, activo: true, creado: new Date().toISOString(), temas: ['lectura'] },
        false,
      );
      setEstadoForm('listo');
    } catch {
      setEstadoForm('error');
      setError('No se pudo guardar. Intenta de nuevo en un momento.');
    }
  }

  return (
    <div className="pila">
      <section className="hero">
        {etiqueta && <small>{etiqueta}</small>}
        <h2 className="hero-titulo">{titulo}</h2>
        <h1>{lectura}</h1>
        {nota && <p className="hero-nota">“{nota}”</p>}
        <p>{capitalizar(formatoLargo(hoy))}</p>
        <div className="acciones">
          <a className="boton claro" href={`https://wa.me/?text=${encodeURIComponent(textoCompartir)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} /> Compartir por WhatsApp
          </a>
        </div>
      </section>

      <section className="tarjeta">
        {estadoForm === 'listo' ? (
          <div className="centrado">
            <h2>¡Listo, {nombre.split(' ')[0] || 'gracias'}! 🙌</h2>
            <p className="suave">
              {email ? 'Cada mañana de lunes a viernes recibirás la lectura en tu correo.' : 'Los diáconos te enviarán la lectura por WhatsApp.'}
            </p>
          </div>
        ) : (
          <>
            <h2>Recibe la lectura cada mañana</h2>
            <p className="suave">Plan «La Biblia en 6 meses». Lee en la versión que prefieras.</p>
            <form className="formulario" onSubmit={suscribir}>
              <label>
                Nombre
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={80} autoComplete="name" />
              </label>
              <div className="fila">
                <label>
                  Correo
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" />
                </label>
                <label>
                  WhatsApp
                  <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="6000-0000" inputMode="tel" maxLength={20} />
                </label>
              </div>
              <small className="suave">Basta con uno de los dos. Solo lo usaremos para enviarte la lectura.</small>
              {error && <div className="error">{error}</div>}
              <button className="boton primario" disabled={estadoForm === 'enviando'}>
                {estadoForm === 'enviando' ? 'Guardando…' : 'Suscribirme'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
