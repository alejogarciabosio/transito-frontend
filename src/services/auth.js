import { apiFetch } from "./api";

/**
 * GET /auth/me — datos del propio usuario autenticado (userId, role, nationalId...).
 * DEF-06: el DNI ya no viaja en el JWT; el backend lo resuelve y lo devuelve acá.
 */
export function getMe() {
  return apiFetch("/auth/me");
}
