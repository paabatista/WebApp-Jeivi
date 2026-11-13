import { IGLESIA_ID } from '../../lib/firebase';

/** Persona de la congregación que se suscribió por el link público (no tiene usuario). */
export interface Suscriptor {
  id: string;
  nombre: string;
  email?: string;
  whatsapp?: string;
  /** Token del link por el que se registró. */
  enlace: string;
  activo: boolean;
  creado: string;
}

export const RUTA_SUSCRIPTORES = `iglesias/${IGLESIA_ID}/suscriptores`;

export const limpiarTelefono = (t: string) => t.replace(/[^\d+]/g, '');

/** Número para wa.me: solo dígitos; si no trae código de país se asume Panamá (507). */
export function numeroWhatsApp(t: string): string {
  const d = t.replace(/\D/g, '');
  if (!d) return '';
  return d.length <= 8 ? `507${d}` : d;
}
