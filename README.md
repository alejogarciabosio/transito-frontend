# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Levanta el front en `http://localhost:5173` contra `VITE_API_BASE_URL` (por defecto `http://localhost:8080`) |
| `npm test` | Corre los tests (Vitest + Testing Library, con un backend simulado en `src/test/fakeApi.js`) |
| `npm run test:coverage` | Tests con reporte de cobertura; falla por debajo del 85 % de líneas |
| `npm run build` | Build de producción; en Railway la URL del backend llega por el `ARG VITE_API_BASE_URL` del `Dockerfile` |

## Estructura del código (`src/`)

| Carpeta / archivo | Qué contiene |
| --- | --- |
| `App.jsx` | Login o, con sesión, la aplicación completa |
| `AuthenticatedApp.jsx` | Estado y carga de datos de la sesión (Portal Vecino y Panel Interno) |
| `features/citizen/` | Pantallas del portal del vecino |
| `features/staff/` | Pantallas del panel interno (inspector, administrador, auditor) con sus formularios |
| `components/` | Piezas compartidas: `ui.jsx` (botones, tablas, diálogos), `Header`, `Footer`, `Login`, `ErrorBoundary` |
| `services/` | Pedidos a la API del backend (único lugar que habla con él) |
| `hooks/`, `lib/`, `constants.js` | Carga de datos, formatos y mapeos de la API, textos y catálogos |
| `context/` | Sesión del usuario (`AuthProvider`, `useAuth`) |
| `test/` | Tests y backend simulado (`fakeApi.js`) |
