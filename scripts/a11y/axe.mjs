// Auditoría axe (WCAG 2.2 AA) + desborde horizontal + objetivos táctiles, a 360/768/1280 px.
// Uso: npm run build && node scripts/a11y/axe.mjs [salida.json]
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { chromium, startServer, openScreen, layoutChecks, SCREENS, WIDTHS } from "./lib.mjs";

const out = process.argv[2];
const { server, url } = await startServer();
const browser = await chromium.launch();
const rows = [];
for (const screen of SCREENS) {
  for (const width of WIDTHS) {
    const { ctx, page } = await openScreen(browser, url, screen, width);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    const layout = await layoutChecks(page);
    const byImpact = (i) => axe.violations.filter((v) => v.impact === i).length;
    rows.push({
      screen: screen.id, width, title: await page.title(),
      violations: axe.violations.length, critical: byImpact("critical"), serious: byImpact("serious"), moderate: byImpact("moderate"), minor: byImpact("minor"),
      rules: axe.violations.map((v) => `${v.id}(${v.impact},${v.nodes.length})`),
      ...layout,
    });
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log("pantalla | ancho | viol(crit/serias/mod/menor) | desborde px | táctiles<24px | reglas");
for (const r of rows) console.log(`${r.screen} | ${r.width} | ${r.violations}(${r.critical}/${r.serious}/${r.moderate}/${r.minor}) | ${r.overflowX} | ${r.smallTargets.length} | ${r.rules.join(" ")}`);
if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 2));
const bad = rows.filter((r) => r.critical || r.serious || r.overflowX > 0);
process.exit(bad.length ? 1 : 0);
