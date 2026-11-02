import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { apiFetch, setUnauthorizedHandler, SESSION_EXPIRED_MESSAGE } from "../services/api";

const AuthContext = createContext(null);

const SESSION_KEY = "transito_auth";

function loadStoredAuth() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadStoredAuth);
  // Aviso para la pantalla de login cuando la sesión se cerró porque el backend rechazó el token.
  const [notice, setNotice] = useState("");

  const login = useCallback(async (username, password) => {
    // auth: false porque login es el único endpoint que no requiere token
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: { username, password },
      auth: false,
    });

    const nextAuth = {
      token: data.token,
      role: data.role,
      username,
      // Hoy no hay refresh token: cuando se cumpla expiresInSeconds
      // hay que volver a loguear (si el backend rechaza el token, ver setUnauthorizedHandler).
      expiresAt: Date.now() + data.expiresInSeconds * 1000,
    };

    sessionStorage.setItem("transito_token", nextAuth.token);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextAuth));
    setNotice("");
    setAuth(nextAuth);
    return nextAuth;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("transito_token");
    sessionStorage.removeItem(SESSION_KEY);
    setAuth(null);
  }, []);

  // Un 401 de cualquier pedido autenticado cierra la sesión y deja el aviso en el login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      setNotice(SESSION_EXPIRED_MESSAGE);
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const isExpired = !auth || Date.now() > auth.expiresAt;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !isExpired,
        role: auth?.role ?? null,
        username: auth?.username ?? null,
        notice,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
