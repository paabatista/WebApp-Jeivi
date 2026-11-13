import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Copy, MailPlus, MessageCircle, Trash2 } from 'lucide-react';
import { Layout } from '../../core/Layout';
import { moduloPorId } from '../../core/modulos';
import { borrarDoc, escucharColeccion, guardarDoc } from '../../lib/datos';
import { IGLESIA_ID } from '../../lib/firebase';
import { formatoCorto } from '../../lib/fechas';
import { RUTA_INVITACIONES, correoValido, normalizarCorreo, type Invitacion } from '../../lib/invitaciones';
import { useSesion, type Perfil } from '../../lib/sesion';
import { ETIQUETA_ROL, NIVEL, ROLES, rolesAsignables, type Rol } from '../../lib/roles';

const modulo = moduloPorId('usuarios')!;

const DESCRIPCION_ROL: Record<Rol, string> = {
  superadmin: 'Todo, incluida la configuración de la app. Solo se asigna desde la consola de Firebase y no se puede quitar ni borrar desde Jeivi.',
  pastor: 'Administra usuarios, invitaciones, finanzas y contenidos. No cambia la configuración de la app.',
  diacono: 'Entra a los módulos, edita cosas básicas, genera banners y links de registro, y ve su estado de cuenta.',
  pendiente: 'Sin acceso: no ve nada. Sirve para bloquear a alguien sin borrarlo.',
};

