import {
  BookOpen,
  Cake,
  CalendarDays,
  Inbox,
  Megaphone,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Rol } from '../lib/roles';

/**
 * Registro de módulos de Jeivi (como las "apps" de Odoo).
 * Para agregar un módulo nuevo: añadirlo aquí, crear su carpeta en src/modulos/<id>
 * y registrar su ruta en App.tsx. Los que están "proximamente" se muestran en el lanzador
 * con una etiqueta y una pantalla de vista previa.
 */
export interface Modulo {
  id: string;
  nombre: string;
  descripcion: string;
  icono: LucideIcon;
  /** Degradado del ícono [desde, hasta]. */
  color: [string, string];
  nivelMinimo: Rol;
  estado: 'activo' | 'proximamente';
  /** Qué hará el módulo (se muestra mientras está en desarrollo). */
  funciones?: string[];
}

export const MODULOS: Modulo[] = [
  {
    id: 'lectura',
    nombre: 'Lectura Bíblica',
    descripcion: 'Plan para leer la Biblia en 6 meses, con banner diario para WhatsApp.',
    icono: BookOpen,
    color: ['#7b4fa8', '#4a2c6d'],
    nivelMinimo: 'pendiente',
    estado: 'activo',
  },
  {
    id: 'cumpleanos',
    nombre: 'Cumpleaños',
    descripcion: 'Calendario de cumpleaños y banners automáticos con la foto del cumpleañero.',
    icono: Cake,
    color: ['#f472b6', '#db2777'],
    nivelMinimo: 'ejecutivo',
    estado: 'proximamente',
    funciones: [
      'Calendario mensual de cumpleaños de la congregación',
      'Banner automático con la foto del cumpleañero listo para WhatsApp',
      'Link público solo con el formulario de registro (fecha, hijos y foto)',
      'Base de datos de acceso restringido: el link no da acceso a nada más',
    ],
  },
  {
    id: 'finanzas',
    nombre: 'Finanzas',
    descripcion: 'Gastos de luz, alquiler, mantenimiento y más, con campos personalizados.',
    icono: Wallet,
    color: ['#34d399', '#047857'],
    nivelMinimo: 'pastor',
    estado: 'proximamente',
    funciones: [
      'Categorías y campos libres (luz, alquiler, mantenimiento…)',
      'Registro de ingresos y gastos con comprobantes',
      'Informes por mes y categoría',
      'Descarga a Excel',
    ],
  },
  {
    id: 'eventos',
    nombre: 'Eventos',
    descripcion: 'Organiza actividades, responsables, inscripciones y tareas.',
    icono: CalendarDays,
    color: ['#60a5fa', '#1d4ed8'],
    nivelMinimo: 'ejecutivo',
    estado: 'proximamente',
    funciones: ['Calendario de actividades', 'Responsables y tareas', 'Inscripciones con link público', 'Banner del evento'],
  },
  {
    id: 'anuncios',
    nombre: 'Anuncios',
    descripcion: 'Crea anuncios con imagen para compartir con los hermanos.',
    icono: Megaphone,
    color: ['#fbbf24', '#d97706'],
    nivelMinimo: 'ejecutivo',
    estado: 'proximamente',
    funciones: ['Plantillas de anuncio con imagen', 'Compartir por WhatsApp', 'Historial de anuncios'],
  },
  {
    id: 'solicitudes',
    nombre: 'Solicitudes',
    descripcion: 'Peticiones de oración, permisos y solicitudes con seguimiento.',
    icono: Inbox,
    color: ['#f87171', '#b91c1c'],
    nivelMinimo: 'ejecutivo',
    estado: 'proximamente',
    funciones: ['Formulario público de solicitudes', 'Estados y responsables', 'Notificaciones'],
  },
  {
    id: 'usuarios',
    nombre: 'Usuarios',
    descripcion: 'Aprueba cuentas y asigna niveles de acceso.',
    icono: Users,
    color: ['#a78bfa', '#6d28d9'],
    nivelMinimo: 'pastor',
    estado: 'activo',
  },
  {
    id: 'configuracion',
    nombre: 'Configuración',
    descripcion: 'Nombre, colores, logo y módulos activos de la app.',
    icono: Settings,
    color: ['#94a3b8', '#475569'],
    nivelMinimo: 'superadmin',
    estado: 'activo',
  },
];

export const moduloPorId = (id: string) => MODULOS.find((m) => m.id === id);
