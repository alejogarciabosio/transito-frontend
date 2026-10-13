import { apiFetch } from "./api";

/** GET /impoundments/mine — vehículos retenidos del ciudadano logueado (CIUDADANO) */
export function getMyImpoundments() {
  return apiFetch("/impoundments/mine");
}
