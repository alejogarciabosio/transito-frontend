import { STAFF_NAV } from "../../constants";
import { cx } from "../../lib/format";

export function StaffSidebar({ active, onChange }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-800 bg-slate-900 lg:block">
      <div className="px-5 py-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Panel interno</p>
        <p className="mt-1 text-sm text-slate-300">Dirección de Tránsito</p>
      </div>
      <nav aria-label="Secciones del panel interno" className="space-y-1 px-3">
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
