# 🏗️ ARCHITECTURE — Resumen técnico operativo

> Documento completo de decisiones (RFC/PRD/System Design/Tech Spec/ADRs) en `docs/ARQUITECTURA-VCARD.md`. Este archivo es el resumen para mantenimiento rápido.

## Flujo de datos

```
Visitante → index.html (wizard) → localStorage (borrador)
   → signUp() con datos en user_metadata → Supabase Auth
   → confirma email → trigger handle_new_user() → INSERT en profiles
   → login → dashboard.html (lee/edita su profile vía RLS)
   → genera QR (cliente) → link https://sitio/u/slug
   → público escanea QR → 404.html redirige → perfil.html?u=slug
   → SELECT público (activo=true) en profiles + gallery_images
```

## Módulos

| Módulo | Páginas | JS | Descripción |
|---|---|---|---|
| Wizard | `index.html` | `wizard.js` | Captura datos sin persistir en DB, preview en vivo, toast de aviso |
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

## Mantenimiento

- Cambios de esquema → nueva migración numerada en `assets/sql/migrations/` (crear carpeta al primer cambio post-lanzamiento) + ADR si es una decisión nueva.
- Parámetros de negocio (textos, límites, redes soportadas) → `assets/js/config.js`, nunca hardcodeados en las páginas.
- No eliminar archivos ni políticas sin confirmación previa del dueño del proyecto.
