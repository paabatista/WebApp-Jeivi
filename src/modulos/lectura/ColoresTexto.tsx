import { useEffect, useState } from 'react';
import { Palette, RotateCcw } from 'lucide-react';
import { useSesion } from '../../lib/sesion';

/** Color elegido para cada texto del banner (lo que no está, usa el color automático). */
export type Colores = Partial<Record<string, string>>;

export interface ParteColor {
  id: string;
  nombre: string;
  /** Color automático (el que pone el diseño si no se elige otro). */
  defecto: string;
}

/** "#abc", "#aabbcc", "rgba(255,255,255,0.8)" → "#rrggbb" (para el selector de color). */
export function aHex(color: string): string {
  const c = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return ('#' + [...c.slice(1)].map((x) => x + x).join('')).toLowerCase();
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return '#' + [m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
  return '#ffffff';
}

/** Colores recordados por módulo en este dispositivo, para no tener que elegirlos cada vez. */
export function useColoresGuardados(clave: string): [Colores, (c: Colores) => void] {
  const llave = `jeivi-colores-${clave}`;
  const [colores, setColores] = useState<Colores>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(llave) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(llave, JSON.stringify(colores));
    } catch {
      /* sin almacenamiento local: solo dura esta sesión */
    }
  }, [llave, colores]);
  return [colores, setColores];
}

export function ColoresTexto({ partes, valores, alCambiar }: { partes: ParteColor[]; valores: Colores; alCambiar: (c: Colores) => void }) {
  const { iglesia } = useSesion();
  const paleta = [...new Set(['#ffffff', '#000000', '#d4af37', '#f5e6c8', iglesia.colorAcento, iglesia.colorPrimario, '#f472b6', '#60a5fa', '#fbbf24', '#22c55e'].map(aHex))];
  const fijar = (id: string, color: string | null) => {
    const v = { ...valores };
    if (color) v[id] = color;
    else delete v[id];
    alCambiar(v);
  };
  const personalizados = partes.filter((p) => valores[p.id]).length;

  return (
    <details className="colores-texto" open={personalizados > 0}>
      <summary className="con-icono">
        <Palette size={16} /> Colores de las letras{personalizados ? ` (${personalizados} cambiado${personalizados > 1 ? 's' : ''})` : ''}
      </summary>
      <div className="color-todos">
        <span className="suave pequeno">Todo el texto:</span>
        {paleta.map((c) => (
          <button key={c} type="button" className="muestra" style={{ background: c }} title={c} onClick={() => alCambiar(Object.fromEntries(partes.map((p) => [p.id, c])))} />
        ))}
        {personalizados > 0 && (
          <button type="button" className="enlace pequeno con-icono" onClick={() => alCambiar({})}>
            <RotateCcw size={13} /> Volver a los colores automáticos
          </button>
        )}
      </div>
      {partes.map((p) => {
        const actual = valores[p.id];
        return (
          <div key={p.id} className="color-fila">
            <span className="color-nombre">{p.nombre}</span>
            <div className="color-opciones">
              {paleta.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`muestra${actual && aHex(actual) === c ? ' activa' : ''}`}
                  style={{ background: c }}
                  title={c}
                  onClick={() => fijar(p.id, c)}
                />
              ))}
              <input type="color" value={aHex(actual || p.defecto)} onChange={(e) => fijar(p.id, e.target.value)} title="Elegir cualquier color" aria-label={`Color de ${p.nombre}`} />
              <button type="button" className={`chip mini${actual ? '' : ' chip-activo'}`} onClick={() => fijar(p.id, null)} title="Color del diseño">
                Auto
              </button>
            </div>
          </div>
        );
      })}
    </details>
  );
}
