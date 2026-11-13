import { IGLESIA_ID } from '../../lib/firebase';
import { MESES, type Cumple } from './datos';

/**
 * Encargado del mes (tipo ticket): la pastora asigna a un diácono los cumpleaños de un mes.
 * El diácono hace y envía los banners; cada persona felicitada queda marcada.
 * Un documento por mes: iglesias/{ig}/cumpleEncargos/{YYYY-MM}.
 */
export type EstadoEncargo = 'pendiente' | 'en_curso' | 'completado';

export const ESTADOS_ENCARGO: Record<EstadoEncargo, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  completado: 'Completado',
};

export interface Encargo {
  id: string; // YYYY-MM
  mes: string; // YYYY-MM
  diaconoUid: string;
  diaconoNombre: string;
  asignadoPor: string;
  asignadoPorNombre: string;
  nota: string;
  estado: EstadoEncargo;
  /** Ids de los cumpleañeros ya felicitados (banner enviado). */
  hechos: string[];
  creado: string;
  actualizado: string;
}

export const RUTA_ENCARGOS = `iglesias/${IGLESIA_ID}/cumpleEncargos`;

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11" → "Noviembre 2026" */
export function nombreMes(clave: string) {
  const [a, m] = clave.split('-').map(Number);
  return `${MESES[m - 1]} ${a}`;
}

/** Meses a mostrar: el anterior, el actual y los `adelante` siguientes. */
export function mesesVisibles(hoy: string, adelante = 4): string[] {
  const [a, m] = hoy.split('-').map(Number);
  const out: string[] = [];
  for (let i = -1; i <= adelante; i++) {
    const d = new Date(Date.UTC(a, m - 1 + i, 1));
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  return out;
}

/** Mes del encargo al que pertenece el próximo cumpleaños de la persona (si ya pasó este año, es el del año que viene). */
export function mesDelEncargo(c: Pick<Cumple, 'mes'>, hoy: string): string {
  const [a, m] = hoy.split('-').map(Number);
  return `${c.mes >= m ? a : a + 1}-${pad(c.mes)}`;
}

/** Cumpleañeros de un mes, por día. */
export function cumplesDelMes(lista: Cumple[], clave: string): Cumple[] {
  const m = Number(clave.split('-')[1]);
  return lista.filter((c) => c.mes === m).sort((a, b) => a.dia - b.dia || a.nombre.localeCompare(b.nombre));
}

export function estadoSegun(hechos: number, total: number): EstadoEncargo {
  if (total > 0 && hechos >= total) return 'completado';
  return hechos > 0 ? 'en_curso' : 'pendiente';
}
