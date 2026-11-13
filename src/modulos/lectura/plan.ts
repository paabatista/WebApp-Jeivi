/**
 * Plan "Lectura de la Biblia en 6 meses" — Ministerio Jesucristo Imperio de Vida.
 * Transcrito del archivo LECTURA DE LA BIBLIA EN 6 MESES.xlsx:
 * 26 semanas, de lunes a viernes (130 lecturas), dos ciclos por año.
 *
 * Correcciones respecto al Excel:
 *  - Semana 5, martes: el Excel dice "Deuteronomio 24-34" en una columna y "25-34" en otra; se usa 25-34.
 *  - Los días con varios libros (semana 20 en adelante) se agrupan según el día de la fila siguiente.
 */

export interface Pasaje {
  libro: string;
  capitulos: string; // "1-8", "1", "136-150"
}

export interface DiaPlan {
  /** índice 0..129 */
  indice: number;
  semana: number; // 1..26
  dia: number; // 1 = lunes … 5 = viernes
  mes: number; // 1..6 (mes del ciclo)
  pasajes: Pasaje[];
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const;

/** Semana en la que empieza cada mes del ciclo (según el Excel). */
const INICIO_MES: Record<number, number> = { 1: 1, 2: 5, 3: 9, 4: 15, 5: 18, 6: 24 };

type DiaCrudo = string; // "Génesis 1-8 | Éxodo 1-3"

const SEMANAS: DiaCrudo[][] = [
  /* 1 */ ['Génesis 1-8', 'Génesis 9-16', 'Génesis 17-24', 'Génesis 25-32', 'Génesis 33-40'],
  /* 2 */ ['Génesis 41-50', 'Éxodo 1-8', 'Éxodo 9-16', 'Éxodo 17-24', 'Éxodo 25-32'],
  /* 3 */ ['Éxodo 33-40', 'Levítico 1-9', 'Levítico 10-18', 'Levítico 19-27', 'Números 1-10'],
  /* 4 */ ['Números 11-18', 'Números 19-26', 'Números 27-36', 'Deuteronomio 1-8', 'Deuteronomio 9-16'],
  /* 5 */ ['Deuteronomio 17-24', 'Deuteronomio 25-34', 'Josué 1-8', 'Josué 9-16', 'Josué 17-24'],
  /* 6 */ ['Jueces 1-10', 'Jueces 11-21', 'Rut 1-4', '1 Samuel 1-10', '1 Samuel 11-21'],
  /* 7 */ ['1 Samuel 22-31', '2 Samuel 1-8', '2 Samuel 9-16', '2 Samuel 17-24', '1 Reyes 1-8'],
  /* 8 */ ['1 Reyes 9-16', '1 Reyes 17-22', '2 Reyes 1-8', '2 Reyes 9-16', '2 Reyes 17-25'],
  /* 9 */ ['1 Crónicas 1-9', '1 Crónicas 10-20', '1 Crónicas 21-29', '2 Crónicas 1-9', '2 Crónicas 10-18'],
  /* 10 */ ['2 Crónicas 19-27', '2 Crónicas 28-36', 'Esdras 1-10', 'Nehemías 1-13', 'Ester 1-10'],
  /* 11 */ ['Job 1-8', 'Job 9-16', 'Job 17-24', 'Job 25-33', 'Job 34-42'],
  /* 12 */ ['Salmos 1-15', 'Salmos 16-30', 'Salmos 31-45', 'Salmos 46-60', 'Salmos 61-75'],
  /* 13 */ ['Salmos 76-90', 'Salmos 91-105', 'Salmos 106-120', 'Salmos 121-135', 'Salmos 136-150'],
  /* 14 */ ['Proverbios 1-10', 'Proverbios 11-20', 'Proverbios 21-31', 'Eclesiastés 1-6', 'Eclesiastés 7-12'],
  /* 15 */ ['Cantares 1-8', 'Isaías 1-8', 'Isaías 9-16', 'Isaías 17-24', 'Isaías 25-32'],
  /* 16 */ ['Isaías 33-40', 'Isaías 41-48', 'Isaías 49-56', 'Isaías 57-66', 'Jeremías 1-9'],
  /* 17 */ ['Jeremías 10-18', 'Jeremías 19-27', 'Jeremías 28-36', 'Jeremías 37-45', 'Jeremías 46-52'],
  /* 18 */ ['Lamentaciones 1-5', 'Ezequiel 1-8', 'Ezequiel 9-16', 'Ezequiel 17-24', 'Ezequiel 25-32'],
  /* 19 */ ['Ezequiel 33-40', 'Ezequiel 41-48', 'Daniel 1-12', 'Oseas 1-7', 'Oseas 8-14'],
  /* 20 */ [
    'Joel 1-3 | Amós 1-9',
    'Abdías 1 | Jonás 1-4',
    'Miqueas 1-7',
    'Nahúm 1-3 | Habacuc 1-3 | Sofonías 1-3 | Hageo 1-2',
    'Zacarías 1-7',
  ],
  /* 21 */ ['Zacarías 8-14 | Malaquías 1-4', 'Mateo 1-7', 'Mateo 8-14', 'Mateo 15-22', 'Mateo 23-28'],
  /* 22 */ ['Marcos 1-8', 'Marcos 9-16', 'Lucas 1-12', 'Lucas 13-24', 'Juan 1-10'],
  /* 23 */ ['Juan 11-21', 'Hechos 1-9', 'Hechos 10-18', 'Hechos 19-28', 'Romanos 1-8'],
  /* 24 */ ['Romanos 9-16', '1 Corintios 1-8', '1 Corintios 9-16', '2 Corintios 1-13', 'Gálatas 1-6 | Efesios 1-6'],
  /* 25 */ [
    'Filipenses 1-4 | Colosenses 1-4',
    '1 Tesalonicenses 1-5 | 2 Tesalonicenses 1-3',
    '1 Timoteo 1-6 | 2 Timoteo 1-4',
    'Tito 1-3 | Filemón 1',
    'Hebreos 1-13',
  ],
  /* 26 */ [
    'Santiago 1-5',
    '1 Pedro 1-5 | 2 Pedro 1-3',
    '1 Juan 1-5 | 2 Juan 1 | 3 Juan 1 | Judas 1',
    'Apocalipsis 1-11',
    'Apocalipsis 12-22',
  ],
];

function parsePasaje(txt: string): Pasaje {
  const m = txt.trim().match(/^(.*\S)\s+(\d+(?:-\d+)?)$/);
  if (!m) throw new Error(`Pasaje inválido: ${txt}`);
  return { libro: m[1], capitulos: m[2] };
}

function mesDeSemana(semana: number): number {
  let mes = 1;
  for (const [m, s] of Object.entries(INICIO_MES)) if (semana >= s) mes = Number(m);
  return mes;
}

export const PLAN: DiaPlan[] = SEMANAS.flatMap((dias, i) =>
  dias.map((crudo, d) => ({
    indice: i * 5 + d,
    semana: i + 1,
    dia: d + 1,
    mes: mesDeSemana(i + 1),
    pasajes: crudo.split('|').map(parsePasaje),
  })),
);

export const TOTAL_DIAS = PLAN.length; // 130

export function textoPasaje(p: Pasaje): string {
  return `${p.libro} ${p.capitulos}`;
}

export function textoPasajes(pasajes: Pasaje[]): string {
  return pasajes.map(textoPasaje).join(', ');
}
