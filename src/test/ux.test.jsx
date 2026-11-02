import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import { useAuth } from "../context/useAuth";
import { installFakeApi, tokenFor } from "./fakeApi";
import { renderApp, loginAs, CREDENTIALS } from "./renderApp";

describe("Página", () => {
  test("el título y el idioma son los del portal", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain("<title>Tránsito UADE</title>");
    expect(html).toContain('<html lang="es">');
  });
});

describe("Inicio del vecino", () => {
  test("la ilustración no muestra datos inventados y no la leen los lectores de pantalla", async () => {
    installFakeApi();
    const { user, container } = renderApp();
    await loginAs(user, ...CREDENTIALS.ciudadano);
    await screen.findByText(/bajo control\./i);
    const phone = container.querySelector('[aria-hidden="true"]');
    expect(phone).toBeTruthy();
    expect(document.body).not.toHaveTextContent(/Rivadavia 4500|Zona Azul 12|Vence en 24 min/);
  });

  test("los links del pie llevan a su pantalla", async () => {
    installFakeApi();
    const { user } = renderApp();
    await loginAs(user, ...CREDENTIALS.ciudadano);
    await screen.findByText(/bajo control\./i);
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).queryByText(/Intendencia|Transparencia|Prensa|Todos los servicios operativos/)).not.toBeInTheDocument();
    await user.click(within(footer).getByRole("button", { name: "Estacionamiento medido" }));
    expect(await screen.findByText("Zona Azul Microcentro")).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalled();
  });
});

describe("Diálogos", () => {
  async function openRegisterInfraction() {
    installFakeApi();
    const { user } = renderApp();
    await loginAs(user, ...CREDENTIALS.inspector);
    await screen.findByText(/Panel de indicadores/i);
    await user.click(screen.getAllByRole("button", { name: "Infracciones", exact: true })[0]);
    await user.click(screen.getByRole("button", { name: /Registrar infracción/ }));
    return user;
  }

  test("Esc cierra el diálogo y el foco vuelve al botón que lo abrió", async () => {
    const user = await openRegisterInfraction();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrar infracción/ })).toHaveFocus();
  });

  test("escribir en un campo no pierde el foco ni se cortan las teclas", async () => {
    const user = await openRegisterInfraction();
    const patente = within(screen.getByRole("dialog")).getByLabelText(/Patente/);
    await user.click(patente);
    await user.keyboard("ab123cd");
    expect(patente).toHaveFocus();
    expect(patente).toHaveValue("AB123CD");
  });
});

describe("Pantalla de error", () => {
  test("si algo se rompe, se muestra el aviso y la opción de recargar", () => {
    const Boom = () => {
      throw new Error("boom");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Algo salió mal/);
    expect(screen.getByRole("button", { name: "Recargar" })).toBeInTheDocument();
  });

  test("sin errores muestra la app normalmente", () => {
    render(
      <ErrorBoundary>
        <p>todo bien</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("todo bien")).toBeInTheDocument();
  });
});

describe("Vencimiento de la sesión", () => {
  function Probe() {
    const { isAuthenticated, notice, login } = useAuth();
    return (
      <div>
        <p>{isAuthenticated ? "dentro" : "fuera"}</p>
        <p data-testid="notice">{notice}</p>
        <button onClick={() => login("ciudadano1", "x")}>entrar</button>
      </div>
    );
  }

  test("al cumplirse el vencimiento del token se cierra sola y avisa", async () => {
    installFakeApi({
      "POST /auth/login": () =>
        new Response(JSON.stringify({ token: tokenFor("ciudadano1"), role: "CIUDADANO", expiresInSeconds: 1 }), { status: 200 }),
    });
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await user.click(screen.getByText("entrar"));
    expect(await screen.findByText("dentro")).toBeInTheDocument();
    // vence al segundo: se espera con el reloj real a que la sesión se cierre sola
    expect(await screen.findByText("fuera", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId("notice")).toHaveTextContent(/sesión venció/);
  });
});
