import type { Fondo } from './fondos';

export type Plantilla = 'centrado' | 'tarjeta' | 'minimal';

export const FORMATOS = {
  cuadrado: { w: 1080, h: 1080, nombre: 'Cuadrado (1:1)' },
  vertical: { w: 1080, h: 1350, nombre: 'Vertical (4:5)' },
  historia: { w: 1080, h: 1920, nombre: 'Estado / Historia (9:16)' },
} as const;
export type Formato = keyof typeof FORMATOS;

export const FUENTE_TITULO = '"Playfair Display", Georgia, serif';
export const FUENTE_TEXTO = 'Montserrat, "Segoe UI", Arial, sans-serif';

export interface OpcionesBanner {
  w: number;
  h: number;
  fondo: { tipo: 'proc'; fondo: Fondo } | { tipo: 'img'; img: HTMLImageElement; tema: 'claro' | 'oscuro' };
  oscurecer: number; // 0..0.8
  plantilla: Plantilla;
  colorAcento: string;
  iglesia: string;
  etiqueta: string;
  titulo: string;
  lectura: string;
  nota: string;
  fecha: string;
  pie: string;
  logo?: HTMLImageElement | null;
}

function cubrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const escala = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * escala;
  const ih = img.naturalHeight * escala;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

function partir(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split('\n')) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    let actual = '';
    for (const p of palabras) {
      const prueba = actual ? `${actual} ${p}` : p;
      if (ctx.measureText(prueba).width > ancho && actual) {
        lineas.push(actual);
        actual = p;
      } else actual = prueba;
    }
    if (actual) lineas.push(actual);
  }
  return lineas;
}

/** Busca el tamaño de letra más grande con el que el texto cabe en `maxLineas`. */
function ajustar(ctx: CanvasRenderingContext2D, texto: string, fuente: (t: number) => string, ancho: number, max: number, min: number, maxLineas: number) {
  let t = max;
  let lineas: string[] = [];
  while (t >= min) {
    ctx.font = fuente(t);
    lineas = partir(ctx, texto, ancho);
    if (lineas.length <= maxLineas && lineas.every((l) => ctx.measureText(l).width <= ancho)) break;
    t -= 4;
  }
  ctx.font = fuente(Math.max(t, min));
  return { tamano: Math.max(t, min), lineas };
}

function rectRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface Bloque {
  alto: number;
  pintar: (y: number) => void;
}

