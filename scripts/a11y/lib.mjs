// Utilidades compartidas por los scripts de auditoría (axe + Lighthouse).
// Sirve `dist/` (npm run build) y responde /api/v1 con la API simulada de src/test/fakeApi.js:
// no hace falta backend, ni producción, ni red.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = path.join(ROOT, "dist");
const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");

export const WIDTHS = [360, 768, 1280];
const HEIGHT = { 360: 740, 768: 1024, 1280: 800 };
export const heightFor = (w) => HEIGHT[w] ?? 800;

// Pantallas auditadas. `go` recibe la página ya logueada y navega hasta la pantalla.
const clickAny = (page, name) => page.getByRole("button", { name }).first().click();
const staffNav = async (page, label, id) => {
  // Con menos de 1024 px el menú lateral se reemplaza por un <select>.
  const sidebar = page.locator("aside").getByRole("button", { name: label });
  if (await sidebar.isVisible().catch(() => false)) await sidebar.click();
  else await page.locator("select").first().selectOption(id);
};
export const SCREENS = [
  { id: "login", role: null, go: async () => {} },
  { id: "login-personal", role: null, go: (p) => p.getByRole("button", { name: "Personal municipal" }).click() },
  { id: "portal-inicio", role: "ciudadano", go: async () => {} },
  { id: "portal-infracciones", role: "ciudadano", go: (p) => clickAny(p, /Mis infracciones/) },
  { id: "portal-estacionamiento", role: "ciudadano", go: (p) => clickAny(p, /Estacionamiento medido/) },
  { id: "portal-vehiculos", role: "ciudadano", go: (p) => clickAny(p, /Vehículos retenidos/) },
  { id: "portal-detalle-infraccion", role: "ciudadano", go: async (p) => { await clickAny(p, /Mis infracciones/); await clickAny(p, /Exceso de velocidad/); } },
  { id: "portal-descargo", role: "ciudadano", go: async (p) => { await clickAny(p, /Mis infracciones/); await clickAny(p, /Exceso de velocidad/); await p.getByRole("button", { name: "Presentar descargo" }).last().click(); } },
  { id: "inspector-dashboard", role: "inspector", go: async () => {} },
  { id: "inspector-infracciones", role: "inspector", go: (p) => staffNav(p, "Infracciones", "infracciones") },
  { id: "inspector-operativos", role: "inspector", go: (p) => staffNav(p, "Operativos", "operativos") },
  { id: "inspector-registrar-infraccion", role: "inspector", go: async (p) => { await staffNav(p, "Infracciones", "infracciones"); await p.getByRole("button", { name: /Registrar infracción/ }).click(); } },
  { id: "admin-dashboard", role: "admin", go: async () => {} },
  { id: "admin-infracciones", role: "admin", go: (p) => staffNav(p, "Infracciones", "infracciones") },
  { id: "admin-cortes", role: "admin", go: (p) => staffNav(p, "Cortes de calle", "cortes") },
  { id: "admin-estacionamiento", role: "admin", go: (p) => staffNav(p, "Estacionamiento medido", "estacionamiento") },
];
const CRED = { ciudadano: ["ciudadano1", "ciudadano123", "Vecino"], inspector: ["inspector1", "inspector123", "Personal municipal"], admin: ["admin1", "admin123", "Personal municipal"] };
const READY = { ciudadano: /bajo control\./i, inspector: /Panel de indicadores/i, admin: /Panel de indicadores/i };

export async function startServer(port = 0) {
  if (!fs.existsSync(path.join(DIST, "index.html"))) throw new Error("Falta dist/: corré `npm run build` primero.");
  const { installFakeApi } = await import(path.join(ROOT, "src/test/fakeApi.js"));
  const realFetch = globalThis.fetch;
  const { fetchMock } = installFakeApi();
  globalThis.fetch = realFetch;
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/v1")) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = chunks.length ? Buffer.concat(chunks).toString() : undefined;
        const headers = {};
        if (req.headers.authorization) headers.Authorization = req.headers.authorization;
        const r = await fetchMock(url.pathname + url.search, { method: req.method, headers, body });
        res.writeHead(r.status, { "Content-Type": r.headers.get("Content-Type") || "application/json" });
        return res.end(await r.text());
      }
      let file = path.join(DIST, path.normalize(url.pathname));
      if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

/** Abre una página nueva (contexto propio) al ancho dado y deja la pantalla lista para auditar. */
export async function openScreen(browser, base, screen, width) {
  const ctx = await browser.newContext({ viewport: { width, height: heightFor(width) }, locale: "es-AR" });
  const page = await ctx.newPage();
  await page.goto(base);
  await page.getByRole("button", { name: "Vecino" }).waitFor();
  if (screen.role) {
    const [u, p, profile] = CRED[screen.role];
    await page.getByRole("button", { name: profile }).click();
    await page.getByLabel(/usuario|dni/i).fill(u);
    await page.getByLabel("Contraseña").fill(p);
    await page.getByRole("button", { name: /ingresar/i }).click();
    await page.getByText(READY[screen.role]).first().waitFor({ timeout: 10000 });
  }
  await screen.go(page);
  await page.waitForTimeout(400);
  return { ctx, page };
}

/** Chequeos propios de responsive: desborde horizontal y objetivos táctiles < 24x24 (WCAG 2.5.8). */
export async function layoutChecks(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    const overflowX = doc.scrollWidth - vw;
    const culprits = [...document.querySelectorAll("body *")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && !el.closest(".overflow-x-auto"); })
      .slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)}`);
    const small = [...document.querySelectorAll("a[href],button,input,select,textarea,[role=button]")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24); })
      .slice(0, 5).map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 25)}"`);
    return { overflowX, culprits, smallTargets: small };
  });
}
