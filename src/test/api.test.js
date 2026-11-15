import { resolveBaseUrl, apiFetch, ApiError, getCurrentNationalId } from "../services/api";
import { installFakeApi, tokenFor } from "./fakeApi";

describe("URL del backend", () => {
  test("en producción usa la variable de Railway", () => {
    expect(resolveBaseUrl({ VITE_API_BASE_URL: "https://transito-backend-prod.up.railway.app/", DEV: false })).toBe(
      "https://transito-backend-prod.up.railway.app"
    );
  });
  test("en producción sin variable NO apunta a localhost", () => {
    expect(resolveBaseUrl({ DEV: false })).toBe("");
  });
  test("en desarrollo sin variable usa localhost:8080", () => {
    expect(resolveBaseUrl({ DEV: true })).toBe("http://localhost:8080");
  });
});

describe("apiFetch", () => {
  test("traduce Problem Details a ApiError con status y detalle", async () => {
    installFakeApi();
    await expect(apiFetch("/auth/login", { method: "POST", body: { username: "x", password: "y" }, auth: false })).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Usuario o contraseña inválidos",
    });
  });
  test("un error de red se informa como status 0", async () => {
    installFakeApi();
    fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const err = await apiFetch("/parking-zones", { auth: false }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
  });
  test("204 devuelve null", async () => {
    installFakeApi({ "GET /parking-zones": () => new Response(null, { status: 204 }) });
    expect(await apiFetch("/parking-zones", { auth: false })).toBeNull();
  });
  test("DEF-06: el token nuevo no trae DNI; uno viejo con claim nationalId se sigue leyendo", () => {
    sessionStorage.setItem("transito_token", tokenFor("ciudadano1"));
    expect(getCurrentNationalId()).toBeNull();
    const legacy = `${btoa(JSON.stringify({ alg: "HS256" }))}.${btoa(JSON.stringify({ sub: "u-1007", nationalId: "30777888", role: "CIUDADANO" }))}.firma`;
    sessionStorage.setItem("transito_token", legacy);
    expect(getCurrentNationalId()).toBe("30777888");
    sessionStorage.setItem("transito_token", "no-es-un-jwt");
    expect(getCurrentNationalId()).toBeNull();
  });
});
