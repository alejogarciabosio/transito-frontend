import { useState, useEffect, useCallback } from "react";
import {
  Search,
  FileWarning,
  FileSignature,
  ParkingCircle,
  TrafficCone,
  Car,
  Siren,
  ArrowUpRight,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  X,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  ClipboardList,
  Plus,
  Filter,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import { getMyInfractions, appealInfraction } from "./services/infractions";
import { getActiveZonesWithTariff } from "./services/parking";
import { getCurrentStreetClosures } from "./services/streetClosures";
import { getMyImpoundments } from "./services/impoundments";
import { getMyAccidents } from "./services/accidents";
import { getCurrentNationalId } from "./services/api";

/**
 * Módulo 7 — Tránsito, Estacionamiento y Seguridad Vial
 * Frontend de demostración (mock, sin backend real) que cubre:
 *  F1 Gestión de infracciones · F2 Cortes de calle · F3 Operativos
 *  F4 Accidentes viales · F5 Vehículos retenidos · F6 Estacionamiento medido
 *  F7 Consultas e indicadores
 * Incluye Portal Vecino (ciudadano) y Panel Interno (inspector / agente).
 * Listo para conectarse a la API REST real del backend del módulo.
 */

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

const cx = (...classes) => classes.filter(Boolean).join(" ");

const formatCurrency = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
};

// LocalDate del backend ("2026-12-31") → "31/12/2026". No se usa new Date()
// porque lo interpretaría como UTC y en Argentina mostraría el día anterior.
const formatLocalDate = (s) => (s ? s.split("-").reverse().join("/") : "—");

// "1 activo" / "2 activos"
const plural = (n, singular, pluralForm) => `${n} ${n === 1 ? singular : pluralForm}`;

/**
 * Carga una lista desde el backend y expone { data, loading, loaded, error, reload }.
 * `loader` tiene que ser una función estable (las de services/ lo son).
 * Con enabled=false no se hace ningún pedido (ej. endpoints solo para CIUDADANO).
 */
function useResource(loader, { enabled = true } = {}) {
  const [state, setState] = useState({ data: [], loading: false, loaded: false, error: "" });

  const reload = useCallback(async () => {
    if (!enabled) return;
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await loader();
      setState({ data: data || [], loading: false, loaded: true, error: "" });
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: err.message || "No se pudo cargar la información." }));
    }
  }, [loader, enabled]);

  return { ...state, reload };
}

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

// ---------------------------------------------------------------------------
// Constantes y mock data
// ---------------------------------------------------------------------------

const INSPECTORS = ["Insp. Diaz", "Insp. Romero", "Insp. Fernández", "Insp. Gómez"];

const INFRACTION_TYPES = [
  { code: "ESTAC_PROHIBIDO", label: "Estacionamiento prohibido", base: 15000 },
  { code: "EXCESO_VELOCIDAD", label: "Exceso de velocidad", base: 45000 },
  { code: "SEMAFORO_ROJO", label: "Cruce en semáforo rojo", base: 60000 },
  { code: "SIN_CINTURON", label: "Circular sin cinturón", base: 20000 },
  { code: "DOC_VENCIDA", label: "Documentación vencida", base: 25000 },
  { code: "ESTAC_MEDIDO", label: "Estacionamiento medido sin pago", base: 18000 },
];

const AGGRAVATING_FACTORS = [
  { code: "REINCIDENCIA", label: "Reincidencia", pct: 0.5 },
  { code: "ZONA_ESCOLAR", label: "Zona escolar", pct: 0.3 },
  { code: "ALTA_VELOCIDAD", label: "Alta velocidad registrada", pct: 0.4 },
  { code: "RESISTENCIA", label: "Resistencia a la autoridad", pct: 0.2 },
];

const CITIZEN_PLATE = "AB123CD";

const REQUISITO_LABEL = {
  pago: "Multa abonada",
  documentacion: "Documentación del vehículo",
  verificacion: "Verificación técnica",
};

const BADGE_TONES = {
  slate: "bg-slate-100 text-slate-600",
  emerald: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-600",
  amber: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  orange: "bg-orange-100 text-orange-700",
};

const TONE_TEXT = {
  red: "text-red-600 bg-red-50",
  orange: "text-orange-600 bg-orange-50",
  sky: "text-sky-600 bg-sky-50",
  slate: "text-slate-700 bg-slate-100",
  amber: "text-amber-600 bg-amber-50",
};

const INFRACCION_ESTADO = {
  Pendiente: "amber",
  Apelada: "sky",
  Confirmada: "red",
  Anulada: "emerald",
};

// InfractionType / InfractionStatus tal como los devuelve el backend real
// (sección 4 de la guía de integración) — no coinciden con los códigos del
// mock, así que acá se traducen para no tener que reescribir las pantallas.
const INFRACTION_TYPE_LABEL = {
  UNPAID_PARKING: "Estacionamiento medido sin pago",
  SPEEDING: "Exceso de velocidad",
  RED_LIGHT: "Cruce en semáforo rojo",
  ILLEGAL_PARKING: "Estacionamiento prohibido",
  NO_LICENSE: "Sin licencia de conducir",
  RECKLESS_DRIVING: "Conducción imprudente",
  OTHER: "Otra infracción",
};

const INFRACTION_STATUS_LABEL = {
  PENDING_APPEAL: "Pendiente",
  APPEALED: "Apelada",
  CONFIRMED: "Confirmada",
  ANNULLED: "Anulada",
};

// Adapta una infracción tal como la devuelve el backend (GET /infractions/mine)
// a la forma que ya esperan MisInfracciones / InfraccionDrawer.
function mapApiInfraction(api) {
  return {
    id: api.infractionId,
    tipoLabel: INFRACTION_TYPE_LABEL[api.infractionType] || api.infractionType,
    patente: api.licensePlate,
    calle: [api.location?.street, api.location?.crossStreet].filter(Boolean).join(" y "),
    inspector: api.inspectorId,
    monto: api.finalAmount ?? api.baseAmount,
    estado: INFRACTION_STATUS_LABEL[api.status] || api.status,
    fecha: formatDateTime(api.infractionDateTime),
  };
}

const CORTE_ESTADO = {
  Pendiente: "amber",
  Aprobado: "sky",
  Rechazado: "red",
  Activo: "orange",
  Finalizado: "slate",
};

const VEHICULO_ESTADO = { Retenido: "red", Liberado: "emerald" };

// Enums del backend usados en el Portal vecino (guía de integración §4)
const CLOSURE_STATUS_UI = {
  APPROVED: { label: "Próximo", tone: "sky" },
  ACTIVE: { label: "Activo", tone: "orange" },
};
const REQUESTING_MODULE_LABEL = { OBRAS: "Obras", AMBIENTE: "Ambiente" };
const IMPOUNDMENT_STATUS_UI = {
  IMPOUNDED: { label: "Retenido", tone: "red" },
  RELEASED: { label: "Liberado", tone: "emerald" },
};
const IMPOUNDMENT_ORIGIN_LABEL = { INFRACTION: "Infracción", OPERATION: "Operativo de control" };
const ACCIDENT_STATUS_UI = {
  PRELIMINARY: { label: "En revisión", tone: "amber" },
  VERIFIED: { label: "Verificado", tone: "emerald" },
};
const INJURY_LEVEL_LABEL = { NONE: "sin lesiones", MINOR: "lesiones leves", SEVERE: "lesiones graves" };
const ACCIDENTE_ESTADO = { Abierto: "amber", Cerrado: "emerald" };
const INCUMPLIMIENTO_ESTADO = {
  "Pendiente validación": "amber",
  Validado: "red",
  Descartado: "slate",
};

const STAFF_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "infracciones", label: "Infracciones", icon: FileWarning },
  { id: "cortes", label: "Cortes de calle", icon: TrafficCone },
  { id: "operativos", label: "Operativos", icon: ClipboardList },
  { id: "accidentes", label: "Accidentes", icon: Siren },
  { id: "vehiculos", label: "Vehículos retenidos", icon: Car },
  { id: "estacionamiento", label: "Estacionamiento medido", icon: ParkingCircle },
];

