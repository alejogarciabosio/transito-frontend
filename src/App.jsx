import { useState, useEffect, useCallback, useMemo, useId, isValidElement, cloneElement } from "react";
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
import {
  getMyInfractions,
  appealInfraction,
  getAllInfractions,
  createInfraction,
  confirmInfraction,
  annulInfraction,
} from "./services/infractions";
import { getOperations, createOperation, closeOperation } from "./services/operations";
import {
  getStreetClosures,
  approveStreetClosure,
  rejectStreetClosure,
  activateStreetClosure,
  completeStreetClosure,
} from "./services/streetClosures";
import { getAccidents, createAccident, verifyAccident } from "./services/accidents";
import { getImpoundments, createImpoundment, updateImpoundment, releaseImpoundment } from "./services/impoundments";
import {
  getAllZonesWithTariffs,
  createParkingZone,
  updateParkingZone,
  deleteParkingZone,
  createParkingTariff,
  updateParkingTariff,
  deleteParkingTariff,
  getParkingSessions,
  flagParkingSessionUnpaid,
} from "./services/parking";
import { getActiveZonesWithTariff } from "./services/parking";
import { getCurrentStreetClosures } from "./services/streetClosures";
import { getMyImpoundments } from "./services/impoundments";
import { getMyAccidents } from "./services/accidents";
import { getCurrentNationalId } from "./services/api";

