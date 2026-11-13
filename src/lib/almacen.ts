/**
 * Almacenamiento de archivos (fotos, banners, comprobantes) en Firebase Storage.
 * Cada archivo queda registrado en iglesias/{ig}/archivos con quién lo subió y cuándo:
 * ese registro es el "historial" de archivos (no se borra ni se sobrescribe).
 *
 * Se activa con VITE_STORAGE_ACTIVO=1 (requiere plan Blaze). Sin eso, Jeivi sigue funcionando:
 * las fotos se guardan reducidas dentro del registro y los banners guardan solo una miniatura.
 */
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { app, firebaseConfigurado, IGLESIA_ID } from './firebase';
import { guardarDoc } from './datos';
import { reducirImagen } from './cloudinary';

export const STORAGE_ACTIVO = firebaseConfigurado && import.meta.env.VITE_STORAGE_ACTIVO === '1';

export type TipoArchivo = 'foto' | 'banner' | 'comprobante' | 'documento';

export interface Archivo {
  id: string;
  tipo: TipoArchivo;
  modulo: string;
  titulo: string;
  nombre: string;
  /** URL del archivo completo en Storage ('' si Storage no está activo). */
  url: string;
  ruta: string;
  contentType: string;
  tamano: number;
  /** Miniatura pequeña (JPEG) para la galería del historial. */
  miniatura?: string;
  /** Documento al que pertenece (ej. el gasto de un comprobante). */
  relacionado?: string;
  creado: string;
  subidoPor: string;
  subidoPorNombre: string;
}

export const RUTA_ARCHIVOS = `iglesias/${IGLESIA_ID}/archivos`;

export interface Autor {
  uid: string;
  nombre: string;
}

function idArchivo() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => abc[b % abc.length]).join('');
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export function blobADataUrl(b: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(b);
  });
}

/** Miniatura JPEG (por defecto 320 px) de una imagen o un canvas. */
export async function miniatura(origen: Blob | HTMLCanvasElement, maxLado = 320): Promise<string> {
  let fuente: CanvasImageSource;
  let w: number;
  let h: number;
  let url = '';
  if (origen instanceof HTMLCanvasElement) {
    fuente = origen;
    w = origen.width;
    h = origen.height;
  } else {
    url = URL.createObjectURL(origen);
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('Imagen no válida'));
      i.src = url;
    });
    fuente = img;
    w = img.naturalWidth;
    h = img.naturalHeight;
  }
  const e = Math.min(1, maxLado / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * e);
  c.height = Math.round(h * e);
  c.getContext('2d')!.drawImage(fuente, 0, 0, c.width, c.height);
  if (url) URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', 0.72);
}

/** Sube un archivo a Storage. Con `publicoToken` va a la carpeta del link público (sin usuario). */
export async function subirAStorage(blob: Blob, modulo: string, publicoToken?: string): Promise<{ url: string; ruta: string }> {
  const ext = EXT[blob.type] || 'bin';
  const mes = new Date().toISOString().slice(0, 7);
  const ruta = publicoToken ? `iglesias/${IGLESIA_ID}/publico/${publicoToken}/${idArchivo()}.${ext}` : `iglesias/${IGLESIA_ID}/${modulo}/${mes}/${idArchivo()}.${ext}`;
  const r = ref(getStorage(app), ruta);
  await uploadBytes(r, blob, { contentType: blob.type, cacheControl: 'public,max-age=31536000' });
  return { url: await getDownloadURL(r), ruta };
}

interface OpcionesArchivo {
  tipo: TipoArchivo;
  modulo: string;
  titulo: string;
  nombre?: string;
  relacionado?: string;
  autor: Autor;
}

/** Sube a Storage (si está activo) y registra el archivo en el historial. Devuelve la URL ('' sin Storage). */
export async function guardarArchivo(blob: Blob, o: OpcionesArchivo): Promise<Archivo> {
  const id = idArchivo();
  const mini = blob.type.startsWith('image/') ? await miniatura(blob).catch(() => undefined) : undefined;
  const subido = STORAGE_ACTIVO ? await subirAStorage(blob, o.modulo) : { url: '', ruta: '' };
  const a: Archivo = {
    id,
    tipo: o.tipo,
    modulo: o.modulo,
    titulo: o.titulo.slice(0, 140),
    nombre: o.nombre || `${o.tipo}.${EXT[blob.type] || 'bin'}`,
    url: subido.url,
    ruta: subido.ruta,
    contentType: blob.type,
    tamano: blob.size,
    miniatura: mini,
    relacionado: o.relacionado || '',
    creado: new Date().toISOString(),
    subidoPor: o.autor.uid,
    subidoPorNombre: o.autor.nombre,
  };
  const { id: _id, ...datos } = a;
  try {
    await guardarDoc(`${RUTA_ARCHIVOS}/${id}`, datos, false);
  } catch (e) {
    // El archivo ya está subido: se usa igual; solo faltó anotarlo en el historial (reglas sin publicar).
    console.warn('No se pudo registrar el archivo en el historial', e);
  }
  return a;
}

