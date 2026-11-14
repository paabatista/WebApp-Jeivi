# Jeivi — guía para desarrollar

Proyecto **personal** de Pablo para su iglesia (Ministerio Jesucristo Imperio de Vida). No tiene relación con Ovnicom: nada de SharePoint ni numeración documental.
Repositorio en GitHub, deploy en Vercel, datos en Firebase. Commits con `62533815+paabatista@users.noreply.github.com` (ya configurado en este repo); nunca con el correo de la empresa.

## Arquitectura

- `src/core/modulos.ts` — **registro de módulos** (id, ícono, color, nivel mínimo, estado `activo`/`proximamente`). Es la fuente del lanzador tipo Odoo.
- `src/App.tsx` — `COMPONENTES` mapea id de módulo → componente. Un módulo sin componente muestra la pantalla "Próximamente".
- `src/lib/sesion.tsx` — Auth (Google, Microsoft, correo), perfil en `users/{uid}`, config de la iglesia en `iglesias/{id}`.
- `src/lib/roles.ts` — niveles: superadmin 100 > pastor 80 > diacono 50 > lider 30 > pendiente 10. Líder: solo lectura, cumpleanos, anuncios y solicitudes (nada de finanzas/eventos; Storage también le niega `finanzas/`). Deben coincidir con `firestore.rules`.
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

- Acceso solo por invitación (`invitaciones/{correo}` → rol + iglesia), correo verificado, cierre por inactividad 1 h (`src/lib/sesion.tsx`). Detalle en SEGURIDAD.md.
- Finanzas importa Excel (`src/modulos/finanzas/importar/`): ids `imp-<hash>` o columna "ID Jeivi" para no duplicar; personas sin cuenta = `ext:<slug>`, se vinculan en Resumen.
- Historial automático en `src/lib/datos.ts` (guardarDoc/borrarDoc/ejecutarLote escriben en `iglesias/{ig}/historial`, append-only). Archivos en `src/lib/almacen.ts` (Storage si `VITE_STORAGE_ACTIVO=1`, registro en `iglesias/{ig}/archivos`). Ver STORAGE.md.
- Hechos: Lectura, Cumpleaños, Finanzas, Eventos, Anuncios, Solicitudes, Usuarios, Configuración.
- Suscriptores (`iglesias/{ig}/suscriptores`) llevan `temas: ['lectura'|'anuncios']`; sin el campo = lectura.
- `/api/enviar-anuncio` verifica el ID token de Firebase y el nivel (≥ líder) con `verificarUsuario`.
- `GeneradorBanner` es reutilizable (props `etiquetas`, `separarComas`) para lectura, anuncios y eventos.
- Fotos: con Cloudinary configurado se suben allí; si no, se guardan reducidas (~520 px) como data URL en el registro (`src/lib/fotos.ts`).

## Comandos

- `npm run dev` (puerto 5180) · `npm test` · `npm run build`
