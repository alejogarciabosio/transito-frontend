import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  FileSignature,
  FileWarning,
  ParkingCircle,
  Siren,
  TrafficCone,
} from "lucide-react";
import { createAccident, getAccidents, getMyAccidents, verifyAccident } from "./services/accidents";
import { getCurrentNationalId } from "./services/api";
import { createImpoundment, getImpoundments, getMyImpoundments, releaseImpoundment, updateImpoundment } from "./services/impoundments";
import { annulInfraction, appealInfraction, confirmInfraction, createInfraction, getAllInfractions, getMyInfractions } from "./services/infractions";
import { closeOperation, createOperation, getOperations } from "./services/operations";
import { createParkingTariff, createParkingZone, deleteParkingTariff, deleteParkingZone, flagParkingSessionUnpaid, getActiveZonesWithTariff, getAllZonesWithTariffs, getParkingSessions, updateParkingTariff, updateParkingZone } from "./services/parking";
import { activateStreetClosure, approveStreetClosure, completeStreetClosure, getCurrentStreetClosures, getStreetClosures, rejectStreetClosure } from "./services/streetClosures";
import { Footer } from "./components/Footer.jsx";
import { Header } from "./components/Header.jsx";
import { STAFF_NAV, inputCls } from "./constants";
import { AccidentesCiudadano } from "./features/citizen/AccidentesCiudadano.jsx";
import { CitizenHome } from "./features/citizen/CitizenHome.jsx";
import { CortesCiudadano } from "./features/citizen/CortesCiudadano.jsx";
import { EstacionamientoCiudadano } from "./features/citizen/EstacionamientoCiudadano.jsx";
import { InfraccionDrawer } from "./features/citizen/InfraccionDrawer.jsx";
import { MisInfracciones } from "./features/citizen/MisInfracciones.jsx";
import { VehiculosCiudadano } from "./features/citizen/VehiculosCiudadano.jsx";
import { AccidentesStaff } from "./features/staff/AccidentesStaff.jsx";
import { CortesDeCalleStaff } from "./features/staff/CortesDeCalleStaff.jsx";
import { Dashboard } from "./features/staff/Dashboard.jsx";
import { EstacionamientoStaff } from "./features/staff/EstacionamientoStaff.jsx";
import { InfraccionesStaff } from "./features/staff/InfraccionesStaff.jsx";
import { OperativosStaff } from "./features/staff/OperativosStaff.jsx";
import { StaffSidebar } from "./features/staff/StaffSidebar.jsx";
import { VehiculosStaff } from "./features/staff/VehiculosStaff.jsx";
import { useResource } from "./hooks/useResource";
import { plural } from "./lib/format";
import { mapApiAccident, mapApiClosure, mapApiImpoundment, mapApiInfraction, mapApiOperation, mapApiSession, mapApiZone } from "./lib/mappers";

