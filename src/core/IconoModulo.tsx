import type { Modulo } from './modulos';

export function IconoModulo({ modulo, tam = 64 }: { modulo: Modulo; tam?: number }) {
  const Icono = modulo.icono;
  return (
    <span
      className="icono-modulo"
      style={{
        width: tam,
        height: tam,
        background: `linear-gradient(135deg, ${modulo.color[0]}, ${modulo.color[1]})`,
      }}
    >
      <Icono size={tam * 0.5} strokeWidth={2} color="#fff" />
    </span>
  );
}
