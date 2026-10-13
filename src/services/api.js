// Cliente HTTP centralizado para hablar con el backend de Tránsito.
// Agrega automáticamente el header Authorization cuando hay token,
// y traduce el formato de error del backend (Problem Details, RFC 9457)
// en un ApiError manejable desde los componentes.

// VITE_API_BASE_URL es solo el origen (ej. http://localhost:8080).
// El prefijo de versión vive acá, en un único lugar, para que nadie tenga
// que tocar su .env cuando cambie.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  constructor(status, message, type) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    // URL que identifica el tipo de problema (ej. .../problems/invalid-state-transition)
    this.type = type;
  }
}

function getToken() {
  return sessionStorage.getItem("transito_token");
}

/**
 * DNI del usuario logueado, leído del claim `nationalId` del JWT.
 * Solo para mostrar información en pantalla: la autorización real
 * la hace siempre el backend con el token.
 */
export function getCurrentNationalId() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).nationalId ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {string} path - sin prefijo de versión, ej: "/infractions" o "/infractions/123"
 * @param {object} options
 * @param {"GET"|"POST"|"PATCH"|"PUT"|"DELETE"} [options.method]
 * @param {object} [options.body]
 * @param {boolean} [options.auth] - false para endpoints públicos (default: true)
 */
export async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Error de red (backend caído, CORS, sin conexión, etc.)
    throw new ApiError(0, "No se pudo conectar con el servidor. Intentá nuevamente.");
  }

  if (response.status === 204) return null;

  // Las respuestas de error vienen como application/problem+json;
  // response.json() las parsea igual que application/json.
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.detail || data?.title || `Error ${response.status}`;
    throw new ApiError(response.status, message, data?.type);
  }

  return data;
}
