import { ACARREO_BASE, CLOSURE_STATUS_STAFF, ESTADIA_DIARIA, IMPOUNDMENT_ORIGIN_LABEL, IMPOUNDMENT_STATUS_UI, INFRACTION_STATUS_LABEL, INFRACTION_TYPE_LABEL, OPERATION_RESOLUTION_LABEL, OPERATION_TYPE_LABEL, REQUESTING_MODULE_LABEL } from "../constants";
import { formatDateTime } from "./format";

// Adapta una infracción tal como la devuelve el backend (GET /infractions y
// GET /infractions/mine) a la forma que usan las pantallas del vecino y del panel.
export function mapApiInfraction(api) {
  return {
    id: api.infractionId,
    tipo: api.infractionType,
    tipoLabel: INFRACTION_TYPE_LABEL[api.infractionType] || api.infractionType,
    patente: api.licensePlate,
    calle: [api.location?.street, api.location?.crossStreet].filter(Boolean).join(" y "),
    inspector: api.inspectorId,
    infractor: api.offenderNationalId,
    evidencias: api.evidenceUrl || [],
    agravantes: api.aggravatingFactors || [],
    monto: api.finalAmount ?? api.baseAmount,
    estado: INFRACTION_STATUS_LABEL[api.status] || api.status,
    fecha: formatDateTime(api.infractionDateTime),
    // Hoy el backend no guarda ni devuelve el texto del descargo (solo lo publica en el
    // evento infractionAppealed; ver HU-INF-04). Si más adelante agrega `appealReason`,
    // las pantallas lo muestran solas.
    motivoDescargo: api.appealReason,
    // Sesión de estacionamiento que originó la infracción (falta de pago), si la hay.
    sesionOrigenId: api.originParkingSessionId ?? null,
  };
}

export function mapApiClosure(api) {
  return {
    id: api.streetClosureId,
    solicitante: REQUESTING_MODULE_LABEL[api.requestingModule] || api.requestingModule,
    calle: (api.affectedStreet || []).join(", "),
    fechaInicio: formatDateTime(api.startDate),
    fechaFin: formatDateTime(api.endDate),
    // Fechas originales (ISO con offset): sirven para precargar la ventana autorizada.
    inicioISO: api.startDate,
    finISO: api.endDate,
    estado: CLOSURE_STATUS_STAFF[api.status] || api.status,
    desvios: api.detours || [],
    condiciones: api.conditions || [],
  };
}

export function mapApiOperation(api) {
  return {
    id: api.operationId,
    tipo: OPERATION_TYPE_LABEL[api.type] || api.type,
    zona: api.zone,
    inicio: formatDateTime(api.startDateTime),
    fin: api.endDateTime ? formatDateTime(api.endDateTime) : "—",
    inspectores: api.assignedInspectors || [],
    moviles: api.assignedUnits || [],
    status: api.status,
    resolucion: api.resolution ? OPERATION_RESOLUTION_LABEL[api.resolution] || api.resolution : null,
  };
}

export function mapApiAccident(api) {
  return {
    id: api.accidentId,
    fecha: formatDateTime(api.accidentDateTime),
    ubicacion: [api.location?.street, api.location?.crossStreet].filter(Boolean).join(" y "),
    personas: api.persons || [],
    vehiculos: api.vehicles || [],
    danosInfraestructura: !!api.involvesInfrastructureDamage,
    danoDesc: api.damageDescription,
    status: api.status,
  };
}

export function suggestFee(entryDateTime) {
  const days = Math.max(1, Math.ceil((Date.now() - new Date(entryDateTime).getTime()) / 86400000) || 1);
  return { days, total: ACARREO_BASE + ESTADIA_DIARIA * days };
}

export function mapApiImpoundment(api) {
  return {
    id: api.impoundmentId,
    patente: api.licensePlate,
    titular: api.ownerNationalId,
    motivo: api.reason,
    deposito: api.depotLocation,
    origen: IMPOUNDMENT_ORIGIN_LABEL[api.originType] || api.originType,
    originId: api.originId,
    ingresoISO: api.entryDateTime,
    fechaIngreso: formatDateTime(api.entryDateTime),
    estado: IMPOUNDMENT_STATUS_UI[api.status]?.label || api.status,
    requisitos: api.verifiedRequirements || [],
    costo: api.towingAndStorageFee,
    referenciaPago: api.paymentReference,
    liberadoPor: api.releasedBy,
  };
}

export function mapApiZone(api) {
  return {
    id: api.zoneId,
    nombre: api.name,
    limites: api.boundaries,
    horario: api.allowedHours,
    activa: api.status === "ACTIVE",
    tarifaVigente: api.tariff?.pricePerHour ?? null,
    tarifas: api.tariffs || [],
  };
}

export function mapApiSession(api) {
  return {
    id: api.sessionId,
    patente: api.licensePlate,
    zonaId: api.zoneId,
    inicio: formatDateTime(api.startDateTime),
    fin: api.endDateTime ? formatDateTime(api.endDateTime) : null,
    pagada: !!api.paid,
  };
}
