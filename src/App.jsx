/**
 * Módulo 7 — Tránsito, Estacionamiento y Seguridad Vial.
 * Punto de entrada de la interfaz: muestra el login o, con sesión, la aplicación completa
 * (Portal Vecino y Panel Interno), que vive en AuthenticatedApp.jsx. Cada pantalla está en
 * features/citizen y features/staff; lo compartido, en components/, hooks/, lib/ y constants.js.
 */
import { useAuth } from "./context/useAuth";
import Login from "./components/Login";
import { AuthenticatedApp } from "./AuthenticatedApp.jsx";

export default function App() {
  const { isAuthenticated, role, username, logout } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  // key={`${role}:${username}`} obliga a React a desmontar y volver a montar
  // este componente cada vez que cambia quién está logueado, para que no
  // quede colgado ningún estado de la sesión anterior (modo activo, vista
  // seleccionada, etc.). Sin esto, un inspector que entra al Panel interno
  // y luego se desloguea para entrar como vecino seguía viendo el panel
  // interno, porque React no remonta el componente solo por loguear/
  // desloguear: reutiliza el mismo estado que había quedado seteado.
  return <AuthenticatedApp key={`${role}:${username}`} role={role} username={username} onLogout={logout} />;
}
