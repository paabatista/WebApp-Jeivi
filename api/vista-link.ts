import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb } from './_lib/firebaseAdmin.js';

const IGLESIA_ID = process.env.IGLESIA_ID || process.env.VITE_IGLESIA_ID || 'imperio-de-vida';
const IGLESIA_POR_DEFECTO = 'Ministerio Jesucristo Imperio de Vida';

/**
 * Vista previa de los links públicos (/p/:token) al compartirlos por WhatsApp, Facebook, etc.
 * WhatsApp no ejecuta la app: solo lee el título, la descripción y la imagen del HTML.
 * Esta función devuelve la misma página de la app, pero con los datos de ESE link
 * (registro de cumpleaños, lectura diaria, inscripción a un evento…), en vez de la descripción general de Jeivi.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fechaLarga(iso?: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]}` : '';
}

interface Vista {
  titulo: string;
  descripcion: string;
  imagen?: string;
}

async function vistaDelLink(token: string, iglesia: string): Promise<Vista | null> {
  const db = adminDb();
  const enlace = (await db.doc(`iglesias/${IGLESIA_ID}/enlaces/${token}`).get()).data();
  if (!enlace) return null;
  if (enlace.activo === false) return { titulo: `Link no disponible · ${iglesia}`, descripcion: 'Este link ya no está activo. Pide uno nuevo a tu diácono o pastor.' };
  switch (enlace.modulo) {
    case 'cumpleanos':
      return {
        titulo: '🎂 Registro de cumpleaños',
        descripcion: `Registra tu fecha de cumpleaños y la de tus hijos (con foto si quieres) para celebrarlos juntos. ${iglesia}.`,
      };
    case 'lectura':
      return {
        titulo: '📖 Lectura bíblica diaria',
        descripcion: `Mira la lectura de hoy del plan de la Biblia y suscríbete para recibirla cada día. ${iglesia}.`,
      };
    case 'anuncios':
      return { titulo: '📣 Anuncios de la iglesia', descripcion: `Entérate de los anuncios y novedades de ${iglesia} y recibe los avisos.` };
    case 'solicitudes':
      return { titulo: '🙏 Peticiones de oración y solicitudes', descripcion: `Envía tu petición de oración, de visita u otra solicitud al equipo pastoral de ${iglesia}.` };
    case 'eventos': {
      const ev = enlace.eventoId ? (await db.doc(`iglesias/${IGLESIA_ID}/eventos/${enlace.eventoId}`).get()).data() : null;
      if (!ev) return { titulo: '📅 Eventos de la iglesia', descripcion: `Mira los próximos eventos de ${iglesia} e inscríbete.` };
      const cuando = [fechaLarga(ev.fecha), ev.hora, ev.lugar].filter(Boolean).join(' · ');
      return {
        titulo: `📅 Inscripción: ${ev.titulo}`,
        descripcion: `${cuando ? cuando + '. ' : ''}Inscríbete aquí. ${iglesia}.`,
        imagen: typeof ev.imagen === 'string' && ev.imagen.startsWith('https://') ? ev.imagen : undefined,
      };
    }
    default:
      return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = String(req.query.token || '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origen = `https://${host}`;

  let html: string;
  try {
    const r = await fetch(`${origen}/index.html`);
    if (!r.ok) throw new Error(`index ${r.status}`);
    html = await r.text();
  } catch (e) {
    console.error(e);
    return res.status(502).send('No se pudo cargar la página. Intenta de nuevo.');
  }

  let vista: Vista | null = null;
  let iglesia = IGLESIA_POR_DEFECTO;
  // Diagnóstico (sin datos sensibles): token-invalido | sin-enlace | ok | error
  let diag = 'token-invalido';
  if (/^[A-Za-z0-9_-]{6,64}$/.test(token)) {
    try {
      const ig = (await adminDb().doc(`iglesias/${IGLESIA_ID}`).get()).data();
      if (ig?.nombre) iglesia = ig.nombre;
      vista = await vistaDelLink(token, iglesia);
      diag = vista ? 'ok' : 'sin-enlace';
    } catch (e) {
      diag = 'error';
      console.error('vista-link', e);
    }
  }

  if (vista) {
    const imagen = vista.imagen || `${origen}/marca/logo.png`;
    const url = `${origen}/p/${token}`;
    const meta = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${esc(iglesia)}" />`,
      `<meta property="og:title" content="${esc(vista.titulo)}" />`,
      `<meta property="og:description" content="${esc(vista.descripcion)}" />`,
      `<meta property="og:image" content="${esc(imagen)}" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      `<meta name="twitter:card" content="summary" />`,
    ].join('\n    ');
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(vista.titulo)} · ${esc(iglesia)}</title>`)
      .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(vista.descripcion)}" />`)
      .replace('</head>', `    ${meta}\n  </head>`);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Jeivi-Vista', diag);
  // Unos minutos en caché: si se desactiva el link o cambia el evento, se nota pronto.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  return res.send(html);
}
