/**
 * Niveles de acceso de Jeivi (de mayor a menor):
 *  - superadmin: todo, incluida la configuración de la app (módulos, marca, roles de pastores).
 *  - pastor:     casi todo — gestiona usuarios, ciclos, finanzas, contenidos — pero no la configuración de la app.
 *  - ejecutivo:  diáconos / líderes: entran a los módulos, editan cosas básicas, generan banners y anuncios.
 *  - miembro:    hermanos: ven la lectura y se suscriben (lectura diaria, cumpleaños, tablero informativo). No crean banners.
 *  - pendiente:  cuenta nueva sin aprobar (solo ve la lectura del día).
 */
export const ROLES = ['superadmin', 'pastor', 'ejecutivo', 'miembro', 'pendiente'] as const;
export type Rol = (typeof ROLES)[number];

export const NIVEL: Record<Rol, number> = { superadmin: 100, pastor: 80, ejecutivo: 50, miembro: 20, pendiente: 10 };

export const ETIQUETA_ROL: Record<Rol, string> = {
  superadmin: 'Super admin',
  pastor: 'Pastor (admin)',
  ejecutivo: 'Ejecutivo / Diácono',
  miembro: 'Miembro',
  pendiente: 'Pendiente de aprobación',
};

export function tieneNivel(rol: Rol | undefined, minimo: Rol): boolean {
  return !!rol && NIVEL[rol] >= NIVEL[minimo];
}

/** Roles que un usuario puede asignar a otros. */
export function rolesAsignables(rol: Rol | undefined): Rol[] {
  if (rol === 'superadmin') return ['pastor', 'ejecutivo', 'miembro', 'pendiente'];
  if (rol === 'pastor') return ['ejecutivo', 'miembro', 'pendiente'];
  return [];
}
