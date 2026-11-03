# SPECS — Módulo Portafolio + Landing Page
**Proyecto:** Personal-vcard-web (repo `qr-personal-web`)
**Fecha:** 2026-11-01
**Estado:** definición de lógica y alcance. **No implementar hasta que Luis apruebe las decisiones abiertas del punto 6.**

---

## 0. Principio rector

El portafolio **no es una excepción para la cuenta de Luis**. Es una funcionalidad genérica del producto que sirve a cualquier rubro:

| Rubro | Qué pone en "Portafolio" |
|---|---|
| Desarrollador (Luis) | Sistemas web, con link al landing de cada uno |
| Fotógrafo | Sesiones |
| Dentista / estética | Antes y después |
| Arquitecto / constructor | Obras |
| Restaurante | Platos, carta |
| Vendedor / distribuidor | Productos |

Nombre en la UI: **"Portafolio"** (subtítulo configurable por el usuario: "Mis trabajos", "Proyectos", "Nuestra carta"). Nunca "Mis sistemas".

---

## PARTE A — MÓDULO PORTAFOLIO

## 1. El problema del modelo actual

Hoy (`gallery_images` + migración 005): **1 foto = 1 ítem**. Cada foto tiene `titulo`, `descripcion`, `url_link`.

Lo que se necesita: **1 proyecto = N fotos**, con descripción general del proyecto, un enlace a su landing, y detalle propio por cada foto.

Además: tope duro de **6 fotos por usuario** (ADR-005, para no reventar el free tier de Storage). Con 6 proyectos a 4 fotos salen 24.

---

## 2. Modelo de datos propuesto

### 2.1 Tabla nueva `portfolio_items`

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid FK → profiles | on delete cascade |
| `titulo` | text not null | ej. "ERP Genko" |
| `subtitulo` | text | una línea, ej. "Sistema de gestión multiempresa" |
| `descripcion` | text | descripción general, 2–4 líneas |
| `url_link` | text | enlace al landing del proyecto |
| `cta_texto` | text default 'Ver más' | **texto del botón, editable** (ver §5.3) |
| `estado` | text not null default 'funcional' | `funcional` \| `desarrollo` \| `privado` |
| `orden` | int not null default 0 | |
| `created_at` / `updated_at` | timestamptz | |

Constraint: `estado in ('funcional','desarrollo','privado')`.

> **Nota de diseño genérico:** las etiquetas `funcional` / `desarrollo` son técnicas y no sirven a un fotógrafo. Se guardan así en BD, pero **el usuario elige cómo se llaman sus dos secciones** en el perfil público (campo nuevo en `profiles`, ver §2.3). Luis pondrá "Funcionales" y "En desarrollo"; un dentista pondrá "Casos" y "En proceso"; quien no quiera secciones las deja vacías y se muestra una sola lista.

### 2.2 Tabla nueva `portfolio_images`

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `item_id` | uuid FK → portfolio_items | on delete cascade |
| `storage_path` | text not null | mismo bucket actual |
| `caption` | text | **detalle de esa foto** (ver §6.2) |
| `orden` | int not null default 0 | orden dentro del carrusel |
| `created_at` | timestamptz | |

### 2.3 Cambios en `profiles`

| Campo | Tipo | Para qué |
|---|---|---|
| `portafolio_titulo` | text default 'Portafolio' | título de la sección en el perfil público |
| `portafolio_label_a` | text default '' | nombre del grupo 1 ("Funcionales") |
| `portafolio_label_b` | text default '' | nombre del grupo 2 ("En desarrollo") |
| `mostrar_portafolio` | boolean default true | interruptor en "Visibilidad" |

### 2.4 Qué pasa con `gallery_images`

**No se borra. Se migra.** Cada fila existente se convierte en un `portfolio_item` de una sola imagen, conservando `titulo`, `descripcion`, `url_link` y `orden`. Ningún usuario pierde nada ni ve su perfil roto.

La tabla `gallery_images` queda deprecada después de la migración (no se elimina en 007; se elimina en una limpieza posterior, cuando esté confirmado que nada la lee).

