import type { Rol } from './roles';

/**
 * Acceso solo por invitación: un pastor o el super admin registra el correo de la persona
 * y con qué rol entra. Quien inicie sesión con un correo sin invitación no ve nada.
 * El id del documento es el correo en minúsculas.
 */
export interface Invitacion {
  email: string;
  nombre: string;
  rol: Extract<Rol, 'pastor' | 'diacono'>;
  iglesiaId: string;
  invitadoPor: string;
  invitadoPorNombre: string;
  creado: string;
}

export const RUTA_INVITACIONES = 'invitaciones';

export const normalizarCorreo = (e: string) => e.trim().toLowerCase();

export const correoValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
