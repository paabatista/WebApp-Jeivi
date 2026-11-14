import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Credenciales: en Vercel crea la variable FIREBASE_SERVICE_ACCOUNT con el JSON completo
 * de la cuenta de servicio (Firebase → Configuración del proyecto → Cuentas de servicio → Generar clave).
 * También se acepta el JSON codificado en base64.
 */
function credenciales() {
  const crudo = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!crudo) throw new Error('Falta la variable FIREBASE_SERVICE_ACCOUNT');
  const json = crudo.trim().startsWith('{') ? crudo : Buffer.from(crudo, 'base64').toString('utf8');
  return JSON.parse(json);
}

function iniciar() {
  if (!getApps().length) initializeApp({ credential: cert(credenciales()) });
}

export function adminDb() {
  iniciar();
  return getFirestore();
}

export function adminAuth() {
  iniciar();
  return getAuth();
}

const NIVEL: Record<string, number> = { superadmin: 100, pastor: 80, diacono: 50, lider: 30 };

/** Verifica el token del usuario y que tenga al menos el nivel pedido. Devuelve su perfil. */
export async function verificarUsuario(authorization: string | undefined, nivelMinimo: number) {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) throw Object.assign(new Error('No autorizado'), { status: 401 });
  const { uid } = await adminAuth().verifyIdToken(token);
  const perfil = (await adminDb().doc(`users/${uid}`).get()).data();
  if (!perfil || (NIVEL[perfil.rol] ?? 0) < nivelMinimo) throw Object.assign(new Error('No tienes permiso'), { status: 403 });
  return { uid, ...perfil } as { uid: string; rol: string; iglesiaId: string; nombre: string };
}
