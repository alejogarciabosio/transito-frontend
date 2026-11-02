import { apiFetch } from "./api";

/** GET /accidents/mine — siniestros donde el ciudadano figura como persona o titular (CIUDADANO) */
export function getMyAccidents() {
  return apiFetch("/accidents/mine");
}

/** GET /accidents — todos los accidentes (INSPECTOR, ADMINISTRADOR) */
export function getAccidents() {
  return apiFetch("/accidents");
}

/** POST /accidents — registra un accidente (solo INSPECTOR). inspectorId lo toma el backend del token. */
export function createAccident(data) {
  return apiFetch("/accidents", { method: "POST", body: data });
}

/** PATCH /accidents/{id} con status VERIFIED — cierra el accidente (solo INSPECTOR; no se puede editar uno ya verificado) */
export function verifyAccident(id) {
  return apiFetch(`/accidents/${id}`, { method: "PATCH", body: { status: "VERIFIED" } });
}
