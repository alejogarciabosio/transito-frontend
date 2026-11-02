import {
  AlertCircle,
  ChevronRight,
  FileWarning,
  RotateCcw,
} from "lucide-react";
import { BackLink, Badge, EmptyState, SectionHeader } from "../../components/ui.jsx";
import { INFRACCION_ESTADO } from "../../constants";
import { formatCurrency } from "../../lib/format";

export function MisInfracciones({ infractions, loading, error, onRetry, onOpen, onBack }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <BackLink onClick={onBack} />
      <SectionHeader
        eyebrow="Portal vecino"
        title="Mis infracciones"
        desc="Estas son las infracciones registradas a tu nombre. Podés revisar el detalle y presentar un descargo cuando corresponda."
      />
      <div className="mt-8 space-y-4">
        {loading && <p className="text-sm text-slate-500">Cargando tus infracciones...</p>}

        {!loading && error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-red-700">
              <AlertCircle size={16} /> {error}
            </p>
            <button onClick={onRetry} className="mt-2 flex items-center gap-1.5 font-medium text-red-700 hover:underline">
              <RotateCcw size={14} /> Reintentar
            </button>
          </div>
        )}

        {!loading && !error && infractions.map((inf) => (
          <button
            key={inf.id}
            onClick={() => onOpen(inf)}
            className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <FileWarning size={18} />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{inf.tipoLabel}</p>
                <p className="text-sm text-slate-500">
                  {inf.calle} · {inf.fecha} · Patente {inf.patente}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p className="font-semibold text-slate-900">{formatCurrency(inf.monto)}</p>
              <Badge tone={INFRACCION_ESTADO[inf.estado]}>{inf.estado}</Badge>
              <ChevronRight size={18} className="text-slate-300" />
            </div>
          </button>
        ))}
        {!loading && !error && infractions.length === 0 && <EmptyState text="No tenés infracciones registradas. ¡Buen manejo!" />}
      </div>
    </section>
  );
}
