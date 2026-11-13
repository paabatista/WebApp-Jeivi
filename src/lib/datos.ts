/**
 * Capa mínima de datos. Usa Firestore cuando Firebase está configurado;
 * si no (desarrollo local sin .env), usa localStorage en "modo demo" para poder probar la app.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db, firebaseConfigurado } from './firebase';
import { camposCambiados, describir, moduloDeRuta, rutaHistorial, sanear, type AccionHistorial, type Auditor } from './historial';

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

/** Escucha los N documentos más recientes de una colección, ordenados por un campo (desc). */
export function escucharRecientes<T = DocumentData>(
  ruta: string,
  campoOrden: string,
  limite: number,
  cb: (docs: (T & { id: string })[]) => void,
  alError?: (e: Error) => void,
): () => void {
  if (MODO_DEMO) {
    return escucharColeccion<T>(ruta, (docs) =>
      cb(
        [...docs]
          .sort((a, b) => String((b as DocumentData)[campoOrden]).localeCompare(String((a as DocumentData)[campoOrden])))
          .slice(0, limite),
      ),
    );
  }
  return onSnapshot(
    query(collection(db, ruta), orderBy(campoOrden, 'desc'), limit(limite)),
    (s) => cb(s.docs.map((d) => ({ ...(d.data() as T), id: d.id }))),
    (e) => (alError ? alError(e) : console.error(ruta, e)),
  );
}

/** Lee un documento una sola vez. */
export async function leerDoc<T = DocumentData>(ruta: string): Promise<T | null> {
  if (MODO_DEMO) return (leerDemo()[ruta] as T) ?? null;
  const s = await getDoc(doc(db, ruta));
  return s.exists() ? (s.data() as T) : null;
}

/* ---------- Historial automático ---------- */

let auditor: Auditor | null = null;

/** La sesión indica quién está trabajando; desde ese momento todo cambio queda en el historial. */
export function fijarAuditor(a: Auditor | null) {
  auditor = a;
}

function idAleatorio() {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => abc[b % abc.length]).join('');
}

function entradaHistorial(
  ruta: string,
  accion: AccionHistorial,
  antes: DocumentData | null,
  despues: DocumentData | null,
  resumen?: string,
): { ruta: string; data: DocumentData } | null {
  const modulo = moduloDeRuta(ruta);
  if (!auditor || !modulo) return null;
  return {
    ruta: `${rutaHistorial(auditor.iglesiaId)}/${idAleatorio()}`,
    data: {
      fecha: new Date().toISOString(),
      uid: auditor.uid,
      nombre: auditor.nombre,
      modulo,
      accion,
      ruta,
      resumen: (resumen ?? describir(despues ?? antes)) || ruta.split('/').slice(-2).join(' / '),
      antes: sanear(antes),
      despues: sanear(despues),
    },
  };
}

/** Registra en el historial un evento que no es un cambio de documento (banner generado, archivo subido…). */
export async function registrarEvento(modulo: string, accion: AccionHistorial, resumen: string, detalle: DocumentData = {}) {
  if (!auditor) return;
  const h = {
    fecha: new Date().toISOString(),
    uid: auditor.uid,
    nombre: auditor.nombre,
    modulo,
    accion,
    ruta: '',
    resumen,
    antes: null,
    despues: sanear(detalle),
  };
  const ruta = `${rutaHistorial(auditor.iglesiaId)}/${idAleatorio()}`;
  if (MODO_DEMO) {
    const todo = leerDemo();
    todo[ruta] = h;
    escribirDemo(todo);
    return;
  }
  await setDoc(doc(db, ruta), limpiar(h)).catch((e) => console.warn('historial', e));
}

async function antesDe(ruta: string): Promise<DocumentData | null> {
  try {
    return await leerDoc(ruta);
  } catch {
    return null;
  }
}

