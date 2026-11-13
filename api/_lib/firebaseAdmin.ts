import { cert, getApps, initializeApp } from 'firebase-admin/app';
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

export function adminDb() {
  if (!getApps().length) initializeApp({ credential: cert(credenciales()) });
  return getFirestore();
}