### 2.5 RLS

Mismo patrón que la galería actual:
- **Lectura pública** de `portfolio_items` solo si `profiles.activo = true` **y** `estado <> 'privado'`.
- **Escritura** solo del dueño (`profile.user_id = auth.uid()`).
- `portfolio_images` hereda: visible si su ítem es visible.

> Ojo: el filtro de `privado` debe estar **en la policy de RLS**, no solo en el JS. Si se filtra solo en el front, cualquiera que abra la consola ve los proyectos privados.

---

## 3. Migración 007 — orden de ejecución

1. `007_portafolio.sql`: crea `portfolio_items` y `portfolio_images`, agrega los 4 campos a `profiles`.
2. Script de migración de datos: `gallery_images` → `portfolio_items` + `portfolio_images` (1 a 1).
3. Re-ejecutar `rls-policies.sql` completo (idempotente) con las policies nuevas.
4. Ajustar límites de Storage según el plan elegido (§4).

---

## 4. Límites y Storage — aquí nace el primer cobro

Restricción real: el free tier de Supabase Storage es finito y lo paga Luis.

**Propuesta de planes:**

| | Gratis | Plan pago |
|---|---|---|
| Ítems de portafolio | 3 | ilimitado (tope técnico 30) |
| Fotos por ítem | 2 | 8 |
| Estadísticas de escaneo | no | sí |
| Ítems privados | no | sí |
| Dominio propio / slug premium | no | a evaluar |

Las fotos se siguen comprimiendo automáticamente (ADR-005). Sugerido: máx. 1600px lado largo, WebP, ~200KB por imagen. 30 ítems × 8 fotos × 200KB ≈ 48MB por usuario pago — sostenible.

> **Decisión de negocio, no técnica:** el portafolio es exactamente la feature por la que un profesional paga. Un fotógrafo con 3 fotos no se luce; con 30 sí. Ese es el escalón.

---

## 5. Pantallas

### 5.1 Dashboard — sección "Portafolio"

- Lista de ítems arrastrables (orden).
- Por ítem: miniatura de portada, título, estado (chip de color), botón editar / eliminar.
- Botón "Agregar proyecto".
- Editor de ítem (modal o pantalla): título, subtítulo, descripción, enlace, texto del botón, estado, y la grilla de fotos con su caption y orden.
- Contador visible: "3 de 3 proyectos usados" → empuja al plan pago sin ser agresivo.

### 5.2 Perfil público — carrusel

- Sección "Portafolio" bajo los datos de contacto.
- Si hay `label_a` / `label_b`, se agrupan en dos bloques con encabezado; si no, lista única.
- Cada ítem: **carrusel horizontal de fotos** (swipe en móvil, flechas en desktop), título, subtítulo, descripción, botón CTA.
- El caption de cada foto se muestra sobre/bajo la imagen activa del carrusel.
- Los ítems `privado` **no se renderizan ni llegan al cliente**.

### 5.3 El CTA — corrección importante

El botón de cada proyecto **no dice "Login / Regístrate"**. Quien escanea un QR todavía no quiere una cuenta.

Dice **"Ver demo"** o **"Conocer el sistema"** → lleva al landing del producto → y *ahí arriba* está "Iniciar sesión / Registrarse".

Por eso `cta_texto` es editable: el fotógrafo pondrá "Ver sesión completa", el restaurante "Ver carta".

---

## 6. Decisiones abiertas — requieren respuesta de Luis

### 6.1 Tope de fotos
¿Se aplica el esquema de planes de §4, o se sube el tope para todos por ahora y se cobra después?

### 6.2 Caption vs. modal de detalle
- **Caption** = una línea de texto que acompaña a la foto dentro del carrusel ("Módulo de cobranzas con proyección de caja"). No es un GIF ni animación: es texto. **~1 día de trabajo.**
- **Modal** = al tocar la foto se abre una ventana con título, texto largo, quizá varias imágenes. **~3 días.**

Recomendación: arrancar con caption. El modal se puede agregar después sin rehacer el modelo (el campo `caption` admite texto largo).

