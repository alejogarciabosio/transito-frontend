import { screen, within, waitFor } from "@testing-library/react";
import { installFakeApi } from "./fakeApi";
import { renderApp, loginAs, CREDENTIALS } from "./renderApp";
import { suggestInfraction } from "../services/suggestions";

const SUG = "POST /infractions/suggestions";
const ai = (body = {}) => () =>
  new Response(JSON.stringify({ infractionType: "RED_LIGHT", aggravatingFactors: ["ZONA_ESCOLAR", "Reincidencia", "inexistente"], source: "AI", promptVersion: "v1", ...body }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const manual = () => new Response(JSON.stringify({ infractionType: null, aggravatingFactors: [], source: "MANUAL", promptVersion: null }), { status: 200, headers: { "Content-Type": "application/json" } });

async function openForm(overrides) {
  const api = installFakeApi(overrides);
  const { user } = renderApp();
  await loginAs(user, ...CREDENTIALS.inspector);
  await screen.findByText(/Panel de indicadores/i);
  await user.click(screen.getAllByRole("button", { name: "Infracciones", exact: true })[0]);
  await user.click(await screen.findByRole("button", { name: /Registrar infracción/ }));
  return { user, ...api, d: screen.getByRole("dialog") };
}
const describe_ = (d, user, text) => user.type(within(d).getByLabelText("Descripción de los hechos"), text);
const suggestBtn = (d) => within(d).getByRole("button", { name: /Sugerir con IA|Consultando/ });

describe("Sugerencia de IA al registrar infracción", () => {
  test("muestra la sugerencia con su etiqueta y pre-completa tipo y agravantes sin enviar nada", async () => {
    const { user, calls, d } = await openForm({ [SUG]: ai() });
    await describe_(d, user, "pasó en rojo frente a una escuela");
    await user.click(suggestBtn(d));
    expect(await within(d).findByText(/Sugerido por IA — revisá antes de confirmar/)).toBeInTheDocument();
    expect(within(d).getByLabelText(/Tipo de infracción/)).toHaveValue("RED_LIGHT");
    expect(within(d).getByRole("button", { name: /Zona escolar/ })).toHaveClass("border-red-600");
    expect(within(d).getByRole("button", { name: /Reincidencia/ })).toHaveClass("border-red-600");
    expect(calls.find((c) => c.method === "POST" && c.path === "/infractions")).toBeUndefined();
    expect(calls.find((c) => c.path === "/infractions/suggestions").body).toEqual({ description: "pasó en rojo frente a una escuela" });
  });

  test("el inspector puede cambiar lo sugerido y confirma el formulario como siempre", async () => {
    const { user, calls, d } = await openForm({ [SUG]: ai() });
    await describe_(d, user, "hecho");
    await user.click(suggestBtn(d));
    await within(d).findByText(/Sugerido por IA/);
    await user.selectOptions(within(d).getByLabelText(/Tipo de infracción/), "SPEEDING");
    await user.click(within(d).getByRole("button", { name: /Reincidencia/ }));
    await user.type(within(d).getByLabelText(/Patente/), "ab123cd");
    await user.type(within(d).getByLabelText(/^Calle/), "Av. Corrientes");
    await user.click(within(d).getByRole("button", { name: /Emitir acta/ }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/infractions")).toBeTruthy());
    const body = calls.find((c) => c.method === "POST" && c.path === "/infractions").body;
    expect(body.infractionType).toBe("SPEEDING");
    expect(body.aggravatingFactors).toEqual(["ZONA_ESCOLAR"]);
  });

  test("source MANUAL muestra el mensaje neutro y no toca el formulario", async () => {
    const { user, d } = await openForm({ [SUG]: manual });
    await describe_(d, user, "algo");
    await user.click(suggestBtn(d));
    expect(await within(d).findByText("No hay sugerencia disponible; completá los datos manualmente.")).toBeInTheDocument();
    expect(within(d).getByLabelText(/Tipo de infracción/)).toHaveValue("ILLEGAL_PARKING");
    expect(within(d).queryByText(/Sugerido por IA/)).not.toBeInTheDocument();
  });

  test.each([
    ["404", () => new Response("{}", { status: 404 })],
    ["500", () => new Response("{}", { status: 500 })],
    [
      "error de red",
      () => {
        throw new TypeError("network");
      },
    ],
  ])("%s se trata como MANUAL sin romper la pantalla", async (_n, handler) => {
    const { user, d } = await openForm({ [SUG]: handler });
    await describe_(d, user, "algo");
    await user.click(suggestBtn(d));
    expect(await within(d).findByText(/No hay sugerencia disponible/)).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: /Emitir acta/ })).toBeInTheDocument();
  });

  test("deshabilita el botón y muestra 'Consultando…' mientras carga", async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    const { user, d } = await openForm({ [SUG]: async () => (await gate, ai()()) });
    await describe_(d, user, "algo");
    await user.click(suggestBtn(d));
    const btn = await within(d).findByRole("button", { name: "Consultando…" });
    expect(btn).toBeDisabled();
    release();
    await within(d).findByText(/Sugerido por IA/);
    expect(within(d).getByRole("button", { name: "Sugerir con IA" })).toBeEnabled();
  });

  test("límite de 500 caracteres: contador, mensaje y botón deshabilitado", async () => {
    const { user, calls, d } = await openForm({ [SUG]: ai() });
    const box = within(d).getByLabelText("Descripción de los hechos");
    expect(suggestBtn(d)).toBeDisabled(); // vacío
    await user.click(box);
    await user.paste("a".repeat(500));
    expect(within(d).getByText("500/500")).toBeInTheDocument();
    expect(suggestBtn(d)).toBeEnabled();
    await user.type(box, "b");
    expect(within(d).getByText("501/500")).toBeInTheDocument();
    expect(within(d).getByText(/no puede superar los 500 caracteres/)).toBeInTheDocument();
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(suggestBtn(d)).toBeDisabled();
    expect(calls.find((c) => c.path === "/infractions/suggestions")).toBeUndefined();
  });

  test("el resultado se anuncia en una región aria-live", async () => {
    const { user, d } = await openForm({ [SUG]: ai() });
    await describe_(d, user, "algo");
    await user.click(suggestBtn(d));
    const msg = await within(d).findByText(/Sugerido por IA/);
    expect(msg.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  test("sin usar la IA el formulario original funciona igual (no regresión)", async () => {
    const { user, calls, d } = await openForm();
    await user.type(within(d).getByLabelText(/Patente/), "ab123cd");
    await user.type(within(d).getByLabelText(/^Calle/), "Av. Corrientes");
    await user.click(within(d).getByRole("button", { name: /Zona escolar/ }));
    await user.click(within(d).getByRole("button", { name: /Emitir acta/ }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/infractions")).toBeTruthy());
    expect(calls.find((c) => c.path === "/infractions/suggestions")).toBeUndefined();
    expect(calls.find((c) => c.method === "POST" && c.path === "/infractions").body.aggravatingFactors).toEqual(["ZONA_ESCOLAR"]);
  });
});

describe("servicio suggestInfraction", () => {
  test("normaliza respuestas inválidas a MANUAL", async () => {
    for (const payload of [null, { source: "AI", infractionType: 5, aggravatingFactors: "x" }, { source: "MANUAL" }]) {
      installFakeApi({ [SUG]: () => new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }) });
      const r = await suggestInfraction("x");
      if (payload?.source === "AI") expect(r).toEqual({ infractionType: null, aggravatingFactors: [], source: "AI", promptVersion: null });
      else expect(r.source).toBe("MANUAL");
    }
  });
});
