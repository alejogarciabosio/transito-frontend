import { screen, within, waitFor } from "@testing-library/react";
import { installFakeApi } from "./fakeApi";
import { renderApp, loginAs, CREDENTIALS } from "./renderApp";

async function enterAsCitizen(overrides) {
  const api = installFakeApi(overrides);
  const { user } = renderApp();
  await loginAs(user, ...CREDENTIALS.ciudadano);
  await screen.findByText(/Mi Tránsito UADE/i);
  return { user, ...api };
}

const card = (name) => screen.getAllByText(name, { exact: true })[0];

describe("Login", () => {
  test("credenciales inválidas muestran el error y no ingresan", async () => {
    installFakeApi();
    const { user } = renderApp();
    await loginAs(user, "ciudadano1", "mala", "Vecino");
    expect(await screen.findByText(/incorrectos/i)).toBeInTheDocument();
    expect(screen.queryByText(/Mi Tránsito UADE/i)).not.toBeInTheDocument();
  });

  test("si el backend no responde, se informa el problema de conexión", async () => {
    installFakeApi();
    fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { user } = renderApp();
    await loginAs(user, ...CREDENTIALS.ciudadano);
    expect(await screen.findByText(/No se pudo conectar/i)).toBeInTheDocument();
  });

  test("la sesión se conserva al recargar y se cierra con Salir", async () => {
    const { user } = await enterAsCitizen();
    await user.click(screen.getByRole("button", { name: "Salir" }));
    expect(await screen.findByRole("button", { name: /ingresar/i })).toBeInTheDocument();
  });
});

describe("Portal del vecino", () => {
  test("el inicio muestra los contadores con datos reales", async () => {
    await enterAsCitizen();
    expect(await screen.findByText("2 registradas")).toBeInTheDocument();
    expect(await screen.findByText(/1 en depósito/)).toBeInTheDocument();
  });

  test("Mis infracciones lista solo las propias y abre el detalle", async () => {
    const { user } = await enterAsCitizen();
    await user.click(card("Mis infracciones"));
    expect(await screen.findByText(/Exceso de velocidad/)).toBeInTheDocument();
    expect(screen.queryByText(/ZZ999ZZ/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Exceso de velocidad/ }));
    expect(await screen.findByText(/DETALLE DE INFRACCIÓN|Detalle de infracción/i)).toBeInTheDocument();
  });

  test("presentar un descargo envía la apelación y confirma el registro", async () => {
    const { user, calls } = await enterAsCitizen();
    await user.click(card("Mis infracciones"));
    await user.click(await screen.findByRole("button", { name: /Exceso de velocidad/ }));
    await user.click(screen.getAllByRole("button", { name: "Presentar descargo" }).at(-1));
    const motivo = screen.getByLabelText(/Motivo del descargo/);
    await user.type(motivo, "El vehículo estaba vendido");
    await user.click(screen.getByRole("button", { name: /Enviar descargo/ }));
    expect(await screen.findByText(/Descargo registrado/i)).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/appeal") && c.body.reason === "El vehículo estaba vendido")).toBe(true);
    await user.click(screen.getByRole("button", { name: /Volver a mis infracciones/ }));
  });

  test("un error del backend al enviar el descargo se muestra al vecino", async () => {
    const { user } = await enterAsCitizen({
      "POST /infractions/aaaaaaaa-0000-4000-8000-000000000001/appeal": () =>
        new Response(JSON.stringify({ status: 409, detail: "La infracción no admite descargo" }), { status: 409 }),
    });
    await user.click(card("Mis infracciones"));
    await user.click(await screen.findByRole("button", { name: /Exceso de velocidad/ }));
    await user.click(screen.getAllByRole("button", { name: "Presentar descargo" }).at(-1));
    await user.type(screen.getByLabelText(/Motivo del descargo/), "x");
    await user.click(screen.getByRole("button", { name: /Enviar descargo/ }));
    expect(await screen.findByText(/no admite descargo/)).toBeInTheDocument();
  });

  test("consultar el estado por número de acta o patente", async () => {
    const { user } = await enterAsCitizen();
    const input = screen.getByLabelText("Número de acta o patente");
    await user.type(input, "aaaaaaaa");
    await user.click(screen.getByRole("button", { name: /Consultar/ }));
    expect(await screen.findByText(/Estado:/)).toHaveTextContent("Pendiente");
    await user.clear(input);
    await user.type(input, "ZZ999ZZ");
    await user.click(screen.getByRole("button", { name: /Consultar/ }));
    expect(await screen.findByText(/No encontramos/)).toBeInTheDocument();
  });

  test("estacionamiento medido muestra zonas activas con su tarifa", async () => {
    const { user } = await enterAsCitizen();
    await user.click(card("Estacionamiento medido"));
    expect(await screen.findByText("Zona Azul Microcentro")).toBeInTheDocument();
    expect(screen.queryByText("Zona Verde Belgrano")).not.toBeInTheDocument();
    expect(screen.getByText(/1\.500/)).toBeInTheDocument();
  });

  test("cortes de calle vigentes, vehículos retenidos y accidentes", async () => {
    const { user } = await enterAsCitizen();
    await user.click(card("Cortes de calle"));
    expect((await screen.findAllByText(/Av. de Mayo/)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Volver/ }));
    await user.click(card("Vehículos retenidos"));
    expect(await screen.findByText(/Depósito Norte/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Volver/ }));
    await user.click(card("Accidentes y denuncias"));
    expect(await screen.findByText(/Av. Cabildo/)).toBeInTheDocument();
  });

  test("un error al cargar se puede reintentar", async () => {
    let fails = 2;
    const { user } = await enterAsCitizen({
      "GET /infractions/mine": () => {
        if (fails > 0) {
          fails -= 1;
          return new Response(JSON.stringify({ status: 500, detail: "Error interno" }), { status: 500 });
        }
        return new Response("[]", { status: 200 });
      },
    });
    await user.click(card("Mis infracciones"));
    const retry = await screen.findByRole("button", { name: /Reintentar/i });
    await user.click(retry);
    await waitFor(() => expect(screen.queryByText(/Error interno/)).not.toBeInTheDocument());
  });

  test("si el token vence, vuelve al login con el aviso", async () => {
    installFakeApi({
      "GET /infractions/mine": () => new Response(JSON.stringify({ status: 401, detail: "Token vencido" }), { status: 401 }),
    });
    const { user } = renderApp();
    await loginAs(user, ...CREDENTIALS.ciudadano);
    expect(await screen.findByText(/Tu sesión venció/)).toBeInTheDocument();
    expect(within(document.body).getByRole("button", { name: /ingresar/i })).toBeInTheDocument();
  });
});
