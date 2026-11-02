export const cx = (...classes) => classes.filter(Boolean).join(" ");

export const formatCurrency = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

export const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
};

// LocalDate del backend ("2026-12-31") → "31/12/2026". No se usa new Date()
// porque lo interpretaría como UTC y en Argentina mostraría el día anterior.
export const formatLocalDate = (s) => (s ? s.split("-").reverse().join("/") : "—");

// Valor inicial de un <input type="datetime-local"> (ahora, a minuto exacto).
export const nowForInput = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "1 activo" / "2 activos"
export const plural = (n, singular, pluralForm) => `${n} ${n === 1 ? singular : pluralForm}`;

export const linesOf = (text) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

// Valor de <input type="datetime-local"> -> LocalDateTime del backend (con segundos).
export const toApiDateTime = (value) => (value.length === 16 ? `${value}:00` : value);

// Valor de <input type="datetime-local"> -> OffsetDateTime del backend, con el offset de la
// zona horaria del navegador (ej. "2026-10-20T08:00:00-03:00"). Vacío -> null.
export const toApiOffsetDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value); // sin zona explícita el navegador lo interpreta como hora local
  if (Number.isNaN(d.getTime())) return null;
  const offset = -d.getTimezoneOffset();
  const abs = Math.abs(offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${toApiDateTime(value)}${offset >= 0 ? "+" : "-"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

// Fecha ISO del backend (con offset) -> valor de <input type="datetime-local"> en hora local.
export const isoToInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ----- Cortes de calle -----
