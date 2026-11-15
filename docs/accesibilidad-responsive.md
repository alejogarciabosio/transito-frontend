# Accesibilidad y responsive (Eje A, P1)

Criterio: responsive verificado a 360, 768 y 1280 px; accesibilidad con Lighthouse/axe >= 90, sin violaciones críticas (WCAG 2.2 AA).

## Cómo se midió
- Front compilado (`npm run build`) servido por un servidor local de auditoría que responde `/api/v1` con la API simulada de `src/test/fakeApi.js`. Sin backend real ni producción.
- `node scripts/a11y/axe.mjs [salida.json]`: axe (`@axe-core/playwright`, tags wcag2a/2aa/21a/21aa/22aa + best-practice), desborde horizontal y objetivos táctiles menores a 24x24 px (WCAG 2.5.8). Sale con código 1 si hay violaciones críticas/graves o desborde.
- `node scripts/a11y/lighthouse.mjs [salida.json]`: Lighthouse (categoría Accesibilidad) en modo snapshot sobre el chromium de Playwright. Se usa el modo snapshot porque la app es una SPA con sesión (la navegación no cambia la URL), así que no se puede reabrir por URL con la CLI. Sale con 1 si algún puntaje es menor a 90.
- Ambos recorren 16 pantallas x 3 anchos: login (vecino y personal), portal (inicio, infracciones, detalle de infracción, descargo, estacionamiento, vehículos), inspector (dashboard, infracciones, registrar infracción, operativos) y administrador (dashboard, infracciones, cortes, estacionamiento).
- Chromium 159 headless de Playwright, axe-core de `@axe-core/playwright`, Lighthouse del `package.json`. No están en el CI todavía.

## Resultado antes / después
Resumen: axe pasó de 2 a 6 violaciones por pantalla (incluida 1 crítica `select-name` en el panel interno a 360/768 px) a 0 en las 48 combinaciones. Lighthouse pasó de 79-97 a 100 en las 48. Desborde horizontal: 0 px en todos los casos, antes y después. Objetivos táctiles menores a 24 px: de 5 en el portal a 0.

| Pantalla | Ancho | axe antes (total / crít.+graves) | axe después | Lighthouse antes → después | Desborde horiz. | Táctiles <24 px antes → después |
|---|---|---|---|---|---|---|
| login | 360 | 2 / 0 | 0 / 0 | 97 → 100 | 0 px | 0 → 0 |
| login | 768 | 2 / 0 | 0 / 0 | 97 → 100 | 0 px | 0 → 0 |
| login | 1280 | 2 / 0 | 0 / 0 | 97 → 100 | 0 px | 0 → 0 |
| login-personal | 360 | 2 / 0 | 0 / 0 | 97 → 100 | 0 px | 0 → 0 |
| login-personal | 768 | 2 / 0 | 0 / 0 | 97 → 100 | 0 px | 0 → 0 |
| login-personal | 1280 | 2 / 0 | 0 / 0 | 97 → 100 | 0 px | 0 → 0 |
| portal-inicio | 360 | 3 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-inicio | 768 | 3 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-inicio | 1280 | 3 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-infracciones | 360 | 4 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-infracciones | 768 | 4 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-infracciones | 1280 | 4 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-estacionamiento | 360 | 4 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-estacionamiento | 768 | 4 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-estacionamiento | 1280 | 4 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-vehiculos | 360 | 4 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-vehiculos | 768 | 4 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-vehiculos | 1280 | 4 / 1 | 0 / 0 | 93 → 100 | 0 px | 5 → 0 |
| portal-detalle-infraccion | 360 | 3 / 2 | 0 / 0 | 89 → 100 | 0 px | 5 → 0 |
| portal-detalle-infraccion | 768 | 3 / 2 | 0 / 0 | 89 → 100 | 0 px | 5 → 0 |
| portal-detalle-infraccion | 1280 | 3 / 2 | 0 / 0 | 89 → 100 | 0 px | 5 → 0 |
| portal-descargo | 360 | 3 / 2 | 0 / 0 | 88 → 100 | 0 px | 5 → 0 |
| portal-descargo | 768 | 3 / 2 | 0 / 0 | 88 → 100 | 0 px | 5 → 0 |
| portal-descargo | 1280 | 3 / 2 | 0 / 0 | 88 → 100 | 0 px | 5 → 0 |
| inspector-dashboard | 360 | 5 / 2 | 0 / 0 | 83 → 100 | 0 px | 0 → 0 |
| inspector-dashboard | 768 | 5 / 2 | 0 / 0 | 83 → 100 | 0 px | 0 → 0 |
| inspector-dashboard | 1280 | 5 / 1 | 0 / 0 | 91 → 100 | 0 px | 0 → 0 |
| inspector-infracciones | 360 | 6 / 3 | 0 / 0 | 79 → 100 | 0 px | 0 → 0 |
| inspector-infracciones | 768 | 5 / 2 | 0 / 0 | 79 → 100 | 0 px | 0 → 0 |
| inspector-infracciones | 1280 | 5 / 1 | 0 / 0 | 88 → 100 | 0 px | 0 → 0 |
| inspector-operativos | 360 | 5 / 2 | 0 / 0 | 79 → 100 | 0 px | 0 → 0 |
| inspector-operativos | 768 | 5 / 2 | 0 / 0 | 79 → 100 | 0 px | 0 → 0 |
| inspector-operativos | 1280 | 5 / 1 | 0 / 0 | 88 → 100 | 0 px | 0 → 0 |
| inspector-registrar-infraccion | 360 | 4 / 3 | 0 / 0 | 91 → 100 | 0 px | 0 → 0 |
| inspector-registrar-infraccion | 768 | 3 / 2 | 0 / 0 | 91 → 100 | 0 px | 0 → 0 |
| inspector-registrar-infraccion | 1280 | 3 / 1 | 0 / 0 | 96 → 100 | 0 px | 0 → 0 |
| admin-dashboard | 360 | 5 / 2 | 0 / 0 | 83 → 100 | 0 px | 0 → 0 |
| admin-dashboard | 768 | 5 / 2 | 0 / 0 | 83 → 100 | 0 px | 0 → 0 |
| admin-dashboard | 1280 | 5 / 1 | 0 / 0 | 91 → 100 | 0 px | 0 → 0 |
| admin-infracciones | 360 | 6 / 3 | 0 / 0 | 79 → 100 | 0 px | 0 → 0 |
| admin-infracciones | 768 | 5 / 2 | 0 / 0 | 79 → 100 | 0 px | 0 → 0 |
| admin-infracciones | 1280 | 5 / 1 | 0 / 0 | 88 → 100 | 0 px | 0 → 0 |
| admin-cortes | 360 | 5 / 2 | 0 / 0 | 79 → 100 | 0 px | 0 → 0 |
| admin-cortes | 768 | 5 / 2 | 0 / 0 | 79 → 100 | 0 px | 0 → 0 |
| admin-cortes | 1280 | 5 / 1 | 0 / 0 | 88 → 100 | 0 px | 0 → 0 |
| admin-estacionamiento | 360 | 6 / 3 | 0 / 0 | 79 → 100 | 0 px | 0 → 0 |
| admin-estacionamiento | 768 | 5 / 2 | 0 / 0 | 79 → 100 | 0 px | 0 → 0 |
| admin-estacionamiento | 1280 | 5 / 1 | 0 / 0 | 88 → 100 | 0 px | 0 → 0 |

