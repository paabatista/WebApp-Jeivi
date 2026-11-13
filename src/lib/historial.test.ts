import { describe, expect, it } from 'vitest';
import { camposCambiados, describir, moduloDeRuta, sanear } from './historial';

describe('historial', () => {
  it('ubica el módulo de cada ruta', () => {
    expect(moduloDeRuta('iglesias/x/finPagos/abc')).toBe('finanzas');
    expect(moduloDeRuta('iglesias/x/cumpleanos/abc')).toBe('cumpleanos');
    expect(moduloDeRuta('iglesias/x')).toBe('configuracion');
    expect(moduloDeRuta('users/u1')).toBe('usuarios');
    expect(moduloDeRuta('users/u1/progresoLectura/c1')).toBeNull();
    expect(moduloDeRuta('iglesias/x/historial/h1')).toBeNull();
  });
  it('no guarda imágenes incrustadas', () => {
    expect(sanear({ foto: 'data:image/jpeg;base64,AAAA', nombre: 'Ana' })).toEqual({ foto: '[imagen]', nombre: 'Ana' });
  });
  it('describe y compara', () => {
    expect(describir({ conceptoNombre: 'Luz', diaconoNombre: 'Carlos', monto: 25 })).toBe('Luz · Carlos · $25.00');
    expect(camposCambiados({ monto: 20, nota: 'a' }, { monto: 25, nota: 'a' })).toEqual([{ campo: 'monto', antes: 20, despues: 25 }]);
  });
});
