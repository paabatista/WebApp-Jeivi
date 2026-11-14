import { tieneNivel } from '../../lib/roles';
import { useSesion, type Perfil } from '../../lib/sesion';

/**
 * Quién administra Finanzas: pastores, super admin y los diáconos que la pastora marcó como
 * "Encargada de finanzas" en Usuarios. Los demás diáconos solo ven su cuenta, el resumen (totales)
 * y los proyectos, sin editar. Debe coincidir con finAdmin() en firestore.rules.
 */
export function esAdminFinanzas(perfil: Perfil | null | undefined): boolean {
  if (!perfil) return false;
  return tieneNivel(perfil.rol, 'pastor') || (perfil.rol === 'diacono' && perfil.encargadoFinanzas === true);
}

export function useAdminFinanzas() {
  return esAdminFinanzas(useSesion().perfil);
}
