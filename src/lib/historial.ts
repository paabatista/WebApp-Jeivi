/**
 * Historial (auditoría) de Jeivi: cada vez que alguien del equipo crea, edita o borra algo,
 * se guarda quién, cuándo, qué había antes y qué quedó. El historial es de solo-agregar:
 * las reglas no permiten editarlo ni borrarlo, ni siquiera al super admin.
 */
import type { DocumentData } from 'firebase/firestore';

export type AccionHistorial = 'crear' | 'editar' | 'borrar' | 'lote' | 'banner' | 'archivo';

export interface EntradaHistorial {
  id: string;
  fecha: string;
  uid: string;
  nombre: string;
  modulo: string;
  accion: AccionHistorial;
  /** Ruta del documento afectado (para poder restaurarlo). */
  ruta: string;
  resumen: string;
  antes: DocumentData | null;
  despues: DocumentData | null;
}

export interface Auditor {
  uid: string;
  nombre: string;
  iglesiaId: string;
}

export const rutaHistorial = (iglesiaId: string) => `iglesias/${iglesiaId}/historial`;

const MODULO_POR_COLECCION: Record<string, string> = {
  lectura: 'lectura',
  lecturaAjustes: 'lectura',
  suscriptores: 'lectura',
  cumpleanos: 'cumpleanos',
  cumpleEncargos: 'cumpleanos',
  finConceptos: 'finanzas',
  finCargos: 'finanzas',
  finPagos: 'finanzas',
  finGastos: 'finanzas',
  finProyectos: 'finanzas',
  finProyectoMovs: 'finanzas',
  bienes: 'finanzas',
  anuncios: 'anuncios',
  eventos: 'eventos',
  inscripciones: 'eventos',
  solicitudes: 'solicitudes',
  enlaces: 'links',
  archivos: 'archivos',
};

export const NOMBRE_MODULO: Record<string, string> = {
  lectura: 'Lectura',
  cumpleanos: 'Cumpleaños',
  finanzas: 'Finanzas',
  anuncios: 'Anuncios',
  eventos: 'Eventos',
  solicitudes: 'Solicitudes',
  links: 'Links públicos',
  archivos: 'Archivos',
  usuarios: 'Usuarios',
  configuracion: 'Configuración',
  banners: 'Banners',
};

/** ¿A qué módulo pertenece esta ruta? null = no se audita (progreso personal, el propio historial…). */
export function moduloDeRuta(ruta: string): string | null {
  const p = ruta.split('/');
  if (p[0] === 'users') return p.length === 2 ? 'usuarios' : null;
  if (p[0] === 'invitaciones') return 'usuarios';
  if (p[0] !== 'iglesias') return null;
  if (p.length === 2) return 'configuracion';
  if (p[2] === 'historial') return null;
  return MODULO_POR_COLECCION[p[2]] ?? p[2];
}

const LIMITE_TEXTO = 3000;

/** Copia "liviana" para el historial: sin imágenes incrustadas ni textos enormes. */
export function sanear(d: DocumentData | null | undefined): DocumentData | null {
  if (!d) return null;
  const limpiar = (v: unknown): unknown => {
    if (typeof v === 'string') return v.startsWith('data:') ? '[imagen]' : v.length > LIMITE_TEXTO ? v.slice(0, LIMITE_TEXTO) + '…' : v;
    if (Array.isArray(v)) return v.slice(0, 100).map(limpiar);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, limpiar(x)]));
    return v;
  };
  return limpiar(JSON.parse(JSON.stringify(d))) as DocumentData;
}

const fmt = (n: unknown) => (typeof n === 'number' ? `$${n.toFixed(2)}` : '');

/** Frase corta que describe el registro: "Luz · Carlos Rodríguez · $25.00". */
export function describir(d: DocumentData | null | undefined): string {
  if (!d) return '';
  const partes = [
    d.titulo,
    d.conceptoNombre,
    d.diaconoNombre,
    d.nombre && !d.titulo ? d.nombre : null,
    d.tipo && typeof d.tipo === 'string' && d.tipo.length < 40 ? d.tipo : null,
    d.email && !d.nombre ? d.email : null,
    typeof d.monto === 'number' ? fmt(d.monto) : null,
    d.rol ? `rol: ${d.rol}` : null,
    d.estado && typeof d.estado === 'string' ? d.estado : null,
  ].filter((x) => typeof x === 'string' && x.trim());
  return [...new Set(partes)].slice(0, 4).join(' · ');
}

/** Campos que cambiaron entre dos versiones (para mostrar "antes → después"). */
export function camposCambiados(antes: DocumentData | null, despues: DocumentData | null): { campo: string; antes: unknown; despues: unknown }[] {
  const a = antes || {};
  const b = despues || {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => !['creado', 'importacion'].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => ({ campo: k, antes: a[k], despues: b[k] }));
}
