/**
 * Subida de imágenes a Cloudinary (plan gratis) con un "upload preset" sin firma.
 * Se configura en Configuración → Imágenes (cloud name + upload preset).
 */
export async function reducirImagen(archivo: File, maxLado = 2000, calidad = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('Imagen no válida'));
      i.src = url;
    });
    const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo procesar'))), 'image/jpeg', calidad));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function subirACloudinary(archivo: File, cloudName: string, uploadPreset: string, carpeta = 'jeivi'): Promise<string> {
  const blob = await reducirImagen(archivo);
  const form = new FormData();
  form.append('file', blob, archivo.name.replace(/\.\w+$/, '.jpg'));
  form.append('upload_preset', uploadPreset);
  form.append('folder', carpeta);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: 'POST', body: form });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Error al subir a Cloudinary');
  return j.secure_url as string;
}