const INITIAL_INFRACTIONS = [
  {
    id: "INF-1001",
    tipo: "ESTAC_PROHIBIDO",
    tipoLabel: "Estacionamiento prohibido",
    patente: CITIZEN_PLATE,
    calle: "Av. Rivadavia 4500",
    inspector: "Insp. Diaz",
    monto: 15000,
    estado: "Pendiente",
    fecha: "18/08/2026 09:14",
  },
  {
    id: "INF-1002",
    tipo: "EXCESO_VELOCIDAD",
    tipoLabel: "Exceso de velocidad",
    patente: CITIZEN_PLATE,
    calle: "Av. Rivadavia 4500",
    inspector: "Insp. Romero",
    monto: 63000,
    estado: "Apelada",
    fecha: "10/08/2026 18:32",
    motivoDescargo:
      "El cinemómetro no contaba con la calibración vigente al momento del control.",
    appealCode: "APL-482913",
  },
  {
    id: "INF-1003",
    tipo: "SEMAFORO_ROJO",
    tipoLabel: "Cruce en semáforo rojo",
    patente: CITIZEN_PLATE,
    calle: "Av. Independencia 1200",
    inspector: "Insp. Fernández",
    monto: 60000,
    estado: "Confirmada",
    fecha: "05/08/2026 08:03",
  },
  {
    id: "INF-1004",
    tipo: "ESTAC_MEDIDO",
    tipoLabel: "Estacionamiento medido sin pago",
    patente: CITIZEN_PLATE,
    calle: "Calle San Martín 220",
    inspector: "Insp. Gómez",
    monto: 18000,
    estado: "Anulada",
    fecha: "01/08/2026 14:20",
  },
  {
    id: "INF-1005",
    tipo: "DOC_VENCIDA",
    tipoLabel: "Documentación vencida",
    patente: "AC456EF",
    calle: "Av. Rivadavia 4500",
    inspector: "Insp. Diaz",
    monto: 25000,
    estado: "Pendiente",
    fecha: "15/08/2026 11:47",
  },
  {
    id: "INF-1006",
    tipo: "EXCESO_VELOCIDAD",
    tipoLabel: "Exceso de velocidad",
    patente: "AD789GH",
    calle: "Av. 9 de Julio 800",
    inspector: "Insp. Romero",
    monto: 45000,
    estado: "Pendiente",
    fecha: "14/08/2026 16:05",
  },
  {
    id: "INF-1007",
    tipo: "ESTAC_PROHIBIDO",
    tipoLabel: "Estacionamiento prohibido",
    patente: "AE321IJ",
    calle: "Calle Belgrano 55",
    inspector: "Insp. Gómez",
    monto: 15000,
    estado: "Confirmada",
    fecha: "09/08/2026 10:00",
  },
];

const INITIAL_CLOSURES = [
  {
    id: "CC-01",
    solicitante: "Obras",
    calle: "Av. Rivadavia 4200-4600",
    fechaInicio: "20/08/2026",
    fechaFin: "25/08/2026",
    estado: "Activo",
    desvios: ["Calle San Martín", "Av. Belgrano"],
  },
  {
    id: "CC-02",
    solicitante: "Ambiente",
    calle: "Calle Sarmiento 300",
    fechaInicio: "22/08/2026",
    fechaFin: "23/08/2026",
    estado: "Pendiente",
    desvios: [],
  },
  {
    id: "CC-03",
    solicitante: "Obras",
    calle: "Av. Independencia 1000-1100",
    fechaInicio: "15/08/2026",
    fechaFin: "18/08/2026",
    estado: "Finalizado",
    desvios: ["Calle Perú"],
  },
  {
    id: "CC-04",
    solicitante: "Ambiente",
    calle: "Calle Moreno 450",
    fechaInicio: "24/08/2026",
    fechaFin: "26/08/2026",
    estado: "Aprobado",
    desvios: ["Av. de Mayo"],
  },
];

const INITIAL_OPERATIVOS = [
  {
    id: "OP-101",
    tipo: "Control de alcoholemia",
    zona: "Palermo",
    fecha: "15/08/2026",
    hora: "22:00",
    inspectores: ["Insp. Diaz", "Insp. Romero"],
    moviles: "M-04, M-11",
    controles: 18,
  },
  {
    id: "OP-102",
    tipo: "Operativo de velocidad",
    zona: "Av. General Paz",
    fecha: "17/08/2026",
    hora: "07:30",
    inspectores: ["Insp. Fernández"],
    moviles: "M-02",
    controles: 42,
  },
];

const INITIAL_ACCIDENTS = [
  {
    id: "ACC-201",
    fecha: "16/08/2026 10:20",
    ubicacion: "Av. Rivadavia y Callao",
    personas: [{ nombre: "Juan Pérez", lesion: "minor" }],
    vehiculos: [{ patente: "AF456KL" }, { patente: "AG789MN" }],
    danosInfraestructura: true,
    danoDesc: "Semáforo dañado en la esquina.",
    estado: "Abierto",
  },
  {
    id: "ACC-202",
    fecha: "10/08/2026 19:45",
    ubicacion: "Calle Lavalle 900",
    personas: [],
    vehiculos: [{ patente: "AH321OP" }],
    danosInfraestructura: false,
    danoDesc: "",
    estado: "Cerrado",
  },
];

const INITIAL_IMPOUNDED = [
  {
    id: "VEH-301",
    patente: "AI654QR",
    motivo: "Estacionamiento en doble fila reincidente",
    deposito: "Depósito Norte",
    origen: "Infracción",
    originId: "INF-0998",
    fechaIngreso: "14/08/2026",
    estado: "Retenido",
    requisitos: { pago: true, documentacion: false, verificacion: false },
    montoAcarreo: 25000,
    montoEstadia: 9000,
  },
  {
    id: "VEH-302",
    patente: "AJ987ST",
    motivo: "Vehículo abandonado en la vía pública",
    deposito: "Depósito Sur",
    origen: "Operativo",
    originId: "OP-098",
    fechaIngreso: "10/08/2026",
    estado: "Liberado",
    requisitos: { pago: true, documentacion: true, verificacion: true },
    montoAcarreo: 25000,
    montoEstadia: 15000,
    fechaLiberacion: "17/08/2026",
  },
];

const INITIAL_ZONES = [
  { id: "Z1", nombre: "Zona Azul — Microcentro", horario: "8 a 20 hs", tarifa: "$450", ocupacion: 78 },
  { id: "Z2", nombre: "Zona Azul — Palermo", horario: "9 a 21 hs", tarifa: "$400", ocupacion: 63 },
  { id: "Z3", nombre: "Zona Verde — Belgrano", horario: "8 a 18 hs", tarifa: "$350", ocupacion: 45 },
];

const INITIAL_VIOLATIONS = [
  { id: "PV-01", patente: "AK123BC", zona: "Zona Azul — Microcentro", hora: "18/08/2026 11:20", estado: "Pendiente validación" },
  { id: "PV-02", patente: "AL456DE", zona: "Zona Azul — Palermo", hora: "17/08/2026 15:05", estado: "Validado" },
  { id: "PV-03", patente: "AM789FG", zona: "Zona Verde — Belgrano", hora: "16/08/2026 09:40", estado: "Descartado" },
];

// ---------------------------------------------------------------------------
// Primitivos de UI
// ---------------------------------------------------------------------------

