import {
  Car,
  ClipboardList,
  FileSignature,
  FileWarning,
  Siren,
  TrafficCone,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ResourceStatus, StatCard } from "../../components/ui.jsx";
import { INFRACTION_TYPES } from "../../constants";

export function Dashboard({ role, status, infractions, closures, operativos, accidents, impounded, zones, sessions }) {
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
      {role === "AUDITOR" && (
        <div role="note" className="mb-6 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
          Ingresaste como auditor: podés consultar toda la información del módulo, pero no registrar ni modificar datos.
        </div>
      )}
      <ResourceStatus resource={status} loadingText="Cargando indicadores..." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={FileWarning} label="Infracciones activas" value={activeInfractions} tone="red" />
        <StatCard icon={TrafficCone} label="Cortes de calle activos" value={activeClosures} tone="orange" />
        <StatCard icon={ClipboardList} label="Operativos registrados" value={runningOps} tone="sky" />
        <StatCard icon={Car} label="Vehículos en depósito" value={inDeposit} tone="slate" />
        <StatCard icon={Siren} label="Accidentes abiertos" value={openAccidents} tone="amber" />
      </div>
      {(role === "ADMINISTRADOR" || role === "AUDITOR") && (
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
