import { IGLESIA_ID } from '../../lib/firebase';
import { capitalizar, formatoLargo } from '../../lib/fechas';

export interface Tarea {
  id: string;
  texto: string;
  responsable?: string;
  hecho: boolean;
}

export type EstadoEvento = 'planificado' | 'confirmado' | 'realizado' | 'cancelado';

export interface Evento {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  fecha: string; // YYYY-MM-DD
  hora?: string; // HH:MM
  fechaFin?: string;
  horaFin?: string;
  lugar?: string;
  responsableUid?: string;
  responsableNombre?: string;
  estado: EstadoEvento;
  /** Acepta inscripciones por link. */
  inscripcion: boolean;
  cupo?: number | null;
  imagen?: string;
  /** Visible por link público (se activa al crear un link del evento). */
  publico: boolean;
  tareas: Tarea[];
  creado: string;
  creadoPor: string;
}

export interface Inscripcion {
  id: string;
  eventoId: string;
  nombre: string;
  telefono: string;
  email: string;
  personas: number;
  nota: string;
  enlace: string;
  creado: string;
}

export const RUTA_EVENTOS = `iglesias/${IGLESIA_ID}/eventos`;
export const RUTA_INSCRIPCIONES = `iglesias/${IGLESIA_ID}/inscripciones`;

export const CATEGORIAS_EVENTO = ['Culto especial', 'Retiro', 'Campaña', 'Jóvenes', 'Damas', 'Caballeros', 'Niños', 'Convivio', 'Bautismo', 'Santa Cena', 'Otro'];

export const ESTADOS: Record<EstadoEvento, string> = {
  planificado: 'Planificado',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
};

/** "7:00 p. m." */
export function hora12(h?: string) {
  if (!h) return '';
  const [H, M] = h.split(':').map(Number);
  const sufijo = H >= 12 ? 'p. m.' : 'a. m.';
  return `${((H + 11) % 12) + 1}:${String(M).padStart(2, '0')} ${sufijo}`;
}

export function textoCuando(e: Pick<Evento, 'fecha' | 'hora' | 'fechaFin' | 'horaFin'>) {
  let t = capitalizar(formatoLargo(e.fecha));
  if (e.hora) t += ` · ${hora12(e.hora)}`;
  if (e.fechaFin && e.fechaFin !== e.fecha) t += ` al ${formatoLargo(e.fechaFin)}`;
  if (e.horaFin) t += ` – ${hora12(e.horaFin)}`;
  return t;
}

export function mensajeEvento(e: Evento, iglesia: string, link?: string) {
  return [
    `🗓️ *${e.titulo}*`,
    textoCuando(e),
    e.lugar ? `📍 ${e.lugar}` : '',
    '',
    e.descripcion,
    link ? `\nInscríbete aquí: ${link}` : '',
    '',
    iglesia,
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n')
    .trim();
}
