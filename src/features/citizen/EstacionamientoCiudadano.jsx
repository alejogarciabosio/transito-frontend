import { BackLink, Badge, EmptyState, ResourceStatus, SectionHeader } from "../../components/ui.jsx";
import { formatCurrency, formatLocalDate } from "../../lib/format";

export function EstacionamientoCiudadano({ resource, onBack }) {
  const zones = resource.data;
  const ready = resource.loaded && !resource.error;
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <BackLink onClick={onBack} />
      <SectionHeader
        eyebrow="Portal vecino"
        title="Estacionamiento medido"
        desc="Zonas, horarios y tarifas vigentes del estacionamiento medido en Ciudad UADE."
      />
      <div className="mt-8 space-y-4">
        <ResourceStatus resource={resource} loadingText="Cargando zonas de estacionamiento..." />
        {ready && (
          <div className="grid gap-4 sm:grid-cols-2">
            {zones.map((z) => (
              <div key={z.zoneId} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{z.name}</p>
                  {z.tariff ? (
                    <Badge tone="sky">{formatCurrency(z.tariff.pricePerHour)}/hora</Badge>
                  ) : (
                    <Badge tone="slate">Tarifa a confirmar</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-500">Horario: {z.allowedHours}</p>
                {z.tariff?.validTo && (
                  <p className="mt-1 text-xs text-slate-400">Tarifa vigente hasta el {formatLocalDate(z.tariff.validTo)}</p>
                )}
              </div>
            ))}
          </div>
        )}
        {ready && zones.length === 0 && <EmptyState text="No hay zonas de estacionamiento medido activas." />}
      </div>
    </section>
  );
}
