import { IGLESIA_ID } from './firebase';
import { guardarDoc } from './datos';
import type { Perfil } from './sesion';

/**
 * Links públicos de captura: un diácono genera un link desde un módulo y lo comparte por WhatsApp.
 * Quien lo abre NO necesita usuario: solo ve el formulario de ese módulo y nada más.
 * El link se puede desactivar en cualquier momento.
 */
export type ModuloEnlace = 'lectura' | 'cumpleanos' | 'anuncios' | 'eventos' | 'solicitudes';

export interface Enlace {
  id: string;
  modulo: ModuloEnlace;
  titulo: string;
  activo: boolean;
  creadoPor: string;
  creadoPorNombre: string;
  creado: string;
  /** Para links de inscripción a un evento concreto. */
  eventoId?: string;
}

export const RUTA_ENLACES = `iglesias/${IGLESIA_ID}/enlaces`;

export const DESCRIPCION_ENLACE: Record<ModuloEnlace, string> = {
  lectura: 'Ver la lectura de hoy y suscribirse para recibirla',
  cumpleanos: 'Registrar fecha de cumpleaños (propia y de los hijos) con foto',
  anuncios: 'Ver el tablero de anuncios de la iglesia y suscribirse a los avisos',
  eventos: 'Ver el evento e inscribirse',
  solicitudes: 'Enviar una petición de oración, visita u otra solicitud',
};

export function nuevoId(largo = 20) {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(largo));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

export function urlEnlace(token: string) {
  return `${window.location.origin}/p/${token}`;
}

export async function crearEnlace(modulo: ModuloEnlace, titulo: string, perfil: Perfil, eventoId?: string): Promise<Enlace> {
  const e: Enlace = {
    id: nuevoId(),
    modulo,
    titulo: titulo.trim() || DESCRIPCION_ENLACE[modulo],
    activo: true,
    creadoPor: perfil.uid,
    creadoPorNombre: perfil.nombre,
    creado: new Date().toISOString(),
    ...(eventoId ? { eventoId } : {}),
  };
  const { id, ...datos } = e;
  await guardarDoc(`${RUTA_ENLACES}/${id}`, datos, false);
  return e;
}
