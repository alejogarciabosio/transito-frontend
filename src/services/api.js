// Cliente HTTP centralizado para hablar con el backend de Tránsito.
// Agrega automáticamente el header Authorization cuando hay token,
// y traduce el formato de error del backend (sección 3 de la guía)
// en un ApiError manejable desde los componentes.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export class ApiError extends Error {
  constructor(status, message, timestamp) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.timestamp = timestamp;
  }
}

function getToken() {
  return sessionStorage.getItem("transito_token");
}

/**
 * @param {string} path - ej: "/infractions" o "/infractions/123"
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
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Error de red (backend caído, CORS, sin conexión, etc.)
    throw new ApiError(0, "No se pudo conectar con el servidor. Intentá nuevamente.");
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || `Error ${response.status}`;
    throw new ApiError(response.status, message, data?.timestamp);
  }

  return data;
}
