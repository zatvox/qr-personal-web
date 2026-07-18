# ⚙️ SETUP — Guía de configuración inicial

## 1. Crear proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Elige nombre, contraseña de base de datos y región. Espera a que aprovisione (~2 min).
3. En **Project Settings → API**, copia:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`

## 2. Ejecutar el SQL

En el panel de Supabase ve a **SQL Editor** y ejecuta, **en este orden**:

1. `assets/sql/schema.sql`
2. `assets/sql/functions.sql`
3. `assets/sql/rls-policies.sql`

> Si ya habías corrido `schema.sql` antes de la versión con selector de tema de color, corre además `assets/sql/migrations/001_add_tema_perfil.sql` para agregar la columna `tema` sin perder tus datos.

## 3. Crear los buckets de Storage

En **Storage**, crea dos buckets **públicos**:
- `avatars`
- `gallery`

(Las políticas de acceso ya quedaron definidas en `rls-policies.sql`, sección STORAGE. Si tu proyecto no permite políticas de storage por SQL, créalas manualmente desde la UI de Storage → Policies, replicando las reglas del archivo.)

## 4. Configurar autenticación

En **Authentication → Providers**, deja habilitado **Email**. En **Authentication → URL Configuration**, agrega como *Redirect URLs*:

```
https://TU-USUARIO.github.io/TU-REPO/pages/login.html
https://TU-USUARIO.github.io/TU-REPO/pages/login.html?confirmado=1
https://TU-USUARIO.github.io/TU-REPO/pages/restablecer-password.html
```

(Ajusta si usas dominio propio.)

## 5. Configurar `assets/js/config.js`

Reemplaza:

```js
SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
SUPABASE_ANON_KEY: 'TU-ANON-KEY-AQUI',
```

con los valores copiados en el paso 1. El `anon key` es seguro para exponer públicamente: toda la protección real vive en las políticas RLS.

## 6. Probar localmente

No necesitas servidor especial, pero como el sitio usa ES Modules (`type="module"`), ábrelo con un servidor local simple (no funciona con `file://`):

```bash
# Con Python
python3 -m http.server 8080

# O con Node
npx serve .
```

Abre `http://localhost:8080` y prueba el flujo completo: wizard → registro → confirmar correo (revisa tu bandeja) → login → dashboard → QR → perfil público.

## 7. Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a un repositorio de GitHub.
2. Ve a **Settings → Pages** → Source: rama `main`, carpeta `/ (root)`.
3. Espera 1-2 minutos y entra a `https://TU-USUARIO.github.io/TU-REPO/`.
4. `404.html` ya viene configurado para repo de proyecto (`usuario.github.io/nombre-repo/`), que es el caso de este sitio: `PATH_SEGMENTS_TO_KEEP = 1`. Si más adelante migras a un dominio propio o a un repo de usuario (`usuario.github.io/` raíz), cambia ese valor a `0`.
5. Actualiza las *Redirect URLs* de Supabase (paso 4) con tu dominio real de GitHub Pages.

## Logo y favicons

El sitio ya incluye un logo/favicon propio en `assets/images/logo.svg` (mitad patrón QR, mitad silueta de persona con traje) usado como ícono en todas las páginas y como avatar de respaldo cuando un perfil no tiene foto. Si más adelante quieres reemplazarlo por tu propio diseño, solo sobrescribe ese archivo (mismo nombre) o actualiza las referencias `<link rel="icon">` en cada HTML.

## Monitoreo de cuotas (Storage e importante a futuro)

Todas las imágenes (avatar y galería) se comprimen automáticamente en el navegador antes de subirse, lo que estira mucho el 1GB gratuito de Supabase Storage (ver análisis completo en `docs/ARQUITECTURA-VCARD.md` sección 3.4 y ADR-005). Aun así, si el sistema crece:

1. Revisa mensualmente **Project Settings → Usage** en Supabase (Storage, Database, Auth MAU).
2. Si Storage supera ~80% (800MB de 1GB), en orden de preferencia:
   - Baja `GALERIA_MAX_FOTOS` en `assets/js/config.js` (ej. de 6 a 4) para nuevos usuarios.
   - Evalúa subir a Supabase Pro (100GB) si el crecimiento lo justifica.
   - Como paso intermedio, considera migrar fotos antiguas a un servicio externo con free tier (ej. Cloudinary).
3. Si Auth se acerca al límite de 50,000 usuarios activos mensuales del free tier, es señal de éxito: evalúa el plan Pro.

## Problemas comunes

**"Email not confirmed" al iniciar sesión**
→ El usuario debe confirmar su correo antes de poder ver el dashboard. Puede reenviar el correo desde `login.html`.

**El perfil no aparece tras confirmar el correo**
→ Verifica que el trigger `trg_handle_new_user` (en `functions.sql`) se ejecutó sin error: revisa **Database → Logs** en Supabase.

**CORS o "Invalid API key"**
→ Confirma que copiaste el `anon key` (no el `service_role`) y que no tiene espacios extra.

**El QR no se genera**
→ Revisa la consola del navegador: si el CDN de `qrcodejs` está bloqueado, se mostrará el link en texto como respaldo (ver `assets/js/qr.js`).
