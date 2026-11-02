import { apiFetch } from "./api";

/** GET /infractions/mine — infracciones del ciudadano logueado (CIUDADANO) */
export function getMyInfractions() {
  return apiFetch("/infractions/mine");
}

/** POST /infractions/{id}/appeal — body: { reason } (CIUDADANO) */
export function appealInfraction(id, reason) {
  return apiFetch(`/infractions/${id}/appeal`, {
    method: "POST",
    body: { reason },
  });
}

/** GET /infractions — todas las infracciones (INSPECTOR, ADMINISTRADOR) */
export function getAllInfractions() {
  return apiFetch("/infractions");
}

/**
 * POST /infractions — registra una infracción (solo INSPECTOR).
 * inspectorId no se manda: el backend lo toma del token.
 */
export function createInfraction(data) {
  return apiFetch("/infractions", { method: "POST", body: data });
}

/** POST /infractions/{id}/confirmation — deja firme la infracción (solo ADMINISTRADOR) */
export function confirmInfraction(id) {
  return apiFetch(`/infractions/${id}/confirmation`, { method: "POST" });
}

/**
 * POST /infractions/{id}/annulment — anula la infracción (solo ADMINISTRADOR).
 * authorizedBy no se manda: el backend lo toma del token.
 */
export function annulInfraction(id, annulmentReason) {
  return apiFetch(`/infractions/${id}/annulment`, {
    method: "POST",
    body: { annulmentReason },
  });
}
