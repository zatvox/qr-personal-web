# 🏗️ ARCHITECTURE — Resumen técnico operativo

> Documento completo de decisiones (RFC/PRD/System Design/Tech Spec/ADRs) en `docs/ARQUITECTURA-VCARD.md`. Este archivo es el resumen para mantenimiento rápido.

## Flujo de datos

```
Visitante → index.html (landing) → crear.html (wizard) → localStorage (borrador)
   → signUp() con datos en user_metadata → Supabase Auth
   → confirma email → trigger handle_new_user() → INSERT en profiles
   → login → dashboard.html (lee/edita su profile vía RLS)
   → genera QR (cliente) → link https://sitio/u/slug
   → público escanea QR → 404.html redirige → perfil.html?u=slug
   → SELECT público (activo=true) en profiles + portfolio_items/portfolio_images (sin ítems privados)
```

## Módulos

| Módulo | Páginas | JS | Descripción |
|---|---|---|---|
| Landing | `index.html` | `landing.js` | Página de venta: demo con datos embebidos (sin backend), precios y FAQ |
| Wizard | `crear.html` | `wizard.js` | Captura datos sin persistir en DB, preview en vivo, toast de aviso |
| Auth | `pages/login.html` | `auth.js`, `login.js` | Registro (desde wizard), login, reenvío de confirmación |
| Dashboard | `pages/dashboard.html` | `dashboard.js` | CRUD del perfil propio, subida de avatar y galería (con compresión), generación/descarga de QR |
| Perfil público | `pages/perfil.html` | `perfil.js`, `vcard.js` | Vista pública, botón guardar contacto (.vcf), galería, video |
| Recuperar contraseña | `pages/olvide-password.html`, `pages/restablecer-password.html` | `olvide-password.js`, `restablecer-password.js` | Flujo completo de reset vía email de Supabase Auth |
| QR | (todas) | `qr.js` | Generación 100% cliente vía CDN qrcodejs |
| Compresión de imágenes | dashboard | `utils.js` (`comprimirImagen`) | Redimensiona y comprime a JPEG en canvas antes de subir (ADR-005) |

## Base de datos

Ver diagrama ER y detalle de columnas en `docs/ARQUITECTURA-VCARD.md` sección 4.3. Resumen: `profiles` (1:1 con `auth.users`) + `gallery_images` (N:1 con `profiles`) + `slugs_reservados` (lista estática).

## Patrones utilizados

- **Three-layer pattern** en JS: UI (`wizard.js`, `dashboard.js`, `perfil.js`) → Data (`supabase-data.js`) → Client (`supabase-client.js`, singleton).
- **RLS deny-by-default**: ninguna tabla es accesible sin política explícita.
- **Datos sensibles diferidos**: nada se escribe en `profiles` hasta que el email está confirmado (ADR-004), evitando cuentas fantasma.
- **URLs bonitas sin servidor**: trick de `404.html` (ADR-003), estándar en sitios estáticos de GitHub Pages.

## Decisiones técnicas (ADRs)

Ver índice completo en `docs/ARQUITECTURA-VCARD.md` sección 5. Resumen: ADR-001 Supabase serverless · ADR-002 QR en cliente · ADR-003 URLs bonitas · ADR-004 datos en `user_metadata` hasta confirmación · ADR-005 compresión de imágenes en cliente (crítico para no saturar el free tier de Storage con muchos usuarios).

## Portafolio, planes y panel admin (migración 007)

- **Portafolio:** `portfolio_items` (1 trabajo) → `portfolio_images` (N fotos con `caption`). Reemplaza a `gallery_images`, que se conserva solo como respaldo de la migración. UI: `portafolio-editor.js` (dashboard) y `perfil-portafolio.js` (carrusel con scroll-snap). Datos: `portafolio-data.js`.
- **Planes:** `profiles.plan` (`gratis`/`pro`) + `plan_vence_en`. El plan *efectivo* lo calcula la BD (`plan_efectivo()`); un Pro vencido cae solo a Gratis. Topes: Gratis 3×2, Pro 30×8, privados solo Pro — forzados por triggers en la BD, el JS solo pinta contadores (`CONFIG.PLANES`). Las columnas de plan están blindadas por trigger: un usuario normal no puede cambiárselas.
- **Privacidad:** los ítems `privado` se excluyen en la RLS (no solo en el JS). El bucket `gallery` es público, así que un privado queda oculto pero su archivo sigue accesible por URL directa.
- **Admin:** tabla `admins` (sin policies, se llena desde el SQL Editor) + `es_admin()`. `pages/admin.html` usa RPCs `SECURITY DEFINER` (`admin_listar_usuarios`, `admin_registrar_pago`, `admin_cambiar_plan`, `admin_activar_perfil`) que verifican admin en el servidor. Tabla `pagos` con historial.
- **Capa de datos:** además de `supabase-data.js`, `portafolio-data.js` y `admin-data.js` (misma regla: la UI nunca habla directo con Supabase).

## Mantenimiento

- Cambios de esquema → nueva migración numerada en `assets/sql/migrations/` (crear carpeta al primer cambio post-lanzamiento) + ADR si es una decisión nueva.
- Parámetros de negocio (textos, límites, redes soportadas) → `assets/js/config.js`, nunca hardcodeados en las páginas.
- No eliminar archivos ni políticas sin confirmación previa del dueño del proyecto.


## Estadísticas y tarjeta imprimible (migración 008)

- **Visitas:** el perfil público llama `registrar_visita(slug, origen)` (RPC `security definer`, accesible a anónimos). El QR impreso apunta a `/u/slug?s=qr`; sin ese parámetro la visita cuenta como "link". Solo se suman contadores por día (`visitas_diarias`); no se guarda IP. `CONFIG.ESTADISTICAS.guardarDetalle` (hoy `false`) activaría `visitas_detalle` (dispositivo, idioma, referrer; nunca IP). El dueño no se cuenta a sí mismo.
- **Lectura:** `estadisticas_perfil(dias)` devuelve totales a todos y la serie diaria solo a plan Pro.
- **Tarjeta:** `tarjeta-render.js` dibuja frente/dorso en canvas con medidas en mm (10 diseños). `tarjeta-editor.js` es la UI del dashboard y arma el PDF con jsPDF: 2 páginas de 96×56 mm (90×50 + 3 mm de sangrado por lado) a 600 dpi. La configuración se autoguarda en `profiles.tarjeta_config`. Descargar el PDF es solo para Pro (control de interfaz; el PDF se genera en el navegador).