/** Guarda (fusionando por defecto) un documento. Si lo hace alguien del equipo, queda en el historial. */
export async function guardarDoc(ruta: string, data: DocumentData, fusionarCampos = true): Promise<void> {
  const auditable = !!auditor && !!moduloDeRuta(ruta);
  const antes = auditable ? await antesDe(ruta) : null;
  const despues = fusionarCampos ? fusionar(antes ?? undefined, data) : data;
  const sinCambios = auditable && antes && camposCambiados(sanear(antes), sanear(despues)).length === 0;
  const h = auditable && !sinCambios ? entradaHistorial(ruta, antes ? 'editar' : 'crear', antes, despues) : null;

  if (MODO_DEMO) {
    const todo = leerDemo();
    todo[ruta] = despues;
    if (h) todo[h.ruta] = h.data;
    escribirDemo(todo);
    return;
  }
  if (!h) {
    await setDoc(doc(db, ruta), limpiar(data), { merge: fusionarCampos });
    return;
  }
  const lote = writeBatch(db);
  lote.set(doc(db, ruta), limpiar(data), { merge: fusionarCampos });
  lote.set(doc(db, h.ruta), limpiar(h.data));
  await lote.commit();
}

/** Borra un documento; si lo hace alguien del equipo, el contenido borrado queda en el historial (se puede restaurar). */
export async function borrarDoc(ruta: string): Promise<void> {
  const auditable = !!auditor && !!moduloDeRuta(ruta);
  const antes = auditable ? await antesDe(ruta) : null;
  const h = auditable && antes ? entradaHistorial(ruta, 'borrar', antes, null) : null;
  if (MODO_DEMO) {
    const todo = leerDemo();
    delete todo[ruta];
    if (h) todo[h.ruta] = h.data;
    escribirDemo(todo);
    return;
  }
  if (!h) {
    await deleteDoc(doc(db, ruta));
    return;
  }
  const lote = writeBatch(db);
  lote.delete(doc(db, ruta));
  lote.set(doc(db, h.ruta), limpiar(h.data));
  await lote.commit();
}

export type OperacionLote = { tipo: 'guardar'; ruta: string; data: DocumentData } | { tipo: 'borrar'; ruta: string };

/** Escribe muchas operaciones de una vez (en bloques de 400, el límite de Firestore es 500). Deja una entrada resumen en el historial. */
export async function ejecutarLote(ops: OperacionLote[], alAvanzar?: (hechas: number) => void, resumen?: string): Promise<void> {
  const guardados = ops.filter((o) => o.tipo === 'guardar').length;
  const borrados = ops.length - guardados;
  const primera = ops.find((o) => moduloDeRuta(o.ruta));
  const h = primera
    ? entradaHistorial(primera.ruta, 'lote', null, { guardados, borrados, rutas: ops.slice(0, 60).map((o) => `${o.tipo}: ${o.ruta}`) }, resumen || `${guardados} guardados, ${borrados} borrados`)
    : null;
  if (MODO_DEMO) {
    const todo = leerDemo();
    for (const op of ops) {
      if (op.tipo === 'guardar') todo[op.ruta] = op.data;
      else delete todo[op.ruta];
    }
    if (h) todo[h.ruta] = h.data;
    escribirDemo(todo);
    alAvanzar?.(ops.length);
    return;
  }
  for (let i = 0; i < ops.length; i += 400) {
    const lote = writeBatch(db);
    for (const op of ops.slice(i, i + 400)) {
      if (op.tipo === 'guardar') lote.set(doc(db, op.ruta), limpiar(op.data));
      else lote.delete(doc(db, op.ruta));
    }
    await lote.commit();
    alAvanzar?.(Math.min(ops.length, i + 400));
  }
  if (h) await setDoc(doc(db, h.ruta), limpiar(h.data)).catch((e) => console.warn('historial', e));
}

/** Firestore no acepta `undefined`. */
function limpiar(d: DocumentData): DocumentData {
  return JSON.parse(JSON.stringify(d));
}
