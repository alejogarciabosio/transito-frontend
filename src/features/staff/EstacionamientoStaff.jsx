import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  ErrorNote,
  Field,
  Modal,
  ResourceStatus,
  SectionToolbar,
  inputCls,
} from "../../components/ui.jsx";
import { INFRACTION_TYPES } from "../../constants";
import { useAction } from "../../hooks/useAction";
import { formatCurrency } from "../../utils/format";

export function ZonaForm({ zone, onSubmit, onDone }) {
  const [name, setName] = useState(zone?.nombre ?? "");
  const [boundaries, setBoundaries] = useState(zone?.limites ?? "");
  const [hours, setHours] = useState(zone?.horario ?? "");
  const [status, setStatus] = useState(zone && !zone.activa ? "INACTIVE" : "ACTIVE");
  const { run, acting, error } = useAction();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !boundaries.trim() || !hours.trim()) return;
    const body = { name: name.trim(), boundaries: boundaries.trim(), allowedHours: hours.trim() };
    const ok = await run(() => onSubmit(zone ? { ...body, status } : body));
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit}>
      <ErrorNote title={zone ? "No se pudo guardar la zona" : "No se pudo crear la zona"}>{error}</ErrorNote>
      <Field label="Nombre" required>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Zona Azul — Microcentro" />
      </Field>
      <Field label="Límites" required hint="Calles que delimitan la zona.">
        <input value={boundaries} onChange={(e) => setBoundaries(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Horario permitido" required>
        <input value={hours} onChange={(e) => setHours(e.target.value)} className={inputCls} placeholder="8 a 20 hs" />
      </Field>
      {zone && (
        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            <option value="ACTIVE">Activa</option>
            <option value="INACTIVE">Inactiva</option>
          </select>
        </Field>
      )}
      <Button type="submit" variant="primary" className="mt-2 w-full" disabled={acting}>
        {acting ? "Guardando..." : zone ? "Guardar cambios" : "Crear zona"}
      </Button>
    </form>
  );
}

