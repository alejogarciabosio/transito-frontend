import { apiFetch } from "./api";

/** GET /accidents/mine — siniestros donde el ciudadano figura como persona o titular (CIUDADANO) */
export function getMyAccidents() {
  return apiFetch("/accidents/mine");
}