### 6.3 Nombre comercial de la vCard
El producto no puede llamarse "Personal-vcard-web" en el landing. Necesita nombre propio bajo la casa **ZatVox**, igual que Genko. Pendiente de definir y verificar colisiones.

---

## PARTE B — LANDING PAGE

## 7. Diagnóstico del `index.html` actual

Hoy la home **es el wizard**: `<h1>Crea tu tarjeta de presentación digital</h1>` y a llenar campos. No hay beneficios, ejemplo, precios ni prueba social.

Analogía: es abrir la tienda con la caja registradora pegada a la puerta. El visitante todavía no sabe por qué debería llenar nada.

**El wizard no se elimina — se mueve.** Pasa a `crear.html` (o a un ancla más abajo), y la home se vuelve una página de venta.

---

## 8. Estructura propuesta del nuevo landing

| # | Sección | Contenido | Por qué está |
|---|---|---|---|
| 1 | **Navbar** | Logo ZatVox · Cómo funciona · Precios · **Iniciar sesión** · **Crear mi tarjeta** (botón sólido) | El login arriba a la derecha, como pidió Luis |
| 2 | **Hero** | Titular de beneficio + subtítulo + CTA + imagen de una tarjeta real en un celular | Primera pantalla decide si se quedan |
| 3 | **Prueba viva** ⭐ | "Mira un ejemplo real" → **el perfil de Luis**, embebido o enlazado, con su QR visible | El mejor anuncio del producto es el producto |
| 4 | **Cómo funciona** | 3 pasos: llena tus datos → confirma tu correo → descarga tu QR | Quita la fricción mental |
| 5 | **Para quién es** | 4–6 tarjetas por rubro (profesional, fotógrafo, salud, restaurante, vendedor) | El visitante se tiene que ver a sí mismo |
| 6 | **Funciones** | QR propio, portafolio con carrusel, agendar citas, colores y fuentes a tu gusto, estadísticas | Aquí entra el portafolio como argumento de venta |
| 7 | **Precios** | Gratis vs. Pago, según §4 | Sin esto el landing no tiene dónde convertir |
| 8 | **Preguntas frecuentes** | ¿El QR caduca? ¿Puedo cambiar mis datos después? ¿Qué pasa si imprimo el QR y cambio de trabajo? | Las objeciones reales del QR impreso |
| 9 | **CTA de cierre** | Repite el botón principal | El que bajó hasta el final está listo |
| 10 | **Footer** | ZatVox · otros productos (Genko) · contacto | Aquí la casa de marcas se hace visible |

### 8.1 Titular del hero — tres rutas para elegir

- **A (funcional):** "Tu tarjeta de presentación, en un QR que nunca se queda sin stock."
- **B (dolor):** "Dejaste de repartir tarjetas porque se acaban, se mojan y cambian tus datos. Esta no."
- **C (resultado):** "Un código. Todo tu perfil, tu portafolio y tus contactos."

Recomendación: **B** para redes (el dolor engancha), **C** para el QR impreso (más corto, más limpio).

### 8.2 Regla de contenido
Nada de métricas, clientes ni testimonios inventados. Hasta que haya usuarios reales, la prueba social es **el perfil de Luis funcionando**, no un número.

---

## 9. Alcance e impacto — resumen

| Trabajo | Toca | Riesgo |
|---|---|---|
| Migración 007 + RLS | SQL | Medio — se prueba en un proyecto Supabase de prueba primero |
| Migración de datos de galería | script | Bajo — es 1 a 1 |
| Dashboard: sección Portafolio | `dashboard.html` + `dashboard.js` + JS nuevo | Medio — es la pantalla más grande del cambio |
| Perfil público: carrusel | `perfil.html` + `perfil.js` + CSS | Medio |
| Landing nuevo | `index.html` partido en `index.html` + `crear.html` | **Alto en marketing, bajo en técnica** — el wizard se mueve entero, no se reescribe |
| Estadísticas de escaneo | tabla nueva + tab en dashboard | Pendiente, fase 2 |