export function EliminarZonaForm({ zone, onConfirm, onDone, onCancel }) {
  const { run, acting, error } = useAction();

  const handleConfirm = async () => {
    const ok = await run(() => onConfirm(zone.id));
    if (ok) onDone();
  };

  return (
    <div>
      <ErrorNote title="No se pudo eliminar la zona">{error}</ErrorNote>
      <p className="text-sm text-slate-600">
        ¿Querés eliminar la zona <span className="font-semibold text-slate-900">{zone.nombre}</span>?
      </p>
      <p className="mt-2 text-sm text-slate-500">
        La zona pasa a estado inactivo y deja de mostrarse a los vecinos. Podés volver a activarla desde Editar.
      </p>
      <div className="mt-5 flex gap-2">
        <Button variant="danger" disabled={acting} onClick={handleConfirm}>
          {acting ? "Eliminando..." : "Eliminar zona"}
        </Button>
        <Button variant="ghost" disabled={acting} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function TarifasPanel({ zone, onCreate, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { run, acting, error, setError } = useAction();
  const removal = useAction();

  const startEdit = (t) => {
    setEditing(t);
    setPrice(String(t.pricePerHour));
    setFrom(t.validFrom);
    setTo(t.validTo || "");
    setError("");
  };
  const reset = () => {
    setEditing(null);
    setPrice("");
    setFrom("");
    setTo("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!price || !from || !to) return;
    const body = { pricePerHour: Number(price), validFrom: from, validTo: to };
    const ok = await run(async () => {
      if (!(body.pricePerHour > 0)) throw new Error("El importe por hora tiene que ser mayor a cero.");
      if (body.validTo < body.validFrom) throw new Error("La fecha de fin no puede ser anterior a la de inicio.");
      return editing ? onUpdate(editing.tariffId, body) : onCreate({ zoneId: zone.id, ...body });
    });
    if (ok) reset();
  };

  const handleDelete = async (tariff) => {
    const ok = await removal.run(() => onDelete(tariff.tariffId));
    setConfirmingId(null);
    // Si justo se estaba editando la tarifa borrada, se limpia el formulario.
    if (ok && editing?.tariffId === tariff.tariffId) reset();
  };

  const columns = [
    { header: "Precio por hora", render: (t) => formatCurrency(t.pricePerHour) },
    { header: "Desde", render: (t) => t.validFrom },
    { header: "Hasta", render: (t) => t.validTo || "—" },
    {
      header: "Acciones",
      render: (t) =>
        confirmingId === t.tariffId ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">¿Eliminar esta tarifa?</span>
            <Button size="sm" variant="danger" disabled={removal.acting} onClick={() => handleDelete(t)}>
              Sí, eliminar
            </Button>
            <Button size="sm" variant="ghost" disabled={removal.acting} onClick={() => setConfirmingId(null)}>
              No
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => startEdit(t)}>
              Editar
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                removal.setError("");
                setConfirmingId(t.tariffId);
              }}
            >
              Eliminar
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div>
      <ErrorNote title="No se pudo eliminar la tarifa">{removal.error}</ErrorNote>
      <DataTable columns={columns} data={zone.tarifas} keyField="tariffId" emptyLabel="Esta zona todavía no tiene tarifas" />
      {/* noValidate: las validaciones (importe > 0, fin >= inicio) se muestran en pantalla, no con la burbuja del navegador */}
      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <p className="mb-3 text-sm font-semibold text-slate-700">{editing ? "Editar tarifa" : "Nueva tarifa"}</p>
        <ErrorNote title="No se pudo guardar la tarifa">{error}</ErrorNote>
        <div className="grid gap-x-4 sm:grid-cols-3">
          <Field label="Precio por hora" required>
            <input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Vigente desde" required>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Vigente hasta" required>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={acting}>
            {acting ? "Guardando..." : editing ? "Guardar tarifa" : "Agregar tarifa"}
          </Button>
          {editing && (
            <Button type="button" variant="ghost" onClick={reset}>
              Cancelar edición
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export function FaltaPagoForm({ session, zoneName, onSubmit, onDone }) {
  const [amount, setAmount] = useState(String(INFRACTION_TYPES.find((t) => t.code === "UNPAID_PARKING").base));
  const { run, acting, error } = useAction();
  const amountNumber = Number(amount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!(amountNumber > 0)) return;
    const ok = await run(() => onSubmit(session.id, amountNumber));
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4 rounded-lg bg-slate-50 p-4 text-sm">
        <p className="font-mono font-semibold text-slate-800">{session.patente}</p>
        <p className="text-slate-500">
          {zoneName} · desde {session.inicio}
        </p>
      </div>
      <ErrorNote title="No se pudo generar la infracción">{error}</ErrorNote>
      <Field label="Importe base de la infracción" required hint="Se genera una infracción por estacionamiento medido sin pago, visible en Infracciones.">
        <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
      </Field>
      <Button type="submit" variant="danger" className="w-full" disabled={acting || !(amountNumber > 0)}>
        {acting ? "Generando..." : "Generar infracción"}
      </Button>
    </form>
  );
}

export function EstacionamientoStaff({
  zones,
  zonesResource,
  sessions,
  sessionsResource,
  role,
  onCreateZone,
  onUpdateZone,
  onCreateTariff,
  onUpdateTariff,
  onDeleteZone,
  onDeleteTariff,
  onFlagUnpaid,
}) {
  const [zoneModal, setZoneModal] = useState(null); // "new" o la zona a editar
  const [tariffZoneId, setTariffZoneId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [flagTarget, setFlagTarget] = useState(null);

  // Permisos del backend: el administrador configura zonas y tarifas; el inspector marca la falta de pago.
  const isAdmin = role === "ADMINISTRADOR";
  const isInspector = role === "INSPECTOR";

  const zoneName = (id) => zones.find((z) => z.id === id)?.nombre ?? "—";
  const tariffZone = zones.find((z) => z.id === tariffZoneId) || null;

  const zoneColumns = [
    { header: "Zona", render: (r) => r.nombre },
    { header: "Horario", render: (r) => r.horario },
    { header: "Límites", render: (r) => r.limites },
    { header: "Tarifa vigente", render: (r) => (r.tarifaVigente != null ? `${formatCurrency(r.tarifaVigente)}/hora` : "Sin tarifa vigente") },
    { header: "Estado", render: (r) => <Badge tone={r.activa ? "emerald" : "slate"}>{r.activa ? "Activa" : "Inactiva"}</Badge> },
    ...(isAdmin
      ? [
          {
            header: "Acciones",
            render: (r) => (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setZoneModal(r)}>
                  Editar
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setTariffZoneId(r.id)}>
                  Tarifas
                </Button>
                {r.activa && (
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget(r)}>
                    Eliminar
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  const sessionColumns = [
    { header: "Patente", render: (r) => <span className="font-mono font-semibold">{r.patente}</span> },
    { header: "Zona", render: (r) => zoneName(r.zonaId) },
    { header: "Inicio", render: (r) => r.inicio },
    { header: "Fin", render: (r) => r.fin || "En curso" },
    { header: "Pago", render: (r) => <Badge tone={r.pagada ? "emerald" : "amber"}>{r.pagada ? "Pagada" : "Sin pagar"}</Badge> },
    ...(isInspector
      ? [
          {
            header: "Acciones",
            render: (r) =>
              r.pagada ? null : (
                <Button size="sm" variant="danger" onClick={() => setFlagTarget(r)}>
                  Marcar falta de pago
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      <SectionToolbar
        title="Estacionamiento medido"
        desc={isAdmin ? "Configuración de zonas, horarios y tarifas." : "Zonas configuradas y sesiones de estacionamiento."}
        actions={
          isAdmin && (
            <Button variant="accent" onClick={() => setZoneModal("new")}>
              <Plus size={16} /> Nueva zona
            </Button>
          )
        }
      />
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700">Zonas configuradas</p>
        <ResourceStatus resource={zonesResource} loadingText="Cargando zonas..." />
        {zonesResource.loaded && <DataTable columns={zoneColumns} data={zones} emptyLabel="Todavía no hay zonas configuradas" />}
      </div>
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700">Sesiones de estacionamiento</p>
        {isInspector && (
          <p className="mb-3 text-xs text-slate-400">Marcar la falta de pago de una sesión genera una infracción en la gestión de infracciones.</p>
        )}
        <ResourceStatus resource={sessionsResource} loadingText="Cargando sesiones..." />
        {sessionsResource.loaded && <DataTable columns={sessionColumns} data={sessions} emptyLabel="Todavía no hay sesiones registradas" />}
      </div>

      <Modal open={!!zoneModal} onClose={() => setZoneModal(null)} title={zoneModal === "new" ? "Nueva zona" : "Editar zona"}>
        {zoneModal && (
          <ZonaForm
            zone={zoneModal === "new" ? null : zoneModal}
            onSubmit={zoneModal === "new" ? onCreateZone : (data) => onUpdateZone(zoneModal.id, data)}
            onDone={() => setZoneModal(null)}
          />
        )}
      </Modal>

      <Modal open={!!tariffZone} onClose={() => setTariffZoneId(null)} title={tariffZone ? `Tarifas — ${tariffZone.nombre}` : "Tarifas"} wide>
        {tariffZone && <TarifasPanel zone={tariffZone} onCreate={onCreateTariff} onUpdate={onUpdateTariff} onDelete={onDeleteTariff} />}
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar zona">
        {deleteTarget && <EliminarZonaForm zone={deleteTarget} onConfirm={onDeleteZone} onDone={() => setDeleteTarget(null)} onCancel={() => setDeleteTarget(null)} />}
      </Modal>

      <Modal open={!!flagTarget} onClose={() => setFlagTarget(null)} title="Marcar falta de pago">
        {flagTarget && <FaltaPagoForm session={flagTarget} zoneName={zoneName(flagTarget.zonaId)} onSubmit={onFlagUnpaid} onDone={() => setFlagTarget(null)} />}
      </Modal>
    </div>
  );
}
