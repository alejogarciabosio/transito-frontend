import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, DataTable, ErrorNote, Field, Modal, ResourceStatus, SectionToolbar } from "../../components/ui.jsx";
import { INSPECTORS, OPERATION_RESOLUTIONS, OPERATION_STATUS_UI, OPERATION_TYPES, inputCls } from "../../constants";
import { useAction } from "../../hooks/useAction";
import { cx, nowForInput, toApiDateTime } from "../../lib/format";

function CrearOperativoForm({ onSubmit, onDone }) {
  const [tipo, setTipo] = useState(OPERATION_TYPES[0].code);
  const [zona, setZona] = useState("");
  const [inicio, setInicio] = useState(nowForInput);
  const [fin, setFin] = useState("");
  const [inspectores, setInspectores] = useState([]);
  const [moviles, setMoviles] = useState("");
  const { run, acting, error } = useAction();

  const toggleInsp = (name) => setInspectores((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!zona.trim() || !inicio || inspectores.length === 0) return;
    const ok = await run(() =>
      onSubmit({
        type: tipo,
        zone: zona.trim(),
        startDateTime: toApiDateTime(inicio),
        endDateTime: fin ? toApiDateTime(fin) : null,
        assignedInspectors: inspectores,
        assignedUnits: moviles
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
        ticketId: null,
      })
    );
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit}>
      <ErrorNote title="No se pudo crear el operativo">{error}</ErrorNote>
      <Field label="Tipo de operativo">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
          {OPERATION_TYPES.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Zona" required>
          <input value={zona} onChange={(e) => setZona(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Móviles asignados" hint="Separados por coma.">
          <input value={moviles} onChange={(e) => setMoviles(e.target.value)} placeholder="M-04, M-11" className={inputCls} />
        </Field>
        <Field label="Inicio" required>
          <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Fin" hint="Opcional.">
          <input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Inspectores asignados" required>
        <div className="flex flex-wrap gap-2">
          {INSPECTORS.map((i) => (
            <button
              type="button"
              key={i}
              onClick={() => toggleInsp(i)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                inspectores.includes(i) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"
              )}
            >
              {i}
            </button>
          ))}
        </div>
      </Field>
      <Button type="submit" variant="primary" className="mt-2 w-full" disabled={acting}>
        {acting ? "Creando..." : "Crear operativo"}
      </Button>
    </form>
  );
}

export function OperativosStaff({ operativos, resource, role, onCreate, onClose }) {
  const [open, setOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState(null);
  const [resolution, setResolution] = useState(OPERATION_RESOLUTIONS[0].code);
  const closing = useAction();

  // El backend deja crear y cerrar operativos solo al inspector.
  const canOperate = role === "INSPECTOR";

  const dismissClose = () => {
    setCloseTarget(null);
    closing.setError("");
  };

  const columns = [
    { header: "Tipo", render: (r) => r.tipo },
    { header: "Zona", render: (r) => r.zona },
    { header: "Inicio", render: (r) => r.inicio },
    { header: "Fin", render: (r) => r.fin },
    { header: "Inspectores", render: (r) => r.inspectores.join(", ") || "—" },
    { header: "Móviles", render: (r) => r.moviles.join(", ") || "—" },
    {
      header: "Estado",
      render: (r) => (
        <div>
          <Badge tone={OPERATION_STATUS_UI[r.status]?.tone}>{OPERATION_STATUS_UI[r.status]?.label || r.status}</Badge>
          {r.resolucion && <p className="mt-1 text-xs text-slate-600">{r.resolucion}</p>}
        </div>
      ),
    },
    // Solo el inspector cierra operativos: para el administrador la pantalla es de consulta.
    ...(canOperate
      ? [
          {
            header: "Acciones",
            render: (r) =>
              r.status === "OPEN" ? (
                <Button size="sm" variant="secondary" onClick={() => setCloseTarget(r)}>
                  Cerrar
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <SectionToolbar
        title="Operativos de tránsito"
        desc={canOperate ? "Planificación y seguimiento de operativos en la vía pública." : "Consulta de operativos en la vía pública (solo lectura)."}
        actions={
          canOperate && (
            <Button variant="accent" onClick={() => setOpen(true)}>
              <Plus size={16} /> Nuevo operativo
            </Button>
          )
        }
      />
      <ResourceStatus resource={resource} loadingText="Cargando operativos..." />
      {resource.loaded && <DataTable columns={columns} data={operativos} />}

      <Modal open={open} onClose={() => setOpen(false)} title="Crear operativo">
        <CrearOperativoForm onSubmit={onCreate} onDone={() => setOpen(false)} />
      </Modal>

      <Modal open={!!closeTarget} onClose={dismissClose} title="Cerrar operativo">
        {closeTarget && (
          <div>
            <div className="mb-4 rounded-lg bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-800">
                {closeTarget.tipo} · {closeTarget.zona}
              </p>
              <p className="text-slate-600">{closeTarget.inicio}</p>
            </div>
            <ErrorNote title="No se pudo cerrar">{closing.error}</ErrorNote>
            <Field label="Resultado del operativo" required>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} className={inputCls}>
                {OPERATION_RESOLUTIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              variant="primary"
              className="w-full"
              disabled={closing.acting}
              onClick={async () => {
                if (await closing.run(() => onClose(closeTarget.id, resolution))) dismissClose();
              }}
            >
              {closing.acting ? "Cerrando..." : "Cerrar operativo"}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ----- Accidentes -----
