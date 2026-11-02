import { screen, within, fireEvent, waitFor } from "@testing-library/react";
import { installFakeApi } from "./fakeApi";
import { renderApp, loginAs, CREDENTIALS } from "./renderApp";

async function enterAs(who, overrides) {
  const api = installFakeApi(overrides);
  const { user } = renderApp();
  await loginAs(user, ...CREDENTIALS[who]);
  await screen.findByText(/Panel de indicadores/i);
  return { user, ...api };
}
const tab = (user, name) => user.click(screen.getAllByRole("button", { name, exact: true })[0]);
const dialog = () => screen.getByRole("dialog");
const posted = (calls, method, re) => calls.find((c) => c.method === method && re.test(c.path));

describe("Panel interno: acceso y dashboard", () => {
  test("el personal entra directo al panel con indicadores reales", async () => {
    await enterAs("inspector");
    expect(screen.getByText(/inspector1 · Inspector/)).toBeInTheDocument();
    expect(screen.getByText("Infracciones activas")).toBeInTheDocument();
    expect(screen.queryByText("Descargos por resolver")).not.toBeInTheDocument();
  });

  test("el administrador ve además los pendientes de resolución", async () => {
    await enterAs("admin");
    expect(screen.getByText(/admin1 · Administrador/)).toBeInTheDocument();
    expect(screen.getByText("Descargos por resolver")).toBeInTheDocument();
  });

  test("el personal puede pasar al portal del vecino y volver", async () => {
    const { user } = await enterAs("admin");
    await user.click(screen.getAllByRole("button", { name: "Portal vecino" })[0]);
    expect(await screen.findByText(/bajo control\./i)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Panel interno" })[0]);
    expect(await screen.findByText(/Panel de indicadores/i)).toBeInTheDocument();
  });

  test("el ciudadano no ve el panel interno", async () => {
    installFakeApi();
    const { user } = renderApp();
    await loginAs(user, ...CREDENTIALS.ciudadano);
    await screen.findByText(/bajo control\./i);
    expect(screen.queryByRole("button", { name: "Panel interno" })).not.toBeInTheDocument();
  });
});

describe("Auditor", () => {
  test("ve el panel con datos reales en modo solo lectura", async () => {
    const { user } = await enterAs("auditor");
    expect(screen.getByText(/auditor1 · Auditor/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/solo|no registrar/i);
    expect(screen.queryByText(/no corresponde a tu rol/)).not.toBeInTheDocument();
    expect(screen.getByText("Descargos por resolver")).toBeInTheDocument();
    await tab(user, "Infracciones");
    expect(await screen.findByText("AB123CD")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar infracción/ })).not.toBeInTheDocument();
    await user.click(screen.getByText("AB123CD"));
    expect(screen.queryByRole("button", { name: "Marcar como firme" })).not.toBeInTheDocument();
    for (const t of ["Operativos", "Accidentes", "Vehículos retenidos"]) {
      await tab(user, t);
      expect(screen.queryByRole("button", { name: /Nuevo operativo|Registrar accidente|Registrar ingreso/ })).not.toBeInTheDocument();
    }
  });
});

describe("Infracciones", () => {
  test("el inspector registra una infracción con agravante", async () => {
    const { user, calls } = await enterAs("inspector");
    await tab(user, "Infracciones");
    await user.click(screen.getByRole("button", { name: /Registrar infracción/ }));
    const d = dialog();
    await user.type(within(d).getByLabelText(/Patente/), "ab123cd");
    await user.type(within(d).getByLabelText(/DNI del infractor/), "30777888");
    await user.type(within(d).getByLabelText(/^Calle/), "Av. Corrientes");
    await user.type(within(d).getByLabelText(/Entre calle/), "Callao");
    await user.type(within(d).getByLabelText(/Evidencia/), "https://evidencias/x.jpg");
    await user.click(within(d).getByRole("button", { name: /Zona escolar/ }));
    await user.click(within(d).getByRole("button", { name: /Emitir acta/ }));
    await waitFor(() => expect(posted(calls, "POST", /^\/infractions$/)).toBeTruthy());
    const body = posted(calls, "POST", /^\/infractions$/).body;
    expect(body.licensePlate).toBe("AB123CD");
    expect(body.evidenceUrl).toEqual(["https://evidencias/x.jpg"]);
    expect(body.finalAmount).toBeGreaterThan(body.baseAmount);
  });

  test("el inspector no ve las acciones de administrador", async () => {
    const { user } = await enterAs("inspector");
    await tab(user, "Infracciones");
    await user.click(await screen.findByText("ZZ999ZZ"));
    expect(screen.queryByRole("button", { name: "Marcar como firme" })).not.toBeInTheDocument();
  });

  test("el administrador confirma y anula (la anulación exige motivo)", async () => {
    const { user, calls, db } = await enterAs("admin");
    await tab(user, "Infracciones");
    expect(screen.queryByRole("button", { name: /Registrar infracción/ })).not.toBeInTheDocument();
    await user.click(await screen.findByText("AB123CD"));
    await user.click(screen.getByRole("button", { name: "Marcar como firme" }));
    await waitFor(() => expect(db.infractions[0].status).toBe("CONFIRMED"));
    await tab(user, "Dashboard");
    await tab(user, "Infracciones");
    await user.click(await screen.findByText("AC456DE"));
    await user.click(screen.getByRole("button", { name: "Aceptar descargo (anular)" }));
    const confirmar = screen.getByRole("button", { name: "Confirmar anulación" });
    expect(confirmar).toBeDisabled();
    await user.type(screen.getByLabelText(/Motivo de la anulación/), "Patente mal cargada");
    await user.click(confirmar);
    await waitFor(() => expect(posted(calls, "POST", /annulment$/)?.body.annulmentReason).toBe("Patente mal cargada"));
  });

  test("filtra por estado", async () => {
    const { user } = await enterAs("admin");
    await tab(user, "Infracciones");
    await user.click(await screen.findByRole("button", { name: "Anulada" }));
    expect(screen.getByText("ZZ999ZZ")).toBeInTheDocument();
    expect(screen.queryByText("AC456DE")).not.toBeInTheDocument();
  });
});

