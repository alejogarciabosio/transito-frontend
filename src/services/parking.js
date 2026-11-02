import { apiFetch } from "./api";

/** GET /parking-zones — público */
export function getParkingZones() {
  return apiFetch("/parking-zones", { auth: false });
}

/** GET /parking-tariffs?zoneId=... — público (el listado exige zoneId) */
export function getParkingTariffs(zoneId) {
  return apiFetch(`/parking-tariffs?zoneId=${encodeURIComponent(zoneId)}`, { auth: false });
}

// Fecha local como YYYY-MM-DD (comparable con los LocalDate del backend).
function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Agrega a cada zona sus tarifas (`tariffs`) y la vigente hoy (`tariff`).
 * El backend no expone un listado de todas las tarifas, así que se piden
 * por zona en paralelo. Si falla la tarifa de una zona, la zona igual se muestra.
 */
async function withTariffs(zones) {
  const today = todayLocal();
  return Promise.all(
    zones.map(async (zone) => {
      let tariffs = [];
      try {
        tariffs = (await getParkingTariffs(zone.zoneId)) || [];
      } catch {
        tariffs = [];
      }
      const tariff =
        tariffs
          .filter((t) => t.validFrom <= today && (!t.validTo || t.validTo >= today))
          .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null;
      return { ...zone, tariffs, tariff };
    })
  );
}

/** Zonas activas con la tarifa vigente de cada una (Portal vecino). */
export async function getActiveZonesWithTariff() {
  const zones = await getParkingZones();
  return withTariffs((zones || []).filter((z) => z.status === "ACTIVE"));
}

/** Todas las zonas (también las inactivas) con sus tarifas (Panel interno). */
export async function getAllZonesWithTariffs() {
  return withTariffs((await getParkingZones()) || []);
}

/** POST /parking-zones — { name, boundaries, allowedHours } (solo ADMINISTRADOR) */
export function createParkingZone(data) {
  return apiFetch("/parking-zones", { method: "POST", body: data });
}

/** PUT /parking-zones/{id} — { name, boundaries, allowedHours, status: ACTIVE|INACTIVE } (solo ADMINISTRADOR) */
export function updateParkingZone(id, data) {
  return apiFetch(`/parking-zones/${id}`, { method: "PUT", body: data });
}

/** DELETE /parking-zones/{id} — baja lógica: la zona pasa a INACTIVE (solo ADMINISTRADOR) */
export function deleteParkingZone(id) {
  return apiFetch(`/parking-zones/${id}`, { method: "DELETE" });
}

/** POST /parking-tariffs — { zoneId, pricePerHour, validFrom, validTo } (solo ADMINISTRADOR) */
export function createParkingTariff(data) {
  return apiFetch("/parking-tariffs", { method: "POST", body: data });
}

/** PUT /parking-tariffs/{id} — { pricePerHour, validFrom, validTo } (solo ADMINISTRADOR) */
export function updateParkingTariff(id, data) {
  return apiFetch(`/parking-tariffs/${id}`, { method: "PUT", body: data });
}

/** DELETE /parking-tariffs/{id} (solo ADMINISTRADOR; el backend lo rechaza con 409 si la zona tiene sesiones sin cerrar) */
export function deleteParkingTariff(id) {
  return apiFetch(`/parking-tariffs/${id}`, { method: "DELETE" });
}

/** GET /parking-sessions — todas las sesiones (INSPECTOR, ADMINISTRADOR) */
export function getParkingSessions() {
  return apiFetch("/parking-sessions");
}

/**
 * POST /parking-sessions/{id}/unpaid-flag — { baseAmount } (solo INSPECTOR).
 * Crea una infracción UNPAID_PARKING y devuelve esa infracción, no la sesión.
 */
export function flagParkingSessionUnpaid(id, baseAmount) {
  return apiFetch(`/parking-sessions/${id}/unpaid-flag`, { method: "POST", body: { baseAmount } });
}
