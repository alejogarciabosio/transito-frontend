import { apiFetch } from "./api";

/** GET /parking-zones — público */
export function getParkingZones() {
  return apiFetch("/parking-zones", { auth: false });
}

/** GET /parking-tariffs?zoneId=... — público (el listado exige zoneId) */
export function getParkingTariffs(zoneId) {
  return apiFetch(`/parking-tariffs?zoneId=${encodeURIComponent(zoneId)}`, { auth: false });
}

/**
 * Zonas activas con la tarifa vigente de cada una.
 * El backend no expone un listado de todas las tarifas, así que se piden
 * por zona en paralelo. Si falla la tarifa de una zona, la zona igual se muestra.
 */
export async function getActiveZonesWithTariff() {
  const zones = await getParkingZones();
  const active = (zones || []).filter((z) => z.status === "ACTIVE");
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, comparable con LocalDate

  return Promise.all(
    active.map(async (zone) => {
      let tariff = null;
      try {
        const tariffs = await getParkingTariffs(zone.zoneId);
        tariff =
          (tariffs || [])
            .filter((t) => t.validFrom <= today && (!t.validTo || t.validTo >= today))
            .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null;
      } catch {
        tariff = null;
      }
      return { ...zone, tariff };
    })
  );
}
