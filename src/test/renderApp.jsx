import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";

export function renderApp() {
  const user = userEvent.setup();
  const utils = render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  return { user, ...utils };
}

/** Ingresa por la pantalla de login con el perfil y las credenciales dadas. */
export async function loginAs(user, username, password, profile = "Vecino") {
  await user.click(screen.getByRole("button", { name: profile }));
  await user.type(screen.getByLabelText(/usuario|dni/i), username);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: /ingresar/i }));
}

export const CREDENTIALS = {
  ciudadano: ["ciudadano1", "ciudadano123", "Vecino"],
  inspector: ["inspector1", "inspector123", "Personal municipal"],
  admin: ["admin1", "admin123", "Personal municipal"],
  auditor: ["auditor1", "auditor123", "Personal municipal"],
};
