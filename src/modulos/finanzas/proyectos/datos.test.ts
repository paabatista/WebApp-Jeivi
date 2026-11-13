import { describe, expect, it } from 'vitest';
import { totalesProyecto, type MovProyecto, type Proyecto } from './datos';
import type { Pago } from '../datos';

const p: Proyecto = { id: 'pc', nombre: 'PC directos', descripcion: '', categoria: 'Equipos y tecnología', presupuesto: 1500, estado: 'recaudando', conceptoId: 'c-pc', creado: '', creadoPor: '' };
const mov = (m: Partial<MovProyecto>): MovProyecto => ({ id: Math.random().toString(), proyectoId: 'pc', tipo: 'compra', descripcion: '', fecha: '2026-11-13', monto: 0, creado: '', registradoPor: '', ...m });

describe('totales de proyecto', () => {
  it('suma fondos (incluye aportes de diáconos) y compras', () => {
    const movs = [
      mov({ tipo: 'ingreso', monto: 500, origen: 'Ofrenda especial' }),
      mov({ tipo: 'compra', descripcion: 'Tarjeta de video', montoEstimado: 600, monto: 580, comprado: true }),
      mov({ tipo: 'compra', descripcion: 'Monitor', montoEstimado: 250 }),
      mov({ proyectoId: 'otro', tipo: 'ingreso', monto: 999 }),
    ];
    const pagos = [{ conceptoId: 'c-pc', monto: 300 }, { conceptoId: 'luz', monto: 50 }] as Pago[];
    const t = totalesProyecto(p, movs, pagos);
    expect(t.recaudado).toBe(800);
    expect(t.aportesDiaconos).toBe(300);
    expect(t.gastado).toBe(580);
    expect(t.porComprar).toBe(250);
    expect(t.disponible).toBe(220);
    expect(t.falta).toBe(700);
    expect(t.comprasHechas).toBe(1);
    expect(t.comprasTotal).toBe(2);
  });
});
