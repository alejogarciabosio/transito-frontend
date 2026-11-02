import { useCallback, useState } from "react";

/**
 * Carga una lista desde el backend y expone { data, loading, loaded, error, reload }.
 * `loader` tiene que ser una función estable (las de services/ lo son).
 * Con enabled=false no se hace ningún pedido (ej. endpoints solo para CIUDADANO).
 */
export function useResource(loader, { enabled = true } = {}) {
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