function Badge({ tone = "slate", children }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

function Button({ variant = "primary", size = "md", className, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = { md: "px-4 py-2.5 text-sm", sm: "px-3 py-1.5 text-xs" };
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    accent: "bg-red-600 text-white hover:bg-red-700",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  return <button className={cx(base, sizes[size], variants[variant], className)} {...props} />;
}

function Field({ label, required, children, hint }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-600">*</span>}
      </p>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
      <div className={cx("w-full rounded-2xl bg-white shadow-xl", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: "70vh" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function DataTable({ columns, data, onRowClick, keyField = "id", emptyLabel = "Sin registros" }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                {emptyLabel}
              </td>
            </tr>
          )}
          {data.map((row) => (
            <tr
              key={row[keyField]}
              onClick={() => onRowClick && onRowClick(row)}
              className={cx("transition-colors", onRowClick && "cursor-pointer hover:bg-slate-50")}
            >
              {columns.map((col) => (
                <td key={col.header} className="px-4 py-3 text-slate-700">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionToolbar({ title, desc, actions }) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      {actions}
    </div>
  );
}

function SectionHeader({ eyebrow, title, desc }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-600">
        <span className="h-px w-6 bg-red-600" /> {eyebrow}
      </p>
      <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
      {desc && <p className="mt-2 max-w-2xl text-slate-500">{desc}</p>}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function BackLink({ onClick }) {
  return (
    <button onClick={onClick} className="mb-6 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
      <ChevronLeft size={16} /> Volver al inicio
    </button>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={cx("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", TONE_TEXT[tone])}>
        <Icon size={17} />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-xs">
      <div className="relative rounded-3xl border-8 border-slate-900 bg-slate-900 shadow-2xl">
        <div className="overflow-hidden rounded-2xl bg-white">
          <div className="h-6 bg-slate-900" />
          <div className="space-y-4 p-4">
            <div>
              <p className="text-xs font-medium text-slate-400">HOLA, VECINO</p>
              <p className="text-sm font-bold text-slate-900">Mi Tránsito UADE</p>
            </div>
            <div className="relative h-32 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200">
              <MapPin className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600" size={22} />
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-sm font-semibold text-slate-900">Infracción en descargo</p>
              <p className="text-xs text-slate-400">Av. Rivadavia 4500</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-2/3 rounded-full bg-amber-500" />
              </div>
              <p className="mt-1 text-right text-xs font-medium text-amber-600">En revisión</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5">
                <ParkingCircle size={16} className="text-slate-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Zona Azul 12</p>
                  <p className="text-xs text-slate-400">Vence en 24 min</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Descargo aceptado</p>
                  <p className="text-xs text-slate-400">Infracción anulada</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -right-4 top-10 hidden rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-lg sm:block">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Corte de calle activo
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout compartido
// ---------------------------------------------------------------------------

const ROLE_LABEL = {
  INSPECTOR: "Inspector",
  SUPERVISOR: "Supervisor",
  AUDITOR: "Auditor",
  OPERADOR_CONTROL: "Operador de control",
  PERSONAL_DEPOSITO: "Personal de depósito",
  ADMIN_MUNICIPAL: "Admin municipal",
  CIUDADANO: "Vecino",
};

function Header({ mode, onModeChange, username, role, onLogout, canAccessStaff }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <button onClick={() => onModeChange("ciudadano")} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
            <TrafficCone size={20} />
          </div>
          <div className="text-left">
            <p className="text-base font-bold leading-none text-slate-900">Tránsito UADE</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">Seguridad vial municipal</p>
          </div>
        </button>

        {canAccessStaff && (
          <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 md:flex">
            <button
              onClick={() => onModeChange("ciudadano")}
              className={cx(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                mode === "ciudadano" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Portal vecino
            </button>
            <button
              onClick={() => onModeChange("staff")}
              className={cx(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                mode === "staff" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Panel interno
            </button>
          </nav>
        )}

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm">
            <ShieldCheck size={14} /> {username} · {ROLE_LABEL[role] || role}
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            Salir
          </Button>
        </div>
      </div>
      {canAccessStaff && (
        <div className="flex border-t border-slate-100 md:hidden">
          <button
            onClick={() => onModeChange("ciudadano")}
            className={cx("flex-1 py-2 text-sm font-medium", mode === "ciudadano" ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-400")}
          >
            Portal vecino
          </button>
          <button
            onClick={() => onModeChange("staff")}
            className={cx("flex-1 py-2 text-sm font-medium", mode === "staff" ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-400")}
          >
            Panel interno
          </button>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 text-slate-900">
              <TrafficCone size={20} />
              <span className="text-lg font-bold">Tránsito UADE</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-slate-500">
              Dirección de Tránsito, Estacionamiento y Seguridad Vial. Municipalidad de Ciudad UADE — Gestión 2026.
            </p>
            <div className="mt-4 space-y-1 text-sm text-slate-500">
              <p>147 — Línea Municipal</p>
              <p>transito@ciudaduade.gob.ar</p>
              <p>Av. Independencia 1100, CABA</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Trámites</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Mis infracciones</li>
              <li>Presentar descargo</li>
              <li>Estacionamiento medido</li>
              <li>Vehículos retenidos</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Institucional</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Intendencia</li>
              <li>Transparencia</li>
              <li>Prensa</li>
              <li>Accesibilidad</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
          <p>© 2026 Municipalidad de Ciudad UADE. Todos los derechos reservados.</p>
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Todos los servicios operativos
          </p>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Portal ciudadano
// ---------------------------------------------------------------------------

function CitizenHome({ search, setSearch, trackCode, setTrackCode, trackResult, onTrackSubmit, categories, onNavigate }) {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-red-600" />
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-600">
              <span className="h-px w-6 bg-red-600" /> Tránsito y seguridad vial
            </p>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
              Tu tránsito,
              <br />
              <span className="text-red-600">bajo control.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-slate-500">
              Consultá tus infracciones, presentá descargos, revisá cortes de calle vigentes y gestioná el
              estacionamiento medido, todo desde un solo lugar.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onNavigate("infracciones");
              }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <Search size={18} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscá: Infracciones, Estacionamiento, Cortes..."
                  className="w-full text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
              <Button type="submit" variant="primary">
                Buscar <ArrowUpRight size={16} />
              </Button>
            </form>
          </div>
          <PhoneMock />
        </div>
      </section>

      <div className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <FileSignature size={16} />
            </div>
            <p className="text-sm font-medium text-slate-700">¿Ya presentaste un descargo?</p>
          </div>
          <form onSubmit={onTrackSubmit} className="flex w-full gap-3 sm:w-auto">
            <input
              value={trackCode}
              onChange={(e) => setTrackCode(e.target.value)}
              placeholder="Ingresá tu código APL-000000"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400 sm:w-72"
            />
            <Button type="submit" variant="primary">
              Consultar <ArrowUpRight size={14} />
            </Button>
          </form>
        </div>
        {trackResult !== null && (
          <div className="mx-auto max-w-7xl px-6 pb-5">
            {trackResult ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Descargo <strong>{trackCode}</strong> encontrado. Estado: en revisión.
              </div>
            ) : (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                No encontramos ningún descargo con ese código.
              </div>
            )}
          </div>
        )}
      </div>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-600">
          <span className="h-px w-6 bg-red-600" /> Áreas de gestión
        </p>
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-slate-900">¿Sobre qué necesitás hacer una gestión?</h2>
          <span className="hidden text-sm text-slate-400 sm:block">{categories.length} categorías</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => onNavigate(cat.target)}
              className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="mb-4 flex w-full items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <cat.icon size={20} />
                </div>
                {cat.badge && <Badge tone={cat.badge.tone}>{cat.badge.label}</Badge>}
              </div>
              <h3 className="text-base font-semibold text-slate-900">{cat.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{cat.desc}</p>
              <div className="mt-5 flex w-full items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs font-medium text-slate-400">{cat.count}</span>
                <ArrowUpRight size={16} className="text-slate-300 transition-colors group-hover:text-red-600" />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-br from-slate-50 to-red-50 p-8 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">¿No encontrás lo que buscás?</h3>
            <p className="mt-1 text-sm text-slate-500">
              Iniciá una consulta general y el equipo de Tránsito te deriva al área correspondiente.
            </p>
          </div>
          <Button variant="accent" onClick={() => onNavigate("accidentes")}>
            Consulta general <ArrowUpRight size={16} />
          </Button>
        </div>
      </section>
    </>
  );
}

function MisInfracciones({ infractions, loading, error, onRetry, onOpen, onBack }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <BackLink onClick={onBack} />
      <SectionHeader
        eyebrow="Portal vecino"
        title="Mis infracciones"
        desc="Estas son las infracciones registradas a tu nombre. Podés revisar el detalle y presentar un descargo cuando corresponda."
      />
      <div className="mt-8 space-y-4">
        {loading && <p className="text-sm text-slate-500">Cargando tus infracciones...</p>}

        {!loading && error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-red-700">
              <AlertCircle size={16} /> {error}
            </p>
            <button onClick={onRetry} className="mt-2 flex items-center gap-1.5 font-medium text-red-700 hover:underline">
              <RotateCcw size={14} /> Reintentar
            </button>
          </div>
        )}

        {!loading && !error && infractions.map((inf) => (
          <button
            key={inf.id}
            onClick={() => onOpen(inf)}
            className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <FileWarning size={18} />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{inf.tipoLabel}</p>
                <p className="text-sm text-slate-500">
                  {inf.calle} · {inf.fecha} · Patente {inf.patente}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p className="font-semibold text-slate-900">{formatCurrency(inf.monto)}</p>
              <Badge tone={INFRACCION_ESTADO[inf.estado]}>{inf.estado}</Badge>
              <ChevronRight size={18} className="text-slate-300" />
            </div>
          </button>
        ))}
        {!loading && !error && infractions.length === 0 && <EmptyState text="No tenés infracciones registradas. ¡Buen manejo!" />}
      </div>
    </section>
  );
}

function InfraccionDrawer({ infraction, onClose, onSubmitDescargo }) {
  const [step, setStep] = useState("detail");
  const [motivo, setMotivo] = useState("");
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!infraction) return null;

  const handleAddDoc = (e) => {
    const files = Array.from(e.target.files || []);
    setDocs((d) => [...d, ...files.map((f) => f.name)]);
  };

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
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {step === "detail" && "Detalle de infracción"}
            {step === "form" && "Presentar descargo"}
            {step === "success" && "Descargo enviado"}
          </p>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {step === "detail" && (
          <div className="p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{infraction.tipoLabel}</h2>
                <p className="mt-1 text-sm text-slate-500">Acta N.° {infraction.id}</p>
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
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
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
                <p className="mt-1 text-red-600">{error}</p>
              </div>
            )}
            <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">{infraction.tipoLabel}</p>
              <p className="text-sm text-slate-500">
                {infraction.calle} · Patente {infraction.patente}
              </p>
            </div>
            <p className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-600">
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
            <p className="mb-1.5 mt-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-600">
              <span className="h-px w-5 bg-red-600" /> Documentación
            </p>
            <Field label="Adjuntar respaldo (opcional)">
              <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-400 hover:border-slate-400">
                Hacé clic para subir archivos
                <input type="file" multiple className="hidden" onChange={handleAddDoc} />
              </label>
              {docs.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  {docs.map((d, i) => (
                    <li key={i}>· {d}</li>
                  ))}
                </ul>
              )}
            </Field>
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
            <p className="mt-2 max-w-xs text-sm text-slate-500">
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

// Bloque de "cargando" / "error + reintentar" compartido por las pantallas del portal.
// Devuelve null cuando hay datos para mostrar.
function ResourceStatus({ resource, loadingText }) {
  if (resource.loading && !resource.loaded) {
    return <p className="text-sm text-slate-500">{loadingText}</p>;
  }
  if (resource.error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-red-700">
          <AlertCircle size={16} /> {resource.error}
        </p>
        <button onClick={resource.reload} className="mt-2 flex items-center gap-1.5 font-medium text-red-700 hover:underline">
          <RotateCcw size={14} /> Reintentar
        </button>
      </div>
    );
  }
  return null;
}

const CITIZEN_ONLY_TEXT = "Esta consulta está disponible para vecinos que ingresan con su cuenta de ciudadano.";

function EstacionamientoCiudadano({ resource, onBack }) {
  const zones = resource.data;
  const ready = resource.loaded && !resource.error;
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <BackLink onClick={onBack} />
      <SectionHeader
        eyebrow="Portal vecino"
        title="Estacionamiento medido"
        desc="Zonas, horarios y tarifas vigentes del estacionamiento medido en Ciudad UADE."
      />
      <div className="mt-8 space-y-4">
        <ResourceStatus resource={resource} loadingText="Cargando zonas de estacionamiento..." />
        {ready && (
          <div className="grid gap-4 sm:grid-cols-2">
            {zones.map((z) => (
              <div key={z.zoneId} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{z.name}</p>
                  {z.tariff ? (
                    <Badge tone="sky">{formatCurrency(z.tariff.pricePerHour)}/hora</Badge>
                  ) : (
                    <Badge tone="slate">Tarifa a confirmar</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-500">Horario: {z.allowedHours}</p>
                {z.tariff?.validTo && (
                  <p className="mt-1 text-xs text-slate-400">Tarifa vigente hasta el {formatLocalDate(z.tariff.validTo)}</p>
                )}
              </div>
            ))}
          </div>
        )}
        {ready && zones.length === 0 && <EmptyState text="No hay zonas de estacionamiento medido activas." />}
      </div>
    </section>
  );
}

function CortesCiudadano({ resource, onBack }) {
  // Primero los activos, después los próximos (el backend ya los ordena por fecha de inicio).
  const closures = [...resource.data].sort((a, b) => (a.status === b.status ? 0 : a.status === "ACTIVE" ? -1 : 1));
  const ready = resource.loaded && !resource.error;
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <BackLink onClick={onBack} />
      <SectionHeader
        eyebrow="Portal vecino"
        title="Cortes de calle vigentes"
        desc="Consultá los cortes de calle activos o próximos a activarse y sus desvíos habilitados."
      />
      <div className="mt-8 space-y-4">
        <ResourceStatus resource={resource} loadingText="Cargando cortes de calle..." />
        {ready &&
          closures.map((c) => {
            const ui = CLOSURE_STATUS_UI[c.status] || { label: c.status, tone: "slate" };
            return (
              <div key={c.streetClosureId} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">
                    {c.affectedStreet?.length ? c.affectedStreet.join(", ") : "Calle a confirmar"}
                  </p>
                  <Badge tone={ui.tone}>{ui.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDateTime(c.startDate)} — {formatDateTime(c.endDate)} · Solicitado por{" "}
                  {REQUESTING_MODULE_LABEL[c.requestingModule] || c.requestingModule}
                </p>
                {c.detours?.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-slate-600">
                    {c.detours.map((d, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        <span>
                          Desvío por <strong className="font-medium text-slate-800">{d.alternateRoute}</strong>
                          {d.street ? ` (en ${d.street})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {c.conditions?.length > 0 && (
                  <p className="mt-2 text-xs text-slate-400">Condiciones: {c.conditions.join(" · ")}</p>
                )}
              </div>
            );
          })}
        {ready && closures.length === 0 && <EmptyState text="No hay cortes de calle vigentes en este momento." />}
      </div>
    </section>
  );
}

function VehiculosCiudadano({ resource, isCitizen, onBack }) {
  const [q, setQ] = useState("");
  const ready = resource.loaded && !resource.error;
  const vehicles = resource.data.filter((v) => !q || v.licensePlate?.toUpperCase().includes(q));
  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <BackLink onClick={onBack} />
      <SectionHeader
        eyebrow="Portal vecino"
        title="Vehículos retenidos"
        desc="Estos son los vehículos a tu nombre que ingresaron al depósito municipal, con su estado y los requisitos para liberarlos."
      />
      <div className="mt-8 space-y-4">
        {!isCitizen && <EmptyState text={CITIZEN_ONLY_TEXT} />}
        {isCitizen && <ResourceStatus resource={resource} loadingText="Buscando tus vehículos..." />}
        {isCitizen && ready && resource.data.length > 1 && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value.toUpperCase())}
            placeholder="Filtrar por patente"
            className={cx(inputCls, "sm:w-64")}
          />
        )}
        {isCitizen &&
          ready &&
          vehicles.map((v) => {
            const ui = IMPOUNDMENT_STATUS_UI[v.status] || { label: v.status, tone: "slate" };
            const released = v.status === "RELEASED";
            return (
              <div key={v.impoundmentId} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-slate-900">{v.licensePlate}</p>
                  <Badge tone={ui.tone}>{ui.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Depósito: {v.depotLocation} · Ingreso: {formatDateTime(v.entryDateTime)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Motivo: {v.reason} ({IMPOUNDMENT_ORIGIN_LABEL[v.originType] || v.originType})
                </p>

                {released ? (
                  <>
                    <p className="mt-4 text-sm font-medium text-slate-700">Requisitos verificados</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {(v.verifiedRequirements || []).map((r) => (
                        <li key={r} className="flex items-center gap-2 text-slate-600">
                          <CheckCircle2 size={15} className="text-emerald-500" /> {r}
                        </li>
                      ))}
                    </ul>
                    {v.towingAndStorageFee != null && (
                      <p className="mt-4 text-sm text-slate-500">
                        Acarreo y estadía abonados:{" "}
                        <strong className="text-slate-800">{formatCurrency(v.towingAndStorageFee)}</strong>
                        {v.paymentReference ? ` · Comprobante ${v.paymentReference}` : ""}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-4 text-sm font-medium text-slate-700">Requisitos para liberarlo</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {Object.values(REQUISITO_LABEL).map((r) => (
                        <li key={r} className="flex items-center gap-2 text-slate-500">
                          <AlertCircle size={15} className="text-amber-500" /> {r}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-xs text-slate-400">
                      El personal del depósito verifica los requisitos y calcula el costo de acarreo y estadía al momento
                      de la liberación.
                    </p>
                  </>
                )}
              </div>
            );
          })}
        {isCitizen && ready && resource.data.length === 0 && (
          <EmptyState text="No tenés vehículos registrados en el depósito municipal." />
        )}
        {isCitizen && ready && resource.data.length > 0 && vehicles.length === 0 && (
          <EmptyState text="Ninguno de tus vehículos retenidos coincide con esa patente." />
        )}
      </div>
    </section>
  );
}

function AccidentesCiudadano({ resource, isCitizen, nationalId, onBack }) {
  const ready = resource.loaded && !resource.error;
  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <BackLink onClick={onBack} />
      <SectionHeader
        eyebrow="Portal vecino"
        title="Accidentes y denuncias viales"
        desc="Los siniestros viales son registrados por el personal de inspección en el lugar del hecho."
      />
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">
          Si presenciaste o fuiste parte de un accidente de tránsito, comunicate a la Línea Municipal 147 o iniciá una
          denuncia desde el módulo de Atención Ciudadana. El equipo de Tránsito recibe la derivación automáticamente y
          asigna un inspector a la brevedad.
        </p>
      </div>

      <h3 className="mt-10 text-lg font-semibold text-slate-900">Siniestros en los que figurás</h3>
      <div className="mt-4 space-y-4">
        {!isCitizen && <EmptyState text={CITIZEN_ONLY_TEXT} />}
        {isCitizen && <ResourceStatus resource={resource} loadingText="Buscando tus siniestros registrados..." />}
        {isCitizen &&
          ready &&
          resource.data.map((a) => {
            const ui = ACCIDENT_STATUS_UI[a.status] || { label: a.status, tone: "slate" };
            const me = (a.persons || []).find((p) => p.nationalId === nationalId);
            const myVehicles = (a.vehicles || []).filter((v) => v.ownerNationalId === nationalId);
            const where = [a.location?.street, a.location?.crossStreet].filter(Boolean).join(" y ");
            return (
              <div key={a.accidentId} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{where || "Ubicación a confirmar"}</p>
                  <Badge tone={ui.tone}>{ui.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDateTime(a.accidentDateTime)} · {plural(a.vehicles?.length || 0, "vehículo involucrado", "vehículos involucrados")}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {me && <li>Figurás como persona involucrada ({INJURY_LEVEL_LABEL[me.injuryLevel] || me.injuryLevel}).</li>}
                  {myVehicles.map((v) => (
                    <li key={v.licensePlate}>Figurás como titular del vehículo {v.licensePlate}.</li>
                  ))}
                  {a.involvesInfrastructureDamage && (
                    <li className="text-slate-500">Daños en la vía pública{a.damageDescription ? `: ${a.damageDescription}` : ""}.</li>
                  )}
                </ul>
              </div>
            );
          })}
        {isCitizen && ready && resource.data.length === 0 && (
          <EmptyState text="No figurás en ningún siniestro vial registrado." />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Panel interno (staff)
// ---------------------------------------------------------------------------

function StaffSidebar({ active, onChange }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-800 bg-slate-900 lg:block">
      <div className="px-5 py-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Panel interno</p>
        <p className="mt-1 text-sm text-slate-300">Dirección de Tránsito</p>
      </div>
      <nav className="space-y-1 px-3">
        {STAFF_NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cx(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active === item.id ? "bg-white text-slate-900" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <item.icon size={17} /> {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function Dashboard({ infractions, closures, operativos, accidents, impounded, zones }) {
  const activeInfractions = infractions.filter((i) => i.estado !== "Anulada").length;
  const activeClosures = closures.filter((c) => c.estado === "Activo").length;
  const runningOps = operativos.length;
  const inDeposit = impounded.filter((v) => v.estado === "Retenido").length;
  const openAccidents = accidents.filter((a) => a.estado === "Abierto").length;

  const byType = INFRACTION_TYPES.map((t) => ({
    tipo: t.label.split(" ")[0],
    cantidad: infractions.filter((i) => i.tipo === t.code).length,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Panel de indicadores</h2>
        <p className="mt-1 text-sm text-slate-500">
          Vista general de la actividad del módulo de Tránsito, Estacionamiento y Seguridad Vial.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={FileWarning} label="Infracciones activas" value={activeInfractions} tone="red" />
        <StatCard icon={TrafficCone} label="Cortes de calle activos" value={activeClosures} tone="orange" />
        <StatCard icon={ClipboardList} label="Operativos registrados" value={runningOps} tone="sky" />
        <StatCard icon={Car} label="Vehículos en depósito" value={inDeposit} tone="slate" />
        <StatCard icon={Siren} label="Accidentes abiertos" value={openAccidents} tone="amber" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <p className="mb-4 text-sm font-semibold text-slate-700">Infracciones por tipo</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="tipo" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="cantidad" fill="#dc2626" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="mb-4 text-sm font-semibold text-slate-700">Ocupación estacionamiento medido</p>
          <div className="space-y-4">
            {zones.map((z) => (
              <div key={z.id}>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{z.nombre}</span>
                  <span>{z.ocupacion}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${z.ocupacion}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RegistrarInfraccionForm({ onSubmit }) {
  const [tipo, setTipo] = useState(INFRACTION_TYPES[0].code);
  const [patente, setPatente] = useState("");
  const [calle, setCalle] = useState("");
  const [entrecalle, setEntrecalle] = useState("");
  const [inspector, setInspector] = useState(INSPECTORS[0]);
  const [agravantes, setAgravantes] = useState([]);
  const [evidencia, setEvidencia] = useState("");

  const tipoObj = INFRACTION_TYPES.find((t) => t.code === tipo);
  const recargo = agravantes.reduce((acc, code) => acc + AGGRAVATING_FACTORS.find((a) => a.code === code).pct, 0);
  const monto = Math.round(tipoObj.base * (1 + recargo));

  const toggleAgravante = (code) => {
    setAgravantes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!patente || !calle || !evidencia) return;
    onSubmit({
      id: `INF-${Math.floor(1000 + Math.random() * 9000)}`,
      tipo,
      tipoLabel: tipoObj.label,
      patente: patente.toUpperCase(),
      calle: entrecalle ? `${calle} y ${entrecalle}` : calle,
      inspector,
      monto,
      estado: "Pendiente",
      fecha: new Date().toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      evidencia,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
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
        <Field label="Calle" required>
          <input value={calle} onChange={(e) => setCalle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Entre calle">
          <input value={entrecalle} onChange={(e) => setEntrecalle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Inspector" required>
          <select value={inspector} onChange={(e) => setInspector(e.target.value)} className={inputCls}>
            {INSPECTORS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Evidencia" required hint="Foto o video del hecho">
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-400 hover:border-slate-400">
            {evidencia || "Adjuntar archivo"}
            <input type="file" className="hidden" onChange={(e) => setEvidencia(e.target.files?.[0]?.name || "")} />
          </label>
        </Field>
      </div>
      <Field label="Agravantes">
        <div className="flex flex-wrap gap-2">
          {AGGRAVATING_FACTORS.map((a) => (
            <button
              type="button"
              key={a.code}
              onClick={() => toggleAgravante(a.code)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                agravantes.includes(a.code) ? "border-red-600 bg-red-50 text-red-600" : "border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              {a.label} (+{a.pct * 100}%)
            </button>
          ))}
        </div>
      </Field>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-500">Importe calculado</span>
        <span className="text-lg font-bold text-slate-900">{formatCurrency(monto)}</span>
      </div>
      <Button type="submit" variant="primary" className="mt-4 w-full">
        Emitir acta de infracción
      </Button>
    </form>
  );
}

function InfraccionesStaff({ infractions, onCreate, onResolve }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [filterEstado, setFilterEstado] = useState("Todos");

  const filtered = filterEstado === "Todos" ? infractions : infractions.filter((i) => i.estado === filterEstado);

  const columns = [
    { header: "Patente", render: (r) => <span className="font-mono font-semibold">{r.patente}</span> },
    { header: "Tipo", render: (r) => r.tipoLabel },
    { header: "Fecha", render: (r) => r.fecha },
    { header: "Ubicación", render: (r) => r.calle },
    { header: "Importe", render: (r) => formatCurrency(r.monto) },
    { header: "Estado", render: (r) => <Badge tone={INFRACCION_ESTADO[r.estado]}>{r.estado}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <SectionToolbar
        title="Gestión de infracciones"
        desc="Registrá, consultá y resolvé infracciones de tránsito."
        actions={
          <Button variant="accent" onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Registrar infracción
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-slate-400" />
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
      <DataTable columns={columns} data={filtered} onRowClick={setDetail} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar infracción" wide>
        <RegistrarInfraccionForm
          onSubmit={(data) => {
            onCreate(data);
            setModalOpen(false);
          }}
        />
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detalle de infracción">
        {detail && (
          <div>
            <dl className="space-y-3 text-sm">
              <Row label="Patente" value={detail.patente} />
              <Row label="Tipo" value={detail.tipoLabel} />
              <Row label="Ubicación" value={detail.calle} />
              <Row label="Inspector" value={detail.inspector} />
              <Row label="Importe" value={formatCurrency(detail.monto)} />
              <Row label="Estado" value={detail.estado} />
            </dl>
            {detail.estado === "Apelada" && (
              <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm text-sky-700">
                <p className="font-semibold">Motivo del descargo</p>
                <p className="mt-1">{detail.motivoDescargo}</p>
                <p className="mt-3 text-xs text-sky-500">Requiere autorización de un rol superior para resolver.</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => {
                      onResolve(detail.id, "Anulada");
                      setDetail(null);
                    }}
                  >
                    Aceptar descargo
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      onResolve(detail.id, "Confirmada");
                      setDetail(null);
                    }}
                  >
                    Rechazar descargo
                  </Button>
                </div>
              </div>
            )}
            {detail.estado === "Pendiente" && (
              <div className="mt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onResolve(detail.id, "Confirmada");
                    setDetail(null);
                  }}
                >
                  Marcar como firme
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function EvaluarCorteForm({ closure, onSubmit }) {
  const [decision, setDecision] = useState("Aprobado");
  const [desvios, setDesvios] = useState("");
  const [condiciones, setCondiciones] = useState("");
  const [motivo, setMotivo] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      estado: decision,
      desvios: desvios ? desvios.split(",").map((s) => s.trim()) : [],
      condiciones,
      rejectionReason: motivo,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4 rounded-lg bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-800">{closure.calle}</p>
        <p className="text-slate-500">
          Solicitado por {closure.solicitante} · {closure.fechaInicio} — {closure.fechaFin}
        </p>
      </div>
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
          <Field label="Desvíos sugeridos" hint="Separados por coma">
            <input value={desvios} onChange={(e) => setDesvios(e.target.value)} className={inputCls} placeholder="Av. Rivadavia, Calle San Martín" />
          </Field>
          <Field label="Condiciones">
            <textarea value={condiciones} onChange={(e) => setCondiciones(e.target.value)} rows={3} className={inputCls} />
          </Field>
        </>
      ) : (
        <Field label="Motivo del rechazo" required>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} required className={inputCls} />
        </Field>
      )}
      <Button type="submit" variant="primary" className="mt-2 w-full">
        Confirmar decisión
      </Button>
    </form>
  );
}

function CortesDeCalleStaff({ closures, onEvaluate, onActivate, onExtend, onFinish }) {
  const [evalTarget, setEvalTarget] = useState(null);

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
          {r.estado === "Pendiente" && (
            <Button size="sm" variant="secondary" onClick={() => setEvalTarget(r)}>
              Evaluar
            </Button>
          )}
          {r.estado === "Aprobado" && (
            <Button size="sm" variant="secondary" onClick={() => onActivate(r.id)}>
              Activar
            </Button>
          )}
          {r.estado === "Activo" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => onExtend(r.id)}>
                Extender
              </Button>
              <Button size="sm" variant="danger" onClick={() => onFinish(r.id)}>
                Finalizar
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionToolbar title="Cortes de calle" desc="Solicitudes recibidas desde los módulos de Obras Públicas y Ambiente." />
      <DataTable columns={columns} data={closures} />
      <Modal open={!!evalTarget} onClose={() => setEvalTarget(null)} title="Evaluar solicitud de corte">
        {evalTarget && (
          <EvaluarCorteForm
            closure={evalTarget}
            onSubmit={(payload) => {
              onEvaluate(evalTarget.id, payload);
              setEvalTarget(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function CrearOperativoForm({ onSubmit }) {
  const [tipo, setTipo] = useState("Control de alcoholemia");
  const [zona, setZona] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [inspectores, setInspectores] = useState([]);
  const [moviles, setMoviles] = useState("");

  const toggleInsp = (name) => setInspectores((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!zona || !fecha || inspectores.length === 0) return;
    onSubmit({
      id: `OP-${Math.floor(100 + Math.random() * 900)}`,
      tipo,
      zona,
      fecha,
      hora,
      inspectores,
      moviles: moviles || "—",
      controles: 0,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Tipo de operativo">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
          {["Control de alcoholemia", "Control documentación", "Operativo de velocidad", "Control de estacionamiento"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Zona" required>
          <input value={zona} onChange={(e) => setZona(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Móviles asignados">
          <input value={moviles} onChange={(e) => setMoviles(e.target.value)} placeholder="M-04, M-11" className={inputCls} />
        </Field>
        <Field label="Fecha" required>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Horario">
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputCls} />
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
                inspectores.includes(i) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500"
              )}
            >
              {i}
            </button>
          ))}
        </div>
      </Field>
      <Button type="submit" variant="primary" className="mt-2 w-full">
        Crear operativo
      </Button>
    </form>
  );
}

function OperativosStaff({ operativos, onCreate }) {
  const [open, setOpen] = useState(false);
  const columns = [
    { header: "Tipo", render: (r) => r.tipo },
    { header: "Zona", render: (r) => r.zona },
    { header: "Fecha", render: (r) => `${r.fecha} ${r.hora}` },
    { header: "Inspectores", render: (r) => r.inspectores.join(", ") },
    { header: "Móviles", render: (r) => r.moviles },
    { header: "Controles", render: (r) => r.controles },
  ];
  return (
    <div className="space-y-6">
      <SectionToolbar
        title="Operativos de tránsito"
        desc="Planificación y seguimiento de operativos en la vía pública."
        actions={
          <Button variant="accent" onClick={() => setOpen(true)}>
            <Plus size={16} /> Nuevo operativo
          </Button>
        }
      />
      <DataTable columns={columns} data={operativos} />
      <Modal open={open} onClose={() => setOpen(false)} title="Crear operativo">
        <CrearOperativoForm
          onSubmit={(data) => {
            onCreate(data);
            setOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function CrearAccidenteForm({ onSubmit }) {
  const [ubicacion, setUbicacion] = useState("");
  const [fecha, setFecha] = useState("");
  const [danos, setDanos] = useState(false);
  const [danoDesc, setDanoDesc] = useState("");
  const [personas, setPersonas] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [nombrePersona, setNombrePersona] = useState("");
  const [lesion, setLesion] = useState("none");
  const [patenteVeh, setPatenteVeh] = useState("");

  const addPersona = () => {
    if (!nombrePersona) return;
    setPersonas((p) => [...p, { nombre: nombrePersona, lesion }]);
    setNombrePersona("");
    setLesion("none");
  };
  const addVehiculo = () => {
    if (!patenteVeh) return;
    setVehiculos((v) => [...v, { patente: patenteVeh }]);
    setPatenteVeh("");
  };

  const lesionLabel = { none: "sin lesión", minor: "leve", severe: "grave" };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ubicacion || !fecha) return;
    onSubmit({
      id: `ACC-${Math.floor(1000 + Math.random() * 9000)}`,
      ubicacion,
      fecha,
      personas,
      vehiculos,
      danosInfraestructura: danos,
      danoDesc,
      estado: "Abierto",
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Ubicación" required>
          <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Fecha y hora" required>
          <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <Field label="Personas involucradas">
        <div className="flex gap-2">
          <input value={nombrePersona} onChange={(e) => setNombrePersona(e.target.value)} placeholder="Nombre" className={inputCls} />
          <select value={lesion} onChange={(e) => setLesion(e.target.value)} className={cx(inputCls, "w-32")}>
            <option value="none">Sin lesión</option>
            <option value="minor">Leve</option>
            <option value="severe">Grave</option>
          </select>
          <Button type="button" variant="secondary" onClick={addPersona}>
            <Plus size={14} />
          </Button>
        </div>
        {personas.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {personas.map((p, i) => (
              <li key={i}>
                · {p.nombre} — {lesionLabel[p.lesion]}
              </li>
            ))}
          </ul>
        )}
      </Field>

      <Field label="Vehículos involucrados">
        <div className="flex gap-2">
          <input value={patenteVeh} onChange={(e) => setPatenteVeh(e.target.value.toUpperCase())} placeholder="Patente" className={inputCls} />
          <Button type="button" variant="secondary" onClick={addVehiculo}>
            <Plus size={14} />
          </Button>
        </div>
        {vehiculos.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {vehiculos.map((v, i) => (
              <li key={i}>· {v.patente}</li>
            ))}
          </ul>
        )}
      </Field>

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={danos} onChange={(e) => setDanos(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        Involucra daños a infraestructura pública
      </label>
      {danos && (
        <Field label="Descripción de los daños">
          <textarea value={danoDesc} onChange={(e) => setDanoDesc(e.target.value)} rows={3} className={inputCls} />
        </Field>
      )}

      <Button type="submit" variant="primary" className="mt-2 w-full">
        Registrar accidente
      </Button>
    </form>
  );
}

function AccidentesStaff({ accidents, onCreate, onClose }) {
  const [open, setOpen] = useState(false);
  const columns = [
    { header: "Fecha", render: (r) => r.fecha },
    { header: "Ubicación", render: (r) => r.ubicacion },
    { header: "Personas", render: (r) => r.personas.length },
    { header: "Vehículos", render: (r) => r.vehiculos.length },
    { header: "Infraestructura", render: (r) => (r.danosInfraestructura ? <Badge tone="red">Sí</Badge> : <Badge tone="slate">No</Badge>) },
    { header: "Estado", render: (r) => <Badge tone={ACCIDENTE_ESTADO[r.estado]}>{r.estado}</Badge> },
    {
      header: "Acciones",
      render: (r) =>
        r.estado === "Abierto" ? (
          <Button size="sm" variant="secondary" onClick={() => onClose(r.id)}>
            Cerrar
          </Button>
        ) : null,
    },
  ];
  return (
    <div className="space-y-6">
      <SectionToolbar
        title="Accidentes viales"
        desc="Registro y seguimiento de siniestros de tránsito."
        actions={
          <Button variant="accent" onClick={() => setOpen(true)}>
            <Plus size={16} /> Registrar accidente
          </Button>
        }
      />
      <DataTable columns={columns} data={accidents} />
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar accidente vial" wide>
        <CrearAccidenteForm
          onSubmit={(data) => {
            onCreate(data);
            setOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function IngresoVehiculoForm({ onSubmit }) {
  const [patente, setPatente] = useState("");
  const [motivo, setMotivo] = useState("");
  const [deposito, setDeposito] = useState("Depósito Norte");
  const [origen, setOrigen] = useState("infraction");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!patente || !motivo) return;
    onSubmit({
      id: `VEH-${Math.floor(1000 + Math.random() * 9000)}`,
      patente: patente.toUpperCase(),
      motivo,
      deposito,
      origen: origen === "infraction" ? "Infracción" : "Operativo",
      originId: `${origen === "infraction" ? "INF" : "OP"}-${Math.floor(100 + Math.random() * 900)}`,
      fechaIngreso: new Date().toLocaleDateString("es-AR"),
      estado: "Retenido",
      requisitos: { pago: false, documentacion: false, verificacion: false },
      montoAcarreo: 25000,
      montoEstadia: 3000,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Patente" required>
          <input value={patente} onChange={(e) => setPatente(e.target.value.toUpperCase())} className={inputCls} />
        </Field>
        <Field label="Depósito">
          <select value={deposito} onChange={(e) => setDeposito(e.target.value)} className={inputCls}>
            <option>Depósito Norte</option>
            <option>Depósito Sur</option>
            <option>Depósito Central</option>
          </select>
        </Field>
      </div>
      <Field label="Motivo de la retención" required>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} placeholder="Estacionamiento en doble fila reincidente" />
      </Field>
      <Field label="Origen de la retención">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOrigen("infraction")}
            className={cx(
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium",
              origen === "infraction" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500"
            )}
          >
            Infracción
          </button>
          <button
            type="button"
            onClick={() => setOrigen("operation")}
            className={cx(
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium",
              origen === "operation" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500"
            )}
          >
            Operativo
          </button>
        </div>
      </Field>
      <Button type="submit" variant="primary" className="mt-2 w-full">
        Registrar ingreso
      </Button>
    </form>
  );
}

function VehiculosStaff({ impounded, onCreate, onToggleReq, onRelease }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const columns = [
    { header: "Patente", render: (r) => <span className="font-mono font-semibold">{r.patente}</span> },
    { header: "Origen", render: (r) => `${r.origen} · ${r.originId}` },
    { header: "Ingreso", render: (r) => r.fechaIngreso },
    { header: "Depósito", render: (r) => r.deposito },
    { header: "Costo", render: (r) => formatCurrency(r.montoAcarreo + r.montoEstadia) },
    { header: "Estado", render: (r) => <Badge tone={VEHICULO_ESTADO[r.estado]}>{r.estado}</Badge> },
  ];
  return (
    <div className="space-y-6">
      <SectionToolbar
        title="Vehículos retenidos"
        desc="Ingreso, seguimiento y liberación de vehículos en depósito."
        actions={
          <Button variant="accent" onClick={() => setOpen(true)}>
            <Plus size={16} /> Registrar ingreso
          </Button>
        }
      />
      <DataTable columns={columns} data={impounded} onRowClick={setDetail} />
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar ingreso de vehículo">
        <IngresoVehiculoForm
          onSubmit={(data) => {
            onCreate(data);
            setOpen(false);
          }}
        />
      </Modal>
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detalle del vehículo retenido">
        {detail && (
          <div>
            <dl className="space-y-2 text-sm">
              <Row label="Patente" value={detail.patente} />
              <Row label="Motivo" value={detail.motivo} />
              <Row label="Origen" value={`${detail.origen} · ${detail.originId}`} />
              <Row label="Costo total" value={formatCurrency(detail.montoAcarreo + detail.montoEstadia)} />
            </dl>
            <p className="mb-2 mt-4 text-sm font-medium text-slate-700">Requisitos para liberar</p>
            <div className="space-y-2">
              {Object.entries(detail.requisitos).map(([k, v]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={v}
                    disabled={detail.estado === "Liberado"}
                    onChange={() => onToggleReq(detail.id, k)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {REQUISITO_LABEL[k]}
                </label>
              ))}
            </div>
            {detail.estado === "Retenido" ? (
              <Button
                className="mt-4 w-full"
                variant="success"
                disabled={!Object.values(detail.requisitos).every(Boolean)}
                onClick={() => {
                  onRelease(detail.id);
                  setDetail(null);
                }}
              >
                Liberar vehículo
              </Button>
            ) : (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 size={16} /> Liberado el {detail.fechaLiberacion}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function EstacionamientoStaff({ zones, violations, onValidate, onDiscard }) {
  const zoneColumns = [
    { header: "Zona", render: (r) => r.nombre },
    { header: "Horario", render: (r) => r.horario },
    { header: "Tarifa", render: (r) => `${r.tarifa}/hora` },
    { header: "Ocupación", render: (r) => `${r.ocupacion}%` },
  ];
  const violationColumns = [
    { header: "Patente", render: (r) => <span className="font-mono font-semibold">{r.patente}</span> },
    { header: "Zona", render: (r) => r.zona },
    { header: "Detectado", render: (r) => r.hora },
    { header: "Estado", render: (r) => <Badge tone={INCUMPLIMIENTO_ESTADO[r.estado]}>{r.estado}</Badge> },
    {
      header: "Acciones",
      render: (r) =>
        r.estado === "Pendiente validación" ? (
          <div className="flex gap-2">
            <Button size="sm" variant="danger" onClick={() => onValidate(r.id)}>
              Validar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onDiscard(r.id)}>
              Descartar
            </Button>
          </div>
        ) : null,
    },
  ];
  return (
    <div className="space-y-8">
      <SectionToolbar title="Estacionamiento medido" desc="Configuración de zonas y validación de incumplimientos detectados." />
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700">Zonas configuradas</p>
        <DataTable columns={zoneColumns} data={zones} />
      </div>
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700">Incumplimientos detectados</p>
        <p className="mb-3 text-xs text-slate-400">
          Validar un incumplimiento genera automáticamente una infracción en la gestión de infracciones (F1).
        </p>
        <DataTable columns={violationColumns} data={violations} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App raíz
// ---------------------------------------------------------------------------

export default function App() {
  const { isAuthenticated, role, username, logout } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  // key={`${role}:${username}`} obliga a React a desmontar y volver a montar
  // este componente cada vez que cambia quién está logueado, para que no
  // quede colgado ningún estado de la sesión anterior (modo activo, vista
  // seleccionada, etc.). Sin esto, un inspector que entra al Panel interno
  // y luego se desloguea para entrar como vecino seguía viendo el panel
  // interno, porque React no remonta el componente solo por loguear/
  // desloguear: reutiliza el mismo estado que había quedado seteado.
  return <AuthenticatedApp key={`${role}:${username}`} role={role} username={username} onLogout={logout} />;
}

function AuthenticatedApp({ role, username, onLogout }) {
  // El rol CIUDADANO (login de vecino) sólo puede operar el Portal vecino;
  // el Panel interno queda reservado al personal municipal autenticado.
  const canAccessStaff = role !== "CIUDADANO";
  const [mode, setModeState] = useState("ciudadano");
  const [citizenView, setCitizenView] = useState("home");
  const [staffView, setStaffView] = useState("dashboard");
  const [selectedInfraction, setSelectedInfraction] = useState(null);
  const [search, setSearch] = useState("");
  const [trackCode, setTrackCode] = useState("");
  const [trackResult, setTrackResult] = useState(null);

  const [infractions, setInfractions] = useState(INITIAL_INFRACTIONS);
  const [closures, setClosures] = useState(INITIAL_CLOSURES);
  const [operativos, setOperativos] = useState(INITIAL_OPERATIVOS);
  const [accidents, setAccidents] = useState(INITIAL_ACCIDENTS);
  const [impounded, setImpounded] = useState(INITIAL_IMPOUNDED);
  const [zones] = useState(INITIAL_ZONES);
  const [violations, setViolations] = useState(INITIAL_VIOLATIONS);

  const goMode = (m) => {
    if (m === "staff" && !canAccessStaff) return;
    setModeState(m);
    if (m === "ciudadano") setCitizenView("home");
    if (m === "staff") setStaffView("dashboard");
  };

  // Datos reales del Portal vecino. Los "mine" solo existen para CIUDADANO:
  // para el resto de los roles no se piden y la pantalla lo explica.
  const isCitizen = role === "CIUDADANO";
  const nationalId = getCurrentNationalId();
  const parkingZones = useResource(getActiveZonesWithTariff);
  const currentClosures = useResource(getCurrentStreetClosures);
  const myImpoundments = useResource(getMyImpoundments, { enabled: isCitizen });
  const myAccidents = useResource(getMyAccidents, { enabled: isCitizen });

  const [citizenInfractions, setCitizenInfractions] = useState([]);
  const [citizenInfractionsLoading, setCitizenInfractionsLoading] = useState(false);
  const [citizenInfractionsError, setCitizenInfractionsError] = useState("");

  const loadCitizenInfractions = useCallback(async () => {
    setCitizenInfractionsLoading(true);
    setCitizenInfractionsError("");
    try {
      const data = await getMyInfractions();
      setCitizenInfractions((data || []).map(mapApiInfraction));
    } catch (err) {
      setCitizenInfractionsError(err.message || "No se pudieron cargar tus infracciones.");
    } finally {
      setCitizenInfractionsLoading(false);
    }
  }, []);

  // Se vuelve a pedir cada vez que el vecino entra a "Mis infracciones",
  // así se refleja cualquier cambio de estado (ej. un descargo recién enviado).
  useEffect(() => {
    if (citizenView === "infracciones") {
      loadCitizenInfractions();
    }
  }, [citizenView, loadCitizenInfractions]);

  // Al volver al inicio se refrescan los contadores de las tarjetas; al entrar
  // a una pantalla se refresca solo lo que esa pantalla muestra.
  const reloadParking = parkingZones.reload;
  const reloadClosures = currentClosures.reload;
  const reloadImpoundments = myImpoundments.reload;
  const reloadAccidents = myAccidents.reload;
  useEffect(() => {
    if (mode !== "ciudadano") return;
    if (citizenView === "home") {
      reloadParking();
      reloadClosures();
      reloadImpoundments();
      reloadAccidents();
      if (isCitizen) loadCitizenInfractions();
    }
    if (citizenView === "estacionamiento") reloadParking();
    if (citizenView === "cortes") reloadClosures();
    if (citizenView === "vehiculos") reloadImpoundments();
    if (citizenView === "accidentes") reloadAccidents();
  }, [mode, citizenView, isCitizen, reloadParking, reloadClosures, reloadImpoundments, reloadAccidents, loadCitizenInfractions]);

  // Texto del pie de cada tarjeta: cargando / error / conteo real.
  const countLabel = (resource, compute, { citizenOnly = false } = {}) => {
    if (citizenOnly && !isCitizen) return "Solo para vecinos";
    if (resource.error) return "Sin conexión";
    if (!resource.loaded) return "Cargando…";
    return compute(resource.data);
  };

  const handleSubmitDescargo = async (id, motivo) => {
    await appealInfraction(id, motivo);
    await loadCitizenInfractions();
  };

  const handleResolveInfraccion = (id, estado) => {
    setInfractions((prev) => prev.map((i) => (i.id === id ? { ...i, estado } : i)));
  };

  const handleCreateInfraccion = (data) => setInfractions((prev) => [data, ...prev]);

  const handleEvaluateClosure = (id, payload) => {
    setClosures((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, estado: payload.estado, desvios: payload.desvios, condiciones: payload.condiciones, rejectionReason: payload.rejectionReason }
          : c
      )
    );
  };
  const handleActivateClosure = (id) => setClosures((prev) => prev.map((c) => (c.id === id ? { ...c, estado: "Activo" } : c)));
  const handleExtendClosure = (id) => setClosures((prev) => prev.map((c) => (c.id === id ? { ...c, fechaFin: `${c.fechaFin} (extendido)` } : c)));
  const handleFinishClosure = (id) => setClosures((prev) => prev.map((c) => (c.id === id ? { ...c, estado: "Finalizado" } : c)));

  const handleCreateOperativo = (data) => setOperativos((prev) => [data, ...prev]);
  const handleCreateAccidente = (data) => setAccidents((prev) => [data, ...prev]);
  const handleCloseAccidente = (id) => setAccidents((prev) => prev.map((a) => (a.id === id ? { ...a, estado: "Cerrado" } : a)));

  const handleCreateImpounded = (data) => setImpounded((prev) => [data, ...prev]);
  const handleToggleRequisito = (id, key) =>
    setImpounded((prev) => prev.map((v) => (v.id === id ? { ...v, requisitos: { ...v.requisitos, [key]: !v.requisitos[key] } } : v)));
  const handleReleaseVehicle = (id) =>
    setImpounded((prev) => prev.map((v) => (v.id === id ? { ...v, estado: "Liberado", fechaLiberacion: new Date().toLocaleDateString("es-AR") } : v)));

  const handleValidateViolation = (id) => {
    const violation = violations.find((v) => v.id === id);
    setViolations((prev) => prev.map((v) => (v.id === id ? { ...v, estado: "Validado" } : v)));
    if (violation) {
      setInfractions((prev) => [
        {
          id: `INF-${Math.floor(1000 + Math.random() * 9000)}`,
          tipo: "ESTAC_MEDIDO",
          tipoLabel: "Estacionamiento medido sin pago",
          patente: violation.patente,
          calle: violation.zona,
          inspector: "Insp. Diaz",
          monto: 18000,
          estado: "Pendiente",
          fecha: new Date().toLocaleString("es-AR"),
        },
        ...prev,
      ]);
    }
  };
  const handleDiscardViolation = (id) => setViolations((prev) => prev.map((v) => (v.id === id ? { ...v, estado: "Descartado" } : v)));

  const categories = [
    {
      key: "cat-infracciones",
      target: "infracciones",
      icon: FileWarning,
      badge: { label: "POPULAR", tone: "slate" },
      title: "Mis infracciones",
      desc: "Consultá tus infracciones registradas y su estado actual.",
      count: `${citizenInfractions.length} registradas`,
    },
    {
      key: "cat-descargo",
      target: "infracciones",
      icon: FileSignature,
      title: "Presentar descargo",
      desc: "Apelá una infracción presentando la documentación correspondiente.",
      count: `${citizenInfractions.filter((i) => i.estado === "Apelada").length} en revisión`,
    },
    {
      key: "cat-estacionamiento",
      target: "estacionamiento",
      icon: ParkingCircle,
      badge: { label: "NUEVO", tone: "emerald" },
      title: "Estacionamiento medido",
      desc: "Consultá zonas, horarios y tarifas del estacionamiento medido.",
      count: countLabel(parkingZones, (d) => plural(d.length, "zona activa", "zonas activas")),
    },
    {
      key: "cat-cortes",
      target: "cortes",
      icon: TrafficCone,
      title: "Cortes de calle",
      desc: "Mirá los cortes de calle vigentes y los desvíos habilitados.",
      count: countLabel(currentClosures, (d) => plural(d.filter((c) => c.status === "ACTIVE").length, "activo", "activos")),
    },
    {
      key: "cat-vehiculos",
      target: "vehiculos",
      icon: Car,
      badge: { label: "URGENTE", tone: "red" },
      title: "Vehículos retenidos",
      desc: "Consultá el estado de un vehículo y los requisitos para liberarlo.",
      count: countLabel(myImpoundments, (d) => `${d.filter((v) => v.status === "IMPOUNDED").length} en depósito`, {
        citizenOnly: true,
      }),
    },
    {
      key: "cat-accidentes",
      target: "accidentes",
      icon: Siren,
      title: "Accidentes y denuncias",
      desc: "Consultá cómo reportar un incidente vial.",
      count: countLabel(myAccidents, (d) => plural(d.length, "registrado", "registrados"), { citizenOnly: true }),
    },
  ];

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    const found = infractions.find((i) => i.appealCode === trackCode.trim());
    setTrackResult(!!found);
  };

  const renderCitizen = () => {
    switch (citizenView) {
      case "infracciones":
        return (
          <MisInfracciones
            infractions={citizenInfractions}
            loading={citizenInfractionsLoading}
            error={citizenInfractionsError}
            onRetry={loadCitizenInfractions}
            onOpen={setSelectedInfraction}
            onBack={() => setCitizenView("home")}
          />
        );
      case "estacionamiento":
        return <EstacionamientoCiudadano resource={parkingZones} onBack={() => setCitizenView("home")} />;
      case "cortes":
        return <CortesCiudadano resource={currentClosures} onBack={() => setCitizenView("home")} />;
      case "vehiculos":
        return <VehiculosCiudadano resource={myImpoundments} isCitizen={isCitizen} onBack={() => setCitizenView("home")} />;
      case "accidentes":
        return (
          <AccidentesCiudadano
            resource={myAccidents}
            isCitizen={isCitizen}
            nationalId={nationalId}
            onBack={() => setCitizenView("home")}
          />
        );
      default:
        return (
          <CitizenHome
            search={search}
            setSearch={setSearch}
            trackCode={trackCode}
            setTrackCode={setTrackCode}
            trackResult={trackResult}
            onTrackSubmit={handleTrackSubmit}
            categories={categories}
            onNavigate={setCitizenView}
          />
        );
    }
  };

  const renderStaff = () => {
    switch (staffView) {
      case "infracciones":
        return <InfraccionesStaff infractions={infractions} onCreate={handleCreateInfraccion} onResolve={handleResolveInfraccion} />;
      case "cortes":
        return (
          <CortesDeCalleStaff
            closures={closures}
            onEvaluate={handleEvaluateClosure}
            onActivate={handleActivateClosure}
            onExtend={handleExtendClosure}
            onFinish={handleFinishClosure}
          />
        );
      case "operativos":
        return <OperativosStaff operativos={operativos} onCreate={handleCreateOperativo} />;
      case "accidentes":
        return <AccidentesStaff accidents={accidents} onCreate={handleCreateAccidente} onClose={handleCloseAccidente} />;
      case "vehiculos":
        return (
          <VehiculosStaff impounded={impounded} onCreate={handleCreateImpounded} onToggleReq={handleToggleRequisito} onRelease={handleReleaseVehicle} />
        );
      case "estacionamiento":
        return (
          <EstacionamientoStaff zones={zones} violations={violations} onValidate={handleValidateViolation} onDiscard={handleDiscardViolation} />
        );
      default:
        return <Dashboard infractions={infractions} closures={closures} operativos={operativos} accidents={accidents} impounded={impounded} zones={zones} />;
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <Header mode={mode} onModeChange={goMode} username={username} role={role} onLogout={onLogout} canAccessStaff={canAccessStaff} />
      {mode === "ciudadano" ? (
        <>
          {renderCitizen()}
          <Footer />
        </>
      ) : (
        <div className="flex min-h-screen">
          <StaffSidebar active={staffView} onChange={setStaffView} />
          <div className="flex-1 bg-slate-50">
            <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
              <select value={staffView} onChange={(e) => setStaffView(e.target.value)} className={inputCls}>
                {STAFF_NAV.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-6 lg:p-10">{renderStaff()}</div>
          </div>
        </div>
      )}

      {selectedInfraction && (
        <InfraccionDrawer infraction={selectedInfraction} onClose={() => setSelectedInfraction(null)} onSubmitDescargo={handleSubmitDescargo} />
      )}
    </div>
  );
}
