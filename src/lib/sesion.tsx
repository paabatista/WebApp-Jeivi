import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, IGLESIA_ID } from './firebase';
import { MODO_DEMO, escucharDoc, fijarAuditor, guardarDoc, leerDoc } from './datos';
import { tieneNivel, type Rol } from './roles';
import { RUTA_INVITACIONES, normalizarCorreo, type Invitacion } from './invitaciones';

export interface Perfil {
  uid: string;
  email: string;
  nombre: string;
  foto?: string;
  iglesiaId: string;
  rol: Rol;
  whatsapp?: string;
  /** Recibir la lectura diaria por correo. */
  suscritoCorreo?: boolean;
  creado: string;
}

export interface Iglesia {
  nombre: string;
  nombreCorto: string;
  lema?: string;
  colorPrimario: string;
  colorAcento: string;
  logoUrl?: string;
  sitioWeb?: string;
  /** Módulos visibles en el lanzador. */
  modulosActivos: string[];
  cloudinary?: { cloudName: string; uploadPreset: string };
  /** Horas sin actividad tras las que se cierra la sesión (1 o 2). */
  inactividadHoras?: 1 | 2;
}

export const IGLESIA_POR_DEFECTO: Iglesia = {
  nombre: 'Ministerio Jesucristo Imperio de Vida',
  nombreCorto: 'Imperio de Vida',
  lema: 'Un lugar increíble para encontrarte con Dios',
  colorPrimario: '#4a2c6d',
  colorAcento: '#d4a73a',
  logoUrl: '/marca/logo.png',
  sitioWeb: 'https://www.ministeriojesucristoimperiodevida.com',
  modulosActivos: ['lectura', 'cumpleanos', 'finanzas', 'eventos', 'anuncios', 'solicitudes', 'usuarios', 'configuracion'],
};

/**
 * Estado del acceso de quien inició sesión:
 *  - ok:            tiene perfil (o se acaba de crear desde su invitación)
 *  - verificar:     se registró con correo y contraseña y aún no confirma su correo
 *  - sinInvitacion: su correo no fue invitado por un pastor
 */
export type EstadoAcceso = 'ok' | 'verificar' | 'sinInvitacion' | null;

/** Tiempo sin actividad tras el cual se cierra la sesión: 1 o 2 horas (se elige en Configuración). */
const HORA_MS = 60 * 60 * 1000;
/** Se avisa 5 minutos antes de cerrar. */
export const AVISO_ANTES_MS = 5 * 60 * 1000;
const CLAVE_ACTIVIDAD = 'jeivi-ultima-actividad';
const CLAVE_LIMITE = 'jeivi-limite-inactividad';

/** Último límite conocido (se guarda para aplicarlo aunque la configuración aún no haya cargado). */
let limiteInactividad = (() => {
  try {
    const v = Number(localStorage.getItem(CLAVE_LIMITE));
    return v === 2 * HORA_MS ? v : HORA_MS;
  } catch {
    return HORA_MS;
  }
})();

