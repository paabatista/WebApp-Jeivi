import { PLAN, TOTAL_DIAS, type DiaPlan } from './plan.js';
import { diaSemana, diasEntre, esFinDeSemana, sumarDias } from '../../lib/fechas.js';

export interface Ciclo {
  id: string;
  nombre: string;
  /** Fecha ISO del primer día de lectura (normalmente un lunes). */
  inicio: string;
  /** Días hábiles en los que NO se avanza (feriados, semana de retiro, etc.). */
  pausas?: string[];
}

/** Ajuste del admin para un día concreto del plan (aplica a todos los ciclos). */
export interface AjusteDia {
  /** Texto que reemplaza la lectura del Excel, ej. "Génesis 1:1-8, Mateo 1:5". */
  lectura?: string;
  /** Nota / versículo opcional que acompaña el banner. */
  nota?: string;
}

export type EstadoHoy =
  | { tipo: 'sinCiclo' }
  | { tipo: 'antesDeInicio'; ciclo: Ciclo; faltan: number }
  | { tipo: 'lectura'; ciclo: Ciclo; dia: DiaPlan }
  | { tipo: 'pausa'; ciclo: Ciclo; siguiente?: DiaPlan; leidos: number }
  | { tipo: 'finDeSemana'; ciclo: Ciclo; semana: DiaPlan[]; siguiente?: DiaPlan; leidos: number }
  | { tipo: 'completado'; ciclo: Ciclo };

function esPausa(ciclo: Ciclo, iso: string) {
  return !!ciclo.pausas?.includes(iso);
}

function esDiaDeLectura(ciclo: Ciclo, iso: string) {
  return !esFinDeSemana(iso) && !esPausa(ciclo, iso);
}

/** Cuántas lecturas se completaron ANTES de la fecha dada (sin contarla). */
export function lecturasAntesDe(ciclo: Ciclo, iso: string): number {
  const total = diasEntre(ciclo.inicio, iso);
  let n = 0;
  for (let i = 0; i < total; i++) {
    if (esDiaDeLectura(ciclo, sumarDias(ciclo.inicio, i))) n++;
  }
  return n;
}

/** Ciclo vigente para una fecha: el de inicio más reciente que ya empezó. */
export function cicloVigente(ciclos: Ciclo[], iso: string): { actual?: Ciclo; proximo?: Ciclo } {
  const orden = [...ciclos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const actual = [...orden].reverse().find((c) => c.inicio <= iso);
  const proximo = orden.find((c) => c.inicio > iso);
  return { actual, proximo };
}

export function estadoDelDia(ciclos: Ciclo[], iso: string): EstadoHoy {
  const { actual, proximo } = cicloVigente(ciclos, iso);
  if (!actual) {
    return proximo ? { tipo: 'antesDeInicio', ciclo: proximo, faltan: diasEntre(iso, proximo.inicio) } : { tipo: 'sinCiclo' };
  }
  const antes = lecturasAntesDe(actual, iso);
  if (antes >= TOTAL_DIAS) {
    // El fin de semana justo después de la última lectura sigue siendo "ponerse al día".
    if (esFinDeSemana(iso) && diasEntre(fechaFinCiclo(actual), iso) <= 2) {
      const semana = PLAN.filter((d) => d.semana === 26);
      return { tipo: 'finDeSemana', ciclo: actual, semana, siguiente: proximo ? PLAN[0] : undefined, leidos: TOTAL_DIAS };
    }
    if (proximo) return { tipo: 'antesDeInicio', ciclo: proximo, faltan: diasEntre(iso, proximo.inicio) };
    return { tipo: 'completado', ciclo: actual };
  }
  if (esFinDeSemana(iso)) {
    const ultimo = PLAN[antes - 1];
    const semana = ultimo ? PLAN.filter((d) => d.semana === ultimo.semana && d.indice <= ultimo.indice) : [];
    return { tipo: 'finDeSemana', ciclo: actual, semana, siguiente: PLAN[antes], leidos: antes };
  }
  if (esPausa(actual, iso)) return { tipo: 'pausa', ciclo: actual, siguiente: PLAN[antes], leidos: antes };
  return { tipo: 'lectura', ciclo: actual, dia: PLAN[antes] };
}

/** Fecha en la que toca cada día del plan dentro de un ciclo. */
export function fechasDelCiclo(ciclo: Ciclo): string[] {
  const fechas: string[] = [];
  let iso = ciclo.inicio;
  let guard = 0;
  while (fechas.length < TOTAL_DIAS && guard++ < 1000) {
    if (esDiaDeLectura(ciclo, iso)) fechas.push(iso);
    iso = sumarDias(iso, 1);
  }
  return fechas;
}

export function fechaFinCiclo(ciclo: Ciclo): string {
  const f = fechasDelCiclo(ciclo);
  return f[f.length - 1];
}

export function esLunes(iso: string) {
  return diaSemana(iso) === 1;
}
