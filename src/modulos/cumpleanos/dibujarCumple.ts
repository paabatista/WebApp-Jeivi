import type { Fondo } from '../lectura/fondos';
import { FUENTE_TEXTO, FUENTE_TITULO } from '../lectura/dibujarBanner';

export interface OpcionesCumple {
  w: number;
  h: number;
  fondo: { tipo: 'proc'; fondo: Fondo } | { tipo: 'img'; img: HTMLImageElement };
  oscurecer: number;
  foto: HTMLImageElement | null;
  colorAcento: string;
  iglesia: string;
  titulo: string;
  nombre: string;
  fecha: string;
  mensaje: string;
  pie: string;
  /** Colores elegidos para cada texto (lo que falte usa el color automático). */
  colores?: Partial<Record<ParteCumple, string>>;
}

export type ParteCumple = 'iglesia' | 'titulo' | 'aro' | 'nombre' | 'fecha' | 'mensaje' | 'pie';

export function coloresPorDefectoCumple(colorAcento: string): Record<ParteCumple, string> {
  return {
    iglesia: '#ffffff',
    titulo: colorAcento,
    aro: colorAcento,
    nombre: '#ffffff',
    fecha: colorAcento,
    mensaje: 'rgba(255,255,255,0.92)',
    pie: 'rgba(255,255,255,0.85)',
  };
}

function cubrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const e = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * e;
  const ih = img.naturalHeight * e;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function partir(ctx: CanvasRenderingContext2D, texto: string, ancho: number) {
  const out: string[] = [];
  let linea = '';
  for (const p of texto.split(/\s+/).filter(Boolean)) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && linea) {
      out.push(linea);
      linea = p;
    } else linea = prueba;
  }
  if (linea) out.push(linea);
  return out;
}

function confeti(ctx: CanvasRenderingContext2D, w: number, h: number, acento: string) {
  let s = 7;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const colores = [acento, '#ffffff', '#f472b6', '#60a5fa', '#fbbf24'];
  for (let i = 0; i < 90; i++) {
    const x = r() * w;
    const y = r() < 0.5 ? r() * h * 0.22 : h * 0.78 + r() * h * 0.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r() * Math.PI);
    ctx.globalAlpha = 0.55 + r() * 0.4;
    ctx.fillStyle = colores[Math.floor(r() * colores.length)];
    ctx.fillRect(-w * 0.006, -w * 0.0025, w * 0.012, w * 0.005);
    ctx.restore();
  }
}

export function dibujarCumple(ctx: CanvasRenderingContext2D, o: OpcionesCumple) {
  const { w, h } = o;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  if (o.fondo.tipo === 'proc') o.fondo.fondo.dibujar(ctx, w, h);
  else cubrir(ctx, o.fondo.img, 0, 0, w, h);
  if (o.oscurecer > 0) {
    ctx.fillStyle = `rgba(0,0,0,${o.oscurecer})`;
    ctx.fillRect(0, 0, w, h);
  }
  confeti(ctx, w, h, o.colorAcento);
  const col = { ...coloresPorDefectoCumple(o.colorAcento), ...o.colores };

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const sombra = () => {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 3;
  };

  // Iglesia
  let y = h * 0.055;
  ctx.save();
  sombra();
  ctx.fillStyle = col.iglesia;
  ctx.font = `600 ${Math.round(w * 0.027)}px ${FUENTE_TEXTO}`;
  ctx.fillText(o.iglesia.toUpperCase(), w / 2, y, w * 0.9);
  ctx.restore();
  y += w * 0.05;

  // Título
  ctx.save();
  sombra();
  ctx.fillStyle = col.titulo;
  ctx.font = `italic 700 ${Math.round(w * 0.095)}px ${FUENTE_TITULO}`;
  ctx.fillText(o.titulo, w / 2, y, w * 0.92);
  ctx.restore();
  y += w * 0.13;

  // Foto circular
  const radio = Math.min(w * 0.26, (h - y) * 0.27);
  const cx = w / 2;
  const cy = y + radio + w * 0.01;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(cx, cy, radio + w * 0.014, 0, Math.PI * 2);
  ctx.fillStyle = col.aro;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.clip();
  if (o.foto) cubrir(ctx, o.foto, cx - radio, cy - radio, radio * 2, radio * 2);
  else {
    const g = ctx.createLinearGradient(cx - radio, cy - radio, cx + radio, cy + radio);
    g.addColorStop(0, '#f472b6');
    g.addColorStop(1, '#7b4fa8');
    ctx.fillStyle = g;
    ctx.fillRect(cx - radio, cy - radio, radio * 2, radio * 2);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(radio * 0.9)}px ${FUENTE_TITULO}`;
    ctx.fillText((o.nombre.trim()[0] || '?').toUpperCase(), cx, cy);
    ctx.textBaseline = 'top';
  }
  ctx.restore();
  y = cy + radio + w * 0.05;

  // Nombre
  ctx.save();
  sombra();
  ctx.fillStyle = col.nombre;
  let t = w * 0.085;
  ctx.font = `800 ${Math.round(t)}px ${FUENTE_TEXTO}`;
  let lineas = partir(ctx, o.nombre, w * 0.86);
  while ((lineas.length > 2 || lineas.some((l) => ctx.measureText(l).width > w * 0.86)) && t > w * 0.045) {
    t -= 4;
    ctx.font = `800 ${Math.round(t)}px ${FUENTE_TEXTO}`;
    lineas = partir(ctx, o.nombre, w * 0.86);
  }
  lineas.forEach((l, i) => ctx.fillText(l, w / 2, y + i * t * 1.1));
  y += lineas.length * t * 1.1 + w * 0.015;

  // Fecha
  ctx.fillStyle = col.fecha;
  ctx.font = `700 ${Math.round(w * 0.036)}px ${FUENTE_TEXTO}`;
  ctx.fillText(o.fecha.toUpperCase(), w / 2, y);
  y += w * 0.065;

  // Mensaje
  if (o.mensaje) {
    ctx.fillStyle = col.mensaje;
    const tm = w * 0.037;
    ctx.font = `italic 400 ${Math.round(tm)}px ${FUENTE_TITULO}`;
    partir(ctx, o.mensaje, w * 0.82)
      .slice(0, 4)
      .forEach((l, i) => ctx.fillText(l, w / 2, y + i * tm * 1.35));
  }
  ctx.restore();

  if (o.pie) {
    ctx.save();
    sombra();
    ctx.fillStyle = col.pie;
    ctx.font = `500 ${Math.round(w * 0.024)}px ${FUENTE_TEXTO}`;
    ctx.fillText(o.pie, w / 2, h - h * 0.05);
    ctx.restore();
  }
  ctx.restore();
}
