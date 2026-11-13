/**
 * Niveles de acceso de Jeivi (solo el equipo de la iglesia tiene usuario):
 *  - superadmin: todo, incluida la configuración de la app (módulos, marca, nombrar pastores).
 *  - pastor:     casi todo (usuarios, finanzas, ciclos, contenidos) pero no la configuración de la app.
 *  - diacono:    entra a los módulos, edita cosas básicas, genera banners, anuncios y links de registro;
 *                ve su propio estado de cuenta en Finanzas.
 *  - pendiente:  cuenta nueva que un pastor debe aprobar como diácono.
 *
 * La congregación NO tiene usuario: participa por los links públicos que generan los diáconos
 * (suscribirse a la lectura, registrar cumpleaños, etc.).
 */
export const ROLES = ['superadmin', 'pastor', 'diacono', 'pendiente'] as const;
export type Rol = (typeof ROLES)[number];

export const NIVEL: Record<Rol, number> = { superadmin: 100, pastor: 80, diacono: 50, pendiente: 10 };

export const ETIQUETA_ROL: Record<Rol, string> = {
  superadmin: 'Super admin',
  pastor: 'Pastor (admin)',
  diacono: 'Diácono',
  pendiente: 'Pendiente de aprobación',
};

export function tieneNivel(rol: Rol | undefined, minimo: Rol): boolean {
  return !!rol && (NIVEL[rol] ?? 0) >= NIVEL[minimo];
}

/** Roles que un usuario puede asignar a otros. */
export function rolesAsignables(rol: Rol | undefined): Rol[] {
  if (rol === 'superadmin') return ['pastor', 'diacono', 'pendiente'];
  if (rol === 'pastor') return ['diacono', 'pendiente'];
  return [];
}
