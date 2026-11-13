# Activar Firebase Storage e historial

Con el plan **Blaze** activo, sigue estos 4 pasos (≈10 minutos). Hasta que los completes, Jeivi funciona igual que antes: las fotos se guardan reducidas y los banners guardan solo una miniatura en el historial.

## 1. Crear el bucket de Storage
1. Firebase → **Compilación → Storage → Comenzar**.
2. Ubicación: **us-central1** (o la que ofrezca "sin costo"). No se puede cambiar después.
3. Modo: **producción** → **Listo**.
4. Pestaña **Reglas**: borra todo, pega el contenido de `storage.rules` → **Publicar**.
   - Si pregunta si permites que Storage lea Firestore (*cross-service rules*), toca **Permitir**. Las reglas lo necesitan para saber quién es quién.

## 2. Publicar las reglas nuevas de Firestore
Firebase → Firestore → **Reglas** → pega todo `firestore.rules` → **Publicar**. Agregan el historial y el registro de archivos.

## 3. Permitir que los banners usen fotos de Storage (CORS)
Sin esto, las fotos se ven pero no se pueden usar dentro de un banner.
1. Abre https://console.cloud.google.com, elige el proyecto **jeivi-d9f69** y toca el ícono **Cloud Shell** `>_` (arriba a la derecha).
2. Pega este comando y presiona Enter:

```bash
echo '[{"origin":["https://jeivi.vercel.app"],"method":["GET","HEAD"],"responseHeader":["Content-Type","Content-Length"],"maxAgeSeconds":3600}]' > cors.json && gcloud storage buckets update gs://jeivi-d9f69.firebasestorage.app --cors-file=cors.json
```

3. Debe terminar sin error (dice *Updating…* y vuelve al prompt). Si usas un dominio propio, agrégalo a la lista `origin`.

## 4. Encender Storage en Jeivi
1. Vercel → **Settings → Environment Variables** → agrega `VITE_STORAGE_ACTIVO` = `1` (tipo Config).
2. **Deployments → ⋯ → Redeploy**.

## 5. Alerta de presupuesto (recomendado con Blaze)
https://console.cloud.google.com/billing → tu cuenta de facturación → **Presupuestos y alertas → Crear presupuesto** → monto **$5** → alertas al 50 %, 90 % y 100 % a tu correo.
Con el uso de una iglesia normalmente cuesta **$0** (Storage incluye 5 GB y 1 GB de descarga diaria sin costo en us-central1).

---

## Qué queda guardado

| Qué | Dónde | Se puede borrar desde la app |
|---|---|---|
| **Historial de cambios** (crear, editar, borrar, importar en todos los módulos: quién, cuándo, antes → después) | *Historial → Actividad* y *Finanzas → Historial* | No (solo agregar). Lo borrado se puede **restaurar** |
| **Banners** que se comparten o descargan | *Historial → Banners* (PNG completo con Storage; miniatura sin Storage) | No |
| **Fotos** (cumpleaños, anuncios, eventos, logo, banco de imágenes) | Storage + *Historial → Fotos y comprobantes* | No |
| **Comprobantes** de gastos y aportes (foto o PDF) | Storage + el registro de Finanzas (📎) + *Historial* | No |

Estructura en Storage: `iglesias/{iglesia}/{módulo}/{AAAA-MM}/{archivo}`. Lo que sube la congregación por un link va a `iglesias/{iglesia}/publico/{link}/`.
