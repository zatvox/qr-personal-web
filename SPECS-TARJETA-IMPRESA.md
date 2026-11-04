# SPECS — Módulo "Diseña tu tarjeta impresa"
**Proyecto:** Personal-vcard-web (TARJE) · **Fecha:** 2026-11-02
**Fase:** la siguiente después del portafolio y el landing. **Es funcionalidad de plan Pro.**

---

## 0. Por qué existe este módulo

La mayoría de la gente en Perú todavía pide tarjeta física. El QR no reemplaza la tarjeta: **viaja impreso dentro de ella.**

Y como el QR es permanente, el papel deja de caducar: se manda a imprimir el millar **una sola vez** y los datos se cambian en la web. Cambias de cargo, de teléfono o de empresa y la tarjeta impresa sigue sirviendo.

**Ventaja competitiva real:** ninguna app extranjera del rubro entrega el archivo listo para imprenta local, porque no conocen los formatos de acá. Esto no lo copian fácil.

---

## 1. Principio de diseño: elegante por sobriedad

No es un Canva. **Es un generador con 4–6 plantillas fijas, no un lienzo libre.**

Razón: un lienzo libre produce tarjetas feas. Una plantilla bien hecha produce tarjetas dignas siempre. Y el usuario que quiere libertad total ya usa Canva — ese no es el cliente de este módulo.

Reglas estéticas que no se negocian:
- **Mucho espacio en blanco.** El aire es lo que hace que algo se vea caro.
- **Una sola tipografía** por tarjeta (la que ya eligió en su perfil).
- **Un solo acento de color** (el que ya eligió en su perfil).
- **El QR es el elemento central del reverso**, limpio y con su zona de silencio respetada.
- Sin degradados, sin sombras, sin marcos decorativos.

---

## 2. Especificación técnica de imprenta

| Parámetro | Valor | Por qué |
|---|---|---|
| **Formato** | 90 × 50 mm | Estándar de tarjeta en Perú |
| **Sangrado (bleed)** | 3 mm por lado → lienzo real **96 × 56 mm** | La guillotina nunca corta exacto |
| **Margen de seguridad** | 4 mm hacia adentro del corte | Nada de texto fuera de ahí |
| **Resolución** | **300 dpi** mínimo | Por debajo se ve pixelado impreso |
| **Color** | Entregar **RGB**, advertir sobre CMYK (ver §5) | |
| **Salida** | **PDF de alta calidad**, una página por cara (2 páginas) | Es el formato que toda imprenta acepta |
| **Fuentes** | **Incrustadas (embedded)** en el PDF | Si no, la imprenta las sustituye y se desarma el diseño |
| **Marcas de corte** | Opcionales, como casilla marcable | Algunas imprentas las piden, otras las rechazan |

### 2.1 El QR — lo más delicado

- **Tamaño mínimo impreso: 20 × 20 mm.** Por debajo, los celulares viejos fallan.
- **Zona de silencio:** margen blanco alrededor de al menos 4 módulos del propio QR. Sin eso, no lee.
- **Corrección de error nivel Q (25%)**, no L. En papel el QR se raya, se dobla y se mancha; Q lo aguanta.
- **Vectorial dentro del PDF**, nunca una imagen PNG escalada.
- **Contraste obligatorio:** oscuro sobre claro. Nunca claro sobre oscuro, nunca el QR sobre una foto.

---

## 3. Qué va en cada cara

**Anverso** — jala todo del perfil, el usuario no reescribe nada:
- Nombre completo
- Cargo
- Empresa (si la tiene)
- Teléfono / WhatsApp
- Email (solo si tiene `mostrar_email` activo)
- Logo o avatar, opcional

**Reverso:**
- El QR, grande y centrado
- Una línea corta: "Escanea para ver mi perfil completo"
- La URL en texto, chiquita, como respaldo para quien no sabe escanear

> El respaldo en texto importa más de lo que parece: tu cliente de 55 años no va a escanear nada, pero sí va a escribir la dirección.

---

## 4. Plantillas propuestas (4 para arrancar)

| # | Nombre | Descripción |
|---|---|---|
| 1 | **Mínima** | Todo alineado a la izquierda, mucho aire, solo el nombre destacado |
| 2 | **Centrada** | Simétrica y formal — la que mejor le queda a salud y legal |
| 3 | **Banda** | Una franja de color sólido con el acento del perfil, el resto en blanco |
| 4 | **Oscura** | Fondo tinta, texto claro. Para creativos y tecnología |

Vista previa de ambas caras antes de descargar, siempre.

---

## 5. Advertencias que hay que decirle al usuario (en la propia pantalla)

1. **RGB vs CMYK.** El PDF sale en RGB. Los colores impresos se van a ver un poco más apagados que en pantalla, sobre todo los violetas y los verdes brillantes. Esto es normal y le pasa a todo el mundo; conviene decirlo antes y no después de que imprima mil.
2. **Imprime una prueba antes del millar.** Una sola tarjeta de prueba cuesta centavos y evita mil tarjetas con un dígito mal.
3. **Escanea la prueba con dos celulares distintos**, uno viejo si se puede. Es la única forma de estar seguro.

