import {
  Car,
  ClipboardList,
  FileWarning,
  LayoutDashboard,
  ParkingCircle,
  Siren,
  TrafficCone,
} from "lucide-react";

export const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

export const INSPECTORS = ["Insp. Diaz", "Insp. Romero", "Insp. Fernández", "Insp. Gómez"];

// Códigos = enum InfractionType del backend. `base` es el importe base que arma el
// front (el backend solo guarda baseAmount/finalAmount, no calcula tarifas).
export const INFRACTION_TYPES = [
  { code: "ILLEGAL_PARKING", label: "Estacionamiento prohibido", short: "Estac. prohibido", base: 15000 },
  { code: "SPEEDING", label: "Exceso de velocidad", short: "Velocidad", base: 45000 },
  { code: "RED_LIGHT", label: "Cruce en semáforo rojo", short: "Semáforo", base: 60000 },
  { code: "UNPAID_PARKING", label: "Estacionamiento medido sin pago", short: "Estac. medido", base: 18000 },
  { code: "NO_LICENSE", label: "Sin licencia de conducir", short: "Sin licencia", base: 25000 },
  { code: "RECKLESS_DRIVING", label: "Conducción imprudente", short: "Imprudente", base: 50000 },
  { code: "OTHER", label: "Otra infracción", short: "Otra", base: 20000 },
];

export const AGGRAVATING_FACTORS = [
  { code: "REINCIDENCIA", label: "Reincidencia", pct: 0.5 },
  { code: "ZONA_ESCOLAR", label: "Zona escolar", pct: 0.3 },
  { code: "ALTA_VELOCIDAD", label: "Alta velocidad registrada", pct: 0.4 },
  { code: "RESISTENCIA", label: "Resistencia a la autoridad", pct: 0.2 },
];

// Requisitos de liberación: el backend guarda el código tal cual se envía en
// verifiedRequirements (texto libre, al menos uno); acá se les pone etiqueta.
export const REQUISITO_LABEL = {
  DOCUMENTACION: "Documentación del vehículo",
  PAGO_MULTA: "Multa abonada",
  VERIFICACION_TECNICA: "Verificación técnica",
};

export const BADGE_TONES = {
  slate: "bg-slate-100 text-slate-600",
  emerald: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  orange: "bg-orange-100 text-orange-700",
};

export const TONE_TEXT = {
  red: "text-red-700 bg-red-50",
  orange: "text-orange-600 bg-orange-50",
  sky: "text-sky-600 bg-sky-50",
  slate: "text-slate-700 bg-slate-100",
  amber: "text-amber-600 bg-amber-50",
};

export const INFRACCION_ESTADO = {
  Pendiente: "amber",
  Apelada: "sky",
  Confirmada: "red",
  Anulada: "emerald",
};

// InfractionType / InfractionStatus tal como los devuelve el backend real
// (sección 4 de la guía de integración) — no coinciden con los códigos del
// mock, así que acá se traducen para no tener que reescribir las pantallas.
export const INFRACTION_TYPE_LABEL = Object.fromEntries(INFRACTION_TYPES.map((t) => [t.code, t.label]));

export const INFRACTION_STATUS_LABEL = {
  PENDING_APPEAL: "Pendiente",
  APPEALED: "Apelada",
  CONFIRMED: "Confirmada",
  ANNULLED: "Anulada",
};

export const CORTE_ESTADO = {
  Pendiente: "amber",
  Aprobado: "sky",
  Rechazado: "red",
  Activo: "orange",
  Finalizado: "slate",
  Vencido: "amber",
};

export const VEHICULO_ESTADO = { Retenido: "red", Liberado: "emerald" };

// Enums del backend usados en el Portal vecino (guía de integración §4)
export const CLOSURE_STATUS_UI = {
  APPROVED: { label: "Próximo", tone: "sky" },
  ACTIVE: { label: "Activo", tone: "orange" },
};

export const REQUESTING_MODULE_LABEL = { OBRAS: "Obras", AMBIENTE: "Ambiente" };

export const IMPOUNDMENT_STATUS_UI = {
  IMPOUNDED: { label: "Retenido", tone: "red" },
  RELEASED: { label: "Liberado", tone: "emerald" },
};

export const IMPOUNDMENT_ORIGIN_LABEL = { INFRACTION: "Infracción", OPERATION: "Operativo de control" };

export const ACCIDENT_STATUS_UI = {
  PRELIMINARY: { label: "En revisión", tone: "amber" },
  VERIFIED: { label: "Verificado", tone: "emerald" },
};

export const INJURY_LEVEL_LABEL = { NONE: "sin lesiones", MINOR: "lesiones leves", SEVERE: "lesiones graves" };

export const STAFF_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "infracciones", label: "Infracciones", icon: FileWarning },
  { id: "cortes", label: "Cortes de calle", icon: TrafficCone },
  { id: "operativos", label: "Operativos", icon: ClipboardList },
  { id: "accidentes", label: "Accidentes", icon: Siren },
  { id: "vehiculos", label: "Vehículos retenidos", icon: Car },
  { id: "estacionamiento", label: "Estacionamiento medido", icon: ParkingCircle },
];

export const ROLE_LABEL = {
  INSPECTOR: "Inspector",
  ADMINISTRADOR: "Administrador",
  CIUDADANO: "Vecino",
  AUDITOR: "Auditor",
};

export const FOOTER_LINKS = [
  { label: "Mis infracciones", target: "infracciones" },
  { label: "Estacionamiento medido", target: "estacionamiento" },
  { label: "Cortes de calle", target: "cortes" },
  { label: "Vehículos retenidos", target: "vehiculos" },
];

export const CITIZEN_ONLY_TEXT = "Esta consulta está disponible para vecinos que ingresan con su cuenta de ciudadano.";

export const CLOSURE_STATUS_STAFF = {
  REQUESTED: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  ACTIVE: "Activo",
  FINISHED: "Finalizado",
  EXPIRED: "Vencido",
};

export const OPERATION_TYPES = [
  { code: "ROUTINE_CONTROL", label: "Control de rutina" },
  { code: "COMPLAINT_VERIFICATION", label: "Verificación de denuncia" },
  { code: "SAFETY_INSPECTION", label: "Inspección de seguridad" },
];

export const OPERATION_TYPE_LABEL = Object.fromEntries(OPERATION_TYPES.map((t) => [t.code, t.label]));

export const OPERATION_RESOLUTIONS = [
  { code: "INFRACTION_CREATED", label: "Se generó una infracción" },
  { code: "ACCIDENT_REGISTERED", label: "Se registró un accidente" },
  { code: "NO_ACTION", label: "Sin novedades" },
];

export const OPERATION_RESOLUTION_LABEL = Object.fromEntries(OPERATION_RESOLUTIONS.map((r) => [r.code, r.label]));

export const OPERATION_STATUS_UI = {
  OPEN: { label: "Abierto", tone: "amber" },
  CLOSED: { label: "Cerrado", tone: "emerald" },
};

export const INJURY_OPTIONS = [
  { code: "NONE", label: "Sin lesión" },
  { code: "MINOR", label: "Leve" },
  { code: "SEVERE", label: "Grave" },
];

export const INJURY_OPTION_LABEL = Object.fromEntries(INJURY_OPTIONS.map((o) => [o.code, o.label.toLowerCase()]));

export const DEPOTS = ["Depósito Norte", "Depósito Sur", "Depósito Central"];

// Valores de referencia que ya traía el mock: el backend solo guarda el costo total que se informa al liberar.
export const ACARREO_BASE = 25000;

export const ESTADIA_DIARIA = 3000;