**Todo es aditivo.** Nada de lo que hoy funciona se rompe.

---

## 10. Backlog registrado (no es de esta fase)

- **Estadísticas de escaneo del QR** con tab propio en el perfil: cuántos escaneos, cuándo, desde qué dispositivo.
- **NFC** (la idea del "pin" de restaurante): el mismo perfil servido por acercamiento del celular, sin cámara. Mismo backend, distinto soporte físico.
- **Encuesta rápida / reseña de Google** disparada tras el escaneo.
- **Tarjeta de afiliado**: registrar quién escaneó y atribuirle el contacto a un vendedor. Esto ya no es una vCard — es un producto distinto y hay que decidir si vive aquí o aparte.

---

# ADENDA — decisiones cerradas 2026-11-02

## 11. Planes y precios (decidido: aplicar §4 tal cual)

Tope gratis: **3 ítems × 2 fotos**. Plan pago: **30 ítems × 8 fotos**, estadísticas, ítems privados.

**Regla de precio adoptada: nunca números redondos.** Un precio con decimales se lee como cálculo, no como cifra inventada, y es más difícil de regatear. En Perú además se percibe más barato por el efecto del dígito izquierdo.

Propuesta inicial (a validar contra competencia antes de publicar):

| Plan | Precio |
|---|---|
| Gratis | S/ 0 |
| Pro mensual | **S/ 19.90** |
| Pro anual | **S/ 189.00** (equivale a S/ 15.75/mes — el ahorro se muestra explícito) |

Nunca "S/ 20" ni "S/ 200". El anual siempre se presenta con su equivalente mensual al lado: el cerebro compara mensual contra mensual.

## 12. Landing — demo semi-interactiva (decidido)

El botón "Ver demo" no lleva a un solo perfil. Abre un **mini-flujo en HTML con datos de ejemplo**, con dos caminos:

1. **Profesional** — perfil tipo Luis (desarrollador) o dentista: foto, cargo, portafolio de trabajos, botón de agendar cita.
2. **Negocio / local** — restaurante o tienda: carta o catálogo en el carrusel, ubicación, WhatsApp, horario.

Requisitos:
- Datos **demo embebidos**, sin Supabase ni backend. Es una maqueta, no una cuenta real.
- Capturas de pantalla reales donde no haga falta interacción — es más rápido de construir y más rápido de cargar.
- Diseño moderno, animaciones **ligeras** (transiciones CSS, `prefers-reduced-motion` respetado). Sin librerías pesadas de animación.
- Debe funcionar bien en móvil, que es donde se escanea un QR.

## 13. Fase siguiente al landing: tarjeta de presentación IMPRESA

**Hallazgo de negocio, no de producto:** la mayoría de la gente en Perú todavía pide tarjeta física. El QR no reemplaza la tarjeta — **viaja impreso dentro de ella**. Y como el QR es único y permanente, se puede imprimir por millar una sola vez: los datos cambian en la web, el papel no caduca.

Eso convierte al producto en algo que las apps extranjeras no dan: **no solo tu perfil digital, también tu tarjeta física lista para imprenta.**

Alcance del módulo "Diseña tu tarjeta impresa":
- Editor **simple**, estilo Canva pero reducido: 4–6 plantillas, no un lienzo libre.
- Estética: **elegante por sobriedad** — mucho espacio en blanco, una tipografía, un acento de color, el QR como elemento central y limpio.
- Campos jalados automáticamente del perfil (nombre, cargo, empresa, teléfono, QR). El usuario no vuelve a escribir nada.
- Salida: **PDF listo para imprenta** — tamaño 90×50mm (estándar Perú), 300dpi, márgenes de seguridad y sangrado de 3mm, CMYK si es posible.
- Vista previa de ambas caras.
- Esto es **funcionalidad de plan pago**, sin discusión: es el momento de mayor valor percibido de todo el producto.

Posible extensión comercial: alianza con una imprenta de Lima, el usuario pide el millar desde la web. Eso ya no es software — es margen por pedido. A evaluar después.
