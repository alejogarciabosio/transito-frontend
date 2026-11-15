// Sugerencia de IA para registrar infracciones. Único lugar que habla con
// POST /infractions/suggestions (rol INSPECTOR). Es una ayuda opcional: ante
// cualquier falla (404, 5xx, red, respuesta inválida) se devuelve el modo MANUAL.
import { apiFetch } from "./api";

export const SUGGESTION_MAX_LENGTH = 500;

const MANUAL = Object.freeze({ infractionType: null, aggravatingFactors: [], source: "MANUAL", promptVersion: null });

/**
 * POST /infractions/suggestions — body: { description } (1..500 caracteres).
 * Nunca lanza: devuelve { infractionType, aggravatingFactors, source, promptVersion }.
 */
export async function suggestInfraction(description) {
  try {
    const data = await apiFetch("/infractions/suggestions", { method: "POST", body: { description } });
    if (!data || data.source !== "AI") return { ...MANUAL };
    return {
      infractionType: typeof data.infractionType === "string" ? data.infractionType : null,
      aggravatingFactors: Array.isArray(data.aggravatingFactors) ? data.aggravatingFactors.filter((f) => typeof f === "string") : [],
      source: "AI",
      promptVersion: data.promptVersion ?? null,
    };
  } catch {
    return { ...MANUAL };
  }
}