---

## 6. Alcance técnico

**Generación en el navegador, sin servidor** — mismo criterio que el resto del sistema.

- Librería candidata: **jsPDF** (ya se usa en el ERP para los PDF de packing, o sea que ya conoces su comportamiento).
- **Precaución conocida:** `html2canvas` no renderiza `background-clip:text` ni algunos degradados. Por eso las plantillas deben construirse **dibujando en el PDF directamente**, no capturando HTML. Es más trabajo pero es la única forma de garantizar 300 dpi reales.
- El QR se genera vectorial y se inserta como path, no como imagen.

| Trabajo | Riesgo |
|---|---|
| Motor de dibujo del PDF a medidas reales | Medio |
| Las 4 plantillas | Bajo, una vez que el motor existe |
| QR vectorial con nivel Q y zona de silencio | **Alto — es donde se rompe todo si sale mal** |
| Vista previa en pantalla | Bajo |
| Bloqueo por plan (solo Pro) | Bajo |

---

## 7. Criterio de terminado

- [ ] El PDF abre en Acrobat y reporta **96 × 56 mm** con sangrado.
- [ ] Las fuentes están incrustadas (se verifica en Propiedades del documento).
- [ ] El QR impreso en papel común **lee con un celular de gama baja**.
- [ ] Nada de texto cae dentro de los 4 mm de margen de seguridad.
- [ ] Una imprenta real acepta el archivo sin pedir cambios. *Esta es la única prueba que cuenta.*

---

## 8. Extensión comercial (evaluar después, no ahora)

Alianza con una imprenta de Lima: el usuario pide el millar desde la propia web y tú cobras margen por pedido. **Eso ya no es software, es otro negocio** — con logística, reclamos y capital de trabajo. Anotado, pero no se decide en esta fase.

---

# ANEXO — Dos pendientes del landing de TARJE
*(van en esta sesión de código porque son del mismo proyecto)*

## A. Conectar "Ver un ejemplo real" al perfil de Luis

Hoy ese botón del hero no lleva a ningún lado útil. Debe llevar al perfil real y publicado de Luis, que es **el mejor anuncio del producto**: el visitante ve exactamente lo que va a tener.

**Cómo hacerlo:**

1. En `assets/js/landing.js`, junto a `MARCA`, agregar una constante:
   ```js
   /* Perfil real que se muestra como ejemplo vivo del producto. */
   const PERFIL_DEMO = 'pages/perfil.html?u=<slug-de-luis>';
   ```
   Reemplazar `<slug-de-luis>` por el slug real de su cuenta.

2. En `index.html`, marcar el botón:
   ```html
   <a class="lp-btn lp-btn--ghost lp-btn--lg" href="#" data-perfil>Ver un ejemplo real</a>
   ```

3. En el arranque del script:
   ```js
   document.querySelectorAll('[data-perfil]').forEach(el => {
     el.href = PERFIL_DEMO;
     el.target = '_blank';
     el.rel = 'noopener';
   });
   ```

**Detalle que importa:** abrir en pestaña nueva, no reemplazar el landing. Si se lo lleva fuera de la página de venta, se pierde la conversión.

---

## B. Reemplazar los emojis del portafolio demo por capturas reales

Hoy las tarjetas de la demo usan emojis como marcador de posición. Funcionan para probar el layout, pero **en producción restan credibilidad**: un visitante que ve emojis entiende que no hay producto real detrás.

**Qué se necesita:**

| Dato | Detalle |
|---|---|
| Cuántas | 3 por cada camino de la demo (profesional y negocio) = 6 en total |
| Formato | **WebP**, 1600 px de lado largo, ~200 KB |
| Proporción | **4:3 horizontal**, todas iguales — si se mezclan proporciones el carrusel salta |
| Ruta | `assets/img/demo/` |
| Nombre | `prof-1.webp` … `prof-3.webp`, `neg-1.webp` … `neg-3.webp` |

**Cambio en el código:** en el objeto `DEMOS` de `landing.js`, cada ítem cambia `ico` (emoji) y `bg` (color de fondo) por un solo campo `img` con la ruta. El `renderPerfil()` pasa de pintar un emoji centrado a pintar un `<img loading="lazy">` con `object-fit:cover`.

**Qué capturas usar:**
- **Profesional:** el perfil de alguien con portafolio de trabajos. Lo ideal es el de Luis.
- **Negocio:** un perfil con carta o catálogo en el carrusel.

> Si todavía no hay perfiles reales de terceros, sirve crear dos cuentas de prueba con datos ficticios y capturarlas. Lo que no se vale es inventar clientes, testimonios o cifras: capturas de producto sí, clientes falsos no.
