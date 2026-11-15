// API simulada para E2E: intercepta /api/v1/** con page.route, así la suite no depende
// del backend real ni de producción. Reproduce códigos HTTP, Problem Details y permisos por rol.
// Los datos de siembra son los mismos de src/test/fakeApi.js (usuarios de prueba solo de desarrollo).

const USERS = {
  ciudadano1: { password: "ciudadano123", role: "CIUDADANO", nationalId: "30777888", userId: "u-1007" },
  inspector1: { password: "inspector123", role: "INSPECTOR", nationalId: "30111222", userId: "u-1001" },
  admin1: { password: "admin123", role: "ADMINISTRADOR", nationalId: "30222333", userId: "u-1002" },
  auditor1: { password: "auditor123", role: "AUDITOR", nationalId: null, userId: "u-1003" },
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export const tokenFor = (u) => `${b64({ alg: "HS256" })}.${b64({ sub: USERS[u].userId, role: USERS[u].role })}.firma`;

// DEF-06: el token no trae el DNI; el "servidor" falso lo resuelve por subject.
const dniOf = (claims) => Object.values(USERS).find((x) => x.userId === claims?.sub)?.nationalId ?? null;

export function seed() {
  const inf = (n, plate, type, dt, street, cross, nid, base, fin, status, agg = []) => ({
    infractionId: `${String(n).repeat(8)}-0000-4000-8000-00000000000${n}`,
    licensePlate: plate, infractionType: type, infractionDateTime: dt, location: { street, crossStreet: cross },
    evidenceUrl: [], inspectorId: "u-1001", offenderNationalId: nid, baseAmount: base, aggravatingFactors: agg, finalAmount: fin, status,
  });
  return {
    infractions: [
      inf(1, "AB123CD", "SPEEDING", "2026-10-20T10:15:00", "Av. Corrientes", "Callao", "30777888", 50000, 50000, "PENDING_APPEAL"),
      inf(2, "AC456DE", "ILLEGAL_PARKING", "2026-10-21T09:00:00", "Av. Santa Fe", "Pueyrredón", "30777888", 15000, 19500, "APPEALED", ["Zona escolar"]),
      inf(3, "ZZ999ZZ", "RED_LIGHT", "2026-10-22T18:30:00", "Av. Rivadavia", "Acoyte", "40111222", 30000, 30000, "ANNULLED"),
    ],
    operations: [],
    accidents: [],
    impoundments: [],
    closures: [
      {
        streetClosureId: "11111111-0000-4000-8000-000000000007", closureRequestId: "REQ-M3-001", requestingModule: "OBRAS",
        startDate: "2026-11-05T08:00:00-03:00", endDate: "2026-11-06T18:00:00-03:00", affectedStreet: ["Av. Corrientes"],
        detours: [], conditions: [], status: "REQUESTED",
      },
    ],
    zones: [{ zoneId: "44444444-0000-4000-8000-000000000010", name: "Zona Azul Microcentro", boundaries: "Corrientes y Callao", allowedHours: "8 a 20 hs", status: "ACTIVE" }],
    tariffs: [],
    sessions: [],
  };
}

const problem = (status, detail) => ({
  status,
  contentType: "application/problem+json",
  body: JSON.stringify({ type: "https://transito.uade.edu.ar/problems/x", title: "Error", status, detail }),
});
const ok = (status, body) => ({ status, contentType: "application/json", body: body === undefined ? "" : JSON.stringify(body) });

/**
 * Instala el mock en la página. `overrides` fuerza la respuesta de "METHOD /ruta".
 * Devuelve { db, calls } para inspeccionar el estado y los pedidos hechos.
 */
export async function mockApi(page, overrides = {}) {
  const db = seed();
  const calls = [];
  let seq = 0;

  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const method = req.method();
    const u = new URL(req.url());
    const path = u.pathname.replace(/^\/api\/v1/, "");
    const body = req.postData() ? JSON.parse(req.postData()) : undefined;
    calls.push({ method, path, body });
    const key = `${method} ${path}`;
    if (overrides[key]) return route.fulfill(overrides[key](body));

    const auth = req.headers()["authorization"];
    const claims = auth ? JSON.parse(Buffer.from(auth.split(".")[1], "base64url").toString()) : null;
    const need = (...roles) => (!claims ? problem(401, "Se requiere un token JWT válido") : roles.includes(claims.role) ? null : problem(403, "Sin permiso"));
    const reply = (r) => route.fulfill(r);

    if (key === "POST /auth/login") {
      const user = USERS[body.username];
      if (!user || user.password !== body.password) return reply(problem(401, "Usuario o contraseña inválidos"));
      return reply(ok(200, { token: tokenFor(body.username), role: user.role, expiresInSeconds: 7200 }));
    }
    if (key === "GET /auth/me") return reply(need("CIUDADANO", "INSPECTOR", "ADMINISTRADOR", "AUDITOR") || ok(200, { userId: claims.sub, role: claims.role, nationalId: dniOf(claims) }));
    if (key === "GET /parking-zones") return reply(ok(200, db.zones));
    if (key === "GET /parking-tariffs") return reply(ok(200, db.tariffs));
    if (key === "GET /street-closures/current") return reply(ok(200, db.closures.filter((c) => ["APPROVED", "ACTIVE"].includes(c.status))));

    let m;
    if (key === "GET /infractions/mine") return reply(need("CIUDADANO") || ok(200, db.infractions.filter((i) => i.offenderNationalId === dniOf(claims))));
    if (key === "GET /accidents/mine" || key === "GET /impoundments/mine") return reply(need("CIUDADANO") || ok(200, []));

    const lists = { "/infractions": "infractions", "/operations": "operations", "/accidents": "accidents", "/impoundments": "impoundments", "/street-closures": "closures", "/parking-sessions": "sessions" };
    if (method === "GET" && lists[path]) return reply(need("INSPECTOR", "ADMINISTRADOR", "AUDITOR") || ok(200, db[lists[path]]));

    if (key === "POST /infractions") {
      const denied = need("INSPECTOR");
      if (denied) return reply(denied);
      const created = { infractionId: `99999999-0000-4000-8000-${String(++seq).padStart(12, "0")}`, ...body, inspectorId: claims.sub, status: "PENDING_APPEAL" };
      db.infractions.push(created);
      return reply(ok(201, created));
    }
    if ((m = key.match(/^POST \/infractions\/(.+)\/(confirmation|annulment)$/))) {
      const denied = need("ADMINISTRADOR");
      if (denied) return reply(denied);
      const target = db.infractions.find((i) => i.infractionId === m[1]);
      target.status = m[2] === "confirmation" ? "CONFIRMED" : "ANNULLED";
      return reply(ok(200, target));
    }
    if ((m = key.match(/^POST \/street-closures\/(.+)\/(approval|rejection)$/))) {
      const denied = need("ADMINISTRADOR");
      if (denied) return reply(denied);
      const c = db.closures.find((x) => x.streetClosureId === m[1]);
      Object.assign(c, m[2] === "approval" ? { detours: body.detours, conditions: body.conditions, status: "APPROVED" } : { status: "REJECTED" });
      return reply(ok(200, c));
    }
    if ((m = key.match(/^POST \/parking-sessions\/(.+)\/unpaid-flag$/))) {
      const denied = need("INSPECTOR");
      if (denied) return reply(denied);
      const s = db.sessions.find((x) => x.sessionId === m[1]);
      if (!s) return reply(problem(404, "Sesión inexistente"));
      // Igual que el backend: una sola infracción por sesión.
      if (db.infractions.some((i) => i.originParkingSessionId === s.sessionId)) return reply(problem(409, `La sesión ${s.sessionId} ya tiene una infracción por falta de pago`));
      const created = {
        infractionId: `99999999-0000-4000-8000-${String(++seq).padStart(12, "0")}`, originParkingSessionId: s.sessionId, licensePlate: s.licensePlate,
        infractionType: "UNPAID_PARKING", infractionDateTime: "2026-11-02T10:00:00", location: {}, evidenceUrl: [], aggravatingFactors: [],
        baseAmount: body.baseAmount, finalAmount: body.baseAmount, status: "PENDING_APPEAL",
      };
      db.infractions.push(created);
      return reply(ok(201, created));
    }
    if ((m = key.match(/^DELETE \/parking-tariffs\/(.+)$/))) {
      const denied = need("ADMINISTRADOR");
      if (denied) return reply(denied);
      const t = db.tariffs.find((x) => x.tariffId === m[1]);
      if (!t) return reply(problem(404, "Tarifa inexistente"));
      // Igual que el backend: 409 si la zona tiene sesiones sin cerrar.
      if (db.sessions.some((x) => x.zoneId === t.zoneId && !x.endDateTime)) return reply(problem(409, `No se puede eliminar la tarifa ${t.tariffId}: hay sesiones activas dependientes en la zona`));
      db.tariffs = db.tariffs.filter((x) => x !== t);
      return reply(ok(204));
    }
    return reply(problem(404, `Ruta no simulada: ${key}`));
  });

  return { db, calls };
}

export const CREDENTIALS = {
  ciudadano: ["ciudadano1", "ciudadano123", "Vecino"],
  inspector: ["inspector1", "inspector123", "Personal municipal"],
  admin: ["admin1", "admin123", "Personal municipal"],
};

export async function loginAs(page, who, password) {
  const [user, pass, profile] = CREDENTIALS[who];
  await page.goto("/");
  await page.getByRole("button", { name: profile, exact: true }).click();
  await page.getByLabel(/usuario|dni/i).fill(user);
  await page.getByLabel("Contraseña").fill(password ?? pass);
  await page.getByRole("button", { name: /ingresar/i }).click();
}
