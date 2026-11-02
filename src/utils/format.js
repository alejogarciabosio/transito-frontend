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

// Valor de <input type="datetime-local"> (hora del navegador) -> OffsetDateTime con zona,
// ej. "2026-10-20T08:00" -> "2026-10-20T08:00:00-03:00". Vacío -> null.
export function toApiOffsetDateTime(value) {
  if (!value) return null;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const offsetMinutes = -new Date(withSeconds).getTimezoneOffset();
  const abs = Math.abs(offsetMinutes);
  const pad = (n) => String(n).padStart(2, "0");
  return `${withSeconds}${offsetMinutes >= 0 ? "+" : "-"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

// Valor de <input type="datetime-local"> -> LocalDateTime del backend (con segundos).
export const toApiDateTime = (value) => (value.length === 16 ? `${value}:00` : value);
