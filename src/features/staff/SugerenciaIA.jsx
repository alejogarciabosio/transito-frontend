import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "../../components/ui.jsx";
import { AGGRAVATING_FACTORS, INFRACTION_TYPES, inputCls } from "../../constants";
import { SUGGESTION_MAX_LENGTH, suggestInfraction } from "../../services/suggestions";

const norm = (s) => s.trim().toLowerCase();

// Traduce la sugerencia a valores que el formulario conoce; lo desconocido se descarta.
export function resolveSuggestion(result) {
  const tipo = INFRACTION_TYPES.find((t) => t.code === result.infractionType) || null;
  const agravantes = [];
  for (const f of result.aggravatingFactors) {
    const found = AGGRAVATING_FACTORS.find((a) => norm(a.code) === norm(f) || norm(a.label) === norm(f));
    if (found && !agravantes.some((a) => a.code === found.code)) agravantes.push(found);
  }
  return { tipo, agravantes };
}

/**
 * Ayuda opcional de IA. Solo pre-completa (onApply); nunca envía ni guarda nada.
 * state: idle | loading | suggested | manual
 */
export function SugerenciaIA({ onApply }) {
  const [descripcion, setDescripcion] = useState("");
  const [state, setState] = useState("idle");
  const [suggestion, setSuggestion] = useState(null);
  const requestId = useRef(0);

  const len = descripcion.length;
  const tooLong = len > SUGGESTION_MAX_LENGTH;
  const empty = !descripcion.trim();
  const loading = state === "loading";

  const handleSuggest = async () => {
    if (empty || tooLong || loading) return;
    const id = ++requestId.current;
    setState("loading");
    const result = await suggestInfraction(descripcion.trim());
    if (id !== requestId.current) return;
    const resolved = result.source === "AI" ? resolveSuggestion(result) : null;
    if (resolved && (resolved.tipo || resolved.agravantes.length)) {
      setSuggestion(resolved);
      setState("suggested");
      onApply({ tipo: resolved.tipo?.code, agravantes: resolved.agravantes.map((a) => a.code) });
    } else {
      setSuggestion(null);
      setState("manual");
    }
  };

  return (
    <fieldset className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-slate-700">
        <Sparkles size={14} aria-hidden="true" /> Ayuda con IA (opcional)
      </legend>
      <label htmlFor="ia-descripcion" className="mb-1.5 block text-sm font-medium text-slate-700">
        Descripción de los hechos
      </label>
      <textarea
        id="ia-descripcion"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        rows={3}
        aria-invalid={tooLong}
        aria-describedby="ia-descripcion-ayuda"
        placeholder="Ej.: auto estacionado frente a una escuela, sobre la senda peatonal"
        className={inputCls}
      />
      <div id="ia-descripcion-ayuda" className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={tooLong ? "font-medium text-red-600" : "text-slate-400"}>
          {tooLong ? `La descripción no puede superar los ${SUGGESTION_MAX_LENGTH} caracteres.` : "Se pre-completan el tipo y los agravantes; vos confirmás."}
        </span>
        <span className={tooLong ? "font-medium text-red-600" : "text-slate-400"} aria-label="Caracteres usados">
          {len}/{SUGGESTION_MAX_LENGTH}
        </span>
      </div>
      <Button type="button" variant="secondary" size="sm" className="mt-3 w-full sm:w-auto" disabled={loading || empty || tooLong} onClick={handleSuggest}>
        {loading ? "Consultando…" : "Sugerir con IA"}
      </Button>
      <div aria-live="polite" className="mt-3 text-sm">
        {state === "suggested" && suggestion && (
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-sky-800">
            <p className="text-xs font-semibold">Sugerido por IA — revisá antes de confirmar</p>
            <p className="mt-1">
              <span className="font-medium">Tipo:</span> {suggestion.tipo ? suggestion.tipo.label : "sin sugerencia"}
            </p>
            <p>
              <span className="font-medium">Agravantes:</span> {suggestion.agravantes.length ? suggestion.agravantes.map((a) => a.label).join(", ") : "ninguno"}
            </p>
          </div>
        )}
        {state === "manual" && <p className="text-slate-500">No hay sugerencia disponible; completá los datos manualmente.</p>}
      </div>
    </fieldset>
  );
}