describe("Cortes de calle", () => {
  test("el administrador aprueba con desvío y rechaza con motivo", async () => {
    const { user, calls, db } = await enterAs("admin");
    await tab(user, "Cortes de calle");
    await user.click((await screen.findAllByRole("button", { name: "Evaluar" }))[0]);
    let d = dialog();
    await user.type(within(d).getByPlaceholderText("Calle desviada"), "Av. Corrientes");
    await user.type(within(d).getByPlaceholderText("Ruta alternativa"), "Lavalle");
    await user.type(within(d).getByLabelText(/Condiciones/), "Señalización nocturna");
    await user.click(within(d).getByRole("button", { name: "Confirmar decisión" }));
    await waitFor(() => expect(db.closures[0].status).toBe("APPROVED"));
    expect(posted(calls, "POST", /approval$/).body.detours).toEqual([{ street: "Av. Corrientes", alternateRoute: "Lavalle" }]);

    db.closures[0].status = "REQUESTED";
    await tab(user, "Dashboard");
    await tab(user, "Cortes de calle");
    await user.click((await screen.findAllByRole("button", { name: "Evaluar" }))[0]);
    d = dialog();
    await user.click(within(d).getByRole("button", { name: /Rechazar/ }));
    await user.type(within(d).getByLabelText(/Motivo del rechazo/), "Superpone con otro corte");
    await user.click(within(d).getByRole("button", { name: "Confirmar decisión" }));
    await waitFor(() => expect(posted(calls, "POST", /rejection$/)?.body.rejectionReason).toBe("Superpone con otro corte"));
  });

  test("el inspector activa un corte aprobado y finaliza uno activo", async () => {
    const { user, calls } = await enterAs("inspector");
    await tab(user, "Cortes de calle");
    await user.click(await screen.findByRole("button", { name: "Activar" }));
    await waitFor(() => expect(posted(calls, "POST", /activation$/)).toBeTruthy());
    await user.click((await screen.findAllByRole("button", { name: "Finalizar" }))[0]);
    await user.type(screen.getByLabelText(/Observaciones de la finalización/), "Obra terminada");
    await user.click(screen.getByRole("button", { name: "Finalizar corte" }));
    await waitFor(() => expect(posted(calls, "POST", /completion$/)?.body.notes).toBe("Obra terminada"));
  });
});

