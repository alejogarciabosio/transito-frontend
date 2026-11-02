import { apiFetch } from "./api";

/** GET /street-closures/current — público, solo cortes APPROVED y ACTIVE */
export function getCurrentStreetClosures() {
  return apiFetch("/street-closures/current", { auth: false });
}

/** GET /street-closures — todos los cortes (INSPECTOR, ADMINISTRADOR) */
export function getStreetClosures() {
  return apiFetch("/street-closures");
}

/**
 * POST /street-closures/{id}/approval (solo ADMINISTRADOR)
 * { detours: [{street, alternateRoute}], conditions: [string], authorizedFrom, authorizedTo }
 * Las fechas autorizadas (OffsetDateTime) son opcionales: en null se conserva la ventana solicitada.
 * authorizedTo es el fin operativo que gobierna el cierre automático.
 */
export function approveStreetClosure(id, { detours, conditions, authorizedFrom = null, authorizedTo = null }) {
  return apiFetch(`/street-closures/${id}/approval`, { method: "POST", body: { detours, conditions, authorizedFrom, authorizedTo } });
}

/** POST /street-closures/{id}/rejection — { rejectionReason } (solo ADMINISTRADOR) */
export function rejectStreetClosure(id, rejectionReason) {
  return apiFetch(`/street-closures/${id}/rejection`, { method: "POST", body: { rejectionReason } });
}

/** POST /street-closures/{id}/activation — sin cuerpo (solo INSPECTOR; el corte tiene que estar APPROVED) */
export function activateStreetClosure(id) {
  return apiFetch(`/street-closures/${id}/activation`, { method: "POST" });
}

/** POST /street-closures/{id}/completion — { notes } obligatorias (solo INSPECTOR; el corte tiene que estar ACTIVE) */
export function completeStreetClosure(id, notes) {
  return apiFetch(`/street-closures/${id}/completion`, { method: "POST", body: { notes } });
}
