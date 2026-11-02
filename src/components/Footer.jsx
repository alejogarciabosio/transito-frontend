import { TrafficCone } from "lucide-react";
import { FOOTER_LINKS } from "../constants";

export function Footer({ onNavigate }) {
  const go = (target) => {
    onNavigate(target);
    window.scrollTo?.({ top: 0 });
  };
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
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
          <nav aria-label="Trámites">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Trámites</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {FOOTER_LINKS.map((l) => (
                <li key={l.target}>
                  <button type="button" onClick={() => go(l.target)} className="hover:text-slate-900 hover:underline">
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-10 border-t border-slate-100 pt-6 text-xs text-slate-400">
          <p>© 2026 Municipalidad de Ciudad UADE. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

