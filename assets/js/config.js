// ============================================================
// CONFIG — Valores editables del sistema (cero hardcode disperso)
// Reemplazar SUPABASE_URL y SUPABASE_ANON_KEY con los de tu proyecto.
// El ANON key es seguro para exponer en frontend (protegido por RLS).
// NUNCA pongas aquí el service_role_key.
// ============================================================

export const CONFIG = {
  SUPABASE_URL: 'https://xhhazsciafiurnshtvpk.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoaGF6c2NpYWZpdXJuc2h0dnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxOTEyMTgsImV4cCI6MjA5ODc2NzIxOH0.iGM88zyTGsy80LKwNh8rJmXE_z2zxa4JD1QisYD7uII',

  // Dominio base público (para armar el link corto /u/slug del QR).
  // Se calcula como la raíz del repo (usuario.github.io/nombre-repo),
  // sin importar desde qué página (index, pages/dashboard.html, etc.)
  // se cargue este archivo — así el link nunca arrastra "/pages/...".
  // Ver 404.html (ADR-003): las rutas /u/slug redirigen desde la raíz.
  SITE_BASE_URL: (() => {
    const segmentos = window.location.pathname.split('/').filter(Boolean);
    const repo = segmentos[0] || ''; // primer segmento = nombre del repo (project pages)
    return window.location.origin + (repo ? '/' + repo : '');
  })(),

  // Wizard
  TOAST_DURATION_MS: 4000,
  TOAST_MENSAJE: 'Regístrate para que puedas generar tu QR',
  DRAFT_STORAGE_KEY: 'vcard_wizard_draft_v2',

  // Galería y avatar — límites pensados para maximizar la capacidad
  // del free tier de Supabase Storage (1GB) con muchos usuarios.
  // Ver docs/ARQUITECTURA-VCARD.md 3.4 y ADR-005: toda imagen se
  // redimensiona/comprime en el navegador ANTES de subirse.
  GALERIA_MAX_FOTOS: 6,
  GALERIA_MAX_MB: 2,          // límite del archivo ORIGINAL antes de comprimir
  AVATAR_MAX_MB: 3,           // límite del archivo ORIGINAL antes de comprimir
  GALERIA_RESIZE_MAX_PX: 1080,
  GALERIA_JPEG_CALIDAD: 0.72, // ~150-350KB típico por foto ya comprimida
  AVATAR_RESIZE_MAX_PX: 512,
  AVATAR_JPEG_CALIDAD: 0.82,  // ~40-120KB típico
  POST_COMPRESION_MAX_KB: 700, // tope de seguridad tras comprimir (casos raros)

  // Avatar elegido ANTES de crear la cuenta (wizard): se guarda como
  // miniatura base64 dentro de user_metadata (no hay Storage disponible
  // todavía porque el usuario no existe como auth.users confirmado).
  // Debe ser pequeña para no inflar el JWT de sesión (ver ADR-007).
  AVATAR_THUMBNAIL_MAX_PX: 160,
  AVATAR_THUMBNAIL_JPEG_CALIDAD: 0.55, // objetivo: <15KB

  // Paletas preset de la sección "Diseño": cada una es un par de
  // colores (primario + secundario) que el usuario puede tomar tal
  // cual o editar libremente con los campos de hex. El color de
  // texto sobre estos fondos se calcula automáticamente (blanco u
  // oscuro, el que dé mejor contraste) — ver utils.colorTextoLegible
  // y ADR-006.
  PALETAS_PRESET: [
    { label: 'Azul y Verde',    primary: '#5C7FD6', secondary: '#4FAE8C' },
    { label: 'Claro y Oscuro',  primary: '#F1F0F5', secondary: '#232421' },
    { label: 'Cielo',           primary: '#CFE4FB', secondary: '#4C6FCF' },
    { label: 'Lavanda',         primary: '#C9B8F5', secondary: '#232421' },
    { label: 'Menta',           primary: '#8FD9B0', secondary: '#232421' },
    { label: 'Durazno',         primary: '#EDC472', secondary: '#232421' },
  ],
  TEMA_PRIMARIO_DEFECTO: '#C9B8F5',
  TEMA_SECUNDARIO_DEFECTO: '#232421',

  // Fuentes disponibles para "Título" y "Textos" (Google Fonts, gratis).
  // Debe coincidir exactamente con el CHECK constraint de la DB
  // (tema_fuente_titulo_valida / tema_fuente_texto_valida).
  FUENTES_DISPONIBLES: [
    'Poppins', 'Inter', 'Montserrat', 'Playfair Display', 'Roboto',
    'Lora', 'Nunito', 'Space Grotesk', 'Merriweather', 'Work Sans',
    'Raleway', 'Oswald', 'Quicksand', 'DM Sans', 'Bebas Neue',
    'Josefin Sans', 'Caveat', 'Abril Fatface', 'Fira Sans', 'Ubuntu',
  ],
  FUENTE_TITULO_DEFECTO: 'Poppins',
  FUENTE_TEXTO_DEFECTO: 'Inter',

  // Redes sociales soportadas (clave -> etiqueta + icono)
  REDES_SOCIALES: [
    { key: 'instagram', label: 'Instagram' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'x', label: 'X (Twitter)' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'tiktok', label: 'TikTok' },
    { key: 'web', label: 'Sitio web' },
  ],

  // Buckets de Storage
  BUCKET_AVATARS: 'avatars',
  BUCKET_GALLERY: 'gallery',

  // Días de la semana para el horario de atención / módulo de citas.
  // "valor" debe coincidir exactamente con el CHECK dias_atencion_validos
  // de la DB y con los nombres usados en la función crear_cita().
  DIAS_SEMANA: [
    { valor: 'lunes', label: 'Lun' },
    { valor: 'martes', label: 'Mar' },
    { valor: 'miercoles', label: 'Mié' },
    { valor: 'jueves', label: 'Jue' },
    { valor: 'viernes', label: 'Vie' },
    { valor: 'sabado', label: 'Sáb' },
    { valor: 'domingo', label: 'Dom' },
  ],
  DURACION_CITA_DEFECTO: 30,
  DURACIONES_CITA_DISPONIBLES: [15, 30, 45, 60, 90, 120],

  // EmailJS (https://www.emailjs.com) — envía un correo al dueño del
  // perfil cuando alguien agenda una cita, 100% desde el navegador del
  // visitante (sin backend propio). Plan gratuito: ~200 emails/mes.
  // Deja estos 3 campos vacíos si no quieres activar la notificación
  // por correo; el módulo de citas funciona igual (la cita queda
  // guardada y visible en el dashboard), solo no se envía el aviso.
  // Pasos: crea cuenta gratis en emailjs.com -> Email Service -> Email
  // Template (variables sugeridas: to_email, nombre_perfil, nombre_solicitante,
  // email_solicitante, fecha, hora, descripcion) -> copia aquí tus IDs.
  EMAILJS_PUBLIC_KEY: '',
  EMAILJS_SERVICE_ID: '',
  EMAILJS_TEMPLATE_ID: '',
};
