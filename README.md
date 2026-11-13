# Jeivi

Plataforma modular para la gestión de la iglesia (estilo Odoo): un lanzador de "apps" donde se van sumando módulos.
Hecha para **Ministerio Jesucristo Imperio de Vida**, preparada para que más adelante la usen otras iglesias.

**Stack:** React + Vite + TypeScript · Firebase Authentication + Firestore · Vercel (hosting, funciones y cron) · Cloudinary (imágenes, plan gratis).

## Módulos

| Módulo | Estado | Qué hace |
|---|---|---|
| Lectura Bíblica | ✅ | Plan de 6 meses, banner para WhatsApp, link público para ver la lectura y suscribirse, correo diario |
| Cumpleaños | ✅ | Próximos, calendario, registros, banner con foto, link público de registro (persona + hijos + foto), **encargado del mes tipo ticket** (la pastora asigna, cada banner enviado marca al cumpleañero), exportar |
| Finanzas | ✅ | Aportes de los diáconos (luz, alquiler, mantenimiento…), gastos con campos libres, estado de cuenta, **los diáconos reportan sus pagos con comprobante obligatorio** (un pastor confirma o rechaza), **importar los Excel que ya usan** (.xlsx, .xls, .ods o .csv; primero pregunta si van a Finanzas, a un Proyecto o al Inventario, sin duplicar) y descargar |
| Eventos | ✅ | Próximos, calendario mensual, responsables, tareas, banner, link de inscripción con cupo y lista de inscritos |
| Anuncios | ✅ | Tablero informativo, anuncios con imagen y vigencia, banner, link público del tablero, suscripción a avisos y envío por correo |
| Solicitudes | ✅ | Oración, visitas, consejería… por link público; bandeja con estados, responsable, notas de seguimiento; confidenciales solo para pastores |
| Historial | ✅ | Quién hizo qué y cuándo en todos los módulos (antes → después), restaurar lo borrado, galería de banners, fotos y comprobantes |
| Usuarios / Configuración | ✅ | Aprobar cuentas y niveles · nombre, colores, logo, módulos, Cloudinary |

### Quién usa Jeivi

Solo el **equipo** tiene usuario, y **solo por invitación** (Usuarios → Invitar al equipo). Ver [SEGURIDAD.md](SEGURIDAD.md).

| Nivel | Puede |
|---|---|
| **Super admin** | Todo, incluida la configuración de la app |
| **Pastor (admin)** | Usuarios, finanzas completas, ciclos de lectura, imágenes. No toca la configuración de la app |
| **Diácono** | Entra a los módulos, edita lo básico, crea banners y **links de registro**, ve **su estado de cuenta** |
| **Sin acceso** (`pendiente`) | Bloqueado: no ve nada |

La **congregación no tiene usuario**. Un diácono genera un **link** desde el módulo (Lectura, Cumpleaños, Anuncios, Solicitudes, o dentro de cada Evento) y lo comparte por WhatsApp. Quien lo abre solo ve ese formulario: no puede ver ni modificar ningún dato. Los links se pueden desactivar en cualquier momento.

### Finanzas: aportes de los diáconos

1. **Conceptos:** Luz, Agua, Alquiler, Mantenimiento… cada uno con *campos libres* para sus gastos (n.º de factura, kWh, vencimiento…).
2. **Cargos:** lo que le toca a cada diácono. Dos formas: *repartir un recibo* (ej. luz $100 entre 4 = $25 c/u, y opcionalmente se registra como gasto) o *monto fijo* por diácono.
3. **Aportes:** el pastor registra lo que cada diácono entregó (efectivo, Yappy, transferencia).
6. **Estado de cuenta:** cada diácono, al entrar a Jeivi, ve **“¡Estás al día!”** o **“Debes $25.00 — Luz (nov 2026)”**. Los pagos se aplican a los meses más antiguos.
8. **Proyectos e inversiones:** compras grandes o mejoras (ej. la PC para los directos) que **no cuentan como gastos**: presupuesto, lista de compras (estimado vs. real, con factura), fondos (ofrendas especiales, donaciones…) y avance. Con *Pedir aporte a diáconos* se crea una cuota para el proyecto que entra en el estado de cuenta de cada diácono y suma a los fondos.
9. **Inventario de bienes:** base de datos de lo que tiene la iglesia (equipos, sonido, instrumentos, mobiliario…) con costo, fecha, proveedor, ubicación, responsable, estado, garantía, foto y factura. Lo comprado en un proyecto pasa al inventario con un clic. Exportable a Excel.
7. **Resumen:** gastos, aportes y pendiente por mes; estado de cada diácono con botón de recordatorio por WhatsApp; **Descargar Excel**.

## Probar en tu computadora

```bash
npm install
npm run dev
```

