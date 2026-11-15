// Lighthouse (categoría Accesibilidad) en modo "snapshot": audita la pantalla ya logueada
// (la app es una SPA con sesión, así que no se puede reabrir por URL).
// Uso: npm run build && node scripts/a11y/lighthouse.mjs [salida.json]
import fs from "node:fs";
import { createRequire } from "node:module";
import { chromium, startServer, openScreen, SCREENS, WIDTHS } from "./lib.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const { startFlow } = await import("lighthouse");
const out = process.argv[2];
const { server, url } = await startServer();
const PORT = 20000 + Math.floor(Math.random() * 20000);
const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`] });
const rows = [];
for (const screen of SCREENS) {
  for (const width of WIDTHS) {
    const { ctx } = await openScreen(browser, url, screen, width);
    const pptr = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null });
    const pages = await pptr.pages();
    const target = pages.find((p) => p.url().startsWith(url));
    if (!target) throw new Error("No se encontró la pestaña a auditar");
    const flow = await startFlow(target, { config: { extends: "lighthouse:default", settings: { onlyCategories: ["accessibility"] } } });
    await flow.snapshot({ name: `${screen.id}@${width}` });
    const lhr = (await flow.createFlowResult()).steps[0].lhr;
    const failed = Object.values(lhr.audits).filter((a) => a.score === 0 && a.scoreDisplayMode === "binary").map((a) => a.id);
    rows.push({ screen: screen.id, width, score: Math.round(lhr.categories.accessibility.score * 100), failed });
    await pptr.disconnect();
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log("pantalla | ancho | Lighthouse a11y | auditorías fallidas");
for (const r of rows) console.log(`${r.screen} | ${r.width} | ${r.score} | ${r.failed.join(" ")}`);
if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 2));
process.exit(rows.some((r) => r.score < 90) ? 1 : 0);
