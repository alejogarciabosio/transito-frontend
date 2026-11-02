import { apiFetch } from "./api";

/** GET /impoundments/mine — vehículos retenidos del ciudadano logueado (CIUDADANO) */
export function getMyImpoundments() {
  return apiFetch("/impoundments/mine");
}

/** GET /impoundments — todos los vehículos retenidos (INSPECTOR, ADMINISTRADOR) */
export function getImpoundments() {
  return apiFetch("/impoundments");
}

/**
 * POST /impoundments — registra el ingreso (solo INSPECTOR).
 * { licensePlate, ownerNationalId, reason, depotLocation, entryDateTime, originType, originId (UUID) }
 */
export function createImpoundment(data) {
  return apiFetch("/impoundments", { method: "POST", body: data });
}

/**
 * PATCH /impoundments/{id} — { reason, depotLocation, ownerNationalId } (solo ADMINISTRADOR; solo si sigue IMPOUNDED)
 */
export function updateImpoundment(id, data) {
  return apiFetch(`/impoundments/${id}`, { method: "PATCH", body: data });
}

/**
 * POST /impoundments/{id}/release (solo ADMINISTRADOR; releasedBy lo toma el backend del token)
 * { verifiedRequirements: [string], towingAndStorageFee, paymentReference } — la referencia es obligatoria si el costo es mayor que cero.
 */
export function releaseImpoundment(id, data) {
  return apiFetch(`/impoundments/${id}/release`, { method: "POST", body: data });
}
