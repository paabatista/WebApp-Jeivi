import { useEffect, useMemo, useState } from 'react';
import { IGLESIA_ID } from '../../lib/firebase';
import { escucharColeccion, escucharDoc } from '../../lib/datos';
import { hoyISO, primerLunes } from '../../lib/fechas';
import { estadoDelDia, type AjusteDia, type Ciclo } from './calendario';
import { textoPasajes, type DiaPlan } from './plan';

export interface ImagenBanco {
  id: string;
  url: string;
  titulo: string;
}

export interface ConfigLectura {
  ciclos: Ciclo[];
  mensajeFinDeSemana: string;
  /** Texto del pie del banner (ej. web o redes de la iglesia). */
  pieBanner: string;
  imagenes: ImagenBanco[];
}

export const RUTA_CONFIG = `iglesias/${IGLESIA_ID}/lectura/config`;
export const RUTA_AJUSTES = `iglesias/${IGLESIA_ID}/lecturaAjustes`;

/** Ciclos por defecto: primer lunes de enero y de julio del año actual y del siguiente. */
export function ciclosPorDefecto(anio = new Date().getFullYear()): Ciclo[] {
  return [anio, anio + 1].flatMap((a) => [
    { id: `${a}-1`, nombre: `Enero – Junio ${a}`, inicio: primerLunes(a, 1) },
    { id: `${a}-2`, nombre: `Julio – Diciembre ${a}`, inicio: primerLunes(a, 7) },
  ]);
}

export const CONFIG_POR_DEFECTO: ConfigLectura = {
  ciclos: [],
  mensajeFinDeSemana: 'Hoy es día para ponerte al día. Si te atrasaste, aprovecha para completar las lecturas de la semana.',
  pieBanner: 'ministeriojesucristoimperiodevida.com',
  imagenes: [],
};

export function useLectura() {
  const [config, setConfig] = useState<ConfigLectura>(CONFIG_POR_DEFECTO);
  const [ajustes, setAjustes] = useState<Record<number, AjusteDia>>({});
  const [cargando, setCargando] = useState(true);

  useEffect(
    () =>
      escucharDoc<Partial<ConfigLectura>>(RUTA_CONFIG, (d) => {
        setConfig({ ...CONFIG_POR_DEFECTO, ...(d || {}) });
        setCargando(false);
      }, () => setCargando(false)),
    [],
  );
  useEffect(
    () =>
      escucharColeccion<AjusteDia>(RUTA_AJUSTES, (docs) => {
        const m: Record<number, AjusteDia> = {};
        docs.forEach((d) => (m[Number(d.id)] = d));
        setAjustes(m);
      }),
    [],
  );

  const ciclosEfectivos = config.ciclos.length ? config.ciclos : ciclosPorDefecto();
  const hoy = hoyISO();
  const estado = useMemo(() => estadoDelDia(ciclosEfectivos, hoy), [JSON.stringify(ciclosEfectivos), hoy]);

  /** Lectura del día aplicando el ajuste del admin si existe. */
  const lecturaDe = (dia: DiaPlan) => ajustes[dia.indice]?.lectura?.trim() || textoPasajes(dia.pasajes);
  const notaDe = (dia: DiaPlan) => ajustes[dia.indice]?.nota?.trim() || '';

  return {
    config,
    ajustes,
    cargando,
    ciclos: ciclosEfectivos,
    usandoCiclosPorDefecto: !config.ciclos.length,
    hoy,
    estado,
    lecturaDe,
    notaDe,
  };
}
