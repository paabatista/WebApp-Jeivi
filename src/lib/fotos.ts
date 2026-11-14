import { guardarImagen, type Autor } from './almacen';

/**
 * Guarda una foto en Firebase Storage y devuelve su URL (sin Storage, p. ej. en modo demo, queda reducida en el registro).
 * `carpeta` es "jeivi/<modulo>". Con `autor` la foto queda en el historial de archivos;
 * con `publicoToken` se sube a la carpeta del link público (formularios sin cuenta).
 */
export async function guardarFoto(archivo: File, carpeta: string, extra: { autor?: Autor | null; publicoToken?: string; titulo?: string } = {}): Promise<string> {
  const modulo = carpeta.split('/').pop() || 'fotos';
  return guardarImagen(archivo, {
    modulo,
    titulo: extra.titulo || archivo.name,
    autor: extra.autor,
    publicoToken: extra.publicoToken,
  });
}
