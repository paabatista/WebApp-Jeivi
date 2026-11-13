import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, IGLESIA_ID } from './firebase';
import { MODO_DEMO, escucharDoc, guardarDoc } from './datos';
import { tieneNivel, type Rol } from './roles';

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
}

export const IGLESIA_POR_DEFECTO: Iglesia = {
  nombre: 'Ministerio Jesucristo Imperio de Vida',
  nombreCorto: 'Imperio de Vida',
  lema: 'Un lugar increíble para encontrarte con Dios',
  colorPrimario: '#4a2c6d',
  colorAcento: '#d4a73a',
  logoUrl: '',
  sitioWeb: 'https://www.ministeriojesucristoimperiodevida.com',
  modulosActivos: ['lectura', 'cumpleanos', 'finanzas', 'eventos', 'anuncios', 'solicitudes', 'usuarios', 'configuracion'],
};

interface Sesion {
  cargando: boolean;
  usuario: User | null;
  perfil: Perfil | null;
  iglesia: Iglesia;
  puede: (minimo: Rol) => boolean;
  entrarGoogle: () => Promise<void>;
  entrarMicrosoft: () => Promise<void>;
  entrarCorreo: (email: string, clave: string) => Promise<void>;
  registrarCorreo: (nombre: string, email: string, clave: string) => Promise<void>;
  recuperarClave: (email: string) => Promise<void>;
  salir: () => Promise<void>;
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

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(MODO_DEMO ? PERFIL_DEMO : null);
  const [cargandoAuth, setCargandoAuth] = useState(!MODO_DEMO);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [iglesia, setIglesia] = useState<Iglesia>(IGLESIA_POR_DEFECTO);

  // Configuración de la iglesia (marca, módulos activos).
  // Es de lectura pública (las reglas lo permiten) para mostrar la marca en la pantalla de login.
  useEffect(() => {
    return escucharDoc<Partial<Iglesia>>(
      `iglesias/${IGLESIA_ID}`,
      (d) => setIglesia({ ...IGLESIA_POR_DEFECTO, ...(d || {}) }),
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
    return onAuthStateChanged(auth, (u) => {
      setUsuario(u);
      setCargandoAuth(false);
      if (!u) setPerfil(null);
    });
  }, []);

  // Perfil del usuario: si no existe se crea con el rol por defecto.
  useEffect(() => {
    if (MODO_DEMO || !usuario) return;
    setCargandoPerfil(true);
    let creando = false;
    return escucharDoc<Perfil>(`users/${usuario.uid}`, async (d) => {
      if (d) {
        setPerfil(d);
        setCargandoPerfil(false);
        return;
      }
      if (creando) return;
      creando = true;
      const email = (usuario.email || '').toLowerCase();
      const nuevo: Perfil = {
        uid: usuario.uid,
        email,
        nombre: usuario.displayName || email.split('@')[0],
        foto: usuario.photoURL || undefined,
        iglesiaId: IGLESIA_ID,
        // Toda cuenta nueva espera aprobación de un pastor. El primer super admin se asigna a mano en Firebase (ver README).
        rol: 'pendiente',
        suscritoCorreo: false,
        creado: new Date().toISOString(),
      };
      await guardarDoc(`users/${usuario.uid}`, nuevo, false);
    });
  }, [usuario]);

  const valor = useMemo<Sesion>(
    () => ({
      cargando: cargandoAuth || cargandoPerfil,
      usuario,
      perfil,
      iglesia,
      puede: (minimo) => tieneNivel(perfil?.rol, minimo),
      entrarGoogle: async () => {
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      entrarMicrosoft: async () => {
        const p = new OAuthProvider('microsoft.com');
        p.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, p);
      },
      entrarCorreo: async (email, clave) => {
        await signInWithEmailAndPassword(auth, email, clave);
      },
      registrarCorreo: async (nombre, email, clave) => {
        const r = await createUserWithEmailAndPassword(auth, email, clave);
        await updateProfile(r.user, { displayName: nombre });
      },
      recuperarClave: async (email) => {
        await sendPasswordResetEmail(auth, email);
      },
      salir: async () => {
        if (!MODO_DEMO) await signOut(auth);
      },
      actualizarPerfil: async (cambios) => {
        if (!perfil) return;
        await guardarDoc(`users/${perfil.uid}`, cambios);
      },
    }),
    [cargandoAuth, cargandoPerfil, usuario, perfil, iglesia],
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
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/popup-closed-by-user': 'Se cerró la ventana antes de terminar.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana. Permite ventanas emergentes e intenta de nuevo.',
    'auth/account-exists-with-different-credential':
      'Ese correo ya está registrado con otro método (Google, Microsoft o contraseña). Usa el mismo con el que te registraste.',
    'auth/operation-not-allowed': 'Este método de acceso no está activado en Firebase.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
  };
  return mapa[code] || (e as Error)?.message || 'Ocurrió un error.';
}