Abre http://localhost:5180. Sin archivo `.env` la app arranca en **modo demo** (datos en el navegador, usuario super admin) para que puedas verla sin Firebase.

```bash
npm test
```

## Puesta en marcha (una sola vez)

### 1. GitHub
Crea un repositorio vacío (privado recomendado) y sube esta carpeta. El archivo `.env` **nunca** se sube (está en `.gitignore`); las claves van en Vercel.

### 2. Firebase
1. Crea un proyecto en https://console.firebase.google.com (plan gratis Spark es suficiente).
2. **Authentication → Método de acceso:** activa *Google* y *Correo electrónico/contraseña*.
3. **Authentication → Configuración → Dominios autorizados:** agrega tu dominio de Vercel (ej. `jeivi.vercel.app`) y el dominio propio si lo usas.
4. **Firestore Database:** créala en modo producción.
5. Publica las reglas e índices (con Firebase CLI) o copia `firestore.rules` en la consola:
   ```bash
   npx firebase-tools deploy --only firestore --project TU-PROYECTO
   ```
6. **Configuración del proyecto → Tus apps → Web:** registra una app y copia los valores a las variables `VITE_FIREBASE_*`.
7. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada:** ese JSON va en `FIREBASE_SERVICE_ACCOUNT` (solo en Vercel).

### 3. Vercel
1. *Add New → Project* → importa el repositorio de GitHub (Vercel detecta Vite).
2. En *Settings → Environment Variables* copia todas las variables de `.env.example` con sus valores.
3. `CRON_SECRET`: cualquier texto largo y aleatorio. Vercel lo usa para llamar al cron.
4. Cada `git push` a `main` publica automáticamente.

### 4. Tu usuario super admin
1. Tu documento en Firestore → `users` → campo `rol` = `superadmin` (se hace una sola vez, a mano).
2. A pastores y diáconos los **invitas** en *Usuarios → Invitar al equipo* (correo + nivel) y les envías el mensaje por WhatsApp. Al entrar con ese correo, su cuenta se crea con ese nivel.

### 5. Correo diario (opcional pero recomendado)
El cron `/api/cron/lectura-diaria` corre de lunes a viernes a las 5:00 a.m. (hora de Panamá) y envía la lectura a quienes se suscribieron con su correo por el link público, y a los diáconos que la activaron en *Mi perfil*. Quienes dejaron solo su WhatsApp aparecen en *Lectura → Link y suscriptores* con un botón para enviarles la lectura del día.

- **Resend** (3.000 correos/mes gratis): crea cuenta en https://resend.com, verifica el dominio de la iglesia y usa `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM=Jeivi <lectura@tu-dominio.com>`.
- **Brevo** (300/día gratis, sin dominio propio): https://brevo.com, verifica el correo remitente y usa `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`.

Prueba manual (te llega solo a ti):
```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" "https://TU-APP.vercel.app/api/cron/lectura-diaria?prueba=tu@correo.com"
```

### 6. Imágenes (Cloudinary)
Crea cuenta gratis en https://cloudinary.com → *Settings → Upload → Upload presets → Add* → modo **Unsigned**. Copia el *cloud name* y el nombre del preset en Jeivi → Configuración → Imágenes. Luego los pastores suben fotos al banco desde *Lectura Bíblica → Administrar*.

## Cómo funciona la lectura

- El plan (26 semanas, lunes a viernes, 130 lecturas) está en `src/modulos/lectura/plan.ts`, transcrito del Excel de la iglesia.
- Los **ciclos** los define un pastor (fecha de inicio, normalmente primer lunes de enero y de julio). Las **pausas** (feriados, retiros) no avanzan el plan.
- Sábado y domingo se muestra "Día para ponerte al día" con el resumen de la semana.
- Un diácono puede reemplazar la lectura de cualquier día (escribiéndola o con el selector de libro/capítulo/versículo) y añadir una nota o versículo. Los hermanos eligen en qué versión leer.
- El banner se genera en el navegador (canvas) en 3 formatos (cuadrado, vertical, estado de WhatsApp) y 3 diseños, con 8 fondos incluidos, fotos del banco de la iglesia o una foto propia (que no se sube a ningún servidor). En el celular el botón *Compartir en WhatsApp* envía la imagen directamente.

### Banners

Todos los banners (lectura, anuncios, eventos y cumpleaños) permiten cambiar el color de cada texto (y el borde de la foto en cumpleaños). Los colores elegidos se recuerdan en el dispositivo por módulo.

### Vista previa de los links

Al compartir un link público (`/p/...`) por WhatsApp, la vista previa dice de qué se trata (registro de cumpleaños, lectura diaria, inscripción al evento…). Lo arma `api/vista-link.ts`, que necesita `FIREBASE_SERVICE_ACCOUNT` en Vercel.