/**
 * Módulo 7 — Tránsito, Estacionamiento y Seguridad Vial
 * Frontend conectado a la API REST del módulo (services/), que cubre:
 *  F1 Gestión de infracciones · F2 Cortes de calle · F3 Operativos
 *  F4 Accidentes viales · F5 Vehículos retenidos · F6 Estacionamiento medido
 *  F7 Consultas e indicadores
 * Incluye Portal Vecino (ciudadano) y Panel Interno (inspector / administrador).
 * Cada pantalla del panel carga su listado desde el backend, vuelve a pedirlo después de
 * cada operación exitosa y muestra solo las acciones que el rol autenticado puede hacer.
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

// Valor inicial de un <input type="datetime-local"> (ahora, a minuto exacto).
const nowForInput = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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

// Códigos = enum InfractionType del backend. `base` es el importe base que arma el
// front (el backend solo guarda baseAmount/finalAmount, no calcula tarifas).
const INFRACTION_TYPES = [
  { code: "ILLEGAL_PARKING", label: "Estacionamiento prohibido", short: "Estac. prohibido", base: 15000 },
  { code: "SPEEDING", label: "Exceso de velocidad", short: "Velocidad", base: 45000 },
  { code: "RED_LIGHT", label: "Cruce en semáforo rojo", short: "Semáforo", base: 60000 },
  { code: "UNPAID_PARKING", label: "Estacionamiento medido sin pago", short: "Estac. medido", base: 18000 },
  { code: "NO_LICENSE", label: "Sin licencia de conducir", short: "Sin licencia", base: 25000 },
  { code: "RECKLESS_DRIVING", label: "Conducción imprudente", short: "Imprudente", base: 50000 },
  { code: "OTHER", label: "Otra infracción", short: "Otra", base: 20000 },
];

const AGGRAVATING_FACTORS = [
  { code: "REINCIDENCIA", label: "Reincidencia", pct: 0.5 },
  { code: "ZONA_ESCOLAR", label: "Zona escolar", pct: 0.3 },
  { code: "ALTA_VELOCIDAD", label: "Alta velocidad registrada", pct: 0.4 },
  { code: "RESISTENCIA", label: "Resistencia a la autoridad", pct: 0.2 },
];


// Requisitos de liberación: el backend guarda el código tal cual se envía en
// verifiedRequirements (texto libre, al menos uno); acá se les pone etiqueta.
const REQUISITO_LABEL = {
  DOCUMENTACION: "Documentación del vehículo",
  PAGO_MULTA: "Multa abonada",
  VERIFICACION_TECNICA: "Verificación técnica",
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
const INFRACTION_TYPE_LABEL = Object.fromEntries(INFRACTION_TYPES.map((t) => [t.code, t.label]));

const INFRACTION_STATUS_LABEL = {
  PENDING_APPEAL: "Pendiente",
  APPEALED: "Apelada",
  CONFIRMED: "Confirmada",
  ANNULLED: "Anulada",
};

// Adapta una infracción tal como la devuelve el backend (GET /infractions y
// GET /infractions/mine) a la forma que usan las pantallas del vecino y del panel.
function mapApiInfraction(api) {
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
    // Hoy el backend no devuelve el texto del descargo (solo lo publica en el evento
    // infractionAppealed). Si más adelante lo agrega, la pantalla lo muestra sola.
    motivoDescargo: api.appealReason,
  };
}

const CORTE_ESTADO = {
  Pendiente: "amber",
  Aprobado: "sky",
  Rechazado: "red",
  Activo: "orange",
  Finalizado: "slate",
  Vencido: "amber",
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
const STAFF_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "infracciones", label: "Infracciones", icon: FileWarning },
  { id: "cortes", label: "Cortes de calle", icon: TrafficCone },
  { id: "operativos", label: "Operativos", icon: ClipboardList },
  { id: "accidentes", label: "Accidentes", icon: Siren },
  { id: "vehiculos", label: "Vehículos retenidos", icon: Car },
  { id: "estacionamiento", label: "Estacionamiento medido", icon: ParkingCircle },
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

// Si el contenido es un único input/select/textarea, el título queda asociado como <label>
// (accesibilidad: lectores de pantalla y clic en el título enfocan el campo).
const FIELD_CONTROLS = new Set(["input", "select", "textarea"]);
function Field({ label, required, children, hint }) {
  const autoId = useId();
  const single = isValidElement(children) && FIELD_CONTROLS.has(children.type);
  const id = single ? children.props.id ?? autoId : undefined;
  const Title = single ? "label" : "p";
  return (
    <div className="mb-4">
      <Title htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-600">*</span>}
      </Title>
      {single ? cloneElement(children, { id }) : children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
      <div role="dialog" aria-modal="true" aria-label={title} className={cx("w-full rounded-2xl bg-white shadow-xl", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
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
  ADMINISTRADOR: "Administrador",
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
            <p className="text-sm font-medium text-slate-700">¿Querés saber cómo sigue tu infracción?</p>
          </div>
          <form onSubmit={onTrackSubmit} className="flex w-full gap-3 sm:w-auto">
            <input
              value={trackCode}
              onChange={(e) => setTrackCode(e.target.value)}
              placeholder="Número de acta o patente"
              aria-label="Número de acta o patente"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400 sm:w-72"
            />
            <Button type="submit" variant="primary">
              Consultar <ArrowUpRight size={14} />
            </Button>
          </form>
        </div>
        {trackResult !== null && (
          <div className="mx-auto max-w-7xl px-6 pb-5" role="status">
            {trackResult.status === "found" ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Acta <strong>{trackResult.infraction.id.slice(0, 8)}</strong> · {trackResult.infraction.tipoLabel} ·
                patente {trackResult.infraction.patente}. Estado: <strong>{trackResult.infraction.estado}</strong>.
              </div>
            ) : (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {trackResult.status === "not-citizen"
                  ? "Para consultar un trámite ingresá con tu usuario de vecino."
                  : trackResult.status === "error"
                    ? trackResult.message || "No se pudo consultar. Intentá nuevamente."
                    : "No encontramos ninguna infracción tuya con ese número de acta o patente."}
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
                          <CheckCircle2 size={15} className="text-emerald-500" /> {REQUISITO_LABEL[r] || r}
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

function Dashboard({ role, status, infractions, closures, operativos, accidents, impounded, zones, sessions }) {
  const activeInfractions = infractions.filter((i) => i.estado !== "Anulada").length;
  // Pendientes de decisión: solo el administrador puede resolverlos.
  const appealedInfractions = infractions.filter((i) => i.estado === "Apelada").length;
  const closuresToEvaluate = closures.filter((c) => c.estado === "Pendiente").length;
  const activeClosures = closures.filter((c) => c.estado === "Activo").length;
  const runningOps = operativos.length;
  const inDeposit = impounded.filter((v) => v.estado === "Retenido").length;
  const openAccidents = accidents.filter((a) => a.status === "PRELIMINARY").length;
  const openSessionsByZone = zones
    .filter((z) => z.activa)
    .map((z) => ({ id: z.id, nombre: z.nombre, abiertas: sessions.filter((x) => x.zonaId === z.id && !x.fin).length }));
  const maxOpenSessions = Math.max(1, ...openSessionsByZone.map((z) => z.abiertas));

  const byType = INFRACTION_TYPES.map((t) => ({
    tipo: t.short,
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
      <ResourceStatus resource={status} loadingText="Cargando indicadores..." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={FileWarning} label="Infracciones activas" value={activeInfractions} tone="red" />
        <StatCard icon={TrafficCone} label="Cortes de calle activos" value={activeClosures} tone="orange" />
        <StatCard icon={ClipboardList} label="Operativos registrados" value={runningOps} tone="sky" />
        <StatCard icon={Car} label="Vehículos en depósito" value={inDeposit} tone="slate" />
        <StatCard icon={Siren} label="Accidentes abiertos" value={openAccidents} tone="amber" />
      </div>
      {role === "ADMINISTRADOR" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={FileSignature} label="Descargos por resolver" value={appealedInfractions} tone="sky" />
          <StatCard icon={TrafficCone} label="Cortes por evaluar" value={closuresToEvaluate} tone="amber" />
        </div>
      )}
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
          <p className="mb-4 text-sm font-semibold text-slate-700">Sesiones de estacionamiento abiertas</p>
          <div className="space-y-4">
            {openSessionsByZone.length === 0 && <p className="text-xs text-slate-400">No hay zonas activas.</p>}
            {openSessionsByZone.map((z) => (
              <div key={z.id}>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{z.nombre}</span>
                  <span>{z.abiertas}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${(z.abiertas / maxOpenSessions) * 100}%` }} />
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
          <p className="mt-1 text-red-600">{error}</p>
        </div>
      )}
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
      <Button type="submit" variant="primary" className="mt-4 w-full" disabled={submitting}>
        {submitting ? "Registrando..." : "Emitir acta de infracción"}
      </Button>
    </form>
  );
}

function InfraccionesStaff({ infractions, resource, role, onCreate, onConfirm, onAnnul }) {
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
                <p className="mt-1">{detail.motivoDescargo || "El texto del descargo no está disponible en esta vista."}</p>
                {!canResolve && <p className="mt-3 text-xs text-sky-500">La resolución la realiza un administrador.</p>}
              </div>
            )}
            {actionError && (
              <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
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

/** Ejecuta una acción async y guarda "en curso" y el error para mostrarlo en pantalla. */
function useAction() {
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const run = async (action, fallback = "No se pudo completar la acción.") => {
    setError("");
    setActing(true);
    try {
      await action();
      return true;
    } catch (err) {
      setError(err.message || fallback);
      return false;
    } finally {
      setActing(false);
    }
  };
  return { run, acting, error, setError };
}

