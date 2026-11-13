import { IGLESIA_ID } from '../../lib/firebase';

export interface Anuncio {
  id: string;
  titulo: string;
  texto: string;
  categoria: string;
  /** Cuándo es (texto libre): "Domingo 17 · 10:00 a.m." */
  cuando?: string;
  imagen?: string;
  /** Visible en el tablero público (link). */
  publico: boolean;
  destacado: boolean;
  /** Se muestra desde / hasta (ISO). */
  desde: string;
  hasta?: string;
  creado: string;
  creadoPor: string;
  creadoPorNombre: string;
  /** Último envío por correo a los suscriptores. */
  enviado?: string;
  enviadoA?: number;
}

export const RUTA_ANUNCIOS = `iglesias/${IGLESIA_ID}/anuncios`;

export const CATEGORIAS_ANUNCIO = ['General', 'Culto', 'Jóvenes', 'Damas', 'Caballeros', 'Niños', 'Oración', 'Misiones', 'Evento'];

export const vigente = (a: Pick<Anuncio, 'desde' | 'hasta'>, hoy: string) => a.desde <= hoy && (!a.hasta || a.hasta >= hoy);

export function ordenarAnuncios<T extends Anuncio>(l: T[]): T[] {
  return [...l].sort((a, b) => Number(b.destacado) - Number(a.destacado) || b.desde.localeCompare(a.desde) || b.creado.localeCompare(a.creado));
}

export function mensajeAnuncio(a: Pick<Anuncio, 'titulo' | 'texto' | 'cuando'>, iglesia: string) {
  return [`📢 *${a.titulo}*`, a.cuando ? `🗓️ ${a.cuando}` : '', '', a.texto, '', iglesia].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n').trim();
}
