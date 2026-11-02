import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { BackLink, Badge, EmptyState, ResourceStatus, SectionHeader } from "../../components/ui.jsx";
import { CITIZEN_ONLY_TEXT, IMPOUNDMENT_ORIGIN_LABEL, IMPOUNDMENT_STATUS_UI, REQUISITO_LABEL, inputCls } from "../../constants";
import { cx, formatCurrency, formatDateTime } from "../../lib/format";

export function VehiculosCiudadano({ resource, isCitizen, onBack }) {
  const [q, setQ] = useState("");
  const ready = resource.loaded && !resource.error;
  const vehicles = resource.data.filter((v) => !q || v.licensePlate?.toUpperCase().includes(q));
  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <BackLink onClick={onBack} />
      <SectionHeader
        eyebrow="Portal vecino"
        title="Vehículos retenidos"
        desc="Estos son los vehículos a tu nombre que ingresaron al depósito municipal, con su estado y los requisitos para liberarlos."
      />
      <div className="mt-8 space-y-4">
        {!isCitizen && <EmptyState text={CITIZEN_ONLY_TEXT} />}
        {isCitizen && <ResourceStatus resource={resource} loadingText="Buscando tus vehículos..." />}
        {isCitizen && ready && resource.data.length > 1 && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value.toUpperCase())}
            placeholder="Filtrar por patente"
            className={cx(inputCls, "sm:w-64")}
          />
        )}
        {isCitizen &&
          ready &&
          vehicles.map((v) => {
            const ui = IMPOUNDMENT_STATUS_UI[v.status] || { label: v.status, tone: "slate" };
            const released = v.status === "RELEASED";
            return (
              <div key={v.impoundmentId} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-slate-900">{v.licensePlate}</p>
                  <Badge tone={ui.tone}>{ui.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Depósito: {v.depotLocation} · Ingreso: {formatDateTime(v.entryDateTime)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Motivo: {v.reason} ({IMPOUNDMENT_ORIGIN_LABEL[v.originType] || v.originType})
                </p>

                {released ? (
                  <>
                    <p className="mt-4 text-sm font-medium text-slate-700">Requisitos verificados</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {(v.verifiedRequirements || []).map((r) => (
                        <li key={r} className="flex items-center gap-2 text-slate-600">
                          <CheckCircle2 size={15} className="text-emerald-500" /> {REQUISITO_LABEL[r] || r}
                        </li>
                      ))}
                    </ul>
                    {v.towingAndStorageFee != null && (
                      <p className="mt-4 text-sm text-slate-500">
                        Acarreo y estadía abonados:{" "}
                        <strong className="text-slate-800">{formatCurrency(v.towingAndStorageFee)}</strong>
                        {v.paymentReference ? ` · Comprobante ${v.paymentReference}` : ""}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-4 text-sm font-medium text-slate-700">Requisitos para liberarlo</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {Object.values(REQUISITO_LABEL).map((r) => (
                        <li key={r} className="flex items-center gap-2 text-slate-500">
                          <AlertCircle size={15} className="text-amber-500" /> {r}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-xs text-slate-400">
                      El personal del depósito verifica los requisitos y calcula el costo de acarreo y estadía al momento
                      de la liberación.
                    </p>
                  </>
                )}
              </div>
            );
          })}
        {isCitizen && ready && resource.data.length === 0 && (
          <EmptyState text="No tenés vehículos registrados en el depósito municipal." />
        )}
        {isCitizen && ready && resource.data.length > 0 && vehicles.length === 0 && (
          <EmptyState text="Ninguno de tus vehículos retenidos coincide con esa patente." />
        )}
      </div>
    </section>
  );
}
