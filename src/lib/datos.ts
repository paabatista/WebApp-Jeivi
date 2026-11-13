/**
 * Capa mínima de datos. Usa Firestore cuando Firebase está configurado;
 * si no (desarrollo local sin .env), usa localStorage en "modo demo" para poder probar la app.
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db, firebaseConfigurado } from './firebase';

export const MODO_DEMO = !firebaseConfigurado;

type Oyente = () => void;
const oyentes = new Set<Oyente>();
const CLAVE = 'jeivi-demo-db';

function leerDemo(): Record<string, DocumentData> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || '{}');
  } catch {
    return {};
  }
}
function escribirDemo(data: Record<string, DocumentData>) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(data));
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos en memoria */
  }
  oyentes.forEach((f) => f());
}

function fusionar(base: DocumentData | undefined, cambios: DocumentData): DocumentData {
  const out: DocumentData = { ...(base || {}) };
  for (const [k, v] of Object.entries(cambios)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = fusionar(out[k], v);
    } else if (v === undefined) {
      delete out[k];
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Escucha un documento. Devuelve la función para dejar de escuchar. */
export function escucharDoc<T = DocumentData>(ruta: string, cb: (d: T | null) => void, alError?: (e: Error) => void): () => void {
  if (MODO_DEMO) {
    const emitir = () => cb((leerDemo()[ruta] as T) ?? null);
    emitir();
    oyentes.add(emitir);
    return () => oyentes.delete(emitir);
  }
  return onSnapshot(
    doc(db, ruta),
    (s) => cb(s.exists() ? (s.data() as T) : null),
    (e) => (alError ? alError(e) : console.error(ruta, e)),
  );
}

/** Escucha todos los documentos de una colección (con su id). */
export function escucharColeccion<T = DocumentData>(
  ruta: string,
  cb: (docs: (T & { id: string })[]) => void,
  filtro?: [campo: string, valor: string | number | boolean],
): () => void {
  if (MODO_DEMO) {
    const emitir = () => {
      const pref = ruta + '/';
      const datos = leerDemo();
      cb(
        Object.entries(datos)
          .filter(([k]) => k.startsWith(pref) && !k.slice(pref.length).includes('/'))
          .filter(([, v]) => !filtro || (v as DocumentData)[filtro[0]] === filtro[1])
          .map(([k, v]) => ({ ...(v as T), id: k.slice(pref.length) })),
      );
    };
    emitir();
    oyentes.add(emitir);
    return () => oyentes.delete(emitir);
  }
  const ref = filtro ? query(collection(db, ruta), where(filtro[0], '==', filtro[1])) : collection(db, ruta);
  return onSnapshot(
    ref,
    (s) => cb(s.docs.map((d) => ({ ...(d.data() as T), id: d.id }))),
    (e) => console.error(ruta, e),
  );
}

/** Guarda (fusionando por defecto) un documento. */
export async function guardarDoc(ruta: string, data: DocumentData, fusionarCampos = true): Promise<void> {
  if (MODO_DEMO) {
    const todo = leerDemo();
    todo[ruta] = fusionarCampos ? fusionar(todo[ruta], data) : data;
    escribirDemo(todo);
    return;
  }
  await setDoc(doc(db, ruta), limpiar(data), { merge: fusionarCampos });
}

export async function borrarDoc(ruta: string): Promise<void> {
  if (MODO_DEMO) {
    const todo = leerDemo();
    delete todo[ruta];
    escribirDemo(todo);
    return;
  }
  await deleteDoc(doc(db, ruta));
}

/** Firestore no acepta `undefined`. */
function limpiar(d: DocumentData): DocumentData {
  return JSON.parse(JSON.stringify(d));
}
