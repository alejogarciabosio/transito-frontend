import { BackLink, Badge, EmptyState, ResourceStatus, SectionHeader } from "../../components/ui.jsx";
import { ACCIDENT_STATUS_UI, CITIZEN_ONLY_TEXT, INJURY_LEVEL_LABEL } from "../../constants";
import { formatDateTime, plural } from "../../lib/format";

export function AccidentesCiudadano({ resource, isCitizen, nationalId, onBack }) {
  const ready = resource.loaded && !resource.error;
  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <BackLink onClick={onBack} />
      <SectionHeader
        eyebrow="Portal vecino"
        title="Accidentes y denuncias viales"
        desc="Los siniestros viales son registrados por el personal de inspección en el lugar del hecho."
      />
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">
          Si presenciaste o fuiste parte de un accidente de tránsito, comunicate a la Línea Municipal 147 o iniciá una
          denuncia desde el módulo de Atención Ciudadana. El equipo de Tránsito recibe la derivación automáticamente y
          asigna un inspector a la brevedad.
        </p>
      </div>

      <h3 className="mt-10 text-lg font-semibold text-slate-900">Siniestros en los que figurás</h3>
      <div className="mt-4 space-y-4">
        {!isCitizen && <EmptyState text={CITIZEN_ONLY_TEXT} />}
        {isCitizen && <ResourceStatus resource={resource} loadingText="Buscando tus siniestros registrados..." />}
        {isCitizen &&
          ready &&
          resource.data.map((a) => {
            const ui = ACCIDENT_STATUS_UI[a.status] || { label: a.status, tone: "slate" };
            const me = (a.persons || []).find((p) => p.nationalId === nationalId);
            const myVehicles = (a.vehicles || []).filter((v) => v.ownerNationalId === nationalId);
            const where = [a.location?.street, a.location?.crossStreet].filter(Boolean).join(" y ");
            return (
              <div key={a.accidentId} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{where || "Ubicación a confirmar"}</p>
                  <Badge tone={ui.tone}>{ui.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDateTime(a.accidentDateTime)} · {plural(a.vehicles?.length || 0, "vehículo involucrado", "vehículos involucrados")}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {me && <li>Figurás como persona involucrada ({INJURY_LEVEL_LABEL[me.injuryLevel] || me.injuryLevel}).</li>}
                  {myVehicles.map((v) => (
                    <li key={v.licensePlate}>Figurás como titular del vehículo {v.licensePlate}.</li>
                  ))}
                  {a.involvesInfrastructureDamage && (
                    <li className="text-slate-600">Daños en la vía pública{a.damageDescription ? `: ${a.damageDescription}` : ""}.</li>
                  )}
                </ul>
              </div>
            );
          })}
        {isCitizen && ready && resource.data.length === 0 && (
          <EmptyState text="No figurás en ningún siniestro vial registrado." />
        )}
      </div>
    </section>
  );
}

