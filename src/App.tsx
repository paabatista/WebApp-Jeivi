import { useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useSesion } from './lib/sesion';
import { tieneNivel } from './lib/roles';
import { Cargando } from './core/Cargando';
import { Login } from './core/Login';
import { PantallaSinInvitacion, PantallaVerificar } from './core/PantallasAcceso';
import { Lanzador } from './core/Lanzador';
import { Perfil } from './core/Perfil';
import { moduloPorId } from './core/modulos';
import { LecturaModulo } from './modulos/lectura/LecturaModulo';
import { CumpleanosModulo } from './modulos/cumpleanos/CumpleanosModulo';
import { FinanzasModulo } from './modulos/finanzas/FinanzasModulo';
import { AnunciosModulo } from './modulos/anuncios/AnunciosModulo';
import { EventosModulo } from './modulos/eventos/EventosModulo';
import { SolicitudesModulo } from './modulos/solicitudes/SolicitudesModulo';
import { Usuarios } from './modulos/admin/Usuarios';
import { HistorialModulo } from './modulos/historial/HistorialModulo';
import { Configuracion } from './modulos/admin/Configuracion';
import { Proximamente } from './modulos/proximamente/Proximamente';
import { PaginaPublica } from './publico/PaginaPublica';

/** Componente de cada módulo activo. Los módulos nuevos se registran aquí. */
const COMPONENTES: Partial<Record<string, () => JSX.Element>> = {
  lectura: LecturaModulo,
  cumpleanos: CumpleanosModulo,
  finanzas: FinanzasModulo,
  anuncios: AnunciosModulo,
  eventos: EventosModulo,
  solicitudes: SolicitudesModulo,
  usuarios: Usuarios,
  historial: HistorialModulo,
  configuracion: Configuracion,
};

function RutaModulo() {
  const { id = '' } = useParams();
  const { perfil, iglesia } = useSesion();
  const m = moduloPorId(id);
  if (!m || !(m.siempreVisible || iglesia.modulosActivos.includes(m.id)) || !tieneNivel(perfil?.rol, m.nivelMinimo)) return <Navigate to="/" replace />;
  const C = COMPONENTES[m.id];
  return C && m.estado === 'activo' ? <C /> : <Proximamente modulo={m} />;
}

function AppPrivada() {
  const { cargando, perfil, usuario, estadoAcceso } = useSesion();
  if (cargando) return <Cargando texto="Abriendo Jeivi…" />;
  if (usuario && !perfil && estadoAcceso === 'verificar') return <PantallaVerificar />;
  if (usuario && !perfil && estadoAcceso === 'sinInvitacion') return <PantallaSinInvitacion />;
  if (usuario && !perfil) return <Cargando texto="Revisando tu acceso…" />;
  if (!perfil) return <Login />;
  return (
    <Routes>
      <Route path="/" element={<Lanzador />} />
      <Route path="/perfil" element={<Perfil />} />
      <Route path="/m/:id/*" element={<RutaModulo />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { iglesia } = useSesion();

  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--primario', iglesia.colorPrimario);
    r.setProperty('--acento', iglesia.colorAcento);
    document.title = `Jeivi · ${iglesia.nombreCorto}`;
  }, [iglesia]);

  return (
    <Routes>
      {/* Links públicos: la congregación los abre sin cuenta. */}
      <Route path="/p/:token" element={<PaginaPublica />} />
      <Route path="*" element={<AppPrivada />} />
    </Routes>
  );
}
