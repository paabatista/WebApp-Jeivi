import { reducirImagen, subirACloudinary } from './cloudinary';
import type { Iglesia } from './sesion';

function blobADataUrl(b: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(new Error('No se pudo leer la imagen'));
    r.readAsDataURL(b);
  });
}

/**
 * Guarda una foto y devuelve su URL.
 * Con Cloudinary configurado la sube allí; si no, la reduce (≈500 px) y la guarda como texto
 * dentro del registro (suficiente para banners y sin depender de ningún servicio).
 */
export async function guardarFoto(archivo: File, iglesia: Iglesia, carpeta: string): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen.');
  const cl = iglesia.cloudinary;
  if (cl?.cloudName && cl.uploadPreset) return subirACloudinary(archivo, cl.cloudName, cl.uploadPreset, carpeta);
  return blobADataUrl(await reducirImagen(archivo, 520, 0.8));
}