## Qué se cambió (solo CSS, markup, ARIA y etiquetas; sin lógica, API ni rutas)
- Contraste: `text-slate-400` pasó a `slate-500`, `slate-500` a `slate-600` y `text-red-600` a `red-700` (insignias, errores, botón peligro) sobre fondos claros. El menú lateral oscuro usa `slate-400`.
- Landmarks: `<main>` en el login, el portal y el panel interno; `aria-label` en cada `<nav>`; el selector de sección móvil quedó dentro de un `<nav>`.
- Encabezados: un `h1` por pantalla (títulos de sección y "Panel de indicadores"); el título de los modales pasó a `h2`.
- Etiquetas: `aria-label` en el `<select>` del panel interno y en el buscador del portal; grupo `aria-label` y `aria-pressed` en el selector de perfil del login; `role="dialog"` y botón "Cerrar" con nombre en el panel de detalle de infracción.
- Tablas con desplazamiento horizontal: enfocables con teclado (`tabIndex=0`, `role="group"` con nombre).
- Foco: `:focus-visible` con contorno visible de 2 px en `src/index.css` (antes `outline-none` con un anillo casi invisible). Se respeta `prefers-reduced-motion`.
- Objetivos táctiles: botones "Volver al inicio", enlaces del pie, botones de cerrar y buscador con altura mínima de 24 px o más.
- `lang="es"` y `<title>` ya estaban correctos en `index.html`.

## Pendiente / límites
- El título de la página (`<title>`) es fijo ("Tránsito UADE") en todas las pantallas. Cambiarlo por pantalla exige lógica (un efecto), fuera del alcance de este cambio.
- La navegación del portal y del panel es por estado y no por URL (sin enlaces ni botón Atrás del navegador). Es un tema de diseño/lógica, no de markup.
- Las filas de las tablas son clicables con el mouse (`onClick` en `<tr>`) pero no se pueden activar con teclado. Arreglarlo requiere cambiar el comportamiento (botón o `onKeyDown`).
- axe y Lighthouse detectan una parte de los problemas WCAG; falta una prueba manual con lector de pantalla (NVDA/VoiceOver) y con zoom 200 % y texto agrandado.
- Lighthouse solo mide accesibilidad en modo snapshot; rendimiento y mejores prácticas no se midieron.
- Los scripts de auditoría no están en el CI. Sumar los dos pasos (`build` y luego `axe.mjs` y `lighthouse.mjs`) es sencillo; hay que instalar el chromium de Playwright (`npx playwright install chromium`).
- Se usaron datos simulados: pantallas con estados vacíos, de error o de carga no se auditaron.
