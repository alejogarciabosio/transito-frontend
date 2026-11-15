// Backend simulado en memoria para los tests: responde como la API /api/v1 de Tránsito
// (mismos códigos HTTP, Problem Details y permisos por rol), sin red.
import { vi } from "vitest";

const USERS = {
  ciudadano1: { password: "ciudadano123", role: "CIUDADANO", nationalId: "30777888", userId: "u-1007" },
  inspector1: { password: "inspector123", role: "INSPECTOR", nationalId: "30111222", userId: "u-1001" },
  admin1: { password: "admin123", role: "ADMINISTRADOR", nationalId: "30222333", userId: "u-1002" },
  auditor1: { password: "auditor123", role: "AUDITOR", nationalId: null, userId: "u-1003" },
};

const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, "");
export const tokenFor = (user) => `${b64({ alg: "HS256" })}.${b64({ sub: USERS[user].userId, role: USERS[user].role })}.firma`;

// DEF-06: el token no trae el DNI; el "servidor" falso lo resuelve por subject.
const dniOf = (claims) => Object.values(USERS).find((x) => x.userId === claims?.sub)?.nationalId ?? null;

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

export function seed() {
  return {
    infractions: [
      {
        infractionId: "aaaaaaaa-0000-4000-8000-000000000001",
        licensePlate: "AB123CD",
        infractionType: "SPEEDING",
        infractionDateTime: "2026-10-20T10:15:00",
        location: { street: "Av. Corrientes", crossStreet: "Callao" },
        evidenceUrl: ["https://evidencias/foto1.jpg"],
        inspectorId: "u-1001",
        offenderNationalId: "30777888",
        baseAmount: 50000,
        aggravatingFactors: [],
        finalAmount: 50000,
        status: "PENDING_APPEAL",
      },
      {
        infractionId: "bbbbbbbb-0000-4000-8000-000000000002",
        licensePlate: "AC456DE",
        infractionType: "ILLEGAL_PARKING",
        infractionDateTime: "2026-10-21T09:00:00",
        location: { street: "Av. Santa Fe", crossStreet: "Pueyrredón" },
        evidenceUrl: [],
        inspectorId: "u-1001",
        offenderNationalId: "30777888",
        baseAmount: 15000,
        aggravatingFactors: ["Zona escolar"],
        finalAmount: 19500,
        status: "APPEALED",
      },
      {
        infractionId: "cccccccc-0000-4000-8000-000000000003",
        licensePlate: "ZZ999ZZ",
        infractionType: "RED_LIGHT",
        infractionDateTime: "2026-10-22T18:30:00",
        location: { street: "Av. Rivadavia", crossStreet: "Acoyte" },
        evidenceUrl: [],
        inspectorId: "u-1001",
        offenderNationalId: "40111222",
        baseAmount: 30000,
        aggravatingFactors: [],
        finalAmount: 30000,
        status: "ANNULLED",
      },
    ],
    operations: [
      {
        operationId: "dddddddd-0000-4000-8000-000000000004",
        type: "ROUTINE_CONTROL",
        zone: "Microcentro",
        startDateTime: "2026-10-25T08:00:00",
        endDateTime: "2026-10-25T12:00:00",
        assignedInspectors: ["u-1001"],
        assignedUnits: ["M-04"],
        status: "OPEN",
        resolution: null,
      },
    ],
    accidents: [
      {
        accidentId: "eeeeeeee-0000-4000-8000-000000000005",
        accidentDateTime: "2026-10-24T07:30:00",
        location: { street: "Av. Cabildo", crossStreet: "Juramento" },
        involvesInfrastructureDamage: true,
        damageDescription: "Semáforo dañado",
        vehicles: [{ licensePlate: "AB123CD", ownerNationalId: "30777888" }],
        persons: [{ nationalId: "30777888", injuryLevel: "MINOR" }],
        inspectorId: "u-1001",
        status: "PRELIMINARY",
      },
    ],
    impoundments: [
      {
        impoundmentId: "ffffffff-0000-4000-8000-000000000006",
        licensePlate: "AB123CD",
        ownerNationalId: "30777888",
        reason: "Estacionamiento en doble fila",
        depotLocation: "Depósito Norte",
        entryDateTime: "2026-10-26T10:00:00",
        originType: "INFRACTION",
        originId: "aaaaaaaa-0000-4000-8000-000000000001",
        status: "IMPOUNDED",
        verifiedRequirements: [],
      },
    ],
    closures: [
      {
        streetClosureId: "11111111-0000-4000-8000-000000000007",
        closureRequestId: "REQ-M3-001",
        requestingModule: "OBRAS",
        startDate: "2026-11-05T08:00:00-03:00",
        endDate: "2026-11-06T18:00:00-03:00",
        affectedStreet: ["Av. Corrientes"],
        detours: [],
        conditions: [],
        status: "REQUESTED",
      },
      {
        streetClosureId: "22222222-0000-4000-8000-000000000008",
        closureRequestId: "REQ-M6-002",
        requestingModule: "AMBIENTE",
        startDate: "2026-10-30T08:00:00-03:00",
        endDate: "2026-11-30T18:00:00-03:00",
        affectedStreet: ["Av. de Mayo"],
        detours: [{ street: "Av. de Mayo", alternateRoute: "Hipólito Yrigoyen" }],
        conditions: ["Señalización"],
        status: "APPROVED",
      },
      {
        streetClosureId: "33333333-0000-4000-8000-000000000009",
        closureRequestId: "REQ-M3-003",
        requestingModule: "OBRAS",
        startDate: "2026-10-28T08:00:00-03:00",
        endDate: "2026-12-01T18:00:00-03:00",
        affectedStreet: ["Florida"],
        detours: [],
        conditions: [],
        status: "ACTIVE",
      },
    ],
    zones: [
      { zoneId: "44444444-0000-4000-8000-000000000010", name: "Zona Azul Microcentro", boundaries: "Corrientes y Callao", allowedHours: "8 a 20 hs", status: "ACTIVE" },
      { zoneId: "55555555-0000-4000-8000-000000000011", name: "Zona Verde Belgrano", boundaries: "Cabildo y Juramento", allowedHours: "9 a 18 hs", status: "INACTIVE" },
    ],
    tariffs: [
      { tariffId: "66666666-0000-4000-8000-000000000012", zoneId: "44444444-0000-4000-8000-000000000010", pricePerHour: 1500, validFrom: "2026-01-01", validTo: "2026-12-31", status: "ACTIVE" },
    ],
    sessions: [
      { sessionId: "77777777-0000-4000-8000-000000000013", licensePlate: "AB123CD", zoneId: "44444444-0000-4000-8000-000000000010", startDateTime: "2026-11-02T09:00:00", endDateTime: null, paid: false },
    ],
  };
}

