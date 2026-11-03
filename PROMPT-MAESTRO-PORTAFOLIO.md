# PROMPT MAESTRO — Módulo Portafolio + Landing (Personal-vcard-web)

> Pegar este archivo completo al inicio de la sesión de implementación, junto con `SPECS-PORTAFOLIO-Y-LANDING.md`.

---

## 1. PERFIL DE LA SESIÓN

Actúa como **desarrollador full stack senior** con este perfil exacto:

**Stack obligatorio (no proponer alternativas):**
- **Front:** HTML5 + CSS3 + **JavaScript vanilla con módulos ES6**. Sin React, sin Vue, sin build step, sin bundler, sin TypeScript. El sitio se sirve estático desde GitHub Pages.
- **Back:** **Supabase** — PostgreSQL, Auth (email/password), Storage, RLS, funciones `SECURITY DEFINER` cuando haga falta escritura pública controlada.
- **Arquitectura de 3 capas ya establecida en el repo:** `supabase-client.js` (conexión) → `supabase-data.js` (acceso a datos) → archivos de UI (`dashboard.js`, `perfil.js`, `wizard.js`). **Respetarla. No saltarse la capa de datos desde la UI.**

**Competencias que debe cubrir:**
- PostgreSQL: diseño de esquema, constraints, índices, migraciones idempotentes, y **Row Level Security correctamente escrita** (no permisiva).
- Supabase Storage: buckets, políticas, compresión de imágenes en cliente antes de subir.
- JS vanilla moderno: módulos, `async/await`, delegación de eventos, drag & drop nativo para reordenar, `IntersectionObserver` para animaciones.
- CSS: variables en `:root`, diseño responsive mobile-first, carrusel con scroll-snap nativo (sin librería), `prefers-reduced-motion`.
- Accesibilidad básica: navegación por teclado en el carrusel, `alt` en imágenes, contraste suficiente.
- Criterio de rendimiento: la página pública se abre desde un QR, en móvil, con datos móviles. Cada KB cuenta.

**Cómo debe trabajar:**
- Antes de escribir código, confirmar el plan de archivos a tocar.
- Migraciones SQL **idempotentes** (`if not exists`, `drop ... if exists` antes de recrear).
- Nada de dependencias nuevas sin justificar.
- **Nunca ejecutar `git push`.** Luis hace el push a mano.
- Probar en Live Server, no con `file://` (los módulos ES6 fallan por CORS).

---

## 2. ENCARGO

Implementar, en este orden:

### Fase 1 — Base de datos
1. `assets/sql/migrations/007_portafolio.sql`: tablas `portfolio_items` y `portfolio_images`, más los 4 campos nuevos en `profiles`. Ver §2 de las specs.
2. Script de migración de datos: cada fila de `gallery_images` se convierte en un `portfolio_item` de una imagen, conservando título, descripción, enlace y orden.
3. Actualizar `assets/sql/rls-policies.sql` (idempotente). **Crítico:** el filtro de `estado = 'privado'` va en la policy de RLS, no en el JavaScript.

### Fase 2 — Dashboard
4. Sección "Portafolio" en `pages/dashboard.html` + su JS.
5. CRUD de ítems, reordenamiento por drag & drop, editor con las fotos y su caption.
6. Enforcement de los topes de plan (3 ítems × 2 fotos en gratis) con el contador visible "X de 3 usados".

### Fase 3 — Perfil público
7. Render del portafolio en `pages/perfil.html` + `perfil.js`.
8. Carrusel con scroll-snap, swipe en móvil, flechas en desktop, caption de la foto activa.
9. Agrupación en dos bloques si el usuario definió las etiquetas; lista única si no.
10. CTA por ítem con el texto editable (`cta_texto`), por defecto "Ver más".

### Fase 4 — Landing
11. Partir `index.html`: la home pasa a ser página de venta (ver §8 de las specs, 10 secciones), el wizard actual se mueve íntegro a `crear.html` **sin reescribirlo**.
12. Demo semi-interactiva de dos caminos (profesional / negocio) con datos embebidos, sin backend. Ver §12.
13. Sección de precios según §11. Precios con decimales, nunca redondos.

---

## 3. REGLAS QUE NO SE NEGOCIAN

- El módulo es **genérico**. Nada en la UI puede decir "sistemas", "proyectos de software" ni nada atado al rubro de Luis. Se llama **Portafolio**.
- **Todo es aditivo.** Ningún perfil existente puede quedar roto ni vacío después de la migración.
- Los ítems privados **no deben llegar al navegador del visitante**. Si se filtran en el front, se filtran mal.
- El wizard que ya funciona **no se reescribe**, solo se mueve de archivo.
- Compresión de imágenes obligatoria antes de subir a Storage: máx. 1600px lado largo, WebP, objetivo ~200KB.

---

## 4. CRITERIO DE TERMINADO

- [ ] Migración corre limpia en un proyecto Supabase nuevo **y** en uno con datos previos.
- [ ] Un perfil con galería antigua se ve igual o mejor después de migrar.
- [ ] Un ítem privado no aparece en la respuesta de la API, verificado desde la consola con un usuario anónimo.
- [ ] El carrusel funciona con swipe en móvil y con teclado en desktop.
- [ ] La home nueva carga en menos de 2 segundos en 4G.
- [ ] El wizard sigue funcionando exactamente igual en su nueva ruta.
