/** Traduce errores de Firebase a mensajes que digan qué hacer. */
export function explicarError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  const msg = (e as Error)?.message || '';
  if (code === 'permission-denied' || /insufficient permissions/i.test(msg)) {
    return 'Firebase no permitió guardar. Revisa que estén publicadas las reglas nuevas: Firebase → Firestore Database → Reglas → pega firestore.rules → Publicar.';
  }
  if (code === 'storage/unauthorized') {
    return 'Storage no permitió subir el archivo. Publica storage.rules en Firebase → Storage → Reglas y acepta que Storage lea Firestore.';
  }
  if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found' || code === 'storage/unknown') {
    return 'Storage aún no está listo: créalo en Firebase → Storage → Comenzar (ver STORAGE.md).';
  }
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/canceled') {
    return 'La subida no terminó. Revisa tu conexión e intenta de nuevo.';
  }
  if (code === 'unavailable') return 'Sin conexión con Firebase. Revisa tu internet e intenta de nuevo.';
  return msg || 'Ocurrió un error.';
}