function ErrorNote({ title, children }) {
  if (!children) return null;
  return (
    <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm">
      {title && (
        <p className="flex items-center gap-2 font-semibold text-red-700">
          <AlertCircle size={16} /> {title}
        </p>
      )}
      <p className={cx("text-red-600", title && "mt-1")}>{children}</p>
    </div>
  );
}

const linesOf = (text) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

// Valor de <input type="datetime-local"> -> LocalDateTime del backend (con segundos).
const toApiDateTime = (value) => (value.length === 16 ? `${value}:00` : value);

// Valor de <input type="datetime-local"> -> OffsetDateTime del backend, con el offset de la
// zona horaria del navegador (ej. "2026-10-20T08:00:00-03:00"). Vacío -> null.
const toApiOffsetDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value); // sin zona explícita el navegador lo interpreta como hora local
  if (Number.isNaN(d.getTime())) return null;
  const offset = -d.getTimezoneOffset();
  const abs = Math.abs(offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${toApiDateTime(value)}${offset >= 0 ? "+" : "-"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

// Fecha ISO del backend (con offset) -> valor de <input type="datetime-local"> en hora local.
const isoToInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ----- Cortes de calle -----

const CLOSURE_STATUS_STAFF = {
  REQUESTED: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  ACTIVE: "Activo",
  FINISHED: "Finalizado",
  EXPIRED: "Vencido",
};

function mapApiClosure(api) {
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

function CortesDeCalleStaff({ closures, resource, role, onApprove, onReject, onActivate, onComplete }) {
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

const OPERATION_TYPES = [
  { code: "ROUTINE_CONTROL", label: "Control de rutina" },
  { code: "COMPLAINT_VERIFICATION", label: "Verificación de denuncia" },
  { code: "SAFETY_INSPECTION", label: "Inspección de seguridad" },
];
const OPERATION_TYPE_LABEL = Object.fromEntries(OPERATION_TYPES.map((t) => [t.code, t.label]));
const OPERATION_RESOLUTIONS = [
  { code: "INFRACTION_CREATED", label: "Se generó una infracción" },
  { code: "ACCIDENT_REGISTERED", label: "Se registró un accidente" },
  { code: "NO_ACTION", label: "Sin novedades" },
];
const OPERATION_RESOLUTION_LABEL = Object.fromEntries(OPERATION_RESOLUTIONS.map((r) => [r.code, r.label]));
const OPERATION_STATUS_UI = {
  OPEN: { label: "Abierto", tone: "amber" },
  CLOSED: { label: "Cerrado", tone: "emerald" },
};

function mapApiOperation(api) {
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
                inspectores.includes(i) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500"
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

function OperativosStaff({ operativos, resource, role, onCreate, onClose }) {
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
          {r.resolucion && <p className="mt-1 text-xs text-slate-500">{r.resolucion}</p>}
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
              <p className="text-slate-500">{closeTarget.inicio}</p>
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

const INJURY_OPTIONS = [
  { code: "NONE", label: "Sin lesión" },
  { code: "MINOR", label: "Leve" },
  { code: "SEVERE", label: "Grave" },
];
const INJURY_OPTION_LABEL = Object.fromEntries(INJURY_OPTIONS.map((o) => [o.code, o.label.toLowerCase()]));

function mapApiAccident(api) {
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

function AccidentesStaff({ accidents, resource, role, onCreate, onVerify }) {
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

const DEPOTS = ["Depósito Norte", "Depósito Sur", "Depósito Central"];
// Valores de referencia que ya traía el mock: el backend solo guarda el costo total que se informa al liberar.
const ACARREO_BASE = 25000;
const ESTADIA_DIARIA = 3000;

function suggestFee(entryDateTime) {
  const days = Math.max(1, Math.ceil((Date.now() - new Date(entryDateTime).getTime()) / 86400000) || 1);
  return { days, total: ACARREO_BASE + ESTADIA_DIARIA * days };
}

function mapApiImpoundment(api) {
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

function IngresoVehiculoForm({ infractions, operations, onSubmit, onDone }) {
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
      ? infractions
          .filter((i) => i.estado !== "Anulada")
          .map((i) => ({ id: i.id, label: `${i.patente} · ${i.tipoLabel} · ${i.fecha}` }))
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

function LiberarVehiculoForm({ vehicle, onSubmit, onDone }) {
  const requirements = Object.entries(REQUISITO_LABEL);
  const [checked, setChecked] = useState([]);
  const [suggestion] = useState(() => suggestFee(vehicle.ingresoISO));
  const [fee, setFee] = useState(String(suggestion.total));
  const [reference, setReference] = useState("");
  const { run, acting, error } = useAction();

  const feeNumber = Number(fee);
  const feeValid = fee !== "" && Number.isFinite(feeNumber) && feeNumber >= 0;
  const needsReference = feeValid && feeNumber > 0;
  // El backend exige al menos un requisito verificado (no necesariamente todos).
  const canRelease = checked.length >= 1 && feeValid && (!needsReference || reference.trim() !== "");

  const toggle = (code) => setChecked((prev) => (prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code]));

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
      <p className="mb-2 mt-4 text-sm font-medium text-slate-700">
        Requisitos verificados <span className="text-red-600">*</span>
      </p>
      <div className="space-y-2">
        {requirements.map(([code, label]) => (
          <label key={code} className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={checked.includes(code)} onChange={() => toggle(code)} className="h-4 w-4 rounded border-slate-300" />
            {label}
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-400">Marcá al menos un requisito verificado para poder liberar el vehículo.</p>
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

// Edición de los datos de una retención (PATCH, solo ADMINISTRADOR y solo mientras sigue retenido).
function EditarRetencionForm({ vehicle, onSubmit, onDone, onCancel }) {
  const [motivo, setMotivo] = useState(vehicle.motivo ?? "");
  const [deposito, setDeposito] = useState(vehicle.deposito ?? "");
  const [dni, setDni] = useState(vehicle.titular ?? "");
  const { run, acting, error } = useAction();

  // PATCH parcial: solo se envían los campos que cambiaron.
  const changes = {};
  if (motivo.trim() !== (vehicle.motivo ?? "")) changes.reason = motivo.trim();
  if (deposito.trim() !== (vehicle.deposito ?? "")) changes.depotLocation = deposito.trim();
  if (dni.trim() !== (vehicle.titular ?? "")) changes.ownerNationalId = dni.trim();
  const hasChanges = Object.keys(changes).length > 0;
  const valid = motivo.trim() !== "" && deposito.trim() !== "" && dni.trim() !== "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasChanges || !valid) return;
    if (await run(() => onSubmit(vehicle.id, changes))) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 border-t border-slate-100 pt-4">
      <p className="mb-3 text-sm font-semibold text-slate-700">Editar datos de la retención</p>
      <ErrorNote title="No se pudo guardar">{error}</ErrorNote>
      <Field label="Motivo de la retención" required hint={`${motivo.length}/1000`}>
        <input value={motivo} maxLength={1000} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Depósito" required>
          <input value={deposito} maxLength={200} list="depot-options" onChange={(e) => setDeposito(e.target.value)} className={inputCls} />
          <datalist id="depot-options">
            {DEPOTS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
        <Field label="DNI del titular" required>
          <input value={dni} maxLength={30} inputMode="numeric" onChange={(e) => setDni(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={acting || !hasChanges || !valid}>
          {acting ? "Guardando..." : "Guardar cambios"}
        </Button>
        <Button type="button" variant="ghost" disabled={acting} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function VehiculosStaff({ impounded, resource, role, infractions, operations, onCreate, onUpdate, onRelease }) {
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [editing, setEditing] = useState(false);

  // Permisos del backend: el inspector registra el ingreso; el administrador edita y libera.
  const canRegister = role === "INSPECTOR";
  const canRelease = role === "ADMINISTRADOR";

  const closeDetail = () => {
    setDetailId(null);
    setEditing(false);
  };

  // Se busca por id para que el detalle refleje lo que devuelve el backend tras recargar.
  const detail = impounded.find((v) => v.id === detailId) || null;

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
        desc={canRegister ? "Ingreso y seguimiento de vehículos en depósito." : "Seguimiento, edición y liberación de vehículos en depósito."}
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
                <Button size="sm" variant="secondary" className="mt-4" onClick={() => setEditing(true)}>
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
                    <li key={r}>· {REQUISITO_LABEL[r] || r}</li>
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

// ----- Estacionamiento medido -----

function mapApiZone(api) {
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

function mapApiSession(api) {
  return {
    id: api.sessionId,
    patente: api.licensePlate,
    zonaId: api.zoneId,
    inicio: formatDateTime(api.startDateTime),
    fin: api.endDateTime ? formatDateTime(api.endDateTime) : null,
    pagada: !!api.paid,
  };
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
          <p className="mt-1 text-red-600">Dejará de mostrarse en la zona. Esta acción no se puede deshacer desde acá.</p>
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
                if (await del.run(() => onDelete(deleting.tariffId))) {
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

function EstacionamientoStaff({
  zones,
  zonesResource,
  sessions,
  sessionsResource,
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
  // El personal arranca en el Panel interno; el vecino, en el Portal vecino.
  const [mode, setModeState] = useState(canAccessStaff ? "staff" : "ciudadano");
  const [citizenView, setCitizenView] = useState("home");
  const [staffView, setStaffView] = useState("dashboard");
  const [selectedInfraction, setSelectedInfraction] = useState(null);
  const [search, setSearch] = useState("");
  const [trackCode, setTrackCode] = useState("");
  const [trackResult, setTrackResult] = useState(null);

  // El seguimiento de descargos por código sigue en mock: todavía no tiene endpoint.

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
  // Infracciones del Panel interno (GET /infractions: INSPECTOR y ADMINISTRADOR).
  const staffInfractionsRes = useResource(getAllInfractions, { enabled: canAccessStaff });
  const staffInfractions = useMemo(() => staffInfractionsRes.data.map(mapApiInfraction), [staffInfractionsRes.data]);
  const reloadStaffInfractions = staffInfractionsRes.reload;

  // Resto del Panel interno (INSPECTOR y ADMINISTRADOR pueden leer todos estos listados).
  const staffClosuresRes = useResource(getStreetClosures, { enabled: canAccessStaff });
  const staffClosures = useMemo(() => staffClosuresRes.data.map(mapApiClosure), [staffClosuresRes.data]);
  const operationsRes = useResource(getOperations, { enabled: canAccessStaff });
  const operations = useMemo(() => operationsRes.data.map(mapApiOperation), [operationsRes.data]);
  const staffAccidentsRes = useResource(getAccidents, { enabled: canAccessStaff });
  const staffAccidents = useMemo(() => staffAccidentsRes.data.map(mapApiAccident), [staffAccidentsRes.data]);
  const staffImpoundedRes = useResource(getImpoundments, { enabled: canAccessStaff });
  const staffImpounded = useMemo(() => staffImpoundedRes.data.map(mapApiImpoundment), [staffImpoundedRes.data]);
  const staffZonesRes = useResource(getAllZonesWithTariffs, { enabled: canAccessStaff });
  const staffZones = useMemo(() => staffZonesRes.data.map(mapApiZone), [staffZonesRes.data]);
  const sessionsRes = useResource(getParkingSessions, { enabled: canAccessStaff });
  const sessions = useMemo(() => sessionsRes.data.map(mapApiSession), [sessionsRes.data]);

  const reloadStaffClosures = staffClosuresRes.reload;
  const reloadOperations = operationsRes.reload;
  const reloadStaffAccidents = staffAccidentsRes.reload;
  const reloadStaffImpounded = staffImpoundedRes.reload;
  const reloadStaffZones = staffZonesRes.reload;
  const reloadSessions = sessionsRes.reload;

  // Al entrar a una pantalla del panel se pide solo lo que esa pantalla muestra.
  useEffect(() => {
    if (mode !== "staff") return;
    if (staffView === "dashboard") {
      reloadStaffInfractions();
      reloadStaffClosures();
      reloadOperations();
      reloadStaffAccidents();
      reloadStaffImpounded();
      reloadStaffZones();
      reloadSessions();
    }
    if (staffView === "infracciones") reloadStaffInfractions();
    if (staffView === "cortes") reloadStaffClosures();
    if (staffView === "operativos") reloadOperations();
    if (staffView === "accidentes") reloadStaffAccidents();
    if (staffView === "vehiculos") {
      reloadStaffImpounded();
      reloadStaffInfractions(); // para elegir la infracción de origen
      reloadOperations(); // para elegir el operativo de origen
    }
    if (staffView === "estacionamiento") {
      reloadStaffZones();
      reloadSessions();
    }
  }, [
    mode,
    staffView,
    reloadStaffInfractions,
    reloadStaffClosures,
    reloadOperations,
    reloadStaffAccidents,
    reloadStaffImpounded,
    reloadStaffZones,
    reloadSessions,
  ]);

  // El Dashboard junta los siete listados: un solo estado de carga/error para todos.
  const dashboardResources = [staffInfractionsRes, staffClosuresRes, operationsRes, staffAccidentsRes, staffImpoundedRes, staffZonesRes, sessionsRes];
  const dashboardStatus = {
    loading: dashboardResources.some((r) => r.loading),
    loaded: dashboardResources.every((r) => r.loaded),
    error: dashboardResources.find((r) => r.error)?.error || "",
    reload: () => dashboardResources.forEach((r) => r.reload()),
  };

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

  // Panel interno: cada acción llama al backend y después recarga la lista.
  const handleCreateInfraccion = async (data) => {
    await createInfraction(data);
    await reloadStaffInfractions();
  };
  const handleConfirmInfraccion = async (id) => {
    await confirmInfraction(id);
    await reloadStaffInfractions();
  };
  const handleAnnulInfraccion = async (id, reason) => {
    await annulInfraction(id, reason);
    await reloadStaffInfractions();
  };

  // Cada acción llama al backend y después recarga el listado que corresponde.
  const handleApproveClosure = async (id, payload) => {
    await approveStreetClosure(id, payload);
    await reloadStaffClosures();
  };
  const handleRejectClosure = async (id, reason) => {
    await rejectStreetClosure(id, reason);
    await reloadStaffClosures();
  };
  const handleActivateClosure = async (id) => {
    await activateStreetClosure(id);
    await reloadStaffClosures();
  };
  const handleCompleteClosure = async (id, notes) => {
    await completeStreetClosure(id, notes);
    await reloadStaffClosures();
  };

  const handleCreateOperation = async (data) => {
    await createOperation(data);
    await reloadOperations();
  };
  const handleCloseOperation = async (id, resolution) => {
    await closeOperation(id, resolution);
    await reloadOperations();
  };

  const handleCreateAccident = async (data) => {
    await createAccident(data);
    await reloadStaffAccidents();
  };
  const handleVerifyAccident = async (id) => {
    await verifyAccident(id);
    await reloadStaffAccidents();
  };

  const handleCreateImpoundment = async (data) => {
    await createImpoundment(data);
    await reloadStaffImpounded();
  };
  const handleUpdateImpoundment = async (id, data) => {
    await updateImpoundment(id, data);
    await reloadStaffImpounded();
  };
  const handleReleaseImpoundment = async (id, data) => {
    await releaseImpoundment(id, data);
    await reloadStaffImpounded();
  };

  const handleCreateZone = async (data) => {
    await createParkingZone(data);
    await reloadStaffZones();
  };
  const handleUpdateZone = async (id, data) => {
    await updateParkingZone(id, data);
    await reloadStaffZones();
  };
  const handleDeleteZone = async (id) => {
    await deleteParkingZone(id);
    await reloadStaffZones();
  };
  const handleCreateTariff = async (data) => {
    await createParkingTariff(data);
    await reloadStaffZones();
  };
  const handleUpdateTariff = async (id, data) => {
    await updateParkingTariff(id, data);
    await reloadStaffZones();
  };
  const handleDeleteTariff = async (id) => {
    await deleteParkingTariff(id);
    await reloadStaffZones();
  };
  // Marcar la falta de pago crea una infracción: se recargan las sesiones y las infracciones.
  const handleFlagUnpaid = async (id, baseAmount) => {
    await flagParkingSessionUnpaid(id, baseAmount);
    await Promise.all([reloadSessions(), reloadStaffInfractions()]);
  };

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

  // Busca entre las infracciones reales del vecino por número de acta (completo o sus
  // primeros caracteres) o por patente, y muestra el estado que informa el backend.
  const handleTrackSubmit = async (e) => {
    e.preventDefault();
    const code = trackCode.trim().toLowerCase();
    if (!code) return;
    if (!isCitizen) {
      setTrackResult({ status: "not-citizen" });
      return;
    }
    try {
      const data = await getMyInfractions();
      const found = (data || [])
        .map(mapApiInfraction)
        .find((i) => i.id.toLowerCase().startsWith(code) || i.patente?.toLowerCase() === code);
      setTrackResult(found ? { status: "found", infraction: found } : { status: "not-found" });
    } catch (err) {
      setTrackResult({ status: "error", message: err.message });
    }
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
        return (
          <InfraccionesStaff
            infractions={staffInfractions}
            resource={staffInfractionsRes}
            role={role}
            onCreate={handleCreateInfraccion}
            onConfirm={handleConfirmInfraccion}
            onAnnul={handleAnnulInfraccion}
          />
        );
      case "cortes":
        return (
          <CortesDeCalleStaff
            closures={staffClosures}
            resource={staffClosuresRes}
            role={role}
            onApprove={handleApproveClosure}
            onReject={handleRejectClosure}
            onActivate={handleActivateClosure}
            onComplete={handleCompleteClosure}
          />
        );
      case "operativos":
        return (
          <OperativosStaff operativos={operations} resource={operationsRes} role={role} onCreate={handleCreateOperation} onClose={handleCloseOperation} />
        );
      case "accidentes":
        return (
          <AccidentesStaff accidents={staffAccidents} resource={staffAccidentsRes} role={role} onCreate={handleCreateAccident} onVerify={handleVerifyAccident} />
        );
      case "vehiculos":
        return (
          <VehiculosStaff
            impounded={staffImpounded}
            resource={staffImpoundedRes}
            role={role}
            infractions={staffInfractions}
            operations={operations}
            onCreate={handleCreateImpoundment}
            onUpdate={handleUpdateImpoundment}
            onRelease={handleReleaseImpoundment}
          />
        );
      case "estacionamiento":
        return (
          <EstacionamientoStaff
            zones={staffZones}
            zonesResource={staffZonesRes}
            sessions={sessions}
            sessionsResource={sessionsRes}
            role={role}
            onCreateZone={handleCreateZone}
            onUpdateZone={handleUpdateZone}
            onDeleteZone={handleDeleteZone}
            onCreateTariff={handleCreateTariff}
            onUpdateTariff={handleUpdateTariff}
            onDeleteTariff={handleDeleteTariff}
            onFlagUnpaid={handleFlagUnpaid}
          />
        );
      default:
        return (
          <Dashboard
            role={role}
            status={dashboardStatus}
            infractions={staffInfractions}
            closures={staffClosures}
            operativos={operations}
            accidents={staffAccidents}
            impounded={staffImpounded}
            zones={staffZones}
            sessions={sessions}
          />
        );
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
