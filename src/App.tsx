import { useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useSesion } from './lib/sesion';
import { tieneNivel } from './lib/roles';
import { Cargando } from './core/Cargando';
import { Login } from './core/Login';
import { Lanzador } from './core/Lanzador';
import { Perfil } from './core/Perfil';
import { moduloPorId } from './core/modulos';
import { LecturaModulo } from './modulos/lectura/LecturaModulo';
import { Usuarios } from './modulos/admin/Usuarios';
import { Configuracion } from './modulos/admin/Configuracion';
import { Proximamente } from './modulos/proximamente/Proximamente';

/** Componente de cada módulo activo. Los módulos nuevos se registran aquí. */
const COMPONENTES: Partial<Record<string, () => JSX.Element>> = {
  lectura: LecturaModulo,
  usuarios: Usuarios,
  configuracion: Configuracion,
};

function RutaModulo() {
  const { id = '' } = useParams();
  const { perfil, iglesia } = useSesion();
  const m = moduloPorId(id);
  if (!m || !iglesia.modulosActivos.includes(m.id) || !tieneNivel(perfil?.rol, m.nivelMinimo)) return <Navigate to="/" replace />;
  const C = COMPONENTES[m.id];
  return C && m.estado === 'activo' ? <C /> : <Proximamente modulo={m} />;
}

export default function App() {
  const { cargando, perfil, iglesia } = useSesion();

  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--primario', iglesia.colorPrimario);
    r.setProperty('--acento', iglesia.colorAcento);
    document.title = `Jeivi · ${iglesia.nombreCorto}`;
  }, [iglesia]);

  if (cargando) return <Cargando texto="Abriendo Jeivi…" />;
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