export function AuthenticatedApp({ role, username, onLogout }) {
  // El rol CIUDADANO (login de vecino) sólo puede operar el Portal vecino;
  // el Panel interno queda reservado al personal municipal autenticado.
  const canAccessStaff = role !== "CIUDADANO";
  // El personal arranca en el Panel interno; el vecino, en el Portal vecino.
  const [mode, setModeState] = useState(canAccessStaff ? "staff" : "ciudadano");
  const [citizenView, setCitizenView] = useState("home");
  const [staffView, setStaffView] = useState("dashboard");
  const [selectedInfraction, setSelectedInfraction] = useState(null);
  const [search, setSearch] = useState("");
  const [trackCode, setTrackCode] = useState("");
  const [trackResult, setTrackResult] = useState(null);

  // El seguimiento de descargos por código sigue en mock: todavía no tiene endpoint.

  const goMode = (m) => {
    if (m === "staff" && !canAccessStaff) return;
    setModeState(m);
    if (m === "ciudadano") setCitizenView("home");
    if (m === "staff") setStaffView("dashboard");
  };

  // Datos reales del Portal vecino. Los "mine" solo existen para CIUDADANO:
  // para el resto de los roles no se piden y la pantalla lo explica.
  const isCitizen = role === "CIUDADANO";
  const nationalId = getCurrentNationalId();
  // Infracciones del Panel interno (GET /infractions: INSPECTOR y ADMINISTRADOR).
  const staffInfractionsRes = useResource(getAllInfractions, { enabled: canAccessStaff });
  const staffInfractions = useMemo(() => staffInfractionsRes.data.map(mapApiInfraction), [staffInfractionsRes.data]);
  const reloadStaffInfractions = staffInfractionsRes.reload;

  // Resto del Panel interno (INSPECTOR y ADMINISTRADOR pueden leer todos estos listados).
  const staffClosuresRes = useResource(getStreetClosures, { enabled: canAccessStaff });
  const staffClosures = useMemo(() => staffClosuresRes.data.map(mapApiClosure), [staffClosuresRes.data]);
  const operationsRes = useResource(getOperations, { enabled: canAccessStaff });
  const operations = useMemo(() => operationsRes.data.map(mapApiOperation), [operationsRes.data]);
  const staffAccidentsRes = useResource(getAccidents, { enabled: canAccessStaff });
  const staffAccidents = useMemo(() => staffAccidentsRes.data.map(mapApiAccident), [staffAccidentsRes.data]);
  const staffImpoundedRes = useResource(getImpoundments, { enabled: canAccessStaff });
  const staffImpounded = useMemo(() => staffImpoundedRes.data.map(mapApiImpoundment), [staffImpoundedRes.data]);
  const staffZonesRes = useResource(getAllZonesWithTariffs, { enabled: canAccessStaff });
  const staffZones = useMemo(() => staffZonesRes.data.map(mapApiZone), [staffZonesRes.data]);
  const sessionsRes = useResource(getParkingSessions, { enabled: canAccessStaff });
  const sessions = useMemo(() => sessionsRes.data.map(mapApiSession), [sessionsRes.data]);

  const reloadStaffClosures = staffClosuresRes.reload;
  const reloadOperations = operationsRes.reload;
  const reloadStaffAccidents = staffAccidentsRes.reload;
  const reloadStaffImpounded = staffImpoundedRes.reload;
  const reloadStaffZones = staffZonesRes.reload;
  const reloadSessions = sessionsRes.reload;

  // Al entrar a una pantalla del panel se pide solo lo que esa pantalla muestra.
  useEffect(() => {
    if (mode !== "staff") return;
    if (staffView === "dashboard") {
      reloadStaffInfractions();
      reloadStaffClosures();
      reloadOperations();
      reloadStaffAccidents();
      reloadStaffImpounded();
      reloadStaffZones();
      reloadSessions();
    }
    if (staffView === "infracciones") reloadStaffInfractions();
    if (staffView === "cortes") reloadStaffClosures();
    if (staffView === "operativos") reloadOperations();
    if (staffView === "accidentes") reloadStaffAccidents();
    if (staffView === "vehiculos") {
      reloadStaffImpounded();
      reloadStaffInfractions(); // para elegir la infracción de origen
      reloadOperations(); // para elegir el operativo de origen
    }
    if (staffView === "estacionamiento") {
      reloadStaffZones();
      reloadSessions();
    }
  }, [
    mode,
    staffView,
    reloadStaffInfractions,
    reloadStaffClosures,
    reloadOperations,
    reloadStaffAccidents,
    reloadStaffImpounded,
    reloadStaffZones,
    reloadSessions,
  ]);

  // El Dashboard junta los siete listados: un solo estado de carga/error para todos.
  const dashboardResources = [staffInfractionsRes, staffClosuresRes, operationsRes, staffAccidentsRes, staffImpoundedRes, staffZonesRes, sessionsRes];
  const dashboardStatus = {
    loading: dashboardResources.some((r) => r.loading),
    loaded: dashboardResources.every((r) => r.loaded),
    error: dashboardResources.find((r) => r.error)?.error || "",
    reload: () => dashboardResources.forEach((r) => r.reload()),
  };

  const parkingZones = useResource(getActiveZonesWithTariff);
  const currentClosures = useResource(getCurrentStreetClosures);
  const myImpoundments = useResource(getMyImpoundments, { enabled: isCitizen });
  const myAccidents = useResource(getMyAccidents, { enabled: isCitizen });

  const [citizenInfractions, setCitizenInfractions] = useState([]);
  const [citizenInfractionsLoading, setCitizenInfractionsLoading] = useState(false);
  const [citizenInfractionsError, setCitizenInfractionsError] = useState("");

  const loadCitizenInfractions = useCallback(async () => {
    setCitizenInfractionsLoading(true);
    setCitizenInfractionsError("");
    try {
      const data = await getMyInfractions();
      setCitizenInfractions((data || []).map(mapApiInfraction));
    } catch (err) {
      setCitizenInfractionsError(err.message || "No se pudieron cargar tus infracciones.");
    } finally {
      setCitizenInfractionsLoading(false);
    }
  }, []);

  // Se vuelve a pedir cada vez que el vecino entra a "Mis infracciones",
  // así se refleja cualquier cambio de estado (ej. un descargo recién enviado).
  useEffect(() => {
    if (citizenView === "infracciones") {
      loadCitizenInfractions();
    }
  }, [citizenView, loadCitizenInfractions]);

  // Al volver al inicio se refrescan los contadores de las tarjetas; al entrar
  // a una pantalla se refresca solo lo que esa pantalla muestra.
  const reloadParking = parkingZones.reload;
  const reloadClosures = currentClosures.reload;
  const reloadImpoundments = myImpoundments.reload;
  const reloadAccidents = myAccidents.reload;
  useEffect(() => {
    if (mode !== "ciudadano") return;
    if (citizenView === "home") {
      reloadParking();
      reloadClosures();
      reloadImpoundments();
      reloadAccidents();
      if (isCitizen) loadCitizenInfractions();
    }
    if (citizenView === "estacionamiento") reloadParking();
    if (citizenView === "cortes") reloadClosures();
    if (citizenView === "vehiculos") reloadImpoundments();
    if (citizenView === "accidentes") reloadAccidents();
  }, [mode, citizenView, isCitizen, reloadParking, reloadClosures, reloadImpoundments, reloadAccidents, loadCitizenInfractions]);

  // Texto del pie de cada tarjeta: cargando / error / conteo real.
  const countLabel = (resource, compute, { citizenOnly = false } = {}) => {
    if (citizenOnly && !isCitizen) return "Solo para vecinos";
    if (resource.error) return "Sin conexión";
    if (!resource.loaded) return "Cargando…";
    return compute(resource.data);
  };

  const handleSubmitDescargo = async (id, motivo) => {
    await appealInfraction(id, motivo);
    await loadCitizenInfractions();
  };

  // Panel interno: cada acción llama al backend y después recarga la lista.
  const handleCreateInfraccion = async (data) => {
    await createInfraction(data);
    await reloadStaffInfractions();
  };
  const handleConfirmInfraccion = async (id) => {
    await confirmInfraction(id);
    await reloadStaffInfractions();
  };
  const handleAnnulInfraccion = async (id, reason) => {
    await annulInfraction(id, reason);
    await reloadStaffInfractions();
  };

  // Cada acción llama al backend y después recarga el listado que corresponde.
  const handleApproveClosure = async (id, payload) => {
    await approveStreetClosure(id, payload);
    await reloadStaffClosures();
  };
  const handleRejectClosure = async (id, reason) => {
    await rejectStreetClosure(id, reason);
    await reloadStaffClosures();
  };
  const handleActivateClosure = async (id) => {
    await activateStreetClosure(id);
    await reloadStaffClosures();
  };
  const handleCompleteClosure = async (id, notes) => {
    await completeStreetClosure(id, notes);
    await reloadStaffClosures();
  };

  const handleCreateOperation = async (data) => {
    await createOperation(data);
    await reloadOperations();
  };
  const handleCloseOperation = async (id, resolution) => {
    await closeOperation(id, resolution);
    await reloadOperations();
  };

  const handleCreateAccident = async (data) => {
    await createAccident(data);
    await reloadStaffAccidents();
  };
  const handleVerifyAccident = async (id) => {
    await verifyAccident(id);
    await reloadStaffAccidents();
  };

  const handleCreateImpoundment = async (data) => {
    await createImpoundment(data);
    await reloadStaffImpounded();
  };
  const handleUpdateImpoundment = async (id, data) => {
    await updateImpoundment(id, data);
    await reloadStaffImpounded();
  };
  const handleReleaseImpoundment = async (id, data) => {
    await releaseImpoundment(id, data);
    await reloadStaffImpounded();
  };

  const handleCreateZone = async (data) => {
    await createParkingZone(data);
    await reloadStaffZones();
  };
  const handleUpdateZone = async (id, data) => {
    await updateParkingZone(id, data);
    await reloadStaffZones();
  };
  const handleDeleteZone = async (id) => {
    await deleteParkingZone(id);
    await reloadStaffZones();
  };
  const handleCreateTariff = async (data) => {
    await createParkingTariff(data);
    await reloadStaffZones();
  };
  const handleUpdateTariff = async (id, data) => {
    await updateParkingTariff(id, data);
    await reloadStaffZones();
  };
  const handleDeleteTariff = async (id) => {
    await deleteParkingTariff(id);
    await reloadStaffZones();
  };
  // Marcar la falta de pago crea una infracción: se recargan las sesiones y las infracciones.
  const handleFlagUnpaid = async (id, baseAmount) => {
    await flagParkingSessionUnpaid(id, baseAmount);
    await Promise.all([reloadSessions(), reloadStaffInfractions()]);
  };

  const categories = [
    {
      key: "cat-infracciones",
      target: "infracciones",
      icon: FileWarning,
      badge: { label: "POPULAR", tone: "slate" },
      title: "Mis infracciones",
      desc: "Consultá tus infracciones registradas y su estado actual.",
      count: `${citizenInfractions.length} registradas`,
    },
    {
      key: "cat-descargo",
      target: "infracciones",
      icon: FileSignature,
      title: "Presentar descargo",
      desc: "Apelá una infracción presentando la documentación correspondiente.",
      count: `${citizenInfractions.filter((i) => i.estado === "Apelada").length} en revisión`,
    },
    {
      key: "cat-estacionamiento",
      target: "estacionamiento",
      icon: ParkingCircle,
      badge: { label: "NUEVO", tone: "emerald" },
      title: "Estacionamiento medido",
      desc: "Consultá zonas, horarios y tarifas del estacionamiento medido.",
      count: countLabel(parkingZones, (d) => plural(d.length, "zona activa", "zonas activas")),
    },
    {
      key: "cat-cortes",
      target: "cortes",
      icon: TrafficCone,
      title: "Cortes de calle",
      desc: "Mirá los cortes de calle vigentes y los desvíos habilitados.",
      count: countLabel(currentClosures, (d) => plural(d.filter((c) => c.status === "ACTIVE").length, "activo", "activos")),
    },
    {
      key: "cat-vehiculos",
      target: "vehiculos",
      icon: Car,
      badge: { label: "URGENTE", tone: "red" },
      title: "Vehículos retenidos",
      desc: "Consultá el estado de un vehículo y los requisitos para liberarlo.",
      count: countLabel(myImpoundments, (d) => `${d.filter((v) => v.status === "IMPOUNDED").length} en depósito`, {
        citizenOnly: true,
      }),
    },
    {
      key: "cat-accidentes",
      target: "accidentes",
      icon: Siren,
      title: "Accidentes y denuncias",
      desc: "Consultá cómo reportar un incidente vial.",
      count: countLabel(myAccidents, (d) => plural(d.length, "registrado", "registrados"), { citizenOnly: true }),
    },
  ];

  // Busca entre las infracciones reales del vecino por número de acta (completo o sus
  // primeros caracteres) o por patente, y muestra el estado que informa el backend.
  const handleTrackSubmit = async (e) => {
    e.preventDefault();
    const code = trackCode.trim().toLowerCase();
    if (!code) return;
    if (!isCitizen) {
      setTrackResult({ status: "not-citizen" });
      return;
    }
    try {
      const data = await getMyInfractions();
      const found = (data || [])
        .map(mapApiInfraction)
        .find((i) => i.id.toLowerCase().startsWith(code) || i.patente?.toLowerCase() === code);
      setTrackResult(found ? { status: "found", infraction: found } : { status: "not-found" });
    } catch (err) {
      setTrackResult({ status: "error", message: err.message });
    }
  };

  const renderCitizen = () => {
    switch (citizenView) {
      case "infracciones":
        return (
          <MisInfracciones
            infractions={citizenInfractions}
            loading={citizenInfractionsLoading}
            error={citizenInfractionsError}
            onRetry={loadCitizenInfractions}
            onOpen={setSelectedInfraction}
            onBack={() => setCitizenView("home")}
          />
        );
      case "estacionamiento":
        return <EstacionamientoCiudadano resource={parkingZones} onBack={() => setCitizenView("home")} />;
      case "cortes":
        return <CortesCiudadano resource={currentClosures} onBack={() => setCitizenView("home")} />;
      case "vehiculos":
        return <VehiculosCiudadano resource={myImpoundments} isCitizen={isCitizen} onBack={() => setCitizenView("home")} />;
      case "accidentes":
        return (
          <AccidentesCiudadano
            resource={myAccidents}
            isCitizen={isCitizen}
            nationalId={nationalId}
            onBack={() => setCitizenView("home")}
          />
        );
      default:
        return (
          <CitizenHome
            search={search}
            setSearch={setSearch}
            trackCode={trackCode}
            setTrackCode={setTrackCode}
            trackResult={trackResult}
            onTrackSubmit={handleTrackSubmit}
            categories={categories}
            onNavigate={setCitizenView}
          />
        );
    }
  };

  const renderStaff = () => {
    switch (staffView) {
      case "infracciones":
        return (
          <InfraccionesStaff
            infractions={staffInfractions}
            resource={staffInfractionsRes}
            role={role}
            onCreate={handleCreateInfraccion}
            onConfirm={handleConfirmInfraccion}
            onAnnul={handleAnnulInfraccion}
          />
        );
      case "cortes":
        return (
          <CortesDeCalleStaff
            closures={staffClosures}
            resource={staffClosuresRes}
            role={role}
            onApprove={handleApproveClosure}
            onReject={handleRejectClosure}
            onActivate={handleActivateClosure}
            onComplete={handleCompleteClosure}
          />
        );
      case "operativos":
        return (
          <OperativosStaff operativos={operations} resource={operationsRes} role={role} onCreate={handleCreateOperation} onClose={handleCloseOperation} />
        );
      case "accidentes":
        return (
          <AccidentesStaff accidents={staffAccidents} resource={staffAccidentsRes} role={role} onCreate={handleCreateAccident} onVerify={handleVerifyAccident} />
        );
      case "vehiculos":
        return (
          <VehiculosStaff
            impounded={staffImpounded}
            resource={staffImpoundedRes}
            role={role}
            infractions={staffInfractions}
            operations={operations}
            onCreate={handleCreateImpoundment}
            onUpdate={handleUpdateImpoundment}
            onRelease={handleReleaseImpoundment}
          />
        );
      case "estacionamiento":
        return (
          <EstacionamientoStaff
            zones={staffZones}
            zonesResource={staffZonesRes}
            sessions={sessions}
            sessionsResource={sessionsRes}
            role={role}
            onCreateZone={handleCreateZone}
            onUpdateZone={handleUpdateZone}
            onDeleteZone={handleDeleteZone}
            onCreateTariff={handleCreateTariff}
            onUpdateTariff={handleUpdateTariff}
            onDeleteTariff={handleDeleteTariff}
            onFlagUnpaid={handleFlagUnpaid}
          />
        );
      default:
        return (
          <Dashboard
            role={role}
            status={dashboardStatus}
            infractions={staffInfractions}
            closures={staffClosures}
            operativos={operations}
            accidents={staffAccidents}
            impounded={staffImpounded}
            zones={staffZones}
            sessions={sessions}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <Header mode={mode} onModeChange={goMode} username={username} role={role} onLogout={onLogout} canAccessStaff={canAccessStaff} />
      {mode === "ciudadano" ? (
        <>
          {renderCitizen()}
          <Footer onNavigate={setCitizenView} />
        </>
      ) : (
        <div className="flex min-h-screen">
          <StaffSidebar active={staffView} onChange={setStaffView} />
          <div className="min-w-0 flex-1 bg-slate-50">
            <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
              <select value={staffView} onChange={(e) => setStaffView(e.target.value)} className={inputCls}>
                {STAFF_NAV.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-6 lg:p-10">{renderStaff()}</div>
          </div>
        </div>
      )}

      {selectedInfraction && (
        <InfraccionDrawer infraction={selectedInfraction} onClose={() => setSelectedInfraction(null)} onSubmitDescargo={handleSubmitDescargo} />
      )}
    </div>
  );
}
