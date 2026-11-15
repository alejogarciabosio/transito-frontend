import { cloneElement, isValidElement, useEffect, useId, useRef } from "react";
import {
  AlertCircle,
  ChevronLeft,
  RotateCcw,
  X,
} from "lucide-react";
import { BADGE_TONES, TONE_TEXT } from "../constants";
import { cx } from "../lib/format";

export function Badge({ tone = "slate", children }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = { md: "px-4 py-2.5 text-sm", sm: "px-3 py-1.5 text-xs" };
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    accent: "bg-red-600 text-white hover:bg-red-700",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  return <button className={cx(base, sizes[size], variants[variant], className)} {...props} />;
}

// Si el contenido es un único input/select/textarea, el título queda asociado como <label>
// (accesibilidad: lectores de pantalla y clic en el título enfocan el campo).
const FIELD_CONTROLS = new Set(["input", "select", "textarea"]);

export function Field({ label, required, children, hint }) {
  const autoId = useId();
  const single = isValidElement(children) && FIELD_CONTROLS.has(children.type);
  const id = single ? children.props.id ?? autoId : undefined;
  const Title = single ? "label" : "p";
  return (
    <div className="mb-4">
      <Title htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-700">*</span>}
      </Title>
      {single ? cloneElement(children, { id }) : children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  const dialogRef = useRef(null);
  // onClose suele llegar como función nueva en cada render: se guarda en una referencia para que
  // el efecto dependa solo de "open" y no le robe el foco al campo que se está escribiendo.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Esc cierra el diálogo y, al abrirse, el foco pasa adentro (y vuelve al botón que lo abrió).
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    dialogRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx("w-full rounded-2xl bg-white shadow-xl outline-none", wide ? "max-w-2xl" : "max-w-lg")}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-600">
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

export function DataTable({ columns, data, onRowClick, keyField = "id", emptyLabel = "Sin registros" }) {
  return (
    <div tabIndex={0} role="group" aria-label="Tabla de datos (desplazable)" className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
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

export function SectionToolbar({ title, desc, actions }) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-600">{desc}</p>}
      </div>
      {actions}
    </div>
  );
}

export function SectionHeader({ eyebrow, title, desc }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-700">
        <span className="h-px w-6 bg-red-600" /> {eyebrow}
      </p>
      <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
      {desc && <p className="mt-2 max-w-2xl text-slate-600">{desc}</p>}
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

export function BackLink({ onClick }) {
  return (
    <button onClick={onClick} className="mb-6 flex min-h-10 items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800">
      <ChevronLeft size={16} /> Volver al inicio
    </button>
  );
}

export function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={cx("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", TONE_TEXT[tone])}>
        <Icon size={17} />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{label}</p>
    </div>
  );
}

// Bloque de "cargando" / "error + reintentar" compartido por las pantallas del portal.
// Devuelve null cuando hay datos para mostrar.
export function ResourceStatus({ resource, loadingText }) {
  if (resource.loading && !resource.loaded) {
    return <p className="text-sm text-slate-600">{loadingText}</p>;
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

export function ErrorNote({ title, children }) {
  if (!children) return null;
  return (
    <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm">
      {title && (
        <p className="flex items-center gap-2 font-semibold text-red-700">
          <AlertCircle size={16} /> {title}
        </p>
      )}
      <p className={cx("text-red-700", title && "mt-1")}>{children}</p>
    </div>
  );
}
