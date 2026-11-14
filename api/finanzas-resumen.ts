import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { DocumentData } from 'firebase-admin/firestore';
import { adminDb, verificarUsuario } from './_lib/firebaseAdmin.js';
import { origenPermitido } from './_lib/origen.js';
import { totalesFinanzas, type CargoTotal, type GastoTotal, type PagoTotal } from '../src/modulos/finanzas/totales.js';

/**
 * POST /api/finanzas-resumen  { periodo: "2026-11" }
 * Resumen de Finanzas para cualquier diácono: solo totales de la iglesia, sin nombres.
 * (Las reglas no dejan que un diácono lea los cargos y aportes de los demás; por eso se calcula aquí.)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!origenPermitido(req)) return res.status(403).json({ error: 'Origen no permitido' });
  try {
    const usuario = await verificarUsuario(req.headers.authorization, 50);
    const periodo = String((req.body as { periodo?: string })?.periodo || '');
    if (!/^\d{4}-\d{2}$/.test(periodo)) return res.status(400).json({ error: 'Mes inválido' });

    const db = adminDb();
    const base = `iglesias/${usuario.iglesiaId}`;
    const [cargos, pagos, gastos] = await Promise.all(
      ['finCargos', 'finPagos', 'finGastos'].map((c) => db.collection(`${base}/${c}`).get()),
    );
    const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
    const texto = (v: unknown) => (typeof v === 'string' ? v : '');
    const mov = (d: DocumentData) => ({
      conceptoId: texto(d.conceptoId),
      conceptoNombre: texto(d.conceptoNombre) || 'Concepto',
      monto: num(d.monto),
      diaconoUid: texto(d.diaconoUid),
    });
    const t = totalesFinanzas(
      cargos.docs.map((s): CargoTotal => ({ ...mov(s.data()), periodo: texto(s.get('periodo')) })),
      pagos.docs.map((s): PagoTotal => ({ ...mov(s.data()), fecha: texto(s.get('fecha')) })),
      gastos.docs.map((s): GastoTotal => ({ periodo: texto(s.get('periodo')), conceptoNombre: texto(s.get('conceptoNombre')) || 'Concepto', monto: num(s.get('monto')) })),
      periodo,
    );
    return res.status(200).json(t);
  } catch (e) {
    const err = e as Error & { status?: number };
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'No se pudo calcular el resumen' });
  }
}
