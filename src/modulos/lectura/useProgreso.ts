import { useEffect, useState } from 'react';
import { escucharDoc, guardarDoc } from '../../lib/datos';
import { useSesion } from '../../lib/sesion';

/** Lecturas que el usuario marcó como leídas en un ciclo. */
export function useProgreso(cicloId?: string) {
  const { perfil } = useSesion();
  const [leidos, setLeidos] = useState<number[]>([]);
  const ruta = perfil && cicloId ? `users/${perfil.uid}/progresoLectura/${cicloId}` : '';

  useEffect(() => {
    if (!ruta) return setLeidos([]);
    return escucharDoc<{ leidos: number[] }>(ruta, (d) => setLeidos(d?.leidos || []));
  }, [ruta]);

  async function alternar(indice: number) {
    if (!ruta) return;
    const nuevo = leidos.includes(indice) ? leidos.filter((i) => i !== indice) : [...leidos, indice].sort((a, b) => a - b);
    setLeidos(nuevo);
    await guardarDoc(ruta, { leidos: nuevo, actualizado: new Date().toISOString() });
  }

  return { leidos, alternar, esLeido: (i: number) => leidos.includes(i) };
}