const json = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": status >= 400 ? "application/problem+json" : "application/json" },
  });
const problem = (status, detail) => json(status, { type: "https://transito.uade.edu.ar/problems/x", title: "Error", status, detail });

/**
 * Instala un fetch falso. `overrides` permite forzar una respuesta para "METHOD /ruta".
 * Devuelve { db, calls } para inspeccionar el estado y los pedidos hechos.
 */
export function installFakeApi(overrides = {}) {
  const db = seed();
  const calls = [];
  const fetchMock = vi.fn(async (url, init = {}) => {
    const method = init.method || "GET";
    const u = new URL(url, "http://localhost");
    const path = u.pathname.replace(/^\/api\/v1/, "");
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    const key = `${method} ${path}`;
    if (overrides[key]) return overrides[key](body);

    const auth = init.headers?.Authorization;
    const claims = auth ? JSON.parse(atob(auth.split(".")[1])) : null;
    const role = claims?.role;
    const need = (...roles) => (!claims ? problem(401, "Se requiere un token JWT válido") : roles.includes(role) ? null : problem(403, "Sin permiso"));

    if (key === "POST /auth/login") {
      const user = USERS[body.username];
      if (!user || user.password !== body.password) return problem(401, "Usuario o contraseña inválidos");
      return json(200, { token: tokenFor(body.username), role: user.role, expiresInSeconds: 7200 });
    }
    if (key === "GET /auth/me") return need("CIUDADANO", "INSPECTOR", "ADMINISTRADOR", "AUDITOR") || json(200, { userId: claims.sub, role: claims.role, nationalId: dniOf(claims) });
    // Públicos
    if (key === "GET /parking-zones") return json(200, db.zones);
    if (key === "GET /parking-tariffs") return json(200, db.tariffs.filter((t) => t.zoneId === u.searchParams.get("zoneId")));
    if (key === "GET /street-closures/current") return json(200, db.closures.filter((c) => ["APPROVED", "ACTIVE"].includes(c.status)));

    let m;
    // Ciudadano
    if (key === "GET /infractions/mine") return need("CIUDADANO") || json(200, db.infractions.filter((i) => i.offenderNationalId === dniOf(claims)));
    if (key === "GET /accidents/mine") return need("CIUDADANO") || json(200, db.accidents.filter((a) => a.persons.some((p) => p.nationalId === dniOf(claims))));
    if (key === "GET /impoundments/mine") return need("CIUDADANO") || json(200, db.impoundments.filter((v) => v.ownerNationalId === dniOf(claims)));
    if ((m = key.match(/^POST \/infractions\/(.+)\/appeal$/))) {
      const denied = need("CIUDADANO");
      if (denied) return denied;
      const inf = db.infractions.find((i) => i.infractionId === m[1]);
      if (inf.status !== "PENDING_APPEAL") return problem(409, "La infracción no admite descargo");
      inf.status = "APPEALED";
      return json(200, inf);
    }
    // Personal: listados
    const lists = { "/infractions": "infractions", "/operations": "operations", "/accidents": "accidents", "/impoundments": "impoundments", "/street-closures": "closures", "/parking-sessions": "sessions" };
    if (method === "GET" && lists[path]) return need("INSPECTOR", "ADMINISTRADOR", "AUDITOR") || json(200, db[lists[path]]);

    // Infracciones
    if (key === "POST /infractions") {
      const denied = need("INSPECTOR");
      if (denied) return denied;
      const inf = { infractionId: uuid(), ...body, inspectorId: claims.sub, status: "PENDING_APPEAL" };
      db.infractions.push(inf);
      return json(201, inf);
    }
    if ((m = key.match(/^POST \/infractions\/(.+)\/(confirmation|annulment)$/))) {
      const denied = need("ADMINISTRADOR");
      if (denied) return denied;
      const inf = db.infractions.find((i) => i.infractionId === m[1]);
      inf.status = m[2] === "confirmation" ? "CONFIRMED" : "ANNULLED";
      return json(200, inf);
    }
    // Operativos
    if (key === "POST /operations") {
      const denied = need("INSPECTOR");
      if (denied) return denied;
      const op = { operationId: uuid(), ...body, status: "OPEN", resolution: null };
      db.operations.push(op);
      return json(201, op);
    }
    if ((m = key.match(/^POST \/operations\/(.+)\/closure$/))) {
      const op = db.operations.find((o) => o.operationId === m[1]);
      Object.assign(op, { status: "CLOSED", resolution: body.resolution });
      return json(200, op);
    }
    // Accidentes
    if (key === "POST /accidents") {
      const acc = { accidentId: uuid(), ...body, inspectorId: claims.sub, status: "PRELIMINARY" };
      db.accidents.push(acc);
      return json(201, acc);
    }
    if ((m = key.match(/^PATCH \/accidents\/(.+)$/))) {
      const acc = db.accidents.find((a) => a.accidentId === m[1]);
      Object.assign(acc, body);
      return json(200, acc);
    }
    // Vehículos
    if (key === "POST /impoundments") {
      const v = { impoundmentId: uuid(), ...body, status: "IMPOUNDED", verifiedRequirements: [] };
      db.impoundments.push(v);
      return json(201, v);
    }
    if ((m = key.match(/^POST \/impoundments\/(.+)\/release$/))) {
      const v = db.impoundments.find((i) => i.impoundmentId === m[1]);
      Object.assign(v, body, { status: "RELEASED", releasedBy: claims.sub });
      return json(200, v);
    }
    if ((m = key.match(/^PATCH \/impoundments\/(.+)$/))) {
      const v = db.impoundments.find((i) => i.impoundmentId === m[1]);
      Object.assign(v, body);
      return json(200, v);
    }
    // Cortes
    if ((m = key.match(/^POST \/street-closures\/(.+)\/(approval|rejection|activation|completion)$/))) {
      const c = db.closures.find((x) => x.streetClosureId === m[1]);
      const next = { approval: "APPROVED", rejection: "REJECTED", activation: "ACTIVE", completion: "FINISHED" }[m[2]];
      Object.assign(c, m[2] === "approval" ? { detours: body.detours, conditions: body.conditions } : {}, { status: next });
      return json(200, c);
    }
    // Estacionamiento
    if (key === "POST /parking-zones") {
      const z = { zoneId: uuid(), ...body, status: "ACTIVE" };
      db.zones.push(z);
      return json(201, z);
    }
    if ((m = key.match(/^(PUT|DELETE) \/parking-zones\/(.+)$/))) {
      const z = db.zones.find((x) => x.zoneId === m[2]);
      if (m[1] === "DELETE") {
        z.status = "INACTIVE";
        return json(204);
      }
      Object.assign(z, body);
      return json(200, z);
    }
    if (key === "POST /parking-tariffs") {
      const t = { tariffId: uuid(), ...body, status: "ACTIVE" };
      db.tariffs.push(t);
      return json(201, t);
    }
    if ((m = key.match(/^(PUT|DELETE) \/parking-tariffs\/(.+)$/))) {
      const i = db.tariffs.findIndex((x) => x.tariffId === m[2]);
      if (i < 0) return problem(404, "Tarifa inexistente");
      if (m[1] === "DELETE") {
        const zoneId = db.tariffs[i].zoneId;
        if (db.sessions.some((x) => x.zoneId === zoneId && !x.endDateTime)) return problem(409, `No se puede eliminar la tarifa ${m[2]}: hay sesiones activas dependientes en la zona`);
        db.tariffs.splice(i, 1);
        return json(204);
      }
      Object.assign(db.tariffs[i], body);
      return json(200, db.tariffs[i]);
    }
    if ((m = key.match(/^POST \/parking-sessions\/(.+)\/unpaid-flag$/))) {
      const s = db.sessions.find((x) => x.sessionId === m[1]);
      if (!s) return problem(404, "Sesión inexistente");
      if (db.infractions.some((x) => x.originParkingSessionId === s.sessionId)) return problem(409, `La sesión ${s.sessionId} ya tiene una infracción por falta de pago`);
      const inf = { infractionId: uuid(), originParkingSessionId: s.sessionId, licensePlate: s.licensePlate, infractionType: "UNPAID_PARKING", status: "PENDING_APPEAL", finalAmount: body.baseAmount, baseAmount: body.baseAmount, location: {}, evidenceUrl: [], aggravatingFactors: [], infractionDateTime: "2026-11-02T10:00:00" };
      db.infractions.push(inf);
      return json(201, inf);
    }
    return problem(404, `Ruta no simulada: ${key}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { db, calls, fetchMock };
}
