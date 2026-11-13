# Jeivi — guía para desarrollar

Proyecto **personal** de Pablo para su iglesia (Ministerio Jesucristo Imperio de Vida). No tiene relación con Ovnicom: nada de SharePoint ni numeración documental.
Repositorio en GitHub, deploy en Vercel, datos en Firebase. Commits con `62533815+paabatista@users.noreply.github.com` (ya configurado en este repo); nunca con el correo de la empresa.

## Arquitectura

- `src/core/modulos.ts` — **registro de módulos** (id, ícono, color, nivel mínimo, estado `activo`/`proximamente`). Es la fuente del lanzador tipo Odoo.
- `src/App.tsx` — `COMPONENTES` mapea id de módulo → componente. Un módulo sin componente muestra la pantalla "Próximamente".
- `src/lib/sesion.tsx` — Auth (Google, Microsoft, correo), perfil en `users/{uid}`, config de la iglesia en `iglesias/{id}`.
- `src/lib/roles.ts` — niveles: superadmin 100 > pastor 80 > diacono 50 > pendiente 10. Deben coincidir con `firestore.rules`.
  - **No existe el rol "miembro"** (decisión de Pablo): solo el equipo tiene usuario. La congregación participa por **links públicos** que genera un diácono (`src/lib/enlaces.ts`, `src/core/GestorEnlaces.tsx`, ruta `/p/:token` en `src/publico/`). Las reglas solo les permiten *crear* en la colección del módulo si el link existe y está activo.
  - Finanzas: los diáconos aportan (luz, mantenimiento…). Cada uno ve solo su estado de cuenta (`finCargos`/`finPagos` filtrados por `diaconoUid`); el lanzador muestra "al día" o "debes X".
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

- Hechos: Lectura, Cumpleaños, Finanzas, Usuarios, Configuración.
- **Eventos, Anuncios / tablero informativo (link público para suscribirse), Solicitudes.**
- Fotos: con Cloudinary configurado se suben allí; si no, se guardan reducidas (~520 px) como data URL en el registro (`src/lib/fotos.ts`).

## Comandos

- `npm run dev` (puerto 5180) · `npm test` · `npm run build`
