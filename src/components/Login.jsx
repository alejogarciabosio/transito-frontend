import { useState } from "react";
import { ShieldCheck, AlertCircle, TrafficCone, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

// Dos perfiles de acceso: el vecino se identifica con un usuario (rol
// CIUDADANO) y el personal municipal con su cuenta de empleado (INSPECTOR,
// ADMINISTRADOR o AUDITOR). Ambos pegan al mismo endpoint /auth/login, que valida
// contra el Módulo 1 (Usuarios) con el email; el backend determina el rol.
const PROFILES = {
  vecino: {
    label: "Vecino",
    fieldLabel: "Email o usuario",
    placeholder: "nombre@gmail.com",
    subtitle: "Ingresá con tu cuenta municipal para consultar tus trámites.",
    errorLabel: "Usuario o contraseña incorrectos.",
    icon: User,
    cta: "Ingresar",
  },
  staff: {
    label: "Personal municipal",
    fieldLabel: "Email o usuario",
    placeholder: "nombre@muni.gob.ar",
    subtitle: "Ingresá con tu usuario para continuar.",
    errorLabel: "Usuario o contraseña incorrectos.",
    icon: ShieldCheck,
    cta: "Ingresar",
  },
};

export default function Login() {
  const { login, notice } = useAuth();
  const [profile, setProfile] = useState("vecino");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cfg = PROFILES[profile];

  const handleProfileChange = (next) => {
    if (next === profile) return;
    setProfile(next);
    setUsername("");
    setPassword("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(cfg.errorLabel);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No se pudo conectar con el servidor. Intentá nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">
            <TrafficCone size={22} />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Tránsito UADE</h1>
          <p className="mt-1 text-sm text-slate-500">{cfg.subtitle}</p>
        </div>

        <div className="mb-6 flex rounded-full border border-slate-200 bg-slate-50 p-1">
          {Object.entries(PROFILES).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleProfileChange(key)}
              className={cx(
                "flex-1 rounded-full py-1.5 text-sm font-medium transition-colors",
                profile === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {notice && !error && (
          <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-username" className="mb-1.5 block text-sm font-medium text-slate-700">{cfg.fieldLabel}</label>
            <input
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              type="text"
              className={inputCls}
              placeholder={cfg.placeholder}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-700">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={inputCls}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <cfg.icon size={16} />
            {loading ? "Ingresando..." : cfg.cta}
          </button>
        </form>
      </div>
    </div>
  );
}
