# 🪪 QR Personal System — Tarjeta de presentación digital + QR gratis

Sistema web simplificado (tipo qr-code.io) para crear una página personal/tarjeta de presentación digital y generar un código QR único que apunta a ella. 100% gratuito: sitio estático en GitHub Pages + Supabase como backend.

## ¿Qué hace?

1. El visitante llena un formulario de varios pasos (`index.html`) viendo el resultado en vivo.
2. Al terminar, crea una cuenta (email/contraseña) para poder generar su QR.
3. Confirma su correo → su tarjeta se activa automáticamente con los datos llenados.
4. Entra a su panel (`pages/dashboard.html`), completa lo que falte (incluida galería de fotos y avatar), y descarga su QR.
5. El QR apunta a `tusitio.com/u/su-slug` (`pages/perfil.html?u=su-slug`), su página pública.

## Requisitos

- Cuenta gratuita de [Supabase](https://supabase.com)
- Cuenta de GitHub (para GitHub Pages)
- Navegador moderno (Chrome, Firefox, Safari, Edge — últimas 2 versiones)

## Estructura de carpetas

```
Personal-vcard-web/
├── index.html              # Wizard público con preview en vivo
├── 404.html                 # Redirección de /u/slug -> pages/perfil.html
├── pages/
│   ├── login.html
│   ├── olvide-password.html
│   ├── restablecer-password.html
│   ├── dashboard.html
│   └── perfil.html          # Página pública del usuario
├── assets/
│   ├── css/                 # variables (paleta pastel), styles, components, responsive
│   ├── js/                  # config, supabase-client, supabase-data, auth, wizard, dashboard,
│   │                        # perfil, qr, vcard, utils, login, olvide-password, restablecer-password
│   ├── images/               # logo.svg (favicon + logo + avatar de respaldo)
│   └── sql/                  # schema.sql, functions.sql, rls-policies.sql
├── docs/
│   └── ARQUITECTURA-VCARD.md # RFC/PRD/System Design/Tech Spec/ADRs completos
├── .env.example
├── README.md
├── SETUP.md
└── ARCHITECTURE.md
```

## Guía rápida de uso

Ver **SETUP.md** para el paso a paso completo (crear proyecto Supabase, correr el SQL, configurar `config.js`, publicar en GitHub Pages, monitoreo de cuotas).

## Documentación técnica

Ver **docs/ARQUITECTURA-VCARD.md** para el detalle de decisiones (RFC, PRD, modelo de datos, RLS, ADRs) y **ARCHITECTURE.md** para el resumen operativo.

## Límites conocidos (v1)

- Sin planes de pago (todo gratis, ver PRD 2.4).
- El slug no se puede cambiar desde el dashboard (evita romper QRs ya impresos).
- Galería limitada a 6 fotos por usuario, comprimidas automáticamente para maximizar el free tier de Storage (ver ADR-005).
- Sin reordenar fotos de galería ni estadísticas de escaneo del QR (quedan para v2, ver PRD 2.4).