export function dibujarBanner(ctx: CanvasRenderingContext2D, o: OpcionesBanner) {
  const { w, h } = o;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = 'top';

  // 1. Fondo
  if (o.fondo.tipo === 'proc') o.fondo.fondo.dibujar(ctx, w, h);
  else cubrir(ctx, o.fondo.img, w, h);
  const tema = o.fondo.tipo === 'proc' ? o.fondo.fondo.tema : o.fondo.tema;

  if (o.oscurecer > 0) {
    ctx.fillStyle = tema === 'claro' ? `rgba(0,0,0,${o.oscurecer})` : `rgba(255,255,255,${o.oscurecer * 0.6})`;
    ctx.fillRect(0, 0, w, h);
  }

  const enTarjeta = o.plantilla === 'tarjeta';
  const colorTexto = enTarjeta ? '#24152f' : tema === 'claro' ? '#ffffff' : '#3a2410';
  const colorSuave = enTarjeta ? 'rgba(36,21,47,0.7)' : tema === 'claro' ? 'rgba(255,255,255,0.85)' : 'rgba(58,36,16,0.75)';
  const sombra = !enTarjeta && tema === 'claro';
  const alinear: CanvasTextAlign = o.plantilla === 'minimal' ? 'left' : 'center';

  const margen = w * 0.08;
  const anchoTexto = enTarjeta ? w - margen * 2 - w * 0.1 : w - margen * 2;
  const xTexto = alinear === 'left' ? margen : w / 2;

  const conSombra = (fn: () => void) => {
    ctx.save();
    if (sombra) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 3;
    }
    fn();
    ctx.restore();
  };

  // 2. Cabecera: logo + nombre de la iglesia
  let yCab = h * 0.06;
  if (o.logo) {
    const lado = w * 0.11;
    const lx = alinear === 'left' ? margen : (w - lado) / 2;
    ctx.drawImage(o.logo, lx, yCab, lado, lado * (o.logo.naturalHeight / o.logo.naturalWidth || 1));
    yCab += lado * (o.logo.naturalHeight / o.logo.naturalWidth || 1) + h * 0.015;
  }
  ctx.textAlign = alinear;
  ctx.fillStyle = enTarjeta ? (tema === 'claro' ? '#fff' : '#3a2410') : colorTexto;
  ctx.font = `600 ${Math.round(w * 0.027)}px ${FUENTE_TEXTO}`;
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(w * 0.004)}px`;
  } catch {
    /* navegador sin letterSpacing en canvas */
  }
  const lineasIglesia = partir(ctx, o.iglesia.toUpperCase(), w - margen * 2).slice(0, 2);
  conSombra(() => lineasIglesia.forEach((l, i) => ctx.fillText(l, xTexto, yCab + i * w * 0.036)));
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  yCab += lineasIglesia.length * w * 0.036 + h * 0.012;
  ctx.fillStyle = o.colorAcento;
  const anchoLinea = w * 0.12;
  ctx.fillRect(alinear === 'left' ? margen : (w - anchoLinea) / 2, yCab, anchoLinea, Math.max(4, w * 0.004));

  // 3. Bloques centrales
  const bloques: Bloque[] = [];
  const espacio = h * 0.025;

  if (o.etiqueta) {
    ctx.font = `700 ${Math.round(w * 0.026)}px ${FUENTE_TEXTO}`;
    const t = w * 0.026;
    bloques.push({
      alto: t * 1.3,
      pintar: (y) => {
        ctx.font = `700 ${Math.round(t)}px ${FUENTE_TEXTO}`;
        ctx.fillStyle = o.colorAcento;
        conSombra(() => ctx.fillText(o.etiqueta.toUpperCase(), xTexto, y));
      },
    });
  }

  if (o.titulo) {
    const t = w * 0.075;
    bloques.push({
      alto: t * 1.25,
      pintar: (y) => {
        ctx.font = `italic 700 ${Math.round(t)}px ${FUENTE_TITULO}`;
        ctx.fillStyle = enTarjeta ? o.colorAcento : colorTexto;
        conSombra(() => ctx.fillText(o.titulo, xTexto, y));
      },
    });
  }

  // La lectura: cada pasaje separado por coma va en su propia línea si cabe.
  const textoLectura = o.lectura.split(/\s*,\s*/).join('\n');
  const maxL = o.plantilla === 'minimal' ? 5 : 6;
  const { tamano, lineas } = ajustar(
    ctx,
    textoLectura,
    (t) => `800 ${Math.round(t)}px ${FUENTE_TEXTO}`,
    anchoTexto,
    w * 0.115,
    w * 0.045,
    maxL,
  );
  bloques.push({
    alto: lineas.length * tamano * 1.12,
    pintar: (y) => {
      ctx.font = `800 ${Math.round(tamano)}px ${FUENTE_TEXTO}`;
      ctx.fillStyle = colorTexto;
      conSombra(() => lineas.forEach((l, i) => ctx.fillText(l, xTexto, y + i * tamano * 1.12)));
    },
  });

  if (o.nota) {
    const res = ajustar(ctx, `“${o.nota}”`, (t) => `italic 400 ${Math.round(t)}px ${FUENTE_TITULO}`, anchoTexto, w * 0.042, w * 0.028, 6);
    bloques.push({
      alto: res.lineas.length * res.tamano * 1.35,
      pintar: (y) => {
        ctx.font = `italic 400 ${Math.round(res.tamano)}px ${FUENTE_TITULO}`;
        ctx.fillStyle = colorSuave;
        conSombra(() => res.lineas.forEach((l, i) => ctx.fillText(l, xTexto, y + i * res.tamano * 1.35)));
      },
    });
  }

  if (o.fecha) {
    const t = w * 0.032;
    bloques.push({
      alto: t * 1.3,
      pintar: (y) => {
        ctx.font = `500 ${Math.round(t)}px ${FUENTE_TEXTO}`;
        ctx.fillStyle = colorSuave;
        conSombra(() => ctx.fillText(o.fecha, xTexto, y));
      },
    });
  }

  const altoTotal = bloques.reduce((s, b) => s + b.alto, 0) + espacio * (bloques.length - 1);
  const zonaInicio = yCab + h * 0.04;
  const zonaFin = h - h * 0.1;
  let y =
    o.plantilla === 'minimal'
      ? Math.max(zonaInicio, zonaFin - altoTotal - h * 0.02)
      : zonaInicio + Math.max(0, (zonaFin - zonaInicio - altoTotal) / 2);

  if (enTarjeta) {
    const pad = w * 0.06;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    rectRedondo(ctx, margen, y - pad, w - margen * 2, altoTotal + pad * 2, w * 0.04);
    ctx.fill();
    ctx.restore();
  }

  ctx.textAlign = alinear;
  for (const b of bloques) {
    b.pintar(y);
    y += b.alto + espacio;
  }

  // 4. Pie
  if (o.pie) {
    const t = w * 0.024;
    ctx.font = `500 ${Math.round(t)}px ${FUENTE_TEXTO}`;
    ctx.fillStyle = tema === 'claro' ? 'rgba(255,255,255,0.8)' : 'rgba(58,36,16,0.7)';
    ctx.textAlign = alinear;
    conSombra(() => ctx.fillText(o.pie, xTexto, h - h * 0.055));
  }
  ctx.restore();
}

export function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    if (!src.startsWith('blob:') && !src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error('No se pudo cargar la imagen'));
    img.src = src;
  });
}