/**
 * Foto para un registro (cumpleaños, anuncio, evento, logo). Orden de preferencia:
 * Firebase Storage → Cloudinary → reducida dentro del registro.
 */
export async function guardarImagen(
  archivo: File,
  opciones: { modulo: string; titulo: string; autor?: Autor | null; publicoToken?: string; cloudinary?: { cloudName: string; uploadPreset: string } },
): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen.');
  if (STORAGE_ACTIVO) {
    const reducida = await reducirImagen(archivo, 1600, 0.85);
    if (opciones.publicoToken || !opciones.autor) return (await subirAStorage(reducida, opciones.modulo, opciones.publicoToken)).url;
    return (await guardarArchivo(reducida, { tipo: 'foto', modulo: opciones.modulo, titulo: opciones.titulo, nombre: archivo.name, autor: opciones.autor })).url;
  }
  const cl = opciones.cloudinary;
  if (cl?.cloudName && cl.uploadPreset) {
    const { subirACloudinary } = await import('./cloudinary');
    return subirACloudinary(archivo, cl.cloudName, cl.uploadPreset, `jeivi/${opciones.modulo}`);
  }
  return blobADataUrl(await reducirImagen(archivo, 520, 0.8));
}

/** Comprobante (foto o PDF) para Finanzas. Sin Storage solo se aceptan fotos (reducidas). */
export async function guardarComprobante(archivo: File, titulo: string, relacionado: string, autor: Autor): Promise<{ url: string; nombre: string; tipo: string }> {
  const esPdf = archivo.type === 'application/pdf';
  if (!esPdf && !archivo.type.startsWith('image/')) throw new Error('El comprobante debe ser una foto o un PDF.');
  if (archivo.size > 10 * 1024 * 1024) throw new Error('El archivo pasa de 10 MB.');
  if (!STORAGE_ACTIVO) {
    if (esPdf) throw new Error('Para adjuntar PDF hay que activar Firebase Storage. Puedes subir una foto del recibo.');
    return { url: await blobADataUrl(await reducirImagen(archivo, 1000, 0.75)), nombre: archivo.name, tipo: 'image/jpeg' };
  }
  const blob = esPdf ? archivo : await reducirImagen(archivo, 1800, 0.85);
  const a = await guardarArchivo(blob, { tipo: 'comprobante', modulo: 'finanzas', titulo, nombre: archivo.name, relacionado, autor });
  return { url: a.url, nombre: archivo.name, tipo: blob.type };
}

/**
 * Guarda en el historial un banner que se compartió o descargó.
 * Evita duplicados si se comparte varias veces el mismo diseño.
 */
const ultimoBanner = new Map<string, string>();
export async function registrarBanner(canvas: HTMLCanvasElement, modulo: string, titulo: string, autor: Autor | null | undefined): Promise<void> {
  if (!autor) return;
  const mini = await miniatura(canvas);
  if (ultimoBanner.get(modulo) === mini) return;
  ultimoBanner.set(modulo, mini);
  const id = idArchivo();
  let subido = { url: '', ruta: '' };
  let tamano = 0;
  if (STORAGE_ACTIVO) {
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
    if (blob) {
      tamano = blob.size;
      subido = await subirAStorage(blob, 'banners');
    }
  }
  const a: Omit<Archivo, 'id'> = {
    tipo: 'banner',
    modulo,
    titulo: titulo.slice(0, 140),
    nombre: `banner-${modulo}.png`,
    url: subido.url,
    ruta: subido.ruta,
    contentType: 'image/png',
    tamano,
    miniatura: mini,
    relacionado: '',
    creado: new Date().toISOString(),
    subidoPor: autor.uid,
    subidoPorNombre: autor.nombre,
  };
  await guardarDoc(`${RUTA_ARCHIVOS}/${id}`, a, false);
}
