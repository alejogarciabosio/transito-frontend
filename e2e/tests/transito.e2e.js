import { test, expect } from "@playwright/test";
import { mockApi, loginAs } from "../support/mockApi.js";

const tab = (page, name) => page.getByRole("button", { name, exact: true }).first().click();
const posted = (calls, re) => calls.find((c) => c.method === "POST" && re.test(c.path));

test.describe("Escenarios críticos de punta a punta (API simulada)", () => {
  test("E2E-1 el vecino ingresa y ve sus infracciones (solo las propias)", async ({ page }) => {
    await mockApi(page);
    await loginAs(page, "ciudadano");
    await expect(page.getByText(/bajo control\./i)).toBeVisible();
    await page.getByRole("button", { name: /Mis infracciones/ }).first().click();
    await expect(page.getByText(/Exceso de velocidad/).first()).toBeVisible();
    await expect(page.getByText(/Semáforo|Luz roja|ZZ999ZZ/)).toHaveCount(0);
  });

  test("E2E-2 el inspector registra una infracción", async ({ page }) => {
    const { calls } = await mockApi(page);
    await loginAs(page, "inspector");
    await expect(page.getByText(/Panel de indicadores/i)).toBeVisible();
    await tab(page, "Infracciones");
    await page.getByRole("button", { name: /Registrar infracción/ }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel(/Patente/).fill("ab123cd");
    await d.getByLabel(/DNI del infractor/).fill("30777888");
    await d.getByLabel(/^Calle/).fill("Av. Corrientes");
    await d.getByLabel(/Entre calle/).fill("Callao");
    await d.getByLabel(/Evidencia/).fill("https://evidencias/x.jpg");
    await d.getByRole("button", { name: /Zona escolar/ }).click();
    await d.getByRole("button", { name: /Emitir acta/ }).click();
    await expect.poll(() => posted(calls, /^\/infractions$/)?.body.licensePlate).toBe("AB123CD");
    const body = posted(calls, /^\/infractions$/).body;
    expect(body.evidenceUrl).toEqual(["https://evidencias/x.jpg"]);
    expect(body.finalAmount).toBeGreaterThan(body.baseAmount);
  });

  test("E2E-3 el administrador confirma una infracción y anula otra (la anulación exige motivo)", async ({ page }) => {
    const { calls, db } = await mockApi(page);
    await loginAs(page, "admin");
    await expect(page.getByText(/Panel de indicadores/i)).toBeVisible();
    await tab(page, "Infracciones");
    await page.getByText("AB123CD").click();
    await page.getByRole("button", { name: "Marcar como firme" }).click();
    await expect.poll(() => db.infractions[0].status).toBe("CONFIRMED");

    await tab(page, "Dashboard");
    await tab(page, "Infracciones");
    await page.getByText("AC456DE").click();
    await page.getByRole("button", { name: "Aceptar descargo (anular)" }).click();
    const confirmar = page.getByRole("button", { name: "Confirmar anulación" });
    await expect(confirmar).toBeDisabled();
    await page.getByLabel(/Motivo de la anulación/).fill("Patente mal cargada");
    await expect(confirmar).toBeEnabled();
    await confirmar.click();
    await expect.poll(() => posted(calls, /annulment$/)?.body.annulmentReason).toBe("Patente mal cargada");
    expect(db.infractions[1].status).toBe("ANNULLED");
  });

  test("E2E-4 control de acceso por rol: el vecino no ve el panel interno y el inspector no ve acciones de administrador", async ({ page }) => {
    await mockApi(page);
    await loginAs(page, "ciudadano");
    await expect(page.getByText(/bajo control\./i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Panel interno" })).toHaveCount(0);
    await page.getByRole("button", { name: "Salir" }).click();

    await loginAs(page, "inspector");
    await expect(page.getByText(/Panel de indicadores/i)).toBeVisible();
    await expect(page.getByText("Descargos por resolver")).toHaveCount(0);
    await tab(page, "Infracciones");
    await page.getByText("ZZ999ZZ").click();
    await expect(page.getByRole("button", { name: "Marcar como firme" })).toHaveCount(0);
  });

  test("E2E-5 login con credenciales incorrectas muestra el error y no ingresa", async ({ page }) => {
    await mockApi(page);
    await loginAs(page, "ciudadano", "clave-mala");
    await expect(page.getByText(/incorrectos/i)).toBeVisible();
    await expect(page.getByText(/bajo control\./i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ingresar/i })).toBeVisible();
  });

  test("E2E-6 una sesión vencida (401) vuelve al login con aviso", async ({ page }) => {
    await mockApi(page, {
      "GET /infractions/mine": () => ({ status: 401, contentType: "application/problem+json", body: JSON.stringify({ title: "Unauthorized", status: 401 }) }),
    });
    await loginAs(page, "ciudadano");
    await expect(page.getByText(/sesión venció/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /ingresar/i })).toBeVisible();
  });

  test("E2E-7 el administrador aprueba un corte de calle con desvío", async ({ page }) => {
    const { calls, db } = await mockApi(page);
    await loginAs(page, "admin");
    await expect(page.getByText(/Panel de indicadores/i)).toBeVisible();
    await tab(page, "Cortes de calle");
    await page.getByRole("button", { name: "Evaluar" }).first().click();
    const d = page.getByRole("dialog");
    await d.getByPlaceholder("Calle desviada").fill("Av. Corrientes");
    await d.getByPlaceholder("Ruta alternativa").fill("Lavalle");
    await d.getByLabel(/Condiciones/).fill("Señalización nocturna");
    await d.getByRole("button", { name: "Confirmar decisión" }).click();
    await expect.poll(() => db.closures[0].status).toBe("APPROVED");
    expect(posted(calls, /approval$/).body.detours).toEqual([{ street: "Av. Corrientes", alternateRoute: "Lavalle" }]);
  });

  test("E2E-8 el vecino ve que los adjuntos del descargo todavía no se reciben (sin campo de archivos)", async ({ page }) => {
    await mockApi(page);
    await loginAs(page, "ciudadano");
    await page.getByRole("button", { name: /Mis infracciones/ }).first().click();
    await page.getByRole("button", { name: /Exceso de velocidad/ }).first().click();
    await page.getByRole("button", { name: "Presentar descargo" }).last().click();
    await expect(page.getByText("Adjuntos: próximamente")).toBeVisible();
    await expect(page.getByText(/mesa de entradas/)).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test("E2E-9 el inspector marca una sesión sin pago y el botón deja de ofrecerse", async ({ page }) => {
    const { db, calls } = await mockApi(page);
    db.sessions.push({ sessionId: "77777777-0000-4000-8000-000000000013", licensePlate: "AB123CD", zoneId: "44444444-0000-4000-8000-000000000010", startDateTime: "2026-11-02T09:00:00", endDateTime: null, paid: false });
    await loginAs(page, "inspector");
    await expect(page.getByText(/Panel de indicadores/i)).toBeVisible();
    await tab(page, "Estacionamiento medido");
    await page.getByRole("button", { name: "Marcar falta de pago" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Generar infracción/ }).click();
    await expect(page.getByText("Sin pagar · infracción generada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar falta de pago" })).toHaveCount(0);
    expect(calls.filter((c) => /unpaid-flag$/.test(c.path))).toHaveLength(1);
  });

  test("E2E-10 borrar una tarifa con sesiones activas muestra un mensaje claro (409)", async ({ page }) => {
    const { db } = await mockApi(page);
    db.tariffs.push({ tariffId: "66666666-0000-4000-8000-000000000012", zoneId: "44444444-0000-4000-8000-000000000010", pricePerHour: 1500, validFrom: "2026-01-01", validTo: "2026-12-31", status: "ACTIVE" });
    db.sessions.push({ sessionId: "77777777-0000-4000-8000-000000000013", licensePlate: "AB123CD", zoneId: "44444444-0000-4000-8000-000000000010", startDateTime: "2026-11-02T09:00:00", endDateTime: null, paid: false });
    await loginAs(page, "admin");
    await expect(page.getByText(/Panel de indicadores/i)).toBeVisible();
    await tab(page, "Estacionamiento medido");
    await page.getByRole("button", { name: "Tarifas" }).first().click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: "Eliminar" }).first().click();
    await d.getByRole("button", { name: /Sí, eliminar tarifa/ }).click();
    await expect(d.getByText(/No se puede borrar: hay sesiones activas en esa zona\/tarifa/)).toBeVisible();
    expect(db.tariffs).toHaveLength(1);
  });
});
