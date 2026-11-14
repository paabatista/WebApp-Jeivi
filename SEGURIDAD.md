# Seguridad de Jeivi

## Qué está implementado

### 🔐 Acceso e identidad
- **Login obligatorio** (Google o correo/contraseña con Firebase Auth). Sin sesión no se ve ningún módulo. La congregación solo entra a los links públicos de cada módulo, que únicamente permiten llenar un formulario.
- **Solo por invitación.** Un pastor o el super admin invita el correo y elige el nivel (pastor, diácono o líder). Quien entra con un correo no invitado ve "Tu correo no tiene acceso". Las reglas de Firestore lo exigen en el servidor.
- **Correo verificado.** Las cuentas con contraseña deben confirmar el enlace que llega al correo antes de entrar. Google ya viene verificado.
- **Super admin fijo.** Solo se asigna desde la consola de Firebase. Desde Jeivi nadie puede crear, cambiar ni borrar un super admin.
- **Cierre por inactividad (1 hora).** Si no hay actividad en 1 hora, la sesión se cierra. Al volver otro día también pide entrar de nuevo.

### 🛡️ Aislamiento de datos (`firestore.rules`)
- Todo lo no permitido queda **denegado por defecto**.
- Cada usuario solo ve los datos de **su iglesia** (`iglesiaId`).
- **Pastor / super admin** ven todo lo de su iglesia. El **diácono** solo ve **su** estado de cuenta en Finanzas (más totales de la iglesia sin nombres y los proyectos, sin editar; si un pastor le marca “Lleva finanzas”, administra Finanzas completa), y no ve las solicitudes confidenciales ni la lista de usuarios. El **líder** solo entra a Lectura, Cumpleaños, Solicitudes (no confidenciales) y Anuncios: no ve nada de Finanzas ni Eventos.
- Los links públicos solo pueden **crear** registros en su módulo, con campos y tamaños limitados, y solo mientras el link esté activo.
- Las reglas corren en los servidores de Google, así que no se pueden saltar desde el navegador.
- **Storage** (`storage.rules`): aislado por iglesia; solo el equipo sube (comprobantes solo pastores); la congregación solo puede subir fotos a la carpeta de un link activo; nada se sobrescribe ni se borra.
- **Historial inmutable**: cada cambio queda registrado (quién, cuándo, antes → después) y las reglas impiden editarlo o borrarlo. Ver [STORAGE.md](STORAGE.md).

### 🌐 Protección de la web (`vercel.json`)
- **Security headers:** Content-Security-Policy, Strict-Transport-Security (HSTS), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy y Permissions-Policy.
- **HTTPS forzado** por Vercel. Los datos van cifrados en tránsito (TLS) y Firebase cifra en reposo (AES-256).
- **CORS limitado.** `/api/enviar-anuncio` rechaza llamadas de otros dominios y además verifica el token y el nivel del usuario.
- **App Check (reCAPTCHA v3)** está listo en el código. Se activa al poner `VITE_RECAPTCHA_SITE_KEY` (ver abajo).

### 🔑 Otros blindajes
- **Sin secretos en el código.** Claves de servidor, cuenta de servicio y secreto del cron viven solo en Vercel (variables *Secret*). La configuración web de Firebase es pública por diseño; la protección está en las reglas.
- **Protección de borrado.** No se puede borrar al super admin ni a uno mismo, y todo borrado pide confirmación. Los pastores no pueden borrar usuarios.
- **Sin inyección SQL.** Firestore es NoSQL; los datos se guardan como valores, nunca como código.
- **DDoS** absorbido por la infraestructura de Vercel y Google.

## Pasos manuales (te tocan a ti, en la consola)

1. **Publicar las reglas nuevas (obligatorio).** Firebase → Firestore → **Reglas** → pega todo `firestore.rules` → **Publicar**. Sin esto, los invitados no podrán crear su cuenta.
2. **Quitar `localhost` de los dominios autorizados.** Firebase → Authentication → Configuración → Dominios autorizados → borra `localhost`. Deja solo tu dominio de Vercel y `jeivi-d9f69.firebaseapp.com`.
3. **Política de contraseñas** (opcional). Authentication → Configuración → Política de contraseñas → mínimo 8 caracteres.
4. **App Check** (al final, cuando todo funcione):
   1. https://www.google.com/recaptcha/admin → crea un sitio **reCAPTCHA v3** con tu dominio de Vercel → copia la **clave del sitio** y la **clave secreta**.
   2. Firebase → **App Check** → tu app web → **reCAPTCHA** → pega la clave secreta → Guardar.
   3. Vercel → Environment Variables → `VITE_RECAPTCHA_SITE_KEY` = clave del sitio → **Redeploy**.
   4. Firebase → App Check → APIs → **Cloud Firestore** queda en "Supervisión". Después de unos días, si las métricas muestran 100 % de solicitudes verificadas, cámbialo a **Aplicar**.
5. **Alerta de presupuesto.** Con el plan gratis (Spark) Firebase no cobra nada: al llegar al límite se detiene. Si algún día pasas a Blaze: Google Cloud Console → Facturación → **Presupuestos y alertas** → crear presupuesto de **$5** con alertas al 50 %, 90 % y 100 %.
