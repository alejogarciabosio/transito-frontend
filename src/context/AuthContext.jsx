import { useState, useCallback, useEffect } from "react";
import { apiFetch, setUnauthorizedHandler, SESSION_EXPIRED_MESSAGE } from "../services/api";

import { AuthContext } from "./auth-context";

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

  // Cuando se cumple el vencimiento del token (no hay refresh) se cierra la sesión sola,
  // sin esperar a que el próximo pedido reciba un 401.
  useEffect(() => {
    if (!auth) return undefined;
    const MAX_TIMEOUT = 2 ** 31 - 1;
    const timer = setTimeout(
      () => {
        logout();
        setNotice(SESSION_EXPIRED_MESSAGE);
      },
      Math.min(MAX_TIMEOUT, Math.max(0, auth.expiresAt - Date.now()))
    );
    return () => clearTimeout(timer);
  }, [auth, logout]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!auth,
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
