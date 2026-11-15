import {
  ArrowUpRight,
  FileSignature,
  FileWarning,
  MapPin,
  ParkingCircle,
  Search,
  TrafficCone,
} from "lucide-react";
import { Badge, Button } from "../../components/ui.jsx";

// Ilustración decorativa del inicio: muestra la forma de la app, sin datos reales ni inventados.
function PhoneMock() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-xs">
      <div className="relative rounded-3xl border-8 border-slate-900 bg-slate-900 shadow-2xl">
        <div className="overflow-hidden rounded-2xl bg-white">
          <div className="h-6 bg-slate-900" />
          <div className="space-y-4 p-4">
            <div>
              <p className="text-xs font-medium text-slate-500">PORTAL VECINO</p>
              <p className="text-sm font-bold text-slate-900">Tránsito UADE</p>
            </div>
            <div className="relative h-32 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200">
              <MapPin className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-700" size={22} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5">
                <FileWarning size={16} className="text-red-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Tus infracciones</p>
                  <p className="text-xs text-slate-500">Estado y descargos</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5">
                <ParkingCircle size={16} className="text-slate-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Estacionamiento medido</p>
                  <p className="text-xs text-slate-500">Zonas y tarifas</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5">
                <TrafficCone size={16} className="text-orange-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Cortes de calle</p>
                  <p className="text-xs text-slate-500">Desvíos vigentes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CitizenHome({ search, setSearch, trackCode, setTrackCode, trackResult, onTrackSubmit, categories, onNavigate }) {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-red-600" />
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-700">
              <span className="h-px w-6 bg-red-600" /> Tránsito y seguridad vial
            </p>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
              Tu tránsito,
              <br />
              <span className="text-red-700">bajo control.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-slate-600">
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
                <Search size={18} className="text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscá: Infracciones, Estacionamiento, Cortes..."
                  aria-label="Buscar trámite"
                  className="w-full py-1 text-sm text-slate-700 outline-none placeholder:text-slate-500"
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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700">
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
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
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
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-700">
          <span className="h-px w-6 bg-red-600" /> Áreas de gestión
        </p>
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-slate-900">¿Sobre qué necesitás hacer una gestión?</h2>
          <span className="hidden text-sm text-slate-500 sm:block">{categories.length} categorías</span>
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
              <p className="mt-1.5 text-sm text-slate-600">{cat.desc}</p>
              <div className="mt-5 flex w-full items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs font-medium text-slate-500">{cat.count}</span>
                <ArrowUpRight size={16} className="text-slate-300 transition-colors group-hover:text-red-600" />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-br from-slate-50 to-red-50 p-8 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">¿No encontrás lo que buscás?</h3>
            <p className="mt-1 text-sm text-slate-600">
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
