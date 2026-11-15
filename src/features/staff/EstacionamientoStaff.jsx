import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { Badge, Button, DataTable, ErrorNote, Field, Modal, ResourceStatus, SectionToolbar } from "../../components/ui.jsx";
import { INFRACTION_TYPES, inputCls } from "../../constants";
import { useAction } from "../../hooks/useAction";
import { formatCurrency, formatLocalDate } from "../../lib/format";

// El backend responde 409 al borrar una tarifa si la zona tiene sesiones sin cerrar.
export const TARIFF_IN_USE_MESSAGE = "No se puede borrar: hay sesiones activas en esa zona/tarifa. Esperá a que se cierren e intentá de nuevo.";

async function deleteTariffWithClearError(onDelete, tariffId) {
  try {
    await onDelete(tariffId);
  } catch (err) {
    if (err?.status === 409) throw new Error(TARIFF_IN_USE_MESSAGE, { cause: err });
    throw err;
  }
}

function ZonaForm({ zone, onSubmit, onDone }) {
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

function TarifasPanel({ zone, onCreate, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null); // tarifa pendiente de confirmar la baja
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { run, acting, error, setError } = useAction();
  const del = useAction();

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
      if (!(body.pricePerHour > 0)) throw new Error("El precio por hora tiene que ser mayor que cero.");
      if (body.validTo < body.validFrom) throw new Error("La fecha final no puede ser anterior a la inicial.");
      // En edición no se manda zoneId: la tarifa no cambia de zona.
      return editing ? onUpdate(editing.tariffId, body) : onCreate({ zoneId: zone.id, ...body });
    });
    if (ok) reset();
  };

  const columns = [
    { header: "Precio por hora", render: (t) => formatCurrency(t.pricePerHour) },
    { header: "Desde", render: (t) => formatLocalDate(t.validFrom) },
    { header: "Hasta", render: (t) => formatLocalDate(t.validTo) },
    {
      header: "Acciones",
      render: (t) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => startEdit(t)}>
            Editar
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              del.setError("");
              setDeleting(t);
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
      <DataTable columns={columns} data={zone.tarifas} keyField="tariffId" emptyLabel="Esta zona todavía no tiene tarifas" />
      {deleting && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm">
          <p className="font-semibold text-red-700">
            ¿Eliminar la tarifa de {formatCurrency(deleting.pricePerHour)}/hora ({formatLocalDate(deleting.validFrom)} al {formatLocalDate(deleting.validTo)})?
          </p>
          <p className="mt-1 text-red-700">Dejará de mostrarse en la zona. Esta acción no se puede deshacer desde acá.</p>
          {del.error && (
            <p className="mt-2 flex items-center gap-2 font-medium text-red-700">
              <AlertCircle size={15} /> {del.error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="accent"
              disabled={del.acting}
              onClick={async () => {
                if (await del.run(() => deleteTariffWithClearError(onDelete, deleting.tariffId))) {
                  if (editing?.tariffId === deleting.tariffId) reset();
                  setDeleting(null);
                }
              }}
            >
              {del.acting ? "Eliminando..." : "Sí, eliminar tarifa"}
            </Button>
            <Button size="sm" variant="ghost" disabled={del.acting} onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-6">
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

function FaltaPagoForm({ session, zoneName, onSubmit, onDone }) {
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
        <p className="text-slate-600">
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
  flaggedSessionIds = new Set(),
  role,
  onCreateZone,
  onUpdateZone,
  onDeleteZone,
  onCreateTariff,
  onUpdateTariff,
  onDeleteTariff,
  onFlagUnpaid,
}) {
  const [zoneModal, setZoneModal] = useState(null); // "new" o la zona a editar
  const [tariffZoneId, setTariffZoneId] = useState(null);
  const [flagTarget, setFlagTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // zona pendiente de confirmar la baja
  const deletion = useAction();

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
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      deletion.setError("");
                      setDeleteTarget(r);
                    }}
                  >
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
    {
      header: "Pago",
      render: (r) =>
        r.pagada ? (
          <Badge tone="emerald">Pagada</Badge>
        ) : flaggedSessionIds.has(r.id) ? (
          <Badge tone="red">Sin pagar · infracción generada</Badge>
        ) : (
          <Badge tone="amber">Sin pagar</Badge>
        ),
    },
    ...(isInspector
      ? [
          {
            header: "Acciones",
            // El backend admite una sola infracción por sesión: si ya se generó, no se ofrece de nuevo.
            render: (r) =>
              r.pagada || flaggedSessionIds.has(r.id) ? null : (
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
          <p className="mb-3 text-xs text-slate-500">Marcar la falta de pago de una sesión genera una infracción en la gestión de infracciones.</p>
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
        {deleteTarget && (
          <div>
            <p className="text-sm text-slate-600">
              ¿Seguro que querés eliminar la zona <span className="font-semibold text-slate-900">{deleteTarget.nombre}</span>? Pasa a estado
              Inactiva y deja de mostrarse a los vecinos; las sesiones ya registradas se conservan.
            </p>
            <div className="mt-4">
              <ErrorNote title="No se pudo eliminar la zona">{deletion.error}</ErrorNote>
            </div>
            <div className="flex gap-2">
              <Button
                variant="accent"
                disabled={deletion.acting}
                onClick={async () => {
                  if (await deletion.run(() => onDeleteZone(deleteTarget.id))) setDeleteTarget(null);
                }}
              >
                {deletion.acting ? "Eliminando..." : "Sí, eliminar zona"}
              </Button>
              <Button variant="ghost" disabled={deletion.acting} onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!flagTarget} onClose={() => setFlagTarget(null)} title="Marcar falta de pago">
        {flagTarget && <FaltaPagoForm session={flagTarget} zoneName={zoneName(flagTarget.zonaId)} onSubmit={onFlagUnpaid} onDone={() => setFlagTarget(null)} />}
      </Modal>
    </div>
  );
}

