import { guardarImagen, type Autor } from './almacen';
import type { Iglesia } from './sesion';

/**
 * Guarda una foto y devuelve su URL: Firebase Storage (si está activo) → Cloudinary → reducida en el registro.
 * `carpeta` es "jeivi/<modulo>". Con `autor` la foto queda en el historial de archivos;
 * con `publicoToken` se sube a la carpeta del link público (formularios sin cuenta).
 */
export async function guardarFoto(
  archivo: File,
  iglesia: Iglesia,
  carpeta: string,
  extra: { autor?: Autor | null; publicoToken?: string; titulo?: string } = {},
): Promise<string> {
  const modulo = carpeta.split('/').pop() || 'fotos';
  return guardarImagen(archivo, {
    modulo,
    titulo: extra.titulo || archivo.name,
    autor: extra.autor,
    publicoToken: extra.publicoToken,
    cloudinary: iglesia.cloudinary,
  });
}
