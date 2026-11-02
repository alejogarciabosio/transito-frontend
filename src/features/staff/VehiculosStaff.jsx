import { useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  ErrorNote,
  Field,
  Modal,
  ResourceStatus,
  Row,
  SectionToolbar,
  inputCls,
} from "../../components/ui.jsx";
import { DEPOTS, MAX_REASON_LENGTH, REQUISITO_LABEL, VEHICULO_ESTADO } from "../../constants";
import { useAction } from "../../hooks/useAction";
import { ACARREO_BASE, ESTADIA_DIARIA, suggestFee } from "../../utils/fees";
import { cx, formatCurrency, nowForInput, plural, toApiDateTime } from "../../utils/format";

export function IngresoVehiculoForm({ infractions, operations, onSubmit, onDone }) {
  const [origen, setOrigen] = useState("INFRACTION");
  const [originId, setOriginId] = useState("");
  const [patente, setPatente] = useState("");
  const [dni, setDni] = useState("");
  const [motivo, setMotivo] = useState("");
  const [deposito, setDeposito] = useState(DEPOTS[0]);
  const [ingreso, setIngreso] = useState(nowForInput);
  const { run, acting, error } = useAction();

  const options =
    origen === "INFRACTION"
      ? infractions.map((i) => ({ id: i.id, label: `${i.patente} · ${i.tipoLabel} · ${i.fecha}` }))
      : operations.map((o) => ({ id: o.id, label: `${o.tipo} · ${o.zona} · ${o.inicio}` }));

  const switchOrigen = (value) => {
    setOrigen(value);
    setOriginId("");
  };
  const pickOrigin = (id) => {
    setOriginId(id);
    if (origen === "INFRACTION") {
      const inf = infractions.find((i) => i.id === id);
      if (inf) {
        setPatente(inf.patente);
        if (inf.infractor) setDni(inf.infractor);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!originId || !patente.trim() || !dni.trim() || !motivo.trim() || !ingreso) return;
    const ok = await run(() =>
      onSubmit({
        licensePlate: patente.trim().toUpperCase(),
        ownerNationalId: dni.trim(),
        reason: motivo.trim(),
        depotLocation: deposito,
        entryDateTime: toApiDateTime(ingreso),
        originType: origen,
        originId,
      })
    );
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit}>
      <ErrorNote title="No se pudo registrar el ingreso">{error}</ErrorNote>
      <Field label="Origen de la retención" required>
        <div className="flex gap-2">
          {[
            ["INFRACTION", "Infracción"],
            ["OPERATION", "Operativo"],
          ].map(([code, label]) => (
            <button
              type="button"
              key={code}
              onClick={() => switchOrigen(code)}
              className={cx(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium",
                origen === code ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field
        label={origen === "INFRACTION" ? "Infracción de origen" : "Operativo de origen"}
        required
        hint={options.length === 0 ? "No hay registros para vincular todavía." : undefined}
      >
        <select value={originId} onChange={(e) => pickOrigin(e.target.value)} className={inputCls} disabled={options.length === 0}>
          <option value="">Elegí una opción…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Patente" required>
          <input value={patente} onChange={(e) => setPatente(e.target.value.toUpperCase())} className={inputCls} />
        </Field>
        <Field label="DNI del titular" required hint="Con este DNI el vecino ve el vehículo en su portal.">
          <input value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" className={inputCls} />
        </Field>
        <Field label="Depósito">
          <select value={deposito} onChange={(e) => setDeposito(e.target.value)} className={inputCls}>
            {DEPOTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Fecha y hora de ingreso" required>
          <input type="datetime-local" value={ingreso} max={nowForInput()} onChange={(e) => setIngreso(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Motivo de la retención" required>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} placeholder="Estacionamiento en doble fila reincidente" />
      </Field>
      <Button type="submit" variant="primary" className="mt-2 w-full" disabled={acting}>
        {acting ? "Registrando..." : "Registrar ingreso"}
      </Button>
    </form>
  );
}

export function LiberarVehiculoForm({ vehicle, onSubmit, onDone }) {
  const requirements = Object.values(REQUISITO_LABEL);
  const [checked, setChecked] = useState([]);
  const [suggestion] = useState(() => suggestFee(vehicle.ingresoISO));
  const [fee, setFee] = useState(String(suggestion.total));
  const [reference, setReference] = useState("");
  const { run, acting, error } = useAction();

  const feeNumber = Number(fee);
  const feeValid = fee !== "" && Number.isFinite(feeNumber) && feeNumber >= 0;
  const needsReference = feeValid && feeNumber > 0;
  const canRelease = checked.length === requirements.length && feeValid && (!needsReference || reference.trim() !== "");

  const toggle = (label) => setChecked((prev) => (prev.includes(label) ? prev.filter((r) => r !== label) : [...prev, label]));

  const handleRelease = async () => {
    const ok = await run(() =>
      onSubmit(vehicle.id, {
        verifiedRequirements: checked,
        towingAndStorageFee: feeNumber,
        paymentReference: reference.trim() || null,
      })
    );
    if (ok) onDone();
  };

  return (
    <div>
      <p className="mb-2 mt-4 text-sm font-medium text-slate-700">Requisitos para liberar</p>
      <div className="space-y-2">
        {requirements.map((label) => (
          <label key={label} className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={checked.includes(label)} onChange={() => toggle(label)} className="h-4 w-4 rounded border-slate-300" />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
        <Field
          label="Costo de acarreo y estadía"
          required
          hint={`Sugerido: acarreo ${formatCurrency(ACARREO_BASE)} + estadía ${formatCurrency(ESTADIA_DIARIA)} × ${plural(suggestion.days, "día", "días")}.`}
        >
          <input type="number" min="0" step="1" value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Referencia de pago" required={needsReference} hint={needsReference ? undefined : "Solo si el costo es mayor que cero."}>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <ErrorNote title="No se pudo liberar el vehículo">{error}</ErrorNote>
      <Button className="mt-2 w-full" variant="success" disabled={!canRelease || acting} onClick={handleRelease}>
        {acting ? "Liberando..." : "Liberar vehículo"}
      </Button>
    </div>
  );
}

export function EditarRetencionForm({ vehicle, onSubmit, onDone, onCancel }) {
  const [motivo, setMotivo] = useState(vehicle.motivo);
  const [deposito, setDeposito] = useState(vehicle.deposito);
  const [dni, setDni] = useState(vehicle.titular);
  const { run, acting, error } = useAction();

  // Si el depósito actual no está en la lista habitual, se conserva como opción para no perderlo.
  const depots = DEPOTS.includes(vehicle.deposito) ? DEPOTS : [vehicle.deposito, ...DEPOTS];

  const handleSubmit = async (e) => {
    e.preventDefault();
    // El backend deja sin tocar lo que no se manda: se envía solo lo que cambió.
    const changes = {};
    if (motivo.trim() !== vehicle.motivo) changes.reason = motivo.trim();
    if (deposito !== vehicle.deposito) changes.depotLocation = deposito;
    if (dni.trim() !== vehicle.titular) changes.ownerNationalId = dni.trim();
    const ok = await run(async () => {
      if (Object.keys(changes).length === 0) throw new Error("No hay cambios para guardar.");
      if ("reason" in changes && !changes.reason) throw new Error("El motivo no puede quedar vacío.");
      if ("ownerNationalId" in changes && !changes.ownerNationalId) throw new Error("El DNI del titular no puede quedar vacío.");
      return onSubmit(vehicle.id, changes);
    });
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <p className="mb-3 text-sm font-semibold text-slate-700">Editar datos de la retención</p>
      <ErrorNote title="No se pudieron guardar los cambios">{error}</ErrorNote>
      <Field label="Motivo de la retención" hint={`Máximo ${MAX_REASON_LENGTH} caracteres.`}>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={MAX_REASON_LENGTH} className={inputCls} />
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Depósito">
          <select value={deposito} onChange={(e) => setDeposito(e.target.value)} className={inputCls}>
            {depots.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="DNI del titular">
          <input value={dni} onChange={(e) => setDni(e.target.value)} maxLength={30} inputMode="numeric" className={inputCls} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={acting}>
          {acting ? "Guardando..." : "Guardar cambios"}
        </Button>
        <Button type="button" variant="ghost" disabled={acting} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function VehiculosStaff({ impounded, resource, role, infractions, operations, onCreate, onUpdate, onRelease }) {
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [editing, setEditing] = useState(false);

  // Permisos del backend: el inspector registra el ingreso; el administrador libera.
  const canRegister = role === "INSPECTOR";
  const canRelease = role === "ADMINISTRADOR";

  // Se busca por id para que el detalle refleje lo que devuelve el backend tras recargar.
  const detail = impounded.find((v) => v.id === detailId) || null;

  const closeDetail = () => {
    setDetailId(null);
    setEditing(false);
  };

  const columns = [
    { header: "Patente", render: (r) => <span className="font-mono font-semibold">{r.patente}</span> },
    { header: "Origen", render: (r) => `${r.origen} · ${String(r.originId).slice(0, 8)}` },
    { header: "Ingreso", render: (r) => r.fechaIngreso },
    { header: "Depósito", render: (r) => r.deposito },
    { header: "Costo", render: (r) => (r.costo != null ? formatCurrency(r.costo) : "—") },
    { header: "Estado", render: (r) => <Badge tone={VEHICULO_ESTADO[r.estado]}>{r.estado}</Badge> },
  ];
  return (
    <div className="space-y-6">
      <SectionToolbar
        title="Vehículos retenidos"
        desc="Ingreso, seguimiento y liberación de vehículos en depósito."
        actions={
          canRegister && (
            <Button variant="accent" onClick={() => setOpen(true)}>
              <Plus size={16} /> Registrar ingreso
            </Button>
          )
        }
      />
      <ResourceStatus resource={resource} loadingText="Cargando vehículos retenidos..." />
      {resource.loaded && <DataTable columns={columns} data={impounded} onRowClick={(r) => setDetailId(r.id)} />}
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar ingreso de vehículo">
        <IngresoVehiculoForm infractions={infractions} operations={operations} onSubmit={onCreate} onDone={() => setOpen(false)} />
      </Modal>
      <Modal open={!!detail} onClose={closeDetail} title="Detalle del vehículo retenido">
        {detail && (
          <div>
            <dl className="space-y-2 text-sm">
              <Row label="Patente" value={detail.patente} />
              <Row label="DNI del titular" value={detail.titular} />
              <Row label="Motivo" value={detail.motivo} />
              <Row label="Origen" value={`${detail.origen} · ${String(detail.originId).slice(0, 8)}`} />
              <Row label="Depósito" value={detail.deposito} />
              <Row label="Ingreso" value={detail.fechaIngreso} />
              <Row label="Estado" value={detail.estado} />
            </dl>
            {detail.estado === "Retenido" && canRelease && editing && (
              <EditarRetencionForm vehicle={detail} onSubmit={onUpdate} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
            )}
            {detail.estado === "Retenido" && canRelease && !editing && (
              <>
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => setEditing(true)}>
                  Editar datos
                </Button>
                <LiberarVehiculoForm vehicle={detail} onSubmit={onRelease} onDone={closeDetail} />
              </>
            )}
            {detail.estado === "Retenido" && !canRelease && (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">La liberación la autoriza un administrador.</p>
            )}
            {detail.estado === "Liberado" && (
              <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
                <p className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={16} /> Vehículo liberado
                </p>
                <ul className="mt-2 space-y-1">
                  {detail.requisitos.map((r) => (
                    <li key={r}>· {r}</li>
                  ))}
                </ul>
                <p className="mt-2">Costo: {formatCurrency(detail.costo ?? 0)}</p>
                {detail.referenciaPago && <p>Referencia de pago: {detail.referenciaPago}</p>}
                {detail.liberadoPor && <p>Autorizó: {detail.liberadoPor}</p>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
