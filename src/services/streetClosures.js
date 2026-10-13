import { apiFetch } from "./api";

/** GET /street-closures/current — público, solo cortes APPROVED y ACTIVE */
export function getCurrentStreetClosures() {
  return apiFetch("/street-closures/current", { auth: false });
}
