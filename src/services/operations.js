import { apiFetch } from "./api";

/** GET /operations — todos los operativos (INSPECTOR, ADMINISTRADOR) */
export function getOperations() {
  return apiFetch("/operations");
}

/** POST /operations — crea un operativo (solo INSPECTOR) */
export function createOperation(data) {
  return apiFetch("/operations", { method: "POST", body: data });
}

/** POST /operations/{id}/closure — cierra un operativo abierto (solo INSPECTOR). resolution: enum OperationResolution */
export function closeOperation(id, resolution) {
  return apiFetch(`/operations/${id}/closure`, { method: "POST", body: { resolution } });
}
