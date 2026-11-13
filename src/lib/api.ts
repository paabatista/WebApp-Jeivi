import { auth } from './firebase';
import { MODO_DEMO } from './datos';

/** Llama a una función de /api con el token del usuario (el servidor verifica su nivel). */
export async function llamarApi<T = unknown>(ruta: string, cuerpo: unknown): Promise<T> {
  if (MODO_DEMO) throw new Error('En modo demo no se envían correos. Publica la app con Firebase para usar esta función.');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar.');
  const r = await fetch(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || `Error ${r.status}`);
  return j as T;
}
