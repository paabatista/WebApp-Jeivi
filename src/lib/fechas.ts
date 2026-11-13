/** Utilidades de fechas en formato ISO local "YYYY-MM-DD" (sin horas, sin problemas de zona). */

export const ZONA_IGLESIA = 'America/Panama';

const pad = (n: number) => String(n).padStart(2, '0');

export function aISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fecha de hoy en el navegador. */
export function hoyISO(): string {
  return aISO(new Date());
}

/** Fecha de hoy en una zona horaria concreta (para el servidor). */
export function hoyEnZona(zona = ZONA_IGLESIA, ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
  return partes; // en-CA => YYYY-MM-DD
}

function aUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(aUTC(iso) + dias * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 0 = domingo … 6 = sábado */
export function diaSemana(iso: string): number {
  return new Date(aUTC(iso)).getUTCDay();
}

export function esFinDeSemana(iso: string): boolean {
  const d = diaSemana(iso);
  return d === 0 || d === 6;
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86400000);
}

/** Primer lunes de un mes (mes 1..12). */
export function primerLunes(anio: number, mes: number): string {
  let iso = `${anio}-${pad(mes)}-01`;
  while (diaSemana(iso) !== 1) iso = sumarDias(iso, 1);
  return iso;
}

export function formatoLargo(iso: string): string {
  const d = new Date(aUTC(iso));
  return new Intl.DateTimeFormat('es-PA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function formatoCorto(iso: string): string {
  const d = new Date(aUTC(iso));
  return new Intl.DateTimeFormat('es-PA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
}

export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
