import { IGLESIA_ID } from '../../lib/firebase';
import { diasEntre } from '../../lib/fechas';

export interface Cumple {
  id: string;
  nombre: string;
  dia: number; // 1..31
  mes: number; // 1..12
  /** Año de nacimiento (opcional: hay quien prefiere no darlo). */
  anio?: number | null;
  foto?: string;
  telefono?: string;
  /** Nombre del responsable que registró al grupo familiar. */
  familia?: string;
  /** Id que agrupa al titular con sus hijos. */
  grupo?: string;
  parentesco: 'titular' | 'hijo';
  origen: 'link' | 'manual';
  enlace?: string;
  autorizaFoto: boolean;
  creado: string;
}

export const RUTA_CUMPLES = `iglesias/${IGLESIA_ID}/cumpleanos`;

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const pad = (n: number) => String(n).padStart(2, '0');

export function textoFecha(c: Pick<Cumple, 'dia' | 'mes'>) {
  return `${c.dia} de ${MESES[c.mes - 1].toLowerCase()}`;
}

/** Fecha ISO del próximo cumpleaños (hoy cuenta como próximo). 29-feb cae el 28 en años no bisiestos. */
export function proximoCumple(c: Pick<Cumple, 'dia' | 'mes'>, hoy: string): string {
  const anio = Number(hoy.slice(0, 4));
  const fecha = (a: number) => {
    const bisiesto = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
    const dia = c.mes === 2 && c.dia === 29 && !bisiesto ? 28 : c.dia;
    return `${a}-${pad(c.mes)}-${pad(dia)}`;
  };
  const este = fecha(anio);
  return este >= hoy ? este : fecha(anio + 1);
}

export function diasParaCumple(c: Pick<Cumple, 'dia' | 'mes'>, hoy: string) {
  return diasEntre(hoy, proximoCumple(c, hoy));
}

/** Años que cumple en su próximo cumpleaños (si se conoce el año). */
export function edadQueCumple(c: Cumple, hoy: string): number | null {
  if (!c.anio) return null;
  return Number(proximoCumple(c, hoy).slice(0, 4)) - c.anio;
}

export function partirFecha(iso: string): { dia: number; mes: number; anio: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

export function mensajeFelicitacion(c: Cumple, iglesia: string) {
  return `🎉 ¡Feliz cumpleaños, ${c.nombre.split(' ')[0]}! 🎂\n\nQue el Señor te bendiga y te guarde; que haga resplandecer su rostro sobre ti. (Números 6:24-25)\n\nCon cariño, tu familia de ${iglesia}.`;
}
