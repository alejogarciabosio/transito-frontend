import { MapPin } from "lucide-react";
import { BackLink, Badge, EmptyState, ResourceStatus, SectionHeader } from "../../components/ui.jsx";
import { CLOSURE_STATUS_UI, REQUESTING_MODULE_LABEL } from "../../constants";
import { formatDateTime } from "../../lib/format";

export function CortesCiudadano({ resource, onBack }) {
  // Primero los activos, después los próximos (el backend ya los ordena por fecha de inicio).
  const closures = [...resource.data].sort((a, b) => (a.status === b.status ? 0 : a.status === "ACTIVE" ? -1 : 1));
  const ready = resource.loaded && !resource.error;
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <BackLink onClick={onBack} />
      <SectionHeader
        eyebrow="Portal vecino"
        title="Cortes de calle vigentes"
        desc="Consultá los cortes de calle activos o próximos a activarse y sus desvíos habilitados."
      />
      <div className="mt-8 space-y-4">
        <ResourceStatus resource={resource} loadingText="Cargando cortes de calle..." />
        {ready &&
          closures.map((c) => {
            const ui = CLOSURE_STATUS_UI[c.status] || { label: c.status, tone: "slate" };
            return (
              <div key={c.streetClosureId} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">
                    {c.affectedStreet?.length ? c.affectedStreet.join(", ") : "Calle a confirmar"}
                  </p>
                  <Badge tone={ui.tone}>{ui.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDateTime(c.startDate)} — {formatDateTime(c.endDate)} · Solicitado por{" "}
                  {REQUESTING_MODULE_LABEL[c.requestingModule] || c.requestingModule}
                </p>
                {c.detours?.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-slate-600">
                    {c.detours.map((d, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        <span>
                          Desvío por <strong className="font-medium text-slate-800">{d.alternateRoute}</strong>
                          {d.street ? ` (en ${d.street})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {c.conditions?.length > 0 && (
                  <p className="mt-2 text-xs text-slate-400">Condiciones: {c.conditions.join(" · ")}</p>
                )}
              </div>
            );
          })}
        {ready && closures.length === 0 && <EmptyState text="No hay cortes de calle vigentes en este momento." />}
      </div>
    </section>
  );
}