function Invitaciones({ usuarios }: { usuarios: Perfil[] }) {
  const { perfil, iglesia } = useSesion();
  const [lista, setLista] = useState<(Invitacion & { id: string })[]>([]);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Invitacion['rol']>('diacono');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const opciones = rolesAsignables(perfil?.rol).filter((r): r is Invitacion['rol'] => r === 'pastor' || r === 'diacono');

  useEffect(
    () => escucharColeccion<Invitacion>(RUTA_INVITACIONES, (d) => setLista([...d].sort((a, b) => b.creado.localeCompare(a.creado))), ['iglesiaId', IGLESIA_ID]),
    [],
  );

  const correos = new Set(usuarios.map((u) => normalizarCorreo(u.email)));
  const pendientes = lista.filter((i) => !correos.has(i.id));
  const url = window.location.origin;
  const mensaje = (i: Invitacion) =>
    `Hola ${i.nombre.split(' ')[0]}, Dios te bendiga. Te invitamos a Jeivi, la plataforma de ${iglesia.nombre}, como ${ETIQUETA_ROL[i.rol].toLowerCase()}.\n\n` +
    `1. Entra a ${url}\n2. Usa "Continuar con Google" con el correo ${i.email} (o "Tengo invitación: crear cuenta" con ese mismo correo).\n\n¡Bienvenido!`;

  async function invitar(e: FormEvent) {
    e.preventDefault();
    setError('');
    const correo = normalizarCorreo(email);
    if (!correoValido(correo)) return setError('Escribe un correo válido.');
    if (correos.has(correo)) return setError('Ese correo ya tiene cuenta. Cambia su nivel en la lista de abajo.');
    if (!perfil) return;
    const inv: Invitacion = {
      email: correo,
      nombre: nombre.trim() || correo.split('@')[0],
      rol,
      iglesiaId: IGLESIA_ID,
      invitadoPor: perfil.uid,
      invitadoPorNombre: perfil.nombre,
      creado: new Date().toISOString(),
    };
    try {
      await guardarDoc(`${RUTA_INVITACIONES}/${correo}`, inv, false);
      setMsg(`Invitación creada para ${correo}. Envíale el mensaje por WhatsApp o cópialo.`);
      setEmail('');
      setNombre('');
      setTimeout(() => setMsg(''), 5000);
    } catch {
      setError('No tienes permiso para invitar con ese nivel.');
    }
  }

  return (
    <section className="tarjeta">
      <h2 className="con-icono">
        <MailPlus size={20} /> Invitar al equipo
      </h2>
      <p className="suave">
        Jeivi es solo por invitación: únicamente pueden entrar los correos que invites aquí, con el nivel que elijas. La
        congregación no necesita cuenta (usa los links de cada módulo).
      </p>
      <form className="fila" onSubmit={invitar}>
        <label>
          Correo (el de Google o el que usará)
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="nombre@gmail.com" />
        </label>
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
        </label>
        <label>
          Nivel
          <select value={rol} onChange={(e) => setRol(e.target.value as Invitacion['rol'])}>
            {opciones.map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_ROL[r]}
              </option>
            ))}
          </select>
        </label>
        <button className="boton primario">Invitar</button>
      </form>
      {msg && <div className="exito">{msg}</div>}
      {error && <div className="error">{error}</div>}

      {pendientes.length > 0 && (
        <>
          <h3>Invitaciones sin usar</h3>
          <ul className="lista-enlaces">
            {pendientes.map((i) => (
              <li key={i.id}>
                <div className="enlace-info">
                  <strong>
                    {i.nombre} · {ETIQUETA_ROL[i.rol]}
                  </strong>
                  <small className="suave">
                    {i.email} · invitado por {i.invitadoPorNombre} el {formatoCorto(i.creado.slice(0, 10))}
                  </small>
                </div>
                <div className="acciones">
                  <a className="boton whatsapp pequeno" href={`https://wa.me/?text=${encodeURIComponent(mensaje(i))}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={14} /> Enviar
                  </a>
                  <button className="boton pequeno" onClick={() => navigator.clipboard?.writeText(mensaje(i))}>
                    <Copy size={14} /> Copiar
                  </button>
                  <button
                    className="icono-boton peligro"
                    title="Cancelar invitación"
                    onClick={() => confirm(`¿Cancelar la invitación de ${i.email}?`) && borrarDoc(`${RUTA_INVITACIONES}/${i.id}`)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

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
        .sort((a, b) => (NIVEL[b.rol] ?? 0) - (NIVEL[a.rol] ?? 0) || a.nombre.localeCompare(b.nombre)),
    [usuarios, filtro, rolFiltro],
  );
  const suscritos = usuarios.filter((u) => u.suscritoCorreo).length;

  async function cambiarRol(u: Perfil, rol: Rol) {
    setError('');
    try {
      await guardarDoc(`users/${u.uid}`, { rol });
    } catch {
      setError('No tienes permiso para hacer ese cambio.');
    }
  }

  async function eliminar(u: Perfil) {
    if (!confirm(`¿Eliminar a ${u.nombre} (${u.email})?\n\nPerderá el acceso a Jeivi. Sus registros de finanzas se conservan.`)) return;
    setError('');
    try {
      await borrarDoc(`users/${u.uid}`);
      await borrarDoc(`${RUTA_INVITACIONES}/${normalizarCorreo(u.email)}`).catch(() => undefined);
    } catch {
      setError('No se pudo eliminar.');
    }
  }

  /** Solo se cambia a alguien de nivel inferior al propio; nunca al super admin ni a uno mismo. */
  const editable = (u: Perfil) => u.uid !== perfil?.uid && u.rol !== 'superadmin' && (NIVEL[u.rol] ?? 0) < (NIVEL[perfil?.rol || 'pendiente'] ?? 0);
  const borrable = (u: Perfil) => perfil?.rol === 'superadmin' && u.uid !== perfil.uid && u.rol !== 'superadmin';

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
              <strong>{usuarios.filter((u) => u.rol === 'diacono').length}</strong>
              <span>diáconos</span>
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

        <Invitaciones usuarios={usuarios} />

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
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.uid} className={u.rol === 'pendiente' ? 'apagado' : ''}>
                    <td>
                      {u.nombre}
                      {u.uid === perfil?.uid && <span className="chip mini">tú</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      {u.whatsapp ? (
                        <a href={`https://wa.me/${u.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                          {u.whatsapp}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
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
                        <span className="chip">{ETIQUETA_ROL[u.rol] ?? u.rol}</span>
                      )}
                    </td>
                    <td>
                      {borrable(u) && (
                        <button className="icono-boton peligro" title="Eliminar usuario" onClick={() => eliminar(u)}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!lista.length && (
                  <tr>
                    <td colSpan={6} className="suave">
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
