import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../../core/Layout';
import { moduloPorId } from '../../core/modulos';
import { escucharColeccion, guardarDoc } from '../../lib/datos';
import { IGLESIA_ID } from '../../lib/firebase';
import { useSesion, type Perfil } from '../../lib/sesion';
import { ETIQUETA_ROL, NIVEL, ROLES, rolesAsignables, type Rol } from '../../lib/roles';

const modulo = moduloPorId('usuarios')!;

const DESCRIPCION_ROL: Record<Rol, string> = {
  superadmin: 'Todo, incluida la configuración de la app.',
  pastor: 'Administra usuarios, ciclos, finanzas y contenidos. No cambia la configuración de la app.',
  ejecutivo: 'Diáconos y líderes: entran a los módulos, editan cosas básicas y generan banners y anuncios.',
  miembro: 'Ve la lectura y se suscribe (lectura diaria, cumpleaños, tablero informativo). No crea banners.',
  pendiente: 'Cuenta nueva sin aprobar: solo ve la lectura del día.',
};

export function Usuarios() {
  const { perfil } = useSesion();
  const [usuarios, setUsuarios] = useState<(Perfil & { id: string })[]>([]);
  const [filtro, setFiltro] = useState('');
  const [rolFiltro, setRolFiltro] = useState<Rol | ''>('');
  const [error, setError] = useState('');

  useEffect(() => escucharColeccion<Perfil>('users', setUsuarios, ['iglesiaId', IGLESIA_ID]), []);

  const asignables = rolesAsignables(perfil?.rol);
  const lista = useMemo(
    () =>
      usuarios
        .filter((u) => !rolFiltro || u.rol === rolFiltro)
        .filter((u) => `${u.nombre} ${u.email}`.toLowerCase().includes(filtro.toLowerCase()))
        .sort((a, b) => NIVEL[a.rol] - NIVEL[b.rol] || a.nombre.localeCompare(b.nombre)),
    [usuarios, filtro, rolFiltro],
  );
  const pendientes = usuarios.filter((u) => u.rol === 'pendiente').length;
  const suscritos = usuarios.filter((u) => u.suscritoCorreo).length;

  async function cambiarRol(u: Perfil, rol: Rol) {
    setError('');
    try {
      await guardarDoc(`users/${u.uid}`, { rol });
    } catch {
      setError('No tienes permiso para hacer ese cambio.');
    }
  }

  /** Solo se puede cambiar a alguien de nivel inferior al propio (el super admin puede con todos menos consigo mismo). */
  const editable = (u: Perfil) =>
    u.uid !== perfil?.uid && (perfil?.rol === 'superadmin' ? u.rol !== 'superadmin' : NIVEL[u.rol] < NIVEL[perfil?.rol || 'pendiente']);

  return (
    <Layout modulo={modulo}>
      <div className="pila">
        <section className="tarjeta">
          <div className="resumen">
            <div>
              <strong>{usuarios.length}</strong>
              <span>usuarios</span>
            </div>
            <div>
              <strong>{pendientes}</strong>
              <span>por aprobar</span>
            </div>
            <div>
              <strong>{suscritos}</strong>
              <span>reciben la lectura por correo</span>
            </div>
          </div>
          <details className="niveles">
            <summary>¿Qué puede hacer cada nivel?</summary>
            <ul>
              {ROLES.map((r) => (
                <li key={r}>
                  <strong>{ETIQUETA_ROL[r]}:</strong> {DESCRIPCION_ROL[r]}
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section className="tarjeta">
          <div className="fila">
            <label>
              Buscar
              <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nombre o correo" />
            </label>
            <label>
              Nivel
              <select value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value as Rol | '')}>
                <option value="">Todos</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_ROL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>WhatsApp</th>
                  <th>Correo diario</th>
                  <th>Nivel</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.uid} className={u.rol === 'pendiente' ? 'resaltar' : ''}>
                    <td>{u.nombre}</td>
                    <td>{u.email}</td>
                    <td>{u.whatsapp ? <a href={`https://wa.me/${u.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{u.whatsapp}</a> : '—'}</td>
                    <td>{u.suscritoCorreo ? 'Sí' : 'No'}</td>
                    <td>
                      {editable(u) ? (
                        <select value={u.rol} onChange={(e) => cambiarRol(u, e.target.value as Rol)}>
                          {[...new Set([u.rol, ...asignables])].map((r) => (
                            <option key={r} value={r}>
                              {ETIQUETA_ROL[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="chip">{ETIQUETA_ROL[u.rol]}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!lista.length && (
                  <tr>
                    <td colSpan={5} className="suave">
                      No hay usuarios que coincidan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
}
