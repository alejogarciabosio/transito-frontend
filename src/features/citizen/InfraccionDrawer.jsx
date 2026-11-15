import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileSignature,
  RotateCcw,
  X,
} from "lucide-react";
import { Badge, Button, Field, Row } from "../../components/ui.jsx";
import { INFRACCION_ESTADO, inputCls } from "../../constants";
import { formatCurrency } from "../../lib/format";

export function InfraccionDrawer({ infraction, onClose, onSubmitDescargo }) {
  const [step, setStep] = useState("detail");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!infraction) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!motivo.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      await onSubmitDescargo(infraction.id, motivo);
      setStep("success");
    } catch (err) {
      setError(err.message || "No se pudo conectar con el servidor. Intentá nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50">
      <div role="dialog" aria-modal="true" aria-label="Detalle de infracción" className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {step === "detail" && "Detalle de infracción"}
            {step === "form" && "Presentar descargo"}
            {step === "success" && "Descargo enviado"}
          </p>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {step === "detail" && (
          <div className="p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{infraction.tipoLabel}</h2>
                <p className="mt-1 text-sm text-slate-600">Acta N.° {infraction.id}</p>
              </div>
              <Badge tone={INFRACCION_ESTADO[infraction.estado]}>{infraction.estado}</Badge>
            </div>
            <dl className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-5 text-sm">
              <Row label="Patente" value={infraction.patente} />
              <Row label="Fecha y hora" value={infraction.fecha} />
              <Row label="Ubicación" value={infraction.calle} />
              <Row label="Inspector" value={infraction.inspector} />
              <Row label="Importe" value={formatCurrency(infraction.monto)} />
            </dl>

            {infraction.estado === "Apelada" && (
              <div className="mt-5 rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-700">
                <p className="font-semibold">Tu descargo está en revisión</p>
                {infraction.motivoDescargo && <p className="mt-1 text-sky-600">&ldquo;{infraction.motivoDescargo}&rdquo;</p>}
              </div>
            )}
            {infraction.estado === "Anulada" && (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
                <CheckCircle2 size={18} /> Tu descargo fue aceptado. La infracción quedó anulada.
              </div>
            )}
            {infraction.estado === "Confirmada" && (
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                La infracción quedó firme. Generá tu boleta de pago desde el módulo de Rentas.
              </div>
            )}

            {infraction.estado === "Pendiente" && (
              <Button variant="accent" className="mt-6 w-full" onClick={() => setStep("form")}>
                <FileSignature size={16} /> Presentar descargo
              </Button>
            )}
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold text-red-700">
                  <AlertCircle size={16} /> Error al enviar
                </p>
                <p className="mt-1 text-red-700">{error}</p>
              </div>
            )}
            <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">{infraction.tipoLabel}</p>
              <p className="text-sm text-slate-600">
                {infraction.calle} · Patente {infraction.patente}
              </p>
            </div>
            <p className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-700">
              <span className="h-px w-5 bg-red-600" /> Descargo
            </p>
            <Field label="Motivo del descargo" required>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={5}
                required
                className={inputCls}
                placeholder="Explicá por qué considerás que la infracción no corresponde..."
              />
            </Field>
            <p className="mb-1.5 mt-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-700">
              <span className="h-px w-5 bg-red-600" /> Documentación
            </p>
            {/* El backend todavía no recibe archivos en el descargo (HU-INF-04 pendiente): no se
                ofrece un campo que acepte adjuntos que después se perderían. */}
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600" role="note">
              <p className="font-semibold text-slate-700">Adjuntos: próximamente</p>
              <p className="mt-1">Por ahora el sistema no recibe archivos. Enviá la documentación por mesa de entradas, indicando el acta N.° {infraction.id}.</p>
            </div>
            <Button type="submit" variant="primary" className="mt-4 w-full" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar descargo"}
            </Button>
          </form>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">¡Descargo registrado!</h3>
            <p className="mt-2 max-w-xs text-sm text-slate-600">
              Tu descargo fue enviado y ya quedó registrado en el sistema. Vas a poder ver el estado actualizado en tu lista de infracciones.
            </p>
            <Button variant="primary" className="mt-6" onClick={onClose}>
              <RotateCcw size={14} /> Volver a mis infracciones
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
