# Jeivi — guía para desarrollar

Proyecto **personal** de Pablo para su iglesia (Ministerio Jesucristo Imperio de Vida). No tiene relación con Ovnicom: nada de SharePoint ni numeración documental.
Repositorio en GitHub, deploy en Vercel, datos en Firebase. Commits con `62533815+paabatista@users.noreply.github.com` (ya configurado en este repo); nunca con el correo de la empresa.

## Arquitectura

- `src/core/modulos.ts` — **registro de módulos** (id, ícono, color, nivel mínimo, estado `activo`/`proximamente`). Es la fuente del lanzador tipo Odoo.
- `src/App.tsx` — `COMPONENTES` mapea id de módulo → componente. Un módulo sin componente muestra la pantalla "Próximamente".
- `src/lib/sesion.tsx` — Auth (Google, Microsoft, correo), perfil en `users/{uid}`, config de la iglesia en `iglesias/{id}`.
- `src/lib/roles.ts` — niveles: superadmin 100 > pastor 80 > ejecutivo 50 > miembro 20 > pendiente 10. Deben coincidir con `firestore.rules`.
  - **Miembro NO crea banners** (decisión de Pablo): solo lee y se suscribe (lectura diaria, cumpleaños, tablero informativo). Banners = ejecutivo en adelante.
- `src/lib/datos.ts` — `escucharDoc`, `escucharColeccion`, `guardarDoc`, `borrarDoc`. Sin `.env` usa localStorage (**modo demo**).
- Datos multi-iglesia desde ya: todo el contenido vive bajo `iglesias/{IGLESIA_ID}/…` y los usuarios llevan `iglesiaId`.
- `api/` — funciones de Vercel (ESM): importan con extensión `.js` (también los archivos de `src/` que comparten: `plan.ts`, `calendario.ts`, `fechas.ts`).

## Agregar un módulo

1. Añadirlo (o cambiar a `estado: 'activo'`) en `src/core/modulos.ts`.
2. Crear `src/modulos/<id>/` con su componente principal usando `<Layout modulo={…} pestanas={…}>`.
3. Registrarlo en `COMPONENTES` de `src/App.tsx`.
4. Datos en `iglesias/{ig}/<coleccion>` y reglas en `firestore.rules` usando `deMiIglesia(ig)` y `miNivel()`.
5. Si tiene formulario público (ej. cumpleaños): ruta pública fuera del login que solo escribe en una colección de "solicitudes" con reglas de solo-crear.

## Pendiente (siguientes módulos)

- **Cumpleaños:** calendario, banner con foto, link público solo con formulario (persona + hijos + foto) → base de datos restringida.
- **Finanzas:** categorías y campos libres (luz, alquiler, mantenimiento…), informes, exportar Excel.
- **Eventos, Anuncios / tablero informativo (los miembros se suscriben), Solicitudes.**

## Comandos

- `npm run dev` (puerto 5180) · `npm test` · `npm run build`
