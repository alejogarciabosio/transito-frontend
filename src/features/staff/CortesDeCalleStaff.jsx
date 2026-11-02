import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, DataTable, ErrorNote, Field, Modal, ResourceStatus, SectionToolbar } from "../../components/ui.jsx";
import { CORTE_ESTADO, inputCls } from "../../constants";
import { useAction } from "../../hooks/useAction";
import { cx, isoToInput, linesOf, toApiOffsetDateTime } from "../../lib/format";

function EvaluarCorteForm({ closure, onApprove, onReject, onDone }) {
  const [decision, setDecision] = useState("Aprobado");
  const [detours, setDetours] = useState([{ street: "", alternateRoute: "" }]);
  const [condiciones, setCondiciones] = useState("");
  // Ventana autorizada: arranca con la solicitada. Si no se modifica se manda null y el
  // backend conserva la ventana recibida; authorizedTo es el fin operativo (cierre automático).
  const initialFrom = isoToInput(closure.inicioISO);
  const initialTo = isoToInput(closure.finISO);
  const [authFrom, setAuthFrom] = useState(initialFrom);
  const [authTo, setAuthTo] = useState(initialTo);
  const [motivo, setMotivo] = useState("");
  const { run, acting, error } = useAction();

  const setDetour = (i, key, value) => setDetours((prev) => prev.map((d, idx) => (idx === i ? { ...d, [key]: value } : d)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      if (decision === "Rechazado") return onReject(closure.id, motivo.trim());
      const clean = detours
        .map((d) => ({ street: d.street.trim(), alternateRoute: d.alternateRoute.trim() }))
        .filter((d) => d.street || d.alternateRoute);
      if (clean.some((d) => !d.street || !d.alternateRoute)) {
        throw new Error("Completá la calle y la ruta alternativa de cada desvío.");
      }
      const effectiveFrom = authFrom || initialFrom;
      const effectiveTo = authTo || initialTo;
      if (effectiveFrom && effectiveTo && effectiveTo <= effectiveFrom) {
        throw new Error("El fin autorizado tiene que ser posterior al inicio autorizado.");
      }
      return onApprove(closure.id, {
        detours: clean,
        conditions: linesOf(condiciones),
        authorizedFrom: authFrom && authFrom !== initialFrom ? toApiOffsetDateTime(authFrom) : null,
        authorizedTo: authTo && authTo !== initialTo ? toApiOffsetDateTime(authTo) : null,
      });
    });
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4 rounded-lg bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-800">{closure.calle}</p>
        <p className="text-slate-500">
          Solicitado por {closure.solicitante} · {closure.fechaInicio} — {closure.fechaFin}
        </p>
      </div>
      <ErrorNote title="No se pudo registrar la decisión">{error}</ErrorNote>
      <Field label="Decisión">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDecision("Aprobado")}
            className={cx(
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium",
              decision === "Aprobado" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"
            )}
          >
            Aprobar
          </button>
          <button
            type="button"
            onClick={() => setDecision("Rechazado")}
            className={cx(
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium",
              decision === "Rechazado" ? "border-red-600 bg-red-50 text-red-600" : "border-slate-200 text-slate-500"
            )}
          >
            Rechazar
          </button>
        </div>
      </Field>
      {decision === "Aprobado" ? (
        <>
          <Field label="Desvíos" hint="Opcional. Calle desviada y ruta alternativa.">
            <div className="space-y-2">
              {detours.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <input value={d.street} onChange={(e) => setDetour(i, "street", e.target.value)} placeholder="Calle desviada" className={inputCls} />
                  <input
                    value={d.alternateRoute}
                    onChange={(e) => setDetour(i, "alternateRoute", e.target.value)}
                    placeholder="Ruta alternativa"
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setDetours((p) => [...p, { street: "", alternateRoute: "" }])}>
              <Plus size={14} /> Agregar desvío
            </Button>
          </Field>
          <Field label="Condiciones" hint="Opcional. Una por línea.">
            <textarea value={condiciones} onChange={(e) => setCondiciones(e.target.value)} rows={3} className={inputCls} />
          </Field>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Inicio autorizado" hint="Viene con el inicio solicitado; cambialo solo si autorizás otro.">
              <input type="datetime-local" value={authFrom} onChange={(e) => setAuthFrom(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Fin autorizado" hint="Fin operativo: al vencer, el corte se cierra automáticamente.">
              <input type="datetime-local" value={authTo} min={authFrom || undefined} onChange={(e) => setAuthTo(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </>
      ) : (
        <Field label="Motivo del rechazo" required hint={`${motivo.length}/1000`}>
          <textarea value={motivo} maxLength={1000} onChange={(e) => setMotivo(e.target.value)} rows={3} className={inputCls} />
        </Field>
      )}
      <Button type="submit" variant="primary" className="mt-2 w-full" disabled={acting || (decision === "Rechazado" && !motivo.trim())}>
        {acting ? "Enviando..." : "Confirmar decisión"}
      </Button>
    </form>
  );
}

export function CortesDeCalleStaff({ closures, resource, role, onApprove, onReject, onActivate, onComplete }) {
  const [evalTarget, setEvalTarget] = useState(null);
  const [finishTarget, setFinishTarget] = useState(null);
  const [notes, setNotes] = useState("");
  const page = useAction();
  const finish = useAction();

  // Permisos del backend: el administrador aprueba o rechaza; el inspector activa y finaliza.
  const isAdmin = role === "ADMINISTRADOR";
  const isInspector = role === "INSPECTOR";

  const closeFinish = () => {
    setFinishTarget(null);
    setNotes("");
    finish.setError("");
  };

  const columns = [
    { header: "Solicitante", render: (r) => <Badge tone={r.solicitante === "Obras" ? "orange" : "emerald"}>{r.solicitante}</Badge> },
    { header: "Calle", render: (r) => r.calle },
    { header: "Desde", render: (r) => r.fechaInicio },
    { header: "Hasta", render: (r) => r.fechaFin },
    { header: "Estado", render: (r) => <Badge tone={CORTE_ESTADO[r.estado]}>{r.estado}</Badge> },
    {
      header: "Acciones",
      render: (r) => (
        <div className="flex gap-2">
          {isAdmin && r.estado === "Pendiente" && (
            <Button size="sm" variant="secondary" onClick={() => setEvalTarget(r)}>
              Evaluar
            </Button>
          )}
          {isInspector && r.estado === "Aprobado" && (
            <Button size="sm" variant="secondary" disabled={page.acting} onClick={() => page.run(() => onActivate(r.id))}>
              Activar
            </Button>
          )}
          {isInspector && r.estado === "Activo" && (
            <Button size="sm" variant="danger" onClick={() => setFinishTarget(r)}>
              Finalizar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionToolbar
        title="Cortes de calle"
        desc={
          isAdmin
            ? "Evaluá las solicitudes recibidas desde los módulos de Obras Públicas y Ambiente."
            : "Activá y finalizá los cortes de calle aprobados."
        }
      />
      <ErrorNote title="No se pudo completar la acción">{page.error}</ErrorNote>
      <ResourceStatus resource={resource} loadingText="Cargando cortes de calle..." />
      {resource.loaded && <DataTable columns={columns} data={closures} />}

      <Modal open={!!evalTarget} onClose={() => setEvalTarget(null)} title="Evaluar solicitud de corte">
        {evalTarget && <EvaluarCorteForm closure={evalTarget} onApprove={onApprove} onReject={onReject} onDone={() => setEvalTarget(null)} />}
      </Modal>

      <Modal open={!!finishTarget} onClose={closeFinish} title="Finalizar corte de calle">
        {finishTarget && (
          <div>
            <div className="mb-4 rounded-lg bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-800">{finishTarget.calle}</p>
              <p className="text-slate-500">Solicitado por {finishTarget.solicitante}</p>
            </div>
            <ErrorNote title="No se pudo finalizar">{finish.error}</ErrorNote>
            <Field label="Observaciones de la finalización" required>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
            </Field>
            <Button
              variant="danger"
              className="w-full"
              disabled={finish.acting || !notes.trim()}
              onClick={async () => {
                if (await finish.run(() => onComplete(finishTarget.id, notes.trim()))) closeFinish();
              }}
            >
              {finish.acting ? "Finalizando..." : "Finalizar corte"}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ----- Operativos -----
