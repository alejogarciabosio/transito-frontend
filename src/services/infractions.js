import { apiFetch } from "./api";

/** GET /infractions/mine — infracciones del ciudadano logueado (CIUDADANO) */
export function getMyInfractions() {
  return apiFetch("/infractions/mine");
}

/** POST /infractions/{id}/appeal — body: { reason } */
export function appealInfraction(id, reason) {
  return apiFetch(`/infractions/${id}/appeal`, {
    method: "POST",
    body: { reason },
  });
}
