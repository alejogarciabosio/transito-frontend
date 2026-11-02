import { useState } from "react";

/** Ejecuta una acción async y guarda "en curso" y el error para mostrarlo en pantalla. */
export function useAction() {
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
