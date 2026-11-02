// E2E (Clase 15, eje A): 5 escenarios críticos con Playwright contra el stack real (front + backend).
// Uso: API=http://localhost:8080 WEB=http://localhost:4173 node e2e/e2e.mjs   (requiere `npm i -D playwright` o playwright global)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const API = process.env.API || "http://localhost:8080";
const WEB = process.env.WEB || "http://localhost:4173";
const results = [];
let failed = 0;

async function api(path, method, token, body) {
  const r = await fetch(`${API}/api/v1${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const token = async (u, p) => (await api("/auth/login", "POST", null, { username: u, password: p })).body.token;

async function login(page, user, pass, profile) {
  await page.goto(WEB);
  await page.getByRole("button", { name: profile }).click();
  await page.getByLabel(/usuario|dni/i).fill(user);
  await page.getByLabel("Contraseña").fill(pass);
  await page.getByRole("button", { name: /ingresar/i }).click();
}
async function scenario(name, fn, browser) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  try { await fn(page); results.push(["PASA", name]); }
  catch (e) { failed++; results.push(["FALLA", name + " — " + String(e.message).split("\n")[0]]); }
  await ctx.close();
}

const browser = await chromium.launch();
const insToken = await token("inspector1", "inspector123");
const infraction = {
  licensePlate: "E2E123", infractionType: "SPEEDING", infractionDateTime: "2026-09-20T10:15:00",
  location: { street: "Av. Corrientes", crossStreet: "Callao", latitude: -34.604, longitude: -58.392 },
  evidenceUrl: ["https://evidencias/foto1.jpg"], inspectorId: "u-1001", offenderNationalId: "30777888", vehicleOwnerTaxId: "20-30777888-1",
  debtorId: "30777888", debtorIdType: "DNI", baseAmount: 50000, aggravatingFactors: [], finalAmount: 50000, originTicketId: "TCK-E2E",
};
const created = await api("/infractions", "POST", insToken, infraction);

await scenario("E2E-1 Login incorrecto muestra error y no ingresa", async (p) => {
  await login(p, "ciudadano1", "mala", "Vecino");
  await p.getByText(/incorrectos/i).waitFor({ timeout: 8000 });
}, browser);
await scenario("E2E-2 Vecino ingresa y ve su portal", async (p) => {
  await login(p, "ciudadano1", "ciudadano123", "Vecino");
  await p.getByText(/bajo control\./i).waitFor({ timeout: 8000 });
}, browser);
await scenario("E2E-3 Vecino consulta sus infracciones y ve la labrada por el inspector", async (p) => {
  await login(p, "ciudadano1", "ciudadano123", "Vecino");
  await p.getByText(/bajo control\./i).waitFor();
  await p.getByRole("button", { name: /Mis infracciones/ }).first().click();
  await p.getByText(/Exceso de velocidad/).first().waitFor({ timeout: 8000 });
}, browser);
await scenario("E2E-4 Vecino presenta un descargo y queda registrado", async (p) => {
  await login(p, "ciudadano1", "ciudadano123", "Vecino");
  await p.getByRole("button", { name: /Mis infracciones/ }).first().click();
  await p.getByRole("button", { name: /Exceso de velocidad/ }).first().click();
  await p.getByRole("button", { name: "Presentar descargo" }).last().click();
  await p.getByLabel(/Motivo del descargo/).fill("E2E: el vehículo estaba vendido");
  await p.getByRole("button", { name: /Enviar descargo/ }).click();
  await p.getByText(/Descargo registrado/i).waitFor({ timeout: 8000 });
}, browser);
await scenario("E2E-5 Inspector ve el panel del personal con el dashboard y la infracción", async (p) => {
  await login(p, "inspector1", "inspector123", "Personal municipal");
  await p.getByText(/Panel de indicadores/i).waitFor({ timeout: 8000 });
  await p.getByText(/inspector1 · Inspector/).waitFor();
}, browser);
await browser.close();

console.log(`Infracción de preparación: HTTP ${created.status}`);
for (const [r, n] of results) console.log(`${r}  ${n}`);
console.log(`${results.length - failed}/${results.length} escenarios pasan`);
process.exit(failed ? 1 : 0);
