import { IGLESIA_ID } from '../../lib/firebase';

export type EstadoSolicitud = 'nueva' | 'en_proceso' | 'atendida' | 'cerrada';

export interface Seguimiento {
  fecha: string;
  autor: string;
  texto: string;
}

export interface Solicitud {
  id: string;
  tipo: string;
  nombre: string;
  telefono: string;
  email: string;
  mensaje: string;
  /** Solo la ven pastores y super admin. */
  confidencial: boolean;
  estado: EstadoSolicitud;
  asignadoUid?: string;
  asignadoNombre?: string;
  seguimiento: Seguimiento[];
  origen: 'link' | 'interna';
  enlace?: string;
  creado: string;
}

export const RUTA_SOLICITUDES = `iglesias/${IGLESIA_ID}/solicitudes`;

export const TIPOS_SOLICITUD = [
  'Petición de oración',
  'Visita',
  'Consejería pastoral',
  'Ayuda social',
  'Uso de instalaciones',
  'Presentación de niño / bautismo',
  'Testimonio',
  'Otro',
];

export const ESTADOS_SOLICITUD: Record<EstadoSolicitud, string> = {
  nueva: 'Nueva',
  en_proceso: 'En proceso',
  atendida: 'Atendida',
  cerrada: 'Cerrada',
};
