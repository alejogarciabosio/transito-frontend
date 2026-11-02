import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, DataTable, ErrorNote, Field, Modal, ResourceStatus, SectionToolbar } from "../../components/ui.jsx";
import { ACCIDENT_STATUS_UI, INJURY_OPTIONS, INJURY_OPTION_LABEL, inputCls } from "../../constants";
import { useAction } from "../../hooks/useAction";
import { cx, nowForInput, toApiDateTime } from "../../lib/format";

function CrearAccidenteForm({ onSubmit, onDone }) {
  const [calle, setCalle] = useState("");
  const [entrecalle, setEntrecalle] = useState("");
  const [fecha, setFecha] = useState(nowForInput);
  const [danos, setDanos] = useState(false);
  const [danoDesc, setDanoDesc] = useState("");
  const [personas, setPersonas] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [dniPersona, setDniPersona] = useState("");
  const [lesion, setLesion] = useState("NONE");
  const [patenteVeh, setPatenteVeh] = useState("");
  const [titularVeh, setTitularVeh] = useState("");
  const { run, acting, error } = useAction();

  const pendingPersona = () => (dniPersona.trim() ? [{ nationalId: dniPersona.trim(), injuryLevel: lesion }] : []);
  const pendingVehiculo = () =>
    patenteVeh.trim() ? [{ licensePlate: patenteVeh.trim().toUpperCase(), ownerNationalId: titularVeh.trim() || null }] : [];

  const addPersona = () => {
    setPersonas((p) => [...p, ...pendingPersona()]);
    setDniPersona("");
    setLesion("NONE");
  };
  const addVehiculo = () => {
    setVehiculos((v) => [...v, ...pendingVehiculo()]);
    setPatenteVeh("");
    setTitularVeh("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!calle.trim() || !fecha) return;
    const ok = await run(async () => {
      if (danos && !danoDesc.trim()) throw new Error("Describí los daños a la infraestructura.");
      // inspectorId no se manda: el backend lo toma del usuario logueado.
      return onSubmit({
        accidentDateTime: toApiDateTime(fecha),
        location: { street: calle.trim(), crossStreet: entrecalle.trim() || null },
        involvesInfrastructureDamage: danos,
        damageDescription: danos ? danoDesc.trim() : null,
        vehicles: [...vehiculos, ...pendingVehiculo()],
        persons: [...personas, ...pendingPersona()],
        originTicketId: null,
      });
    });
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit}>
      <ErrorNote title="No se pudo registrar el accidente">{error}</ErrorNote>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Calle" required>
          <input value={calle} onChange={(e) => setCalle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Entre calle">
          <input value={entrecalle} onChange={(e) => setEntrecalle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Fecha y hora" required>
          <input type="datetime-local" value={fecha} max={nowForInput()} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <Field label="Personas involucradas" hint="DNI y nivel de lesión.">
        <div className="flex gap-2">
          <input value={dniPersona} onChange={(e) => setDniPersona(e.target.value)} inputMode="numeric" placeholder="DNI" className={inputCls} />
          <select value={lesion} onChange={(e) => setLesion(e.target.value)} className={cx(inputCls, "w-36")}>
            {INJURY_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="secondary" aria-label="Agregar persona" onClick={addPersona}>
            <Plus size={14} />
          </Button>
        </div>
        {personas.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {personas.map((p, i) => (
              <li key={i}>
                · DNI {p.nationalId} — {INJURY_OPTION_LABEL[p.injuryLevel]}
              </li>
            ))}
          </ul>
        )}
      </Field>

      <Field label="Vehículos involucrados" hint="Patente y, si se conoce, DNI del titular.">
        <div className="flex gap-2">
          <input value={patenteVeh} onChange={(e) => setPatenteVeh(e.target.value.toUpperCase())} placeholder="Patente" className={inputCls} />
          <input value={titularVeh} onChange={(e) => setTitularVeh(e.target.value)} inputMode="numeric" placeholder="DNI titular" className={inputCls} />
          <Button type="button" variant="secondary" aria-label="Agregar vehículo" onClick={addVehiculo}>
            <Plus size={14} />
          </Button>
        </div>
        {vehiculos.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {vehiculos.map((v, i) => (
              <li key={i}>
                · {v.licensePlate}
                {v.ownerNationalId ? ` — titular DNI ${v.ownerNationalId}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Field>

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={danos} onChange={(e) => setDanos(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        Involucra daños a infraestructura pública
      </label>
      {danos && (
        <Field label="Descripción de los daños" required>
          <textarea value={danoDesc} onChange={(e) => setDanoDesc(e.target.value)} rows={3} className={inputCls} />
        </Field>
      )}

      <Button type="submit" variant="primary" className="mt-2 w-full" disabled={acting}>
        {acting ? "Registrando..." : "Registrar accidente"}
      </Button>
    </form>
  );
}

export function AccidentesStaff({ accidents, resource, role, onCreate, onVerify }) {
  const [open, setOpen] = useState(false);
  const page = useAction();

  // El backend deja registrar y verificar accidentes solo al inspector.
  const canOperate = role === "INSPECTOR";

  const columns = [
    { header: "Fecha", render: (r) => r.fecha },
    { header: "Ubicación", render: (r) => r.ubicacion },
    { header: "Personas", render: (r) => r.personas.length },
    { header: "Vehículos", render: (r) => r.vehiculos.length },
    { header: "Infraestructura", render: (r) => (r.danosInfraestructura ? <Badge tone="red">Sí</Badge> : <Badge tone="slate">No</Badge>) },
    { header: "Estado", render: (r) => <Badge tone={ACCIDENT_STATUS_UI[r.status]?.tone}>{ACCIDENT_STATUS_UI[r.status]?.label || r.status}</Badge> },
    // Solo el inspector verifica accidentes: para el administrador la pantalla es de consulta.
    ...(canOperate
      ? [
          {
            header: "Acciones",
            render: (r) =>
              r.status === "PRELIMINARY" ? (
                <Button size="sm" variant="secondary" disabled={page.acting} onClick={() => page.run(() => onVerify(r.id))}>
                  Verificar
                </Button>
              ) : null,
          },
        ]
      : []),
  ];
  return (
    <div className="space-y-6">
      <SectionToolbar
        title="Accidentes viales"
        desc={canOperate ? "Registro y seguimiento de siniestros de tránsito." : "Consulta de siniestros de tránsito (solo lectura)."}
        actions={
          canOperate && (
            <Button variant="accent" onClick={() => setOpen(true)}>
              <Plus size={16} /> Registrar accidente
            </Button>
          )
        }
      />
      <ErrorNote title="No se pudo completar la acción">{page.error}</ErrorNote>
      <ResourceStatus resource={resource} loadingText="Cargando accidentes..." />
      {resource.loaded && <DataTable columns={columns} data={accidents} />}
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar accidente vial" wide>
        <CrearAccidenteForm onSubmit={onCreate} onDone={() => setOpen(false)} />
      </Modal>
    </div>
  );
}

// ----- Vehículos retenidos -----
