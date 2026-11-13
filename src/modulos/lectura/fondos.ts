/**
 * Banco de fondos incluido en la app. Se dibujan con código (canvas), así que no pesan,
 * no dependen de internet y no tienen problemas de derechos de autor.
 * El admin puede sumar fotos propias al banco (Cloudinary) y cada hermano puede usar una foto de su celular.
 */

export interface Fondo {
  id: string;
  nombre: string;
  /** Color de texto que mejor contrasta. */
  tema: 'claro' | 'oscuro';
  dibujar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

function azar(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function degradadoVertical(ctx: CanvasRenderingContext2D, h: number, paradas: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  paradas.forEach(([p, c]) => g.addColorStop(p, c));
  return g;
}

function montanas(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, alto: number, color: string, semilla: number) {
  const r = azar(semilla);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  let x = 0;
  ctx.lineTo(0, base - r() * alto);
  while (x < w) {
    x += w * (0.08 + r() * 0.12);
    ctx.lineTo(x, base - r() * alto);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function brillo(ctx: CanvasRenderingContext2D, x: number, y: number, radio: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radio);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - radio, y - radio, radio * 2, radio * 2);
}

function rayos(ctx: CanvasRenderingContext2D, cx: number, cy: number, largo: number, n: number, alfa: number) {
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < n; i++) {
    ctx.rotate((Math.PI * 2) / n);
    ctx.fillStyle = `rgba(255,240,200,${alfa})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(largo, -largo * 0.06);
    ctx.lineTo(largo, largo * 0.06);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function vineta(ctx: CanvasRenderingContext2D, w: number, h: number, fuerza = 0.45) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${fuerza})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export const FONDOS: Fondo[] = [
  {
    id: 'amanecer',
    nombre: 'Amanecer',
    tema: 'claro',
    dibujar(ctx, w, h) {
      ctx.fillStyle = degradadoVertical(ctx, h, [
        [0, '#2b1a4f'],
        [0.45, '#b44b7a'],
        [0.75, '#f59e5b'],
        [1, '#fcd38b'],
      ]);
      ctx.fillRect(0, 0, w, h);
      brillo(ctx, w * 0.5, h * 0.78, w * 0.55, 'rgba(255,225,160,0.85)');
      montanas(ctx, w, h, h * 0.8, h * 0.12, 'rgba(90,40,90,0.55)', 3);
      montanas(ctx, w, h, h * 0.88, h * 0.1, 'rgba(50,20,60,0.75)', 7);
      montanas(ctx, w, h, h * 0.96, h * 0.06, '#1d0f2b', 11);
    },
  },
  {
    id: 'luz',
    nombre: 'Luz de gloria',
    tema: 'claro',
    dibujar(ctx, w, h) {
      ctx.fillStyle = degradadoVertical(ctx, h, [
        [0, '#5a3a12'],
        [0.5, '#2d1d0b'],
        [1, '#120b05'],
      ]);
      ctx.fillRect(0, 0, w, h);
      rayos(ctx, w / 2, -h * 0.05, Math.max(w, h) * 1.4, 28, 0.06);
      brillo(ctx, w / 2, 0, w * 0.8, 'rgba(255,214,130,0.75)');
      vineta(ctx, w, h, 0.5);
    },
  },
  {
    id: 'noche',
    nombre: 'Cielo estrellado',
    tema: 'claro',
    dibujar(ctx, w, h) {
      ctx.fillStyle = degradadoVertical(ctx, h, [
        [0, '#050a1f'],
        [0.6, '#132257'],
        [1, '#2c3f86'],
      ]);
      ctx.fillRect(0, 0, w, h);
      const r = azar(42);
      for (let i = 0; i < 420; i++) {
        const x = r() * w;
        const y = r() * h * 0.85;
        const s = r() * 2.4 + 0.4;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      }
      brillo(ctx, w * 0.78, h * 0.16, w * 0.22, 'rgba(255,250,220,0.55)');
      ctx.fillStyle = '#fff8e1';
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.16, w * 0.045, 0, Math.PI * 2);
      ctx.fill();
      montanas(ctx, w, h, h * 0.95, h * 0.07, '#060b1c', 5);
    },
  },
  {
    id: 'realeza',
    nombre: 'Realeza',
    tema: 'claro',
    dibujar(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2a1342');
      g.addColorStop(0.55, '#4a2c6d');
      g.addColorStop(1, '#1a0b2b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(212,167,58,0.18)';
      ctx.lineWidth = 2;
      for (let i = -h; i < w; i += 46) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h, h);
        ctx.stroke();
      }
      brillo(ctx, w * 0.2, h * 0.1, w * 0.6, 'rgba(212,167,58,0.35)');
      vineta(ctx, w, h, 0.55);
    },
  },
  {
    id: 'mar',
    nombre: 'Mar en calma',
    tema: 'claro',
    dibujar(ctx, w, h) {
      ctx.fillStyle = degradadoVertical(ctx, h, [
        [0, '#0b3a5b'],
        [0.5, '#0f6b85'],
        [1, '#06283d'],
      ]);
      ctx.fillRect(0, 0, w, h);
      brillo(ctx, w * 0.5, h * 0.35, w * 0.5, 'rgba(180,240,255,0.35)');
      for (let capa = 0; capa < 6; capa++) {
        const y0 = h * (0.62 + capa * 0.065);
        ctx.fillStyle = `rgba(4,30,50,${0.25 + capa * 0.1})`;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 10) {
          ctx.lineTo(x, y0 + Math.sin(x / (60 + capa * 12) + capa) * (10 + capa * 3));
        }
        ctx.lineTo(w, h);
        ctx.fill();
      }
    },
  },
  {
    id: 'bosque',
    nombre: 'Bosque',
    tema: 'claro',
    dibujar(ctx, w, h) {
      ctx.fillStyle = degradadoVertical(ctx, h, [
        [0, '#c9e4c5'],
        [0.4, '#5e9c76'],
        [1, '#0f2e22'],
      ]);
      ctx.fillRect(0, 0, w, h);
      brillo(ctx, w * 0.7, h * 0.15, w * 0.6, 'rgba(255,255,220,0.6)');
      const r = azar(9);
      for (let capa = 0; capa < 3; capa++) {
        ctx.fillStyle = ['rgba(30,80,60,0.5)', 'rgba(18,55,40,0.75)', '#0a2219'][capa];
        const base = h * (0.72 + capa * 0.1);
        for (let x = -40; x < w + 40; x += 40 + r() * 50) {
          const alto = h * (0.18 + r() * 0.14);
          const ancho = alto * 0.38;
          ctx.beginPath();
          ctx.moveTo(x, base - alto);
          ctx.lineTo(x - ancho, base);
          ctx.lineTo(x + ancho, base);
          ctx.fill();
        }
        ctx.fillRect(0, base - 2, w, h - base + 2);
      }
      vineta(ctx, w, h, 0.4);
    },
  },
  {
    id: 'cruz',
    nombre: 'La cruz',
    tema: 'claro',
    dibujar(ctx, w, h) {
      ctx.fillStyle = degradadoVertical(ctx, h, [
        [0, '#1c1028'],
        [0.6, '#3b1f3a'],
        [1, '#a0522d'],
      ]);
      ctx.fillRect(0, 0, w, h);
      brillo(ctx, w / 2, h * 0.86, w * 0.7, 'rgba(255,170,90,0.55)');
      montanas(ctx, w, h, h * 0.93, h * 0.05, '#120a17', 21);
      // Cruz en el horizonte
      const cx = w * 0.5;
      const base = h * 0.9;
      const alto = h * 0.2;
      ctx.fillStyle = '#120a17';
      ctx.fillRect(cx - w * 0.012, base - alto, w * 0.024, alto);
      ctx.fillRect(cx - w * 0.06, base - alto * 0.75, w * 0.12, w * 0.022);
    },
  },
  {
    id: 'pergamino',
    nombre: 'Pergamino',
    tema: 'oscuro',
    dibujar(ctx, w, h) {
      ctx.fillStyle = '#f3e6c8';
      ctx.fillRect(0, 0, w, h);
      const r = azar(77);
      for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = `rgba(120,80,30,${r() * 0.05})`;
        ctx.fillRect(r() * w, r() * h, 2 + r() * 4, 2 + r() * 4);
      }
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(160,110,50,0)');
      g.addColorStop(1, 'rgba(120,70,20,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
];

export const fondoPorId = (id: string) => FONDOS.find((f) => f.id === id) ?? FONDOS[0];