describe("Operativos y accidentes", () => {
  test("el inspector crea y cierra un operativo", async () => {
    const { user, calls } = await enterAs("inspector");
    await tab(user, "Operativos");
    await user.click(screen.getByRole("button", { name: /Nuevo operativo/ }));
    const d = dialog();
    await user.type(within(d).getByLabelText(/^Zona/), "Palermo");
    await user.type(within(d).getByLabelText(/Móviles asignados/), "M-04, M-11");
    fireEvent.change(within(d).getByLabelText(/^Inicio/), { target: { value: "2026-11-02T08:00" } });
    fireEvent.change(within(d).getByLabelText(/^Fin/), { target: { value: "2026-11-02T12:00" } });
    await user.click(within(d).getAllByRole("button", { name: /Insp\./ })[0]);
    await user.click(within(d).getByRole("button", { name: "Crear operativo" }));
    await waitFor(() => expect(posted(calls, "POST", /^\/operations$/)?.body.assignedUnits).toEqual(["M-04", "M-11"]));
    await user.click((await screen.findAllByRole("button", { name: "Cerrar" }))[0]);
    await user.click(screen.getByRole("button", { name: "Cerrar operativo" }));
    await waitFor(() => expect(posted(calls, "POST", /closure$/)).toBeTruthy());
  });

  test("el inspector registra un accidente con personas, vehículos y daños, y lo verifica", async () => {
    const { user, calls } = await enterAs("inspector");
    await tab(user, "Accidentes");
    await user.click(screen.getByRole("button", { name: /Registrar accidente/ }));
    const d = dialog();
    await user.type(within(d).getByLabelText(/^Calle/), "Av. Rivadavia");
    await user.type(within(d).getByLabelText(/Entre calle/), "Acoyte");
    fireEvent.change(within(d).getByLabelText(/Fecha y hora/), { target: { value: "2026-11-01T07:30" } });
    await user.type(within(d).getByPlaceholderText("DNI"), "30777888");
    await user.click(within(d).getByRole("button", { name: "Agregar persona" }));
    await user.type(within(d).getByPlaceholderText("Patente"), "ab123cd");
    await user.type(within(d).getByPlaceholderText("DNI titular"), "30777888");
    await user.click(within(d).getByRole("button", { name: "Agregar vehículo" }));
    await user.click(within(d).getByRole("checkbox"));
    await user.type(within(d).getByLabelText(/Descripción de los daños/), "Poste caído");
    await user.click(within(d).getByRole("button", { name: "Registrar accidente" }));
    await waitFor(() => expect(posted(calls, "POST", /^\/accidents$/)).toBeTruthy());
    const body = posted(calls, "POST", /^\/accidents$/).body;
    expect(body.persons).toHaveLength(1);
    expect(body.vehicles[0].licensePlate).toBe("AB123CD");
    await user.click((await screen.findAllByRole("button", { name: "Verificar" }))[0]);
    await waitFor(() => expect(posted(calls, "PATCH", /^\/accidents\//)?.body.status).toBe("VERIFIED"));
  });
});

describe("Vehículos retenidos", () => {
  test("el inspector registra un ingreso; no se ofrecen infracciones anuladas como origen", async () => {
    const { user, calls } = await enterAs("inspector");
    await tab(user, "Vehículos retenidos");
    await user.click(screen.getByRole("button", { name: /Registrar ingreso/ }));
    const d = dialog();
    const origen = within(d).getAllByRole("combobox")[0];
    expect(within(origen).queryByText(/ZZ999ZZ/)).not.toBeInTheDocument();
    await user.selectOptions(origen, "aaaaaaaa-0000-4000-8000-000000000001");
    fireEvent.change(within(d).getByLabelText(/Fecha y hora de ingreso/), { target: { value: "2026-11-02T09:00" } });
    await user.type(within(d).getByLabelText(/Motivo de la retención/), "Doble fila");
    await user.click(within(d).getByRole("button", { name: "Registrar ingreso" }));
    await waitFor(() => expect(posted(calls, "POST", /^\/impoundments$/)?.body.licensePlate).toBe("AB123CD"));
  });

  test("el ingreso desde un operativo", async () => {
    const { user, calls } = await enterAs("inspector");
    await tab(user, "Vehículos retenidos");
    await user.click(screen.getByRole("button", { name: /Registrar ingreso/ }));
    const d = dialog();
    await user.click(within(d).getByRole("button", { name: "Operativo" }));
    await user.selectOptions(within(d).getAllByRole("combobox")[0], "dddddddd-0000-4000-8000-000000000004");
    await user.type(within(d).getByLabelText(/^Patente/), "QQ111RR");
    await user.type(within(d).getByLabelText(/DNI del titular/), "30555444");
    fireEvent.change(within(d).getByLabelText(/Fecha y hora de ingreso/), { target: { value: "2026-11-02T09:00" } });
    await user.type(within(d).getByLabelText(/Motivo de la retención/), "Sin documentación");
    await user.click(within(d).getByRole("button", { name: "Registrar ingreso" }));
    await waitFor(() => expect(posted(calls, "POST", /^\/impoundments$/)?.body.originType).toBe("OPERATION"));
  });

  test("el administrador edita la retención y libera con requisitos y pago", async () => {
    const { user, calls } = await enterAs("admin");
    await tab(user, "Vehículos retenidos");
    await user.click(await screen.findByText("AB123CD"));
    await user.click(screen.getByRole("button", { name: "Editar datos" }));
    const motivo = screen.getAllByLabelText(/Motivo de la retención/).at(-1);
    await user.clear(motivo);
    await user.type(motivo, "Doble fila reincidente");
    await user.click(screen.getByRole("button", { name: /Guardar/ }));
    await waitFor(() => expect(posted(calls, "PATCH", /^\/impoundments\//)?.body.reason).toBe("Doble fila reincidente"));
    const liberar = await screen.findByRole("button", { name: "Liberar vehículo" });
    expect(liberar).toBeDisabled();
    for (const c of screen.getAllByRole("checkbox")) await user.click(c);
    const fee = screen.getByLabelText(/Costo de acarreo/);
    await user.clear(fee);
    await user.type(fee, "28000");
    await user.type(screen.getByLabelText(/Referencia de pago/), "REC-42");
    await user.click(liberar);
    await waitFor(() => expect(posted(calls, "POST", /release$/)?.body.paymentReference).toBe("REC-42"));
  });
});

describe("Estacionamiento medido", () => {
  test("el administrador crea, edita y da de baja zonas y tarifas", async () => {
    const { user, calls } = await enterAs("admin");
    await tab(user, "Estacionamiento medido");
    await user.click(screen.getByRole("button", { name: /Nueva zona/ }));
    let d = dialog();
    await user.type(within(d).getByLabelText(/^Nombre/), "Zona Roja");
    await user.type(within(d).getByLabelText(/Límites/), "Florida y Lavalle");
    await user.type(within(d).getByLabelText(/Horario permitido/), "8 a 20 hs");
    await user.click(within(d).getByRole("button", { name: /Crear zona/ }));
    await waitFor(() => expect(posted(calls, "POST", /^\/parking-zones$/)).toBeTruthy());

    await user.click((await screen.findAllByRole("button", { name: "Editar" }))[0]);
    d = dialog();
    const nombre = within(d).getByLabelText(/^Nombre/);
    await user.clear(nombre);
    await user.type(nombre, "Zona Azul Centro");
    await user.click(within(d).getByRole("button", { name: /Guardar/ }));
    await waitFor(() => expect(posted(calls, "PUT", /^\/parking-zones\//)?.body.name).toBe("Zona Azul Centro"));

    await user.click((await screen.findAllByRole("button", { name: "Tarifas" }))[0]);
    d = dialog();
    await user.type(within(d).getByLabelText(/Precio por hora/), "2000");
    fireEvent.change(within(d).getByLabelText(/Vigente desde/), { target: { value: "2027-01-01" } });
    fireEvent.change(within(d).getByLabelText(/Vigente hasta/), { target: { value: "2027-12-31" } });
    await user.click(within(d).getAllByRole("button", { name: /Agregar|Crear|Guardar/ }).at(-1));
    await waitFor(() => expect(posted(calls, "POST", /^\/parking-tariffs$/)?.body.pricePerHour).toBe(2000));
    await user.click(within(dialog()).getAllByRole("button", { name: "Editar" })[0]);
    await user.click(within(dialog()).getByRole("button", { name: /Cancelar edición/ }));
    await user.click(within(dialog()).getAllByRole("button", { name: "Eliminar" })[0]);
    await user.click(within(dialog()).getAllByRole("button", { name: /eliminar/i }).at(-1));
    await waitFor(() => expect(posted(calls, "DELETE", /^\/parking-tariffs\//)).toBeTruthy());
  });

  test("el inspector marca una sesión impaga", async () => {
    const { user, calls } = await enterAs("inspector");
    await tab(user, "Estacionamiento medido");
    await user.click(await screen.findByRole("button", { name: "Marcar falta de pago" }));
    const d = dialog();
    const importe = within(d).getByLabelText(/Importe base/);
    await user.clear(importe);
    await user.type(importe, "5000");
    await user.click(within(d).getAllByRole("button", { name: /Generar|Marcar|Confirmar/ }).at(-1));
    await waitFor(() => expect(posted(calls, "POST", /unpaid-flag$/)?.body.baseAmount).toBe(5000));
  });
});

describe("Errores del backend", () => {
  test("un 403 muestra que la acción no corresponde al rol", async () => {
    const { user } = await enterAs("admin", {
      "POST /infractions/aaaaaaaa-0000-4000-8000-000000000001/confirmation": () =>
        new Response(JSON.stringify({ status: 403, detail: "x" }), { status: 403 }),
    });
    await tab(user, "Infracciones");
    await user.click(await screen.findByText("AB123CD"));
    await user.click(screen.getByRole("button", { name: "Marcar como firme" }));
    expect(await screen.findByText(/no corresponde a tu rol/)).toBeInTheDocument();
  });

  test("un listado que falla muestra el error en el panel", async () => {
    const { user } = await enterAs("admin", {
      "GET /operations": () => new Response(JSON.stringify({ status: 500, detail: "Base caída" }), { status: 500 }),
    });
    await tab(user, "Operativos");
    expect((await screen.findAllByText(/Base caída/)).length).toBeGreaterThan(0);
  });
});