function marcarActividad() {
  try {
    localStorage.setItem(CLAVE_ACTIVIDAD, String(Date.now()));
  } catch {
    /* almacenamiento bloqueado: el cierre por inactividad no aplica entre pestañas */
  }
}
function ultimaActividad(): number | null {
  try {
    const v = Number(localStorage.getItem(CLAVE_ACTIVIDAD));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

interface Sesion {
  cargando: boolean;
  usuario: User | null;
  perfil: Perfil | null;
  iglesia: Iglesia;
  estadoAcceso: EstadoAcceso;
  /** Mensaje para la pantalla de login (ej. "se cerró por inactividad"). */
  aviso: string;
  /** Milisegundos que faltan para cerrar la sesión por inactividad (solo en los últimos 5 minutos). */
  porCerrar: number | null;
  seguirConectado: () => void;
  puede: (minimo: Rol) => boolean;
  entrarGoogle: () => Promise<void>;
  entrarCorreo: (email: string, clave: string) => Promise<void>;
  registrarCorreo: (nombre: string, email: string, clave: string) => Promise<void>;
  recuperarClave: (email: string) => Promise<void>;
  reenviarVerificacion: () => Promise<void>;
  comprobarVerificacion: () => Promise<boolean>;
  salir: (aviso?: string) => Promise<void>;
  actualizarPerfil: (cambios: Partial<Perfil>) => Promise<void>;
}

const Ctx = createContext<Sesion | null>(null);

const PERFIL_DEMO: Perfil = {
  uid: 'demo',
  email: 'demo@jeivi.app',
  nombre: 'Usuario demo',
  iglesiaId: IGLESIA_ID,
  rol: 'superadmin',
  creado: new Date().toISOString(),
};

/** Las cuentas con correo y contraseña deben confirmar su correo; Google ya viene verificado. */
const necesitaVerificar = (u: User) => !u.emailVerified && u.providerData.some((p) => p.providerId === 'password');

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(MODO_DEMO ? PERFIL_DEMO : null);
  const [cargandoAuth, setCargandoAuth] = useState(!MODO_DEMO);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [estadoAcceso, setEstadoAcceso] = useState<EstadoAcceso>(MODO_DEMO ? 'ok' : null);
  const [aviso, setAviso] = useState('');
  const [porCerrar, setPorCerrar] = useState<number | null>(null);
  const [iglesia, setIglesia] = useState<Iglesia>(IGLESIA_POR_DEFECTO);
  const [verificacion, setVerificacion] = useState(0);

  // Todo lo que haga alguien del equipo queda en el historial con su nombre.
  useEffect(() => {
    fijarAuditor(perfil && perfil.rol !== 'pendiente' ? { uid: perfil.uid, nombre: perfil.nombre, iglesiaId: perfil.iglesiaId } : null);
  }, [perfil?.uid, perfil?.nombre, perfil?.rol, perfil?.iglesiaId]);

  // Configuración de la iglesia (marca, módulos activos). Lectura pública para la pantalla de login.
  useEffect(() => {
    return escucharDoc<Partial<Iglesia>>(
      `iglesias/${IGLESIA_ID}`,
      (d) => setIglesia({ ...IGLESIA_POR_DEFECTO, ...(d || {}), logoUrl: d?.logoUrl || IGLESIA_POR_DEFECTO.logoUrl }),
      () => setIglesia(IGLESIA_POR_DEFECTO),
    );
  }, []);

  useEffect(() => {
    if (MODO_DEMO) {
      return escucharDoc<Perfil>('users/demo', (d) => {
        if (!d?.iglesiaId) void guardarDoc('users/demo', { ...PERFIL_DEMO, ...(d || {}), iglesiaId: IGLESIA_ID });
        setPerfil({ ...PERFIL_DEMO, ...(d || {}) });
      });
    }
    return onAuthStateChanged(auth, async (u) => {
      // Al volver después de más de 1 hora sin actividad (o al día siguiente) se pide entrar de nuevo.
      const ultima = ultimaActividad();
      if (u && ultima && Date.now() - ultima > limiteInactividad) {
        setAviso('Tu sesión se cerró por inactividad. Vuelve a entrar.');
        await signOut(auth);
        return;
      }
      if (u) marcarActividad();
      setUsuario(u);
      setCargandoAuth(false);
      if (!u) {
        setPerfil(null);
        setEstadoAcceso(null);
      }
    });
  }, []);

  // Tiempo de cierre elegido en Configuración (1 o 2 horas).
  useEffect(() => {
    limiteInactividad = (iglesia.inactividadHoras === 2 ? 2 : 1) * HORA_MS;
    try {
      localStorage.setItem(CLAVE_LIMITE, String(limiteInactividad));
    } catch {
      /* sin almacenamiento: se usa el valor en memoria */
    }
  }, [iglesia.inactividadHoras]);

  // Cierre por inactividad mientras la app está abierta (con aviso 5 minutos antes).
  useEffect(() => {
    if (MODO_DEMO || !usuario) return;
    let ultimoGuardado = 0;
    let avisando = false;
    const actividad = () => {
      const ahora = Date.now();
      if (avisando || ahora - ultimoGuardado > 30_000) {
        ultimoGuardado = ahora;
        marcarActividad();
        if (avisando) {
          avisando = false;
          setPorCerrar(null);
        }
      }
    };
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const;
    eventos.forEach((e) => window.addEventListener(e, actividad, { passive: true }));
    const revisar = () => {
      const ultima = ultimaActividad();
      if (!ultima) return;
      const resta = limiteInactividad - (Date.now() - ultima);
      if (resta <= 0) {
        setPorCerrar(null);
        setAviso(`Tu sesión se cerró tras ${limiteInactividad / HORA_MS === 2 ? '2 horas' : '1 hora'} sin actividad. Vuelve a entrar.`);
        void signOut(auth);
      } else if (resta <= AVISO_ANTES_MS) {
        avisando = true;
        setPorCerrar(resta);
      } else if (avisando) {
        avisando = false;
        setPorCerrar(null);
      }
    };
    const intervalo = window.setInterval(revisar, 15_000);
    document.addEventListener('visibilitychange', revisar);
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, actividad));
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', revisar);
    };
  }, [usuario]);

  // Perfil: si no existe, solo se crea si el correo fue invitado (y está verificado).
  useEffect(() => {
    if (MODO_DEMO || !usuario) return;
    setCargandoPerfil(true);
    let creando = false;
    return escucharDoc<Perfil>(
      `users/${usuario.uid}`,
      async (d) => {
        if (d) {
          setPerfil(d);
          setEstadoAcceso('ok');
          setCargandoPerfil(false);
          return;
        }
        setPerfil(null);
        if (necesitaVerificar(usuario)) {
          setEstadoAcceso('verificar');
          setCargandoPerfil(false);
          return;
        }
        if (creando) return;
        creando = true;
        const email = normalizarCorreo(usuario.email || '');
        try {
          const inv = email ? await leerDoc<Invitacion>(`${RUTA_INVITACIONES}/${email}`) : null;
          if (!inv) {
            setEstadoAcceso('sinInvitacion');
            setCargandoPerfil(false);
            return;
          }
          const nuevo: Perfil = {
            uid: usuario.uid,
            email,
            nombre: inv.nombre || usuario.displayName || email.split('@')[0],
            foto: usuario.photoURL || undefined,
            iglesiaId: inv.iglesiaId,
            rol: inv.rol,
            suscritoCorreo: false,
            creado: new Date().toISOString(),
          };
          await guardarDoc(`users/${usuario.uid}`, nuevo, false);
        } catch {
          setEstadoAcceso('sinInvitacion');
          setCargandoPerfil(false);
        } finally {
          creando = false;
        }
      },
      () => {
        setEstadoAcceso('sinInvitacion');
        setCargandoPerfil(false);
      },
    );
  }, [usuario, verificacion]);

  const valor = useMemo<Sesion>(
    () => ({
      cargando: cargandoAuth || cargandoPerfil,
      usuario,
      perfil,
      iglesia,
      estadoAcceso,
      aviso,
      porCerrar,
      seguirConectado: () => {
        marcarActividad();
        setPorCerrar(null);
      },
      puede: (minimo) => tieneNivel(perfil?.rol, minimo),
      entrarGoogle: async () => {
        setAviso('');
        marcarActividad();
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      entrarCorreo: async (email, clave) => {
        setAviso('');
        marcarActividad();
        await signInWithEmailAndPassword(auth, email, clave);
      },
      registrarCorreo: async (nombre, email, clave) => {
        setAviso('');
        marcarActividad();
        const r = await createUserWithEmailAndPassword(auth, email, clave);
        await updateProfile(r.user, { displayName: nombre });
        await sendEmailVerification(r.user);
      },
      recuperarClave: async (email) => {
        await sendPasswordResetEmail(auth, email);
      },
      reenviarVerificacion: async () => {
        if (auth.currentUser) await sendEmailVerification(auth.currentUser);
      },
      comprobarVerificacion: async () => {
        const u = auth.currentUser;
        if (!u) return false;
        await u.reload();
        if (!u.emailVerified) return false;
        await u.getIdToken(true); // para que las reglas vean el correo verificado
        setVerificacion((n) => n + 1);
        return true;
      },
      salir: async (mensaje) => {
        setAviso(mensaje || '');
        if (!MODO_DEMO) await signOut(auth);
      },
      actualizarPerfil: async (cambios) => {
        if (!perfil) return;
        await guardarDoc(`users/${perfil.uid}`, cambios);
      },
    }),
    [cargandoAuth, cargandoPerfil, usuario, perfil, iglesia, estadoAcceso, aviso, porCerrar],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSesion(): Sesion {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSesion fuera de SesionProvider');
  return s;
}

export function mensajeErrorAuth(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  const mapa: Record<string, string> = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
    'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/popup-closed-by-user': 'Se cerró la ventana antes de terminar.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana. Permite ventanas emergentes e intenta de nuevo.',
    'auth/account-exists-with-different-credential':
      'Ese correo ya está registrado con otro método (Google o contraseña). Usa el mismo con el que te registraste.',
    'auth/operation-not-allowed': 'Este método de acceso no está activado en Firebase.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
  };
  return mapa[code] || (e as Error)?.message || 'Ocurrió un error.';
}
