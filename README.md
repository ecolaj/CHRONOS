# Órbita — progreso del año

App web (PWA) que muestra, en tiempo real, qué porcentaje del año ha transcurrido — o qué porcentaje falta — a partir de la fecha y hora del propio dispositivo. Funciona igual en iOS y Android porque corre dentro del navegador, pero se instala como una app real (ícono en el home, pantalla completa, sin barra de navegador).

## Qué incluye

- Anillo tipo "órbita": un punto recorre un círculo a lo largo del año, con marcas para cada mes.
- Porcentaje grande en el centro, con 0, 2 o 4 decimales a elección.
- Interruptor **Transcurrido / Restante**.
- 5 temas de color predefinidos: Medianoche, Aurora, Papel, Terminal, Marea.
- Ajustes: mostrar/ocultar el conteo de días, fondo animado de estrellas, y mantener la pantalla encendida (Wake Lock, donde el navegador lo soporte).
- Funciona sin conexión una vez instalada (service worker).
- Todo el cálculo se hace en el dispositivo del usuario — no hay backend ni se envían datos a ningún lado.

## Probarla ahora mismo

Abrí `index.html` directamente en el navegador del teléfono o la compu. Va a funcionar, pero para poder "instalarla" como app de verdad (ícono, pantalla completa, offline) los navegadores exigen que esté servida por **https** — abrir el archivo local no alcanza.

## Publicarla gratis (recomendado)

La forma más simple es subir la carpeta completa a un hosting estático gratuito. Cualquiera de estas opciones te da una URL https en minutos, sin necesidad de saber programar:

**Netlify (arrastrar y soltar)**
1. Entrá a https://app.netlify.com/drop
2. Arrastrá la carpeta `year-progress` completa a la página.
3. Te da una URL (ej. `https://algo-random.netlify.app`) — esa es tu app.

**Vercel / GitHub Pages** funcionan igual de bien si ya los usás.

## Instalarla en el celular

**iOS (Safari):**
1. Abrí la URL de tu app en Safari (tiene que ser Safari, no Chrome).
2. Tocá el ícono de compartir (el cuadrado con la flecha hacia arriba).
3. "Añadir a pantalla de inicio".

**Android (Chrome):**
1. Abrí la URL en Chrome.
2. Tocá el menú (⋮) → "Instalar app" (o aparece un banner automático abajo).

Una vez instalada, abre en pantalla completa, con su propio ícono, sin barra de direcciones — se siente como una app nativa.

## Estructura del proyecto

```
year-progress/
├── index.html          → estructura de la app
├── css/styles.css       → estilos y los 5 temas de color
├── js/app.js             → cálculo del % del año, ajustes, animaciones
├── manifest.json        → metadata para instalar como PWA
├── sw.js                 → service worker (funcionamiento offline)
└── icons/                → íconos de la app (192, 512, maskable, apple-touch)
```

## Personalizar

- **Agregar un tema de color:** editá `css/styles.css` (agregá un bloque `body[data-theme="tunombre"] { ... }` con las mismas variables que los otros temas) y sumá el objeto correspondiente al arreglo `THEMES` en `js/app.js`.
- **Cambiar el color por defecto:** cambiá `data-theme="medianoche"` en el `<body>` de `index.html` y `defaults.theme` en `js/app.js`.
- **Regenerar los íconos** con otro color: editá y volvé a correr el script de Python que generó `icons/` (te lo puedo pasar si lo necesitás).
