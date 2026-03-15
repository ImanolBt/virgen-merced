import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import VisitDetail from "./pages/VisitDetail.jsx";
import PrescriptionDetail from "./pages/PrescriptionDetail.jsx";
import AvailabilityConfig from './pages/AvailabilityConfig'
import PublicBooking from './pages/PublicBooking'
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import PatientDetail from "./pages/PatientDetail.jsx";
import Billing from "./pages/Billing.jsx";
import Agenda from "./pages/Agenda.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loadingSession) return null;

  // Si no hay sesión -> Login
  if (!session) return <Login />;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f7f3" }}>
      {/* Top bar */}
      <div
        style={{
          background: "linear-gradient(90deg, #96b34a, #7aa63c)",
          color: "white",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Virgen de la Merced</div>
          <div style={{ fontSize: 12, opacity: 0.95 }}>
            Conectado como: <b>{session.user.email}</b>
          </div>
        </div>

        <button
          onClick={signOut}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "none",
            background: "rgba(255,255,255,.20)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>

      {/* Menu */}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: 14,
          maxWidth: 1200,
          margin: "0 auto",
          flexWrap: "wrap",
        }}
      >
        <NavLink className="mm-nav" to="/dashboard">
          📊 Dashboard
        </NavLink>
        <NavLink className="mm-nav" to="/patients">
          👥 Pacientes
        </NavLink>
        <NavLink className="mm-nav" to="/agenda">
          📅 Agenda
        </NavLink>
        <NavLink className="mm-nav" to="/config-horarios">
          ⚙️ Configurar Horarios
        </NavLink>
        <NavLink className="mm-nav" to="/billing">
          💰 Facturas
        </NavLink>
      </div>

      {/* Pages */}
      <Routes>
        {/* Rutas principales */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/visits/:id" element={<VisitDetail />} />
        <Route path="/visits/:id/prescription" element={<PrescriptionDetail />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/billing" element={<Billing />} />
        
        {/* Configuración de horarios - requiere autenticación */}
        <Route path="/config-horarios" element={<AvailabilityConfig />} />
        
        {/* Formulario público - NO requiere autenticación */}
        <Route path="/agendar" element={<PublicBooking />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}