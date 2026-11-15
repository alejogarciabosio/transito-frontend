// Cliente HTTP centralizado para hablar con el backend de Tránsito.
// Agrega automáticamente el header Authorization cuando hay token,
// y traduce el formato de error del backend (Problem Details, RFC 9457)
// en un ApiError manejable desde los componentes.

// VITE_API_BASE_URL es solo el origen (ej. http://localhost:8080).
// El prefijo de versión vive acá, en un único lugar, para que nadie tenga
// que tocar su .env cuando cambie.
// localhost es el valor por defecto SOLO en desarrollo (npm run dev). En un build
// de producción sin la variable, queda vacío y los pedidos van al mismo origen del
// front: falla enseguida y se nota, en vez de apuntar en silencio a localhost.
export function resolveBaseUrl(env) {
  return (env.VITE_API_BASE_URL || (env.DEV ? "http://localhost:8080" : "")).replace(/\/+$/, "");
}

const BASE_URL = resolveBaseUrl(import.meta.env);
const API_PREFIX = "/api/v1";

// Mensajes fijos: el backend responde 401 y 403 con textos técnicos y la pantalla necesita algo claro.
export const SESSION_EXPIRED_MESSAGE = "Tu sesión venció. Volvé a ingresar.";
export const FORBIDDEN_MESSAGE = "Esta acción no corresponde a tu rol.";

// AuthProvider registra acá qué hacer cuando el backend rechaza el token (401): cerrar la sesión.
let unauthorizedHandler = null;
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

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
 * DNI leído del claim `nationalId` de un JWT viejo (anterior a DEF-06).
 * Los tokens nuevos ya no lo traen: el DNI se pide a GET /auth/me.
 * Queda solo como respaldo mientras convivan tokens viejos o un backend sin /auth/me.
 * Solo para mostrar información en pantalla: la autorización la hace el backend.
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
    // 401 con token: la sesión venció o es inválida -> se cierra y se vuelve al login.
    // (El login usa auth:false: ahí un 401 son credenciales incorrectas, no una sesión vencida.)
    if (response.status === 401 && auth) {
      unauthorizedHandler?.();
      throw new ApiError(401, SESSION_EXPIRED_MESSAGE, data?.type);
    }
    // 403: el token es válido pero el rol no alcanza para esta acción.
    if (response.status === 403) throw new ApiError(403, FORBIDDEN_MESSAGE, data?.type);
    const message = data?.detail || data?.title || `Error ${response.status}`;
    throw new ApiError(response.status, message, data?.type);
  }

  return data;
}
