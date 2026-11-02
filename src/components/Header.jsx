import { ShieldCheck, TrafficCone } from "lucide-react";
import { Button } from "./ui.jsx";
import { ROLE_LABEL } from "../constants";
import { cx } from "../lib/format";

export function Header({ mode, onModeChange, username, role, onLogout, canAccessStaff }) {
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
