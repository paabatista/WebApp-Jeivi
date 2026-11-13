# Publicar Jeivi (Firebase + Vercel) — lista de pasos

Tiempo aproximado: 30–45 minutos. Todo es gratis salvo que superes los límites del plan gratuito.

## 1. Firebase (base de datos y acceso)
1. https://console.firebase.google.com → **Agregar proyecto** → nombre `jeivi` (Analytics no hace falta).
2. **Compilación → Authentication → Comenzar → Método de acceso**: activa
   - **Google**
   - **Correo electrónico/contraseña**
   - **Microsoft** (opcional; pide registrar una app en Azure — ver README).
3. **Compilación → Firestore Database → Crear base de datos** → modo **producción** → región `nam5` o `us-east1`.
4. **Firestore → Reglas**: borra todo, pega el contenido de `firestore.rules` y **Publicar**.
5. **Firestore → Índices → Compuestos → Crear índice**: colección `users`, campos `iglesiaId` (Ascendente) y `suscritoCorreo` (Ascendente).
6. **⚙ Configuración del proyecto → General → Tus apps → Web (`</>`)** → registra "Jeivi" → copia los 6 valores `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
7. **⚙ Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** → se descarga un `.json`. **No lo subas a GitHub.**

## 2. Vercel (hosting)
1. https://vercel.com → **Add New → Project** → importa `paabatista/WebApp-Jeivi`.
2. Antes de **Deploy**, abre **Environment Variables** y agrega:

| Variable | Valor |
|---|---|
| `VITE_FIREBASE_API_KEY` | apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
| `VITE_FIREBASE_PROJECT_ID` | projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId |
| `VITE_FIREBASE_APP_ID` | appId |
| `VITE_IGLESIA_ID` | `imperio-de-vida` |
| `IGLESIA_ID` | `imperio-de-vida` |
| `FIREBASE_SERVICE_ACCOUNT` | el contenido completo del `.json` del paso 1.7 |
| `CRON_SECRET` | un texto largo inventado (ej. 40 letras y números al azar) |
| `APP_URL` | la URL que te dé Vercel, ej. `https://webapp-jeivi.vercel.app` |
| `EMAIL_PROVIDER` | `brevo` o `resend` |
| `BREVO_API_KEY` o `RESEND_API_KEY` | la clave del servicio de correo |
| `EMAIL_FROM` | `Jeivi <tu-correo-verificado>` |

3. **Deploy**. Si cambias variables después, usa **Deployments → ⋯ → Redeploy**.
4. Vuelve a Firebase → **Authentication → Configuración → Dominios autorizados** → agrega el dominio de Vercel (`webapp-jeivi.vercel.app`) y tu dominio propio si lo usas.

## 2.5 Seguridad
Después de publicar, sigue los pasos manuales de [SEGURIDAD.md](SEGURIDAD.md) (reglas, dominios, App Check).

## 3. Tu cuenta de super admin
1. Abre la app publicada y entra con Google (o crea cuenta con correo). Quedarás "pendiente".
2. Firebase → Firestore → `users` → tu documento → campo `rol` → cambia `pendiente` por `superadmin`.
3. Recarga la app. En **Configuración** revisa nombre, colores y logo, y guarda.
4. Pide a pastores y diáconos que creen su cuenta y apruébalos en **Usuarios**.

## 4. Correo (para la lectura diaria y los avisos)
- **Brevo** (más fácil, 300/día gratis): crea cuenta → *Senders* → verifica tu correo → *SMTP & API → API keys* → crea una. `EMAIL_PROVIDER=brevo`.
- **Resend** (3.000/mes): requiere verificar el dominio de la iglesia (registros DNS). `EMAIL_PROVIDER=resend`.
- Prueba: `https://TU-APP.vercel.app/api/cron/lectura-diaria?prueba=tu@correo.com` con el encabezado `Authorization: Bearer TU_CRON_SECRET` (ver README).

## 5. Imágenes (opcional)
Sin Cloudinary las fotos se guardan reducidas dentro de la base de datos (suficiente para empezar).
Para fotos en alta calidad: cuenta gratis en https://cloudinary.com → *Settings → Upload → Upload presets → Add* (modo **Unsigned**) → pon *cloud name* y *preset* en Jeivi → Configuración.

## 6. Primeros pasos dentro de Jeivi
1. **Lectura → Administrar**: guarda los ciclos (o deja los automáticos).
2. **Finanzas → Conceptos**: "Crear los sugeridos" y ajusta.
3. Crea los **links** (Lectura, Cumpleaños, Anuncios, Solicitudes) y compártelos por WhatsApp.
