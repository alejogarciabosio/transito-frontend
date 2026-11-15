import { useState } from "react";
import { AlertCircle, Filter, Plus } from "lucide-react";
import { Badge, Button, DataTable, Field, Modal, ResourceStatus, Row, SectionToolbar } from "../../components/ui.jsx";
import { AGGRAVATING_FACTORS, INFRACCION_ESTADO, INFRACTION_TYPES, inputCls } from "../../constants";
import { cx, formatCurrency, nowForInput } from "../../lib/format";
import { SugerenciaIA } from "./SugerenciaIA.jsx";

function RegistrarInfraccionForm({ onSubmit }) {
  const [tipo, setTipo] = useState(INFRACTION_TYPES[0].code);
  const [patente, setPatente] = useState("");
  const [dni, setDni] = useState("");
  const [fechaHora, setFechaHora] = useState(nowForInput);
  const [calle, setCalle] = useState("");
  const [entrecalle, setEntrecalle] = useState("");
  const [agravantes, setAgravantes] = useState([]);
  const [evidencia, setEvidencia] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tipoObj = INFRACTION_TYPES.find((t) => t.code === tipo);
  const recargo = agravantes.reduce((acc, code) => acc + AGGRAVATING_FACTORS.find((a) => a.code === code).pct, 0);
  const monto = Math.round(tipoObj.base * (1 + recargo));

  const toggleAgravante = (code) => {
    setAgravantes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  // La sugerencia de IA solo pre-completa; el inspector puede cambiarla y confirma como siempre.
  const aplicarSugerencia = ({ tipo: t, agravantes: a }) => {
    if (t) setTipo(t);
    setAgravantes(a);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patente.trim() || !calle.trim() || !fechaHora) return;
    setError("");
    setSubmitting(true);
    try {
      // inspectorId no se manda: el backend lo toma del usuario logueado.
      await onSubmit({
        licensePlate: patente.trim().toUpperCase(),
        infractionType: tipo,
        infractionDateTime: fechaHora.length === 16 ? `${fechaHora}:00` : fechaHora,
        location: { street: calle.trim(), crossStreet: entrecalle.trim() || null },
        evidenceUrl: evidencia
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        offenderNationalId: dni.trim() || null,
        baseAmount: tipoObj.base,
        aggravatingFactors: agravantes,
        finalAmount: monto,
      });
    } catch (err) {
      setError(err.message || "No se pudo registrar la infracción.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-red-700">
            <AlertCircle size={16} /> No se pudo registrar
          </p>
          <p className="mt-1 text-red-700">{error}</p>
        </div>
      )}
      <SugerenciaIA onApply={aplicarSugerencia} />
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Tipo de infracción" required>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
            {INFRACTION_TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Patente" required>
          <input value={patente} onChange={(e) => setPatente(e.target.value.toUpperCase())} placeholder="AB123CD" className={inputCls} />
        </Field>
        <Field label="Fecha y hora del hecho" required>
          <input type="datetime-local" value={fechaHora} max={nowForInput()} onChange={(e) => setFechaHora(e.target.value)} className={inputCls} />
        </Field>
        <Field label="DNI del infractor" hint="Opcional. Con el DNI el vecino ve el acta en su portal.">
          <input value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" placeholder="30111222" className={inputCls} />
        </Field>
        <Field label="Calle" required>
          <input value={calle} onChange={(e) => setCalle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Entre calle">
          <input value={entrecalle} onChange={(e) => setEntrecalle(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Evidencia" hint="Opcional. Un enlace por línea (foto o video del hecho).">
        <textarea value={evidencia} onChange={(e) => setEvidencia(e.target.value)} rows={2} placeholder="https://..." className={inputCls} />
      </Field>
      <Field label="Agravantes">
        <div className="flex flex-wrap gap-2">
          {AGGRAVATING_FACTORS.map((a) => (
            <button
              type="button"
              key={a.code}
              onClick={() => toggleAgravante(a.code)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                agravantes.includes(a.code) ? "border-red-600 bg-red-50 text-red-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              {a.label} (+{a.pct * 100}%)
            </button>
          ))}
        </div>
      </Field>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-600">Importe calculado</span>
        <span className="text-lg font-bold text-slate-900">{formatCurrency(monto)}</span>
      </div>
      <Button type="submit" variant="primary" className="mt-4 w-full" disabled={submitting}>
        {submitting ? "Registrando..." : "Emitir acta de infracción"}
      </Button>
    </form>
  );
}

export function InfraccionesStaff({ infractions, resource, role, onCreate, onConfirm, onAnnul }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [annulMode, setAnnulMode] = useState(false);
  const [annulReason, setAnnulReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [acting, setActing] = useState(false);

  // Permisos del backend: el inspector registra; el administrador confirma o anula.
  const canRegister = role === "INSPECTOR";
  const canResolve = role === "ADMINISTRADOR";

  const filtered = filterEstado === "Todos" ? infractions : infractions.filter((i) => i.estado === filterEstado);

  const closeDetail = () => {
    setDetail(null);
    setAnnulMode(false);
    setAnnulReason("");
    setActionError("");
  };

  const run = async (action) => {
    setActionError("");
    setActing(true);
    try {
      await action();
      closeDetail();
    } catch (err) {
      setActionError(err.message || "No se pudo completar la acción.");
    } finally {
      setActing(false);
    }
  };

  const columns = [
    { header: "Patente", render: (r) => <span className="font-mono font-semibold">{r.patente}</span> },
    { header: "Tipo", render: (r) => r.tipoLabel },
    { header: "Fecha", render: (r) => r.fecha },
    { header: "Ubicación", render: (r) => r.calle },
    { header: "Importe", render: (r) => formatCurrency(r.monto) },
    { header: "Estado", render: (r) => <Badge tone={INFRACCION_ESTADO[r.estado]}>{r.estado}</Badge> },
  ];

  const canActOnDetail = canResolve && detail && (detail.estado === "Pendiente" || detail.estado === "Apelada");

  return (
    <div className="space-y-6">
      <SectionToolbar
        title="Gestión de infracciones"
        desc={canRegister ? "Registrá y consultá infracciones de tránsito." : "Consultá y resolvé infracciones de tránsito."}
        actions={
          canRegister && (
            <Button variant="accent" onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Registrar infracción
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-slate-500" />
        {["Todos", "Pendiente", "Apelada", "Confirmada", "Anulada"].map((e) => (
          <button
            key={e}
            onClick={() => setFilterEstado(e)}
            className={cx(
              "rounded-full px-3 py-1 text-xs font-medium",
              filterEstado === e ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {e}
          </button>
        ))}
      </div>
      <ResourceStatus resource={resource} loadingText="Cargando infracciones..." />
      {resource.loaded && <DataTable columns={columns} data={filtered} onRowClick={setDetail} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar infracción" wide>
        <RegistrarInfraccionForm
          onSubmit={async (data) => {
            await onCreate(data);
            setModalOpen(false);
          }}
        />
      </Modal>

      <Modal open={!!detail} onClose={closeDetail} title="Detalle de infracción">
        {detail && (
          <div>
            <dl className="space-y-3 text-sm">
              <Row label="Patente" value={detail.patente} />
              <Row label="Tipo" value={detail.tipoLabel} />
              <Row label="Fecha y hora" value={detail.fecha} />
              <Row label="Ubicación" value={detail.calle} />
              <Row label="DNI del infractor" value={detail.infractor || "—"} />
              <Row label="Inspector" value={detail.inspector} />
              <Row label="Importe" value={formatCurrency(detail.monto)} />
              <Row label="Estado" value={detail.estado} />
            </dl>
            {detail.evidencias.length > 0 && (
              <div className="mt-4 text-sm">
                <p className="font-medium text-slate-700">Evidencia</p>
                <ul className="mt-1 space-y-1">
                  {detail.evidencias.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer" className="break-all text-sky-600 hover:underline">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {detail.estado === "Apelada" && (
              <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm text-sky-700">
                <p className="font-semibold">El vecino presentó un descargo</p>
                <p className="mt-1">{detail.motivoDescargo ? (
                    <>&ldquo;{detail.motivoDescargo}&rdquo;</>
                  ) : (
                    "El sistema todavía no guarda el texto del descargo (pendiente en el backend, HU-INF-04). Pedí la documentación por mesa de entradas."
                  )}</p>
                {!canResolve && <p className="mt-3 text-xs text-sky-500">La resolución la realiza un administrador.</p>}
              </div>
            )}
            {actionError && (
              <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                <p className="flex items-center gap-2">
                  <AlertCircle size={16} /> {actionError}
                </p>
              </div>
            )}
            {canActOnDetail && !annulMode && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant={detail.estado === "Apelada" ? "danger" : "secondary"} disabled={acting} onClick={() => run(() => onConfirm(detail.id))}>
                  {detail.estado === "Apelada" ? "Rechazar descargo (confirmar)" : "Marcar como firme"}
                </Button>
                <Button size="sm" variant={detail.estado === "Apelada" ? "success" : "danger"} disabled={acting} onClick={() => setAnnulMode(true)}>
                  {detail.estado === "Apelada" ? "Aceptar descargo (anular)" : "Anular"}
                </Button>
              </div>
            )}
            {canActOnDetail && annulMode && (
              <div className="mt-4">
                <Field label="Motivo de la anulación" required hint={`${annulReason.length}/1000`}>
                  <textarea value={annulReason} maxLength={1000} onChange={(e) => setAnnulReason(e.target.value)} rows={3} className={inputCls} />
                </Field>
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" disabled={acting || !annulReason.trim()} onClick={() => run(() => onAnnul(detail.id, annulReason.trim()))}>
                    {acting ? "Anulando..." : "Confirmar anulación"}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={acting} onClick={() => setAnnulMode(false)}>
                    Volver
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel interno: Cortes de calle, Operativos, Accidentes, Vehículos retenidos
// y Estacionamiento medido. Datos reales del backend; cada acción se muestra
// solo al rol que la puede hacer (igual que en la API).
// ---------------------------------------------------------------------------
