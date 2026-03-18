import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function fmtDateTime(dateISO) {
  if (!dateISO) return "-";
  return new Date(dateISO).toLocaleString("es-EC");
}

export default function Dashboard() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);

  const [countPatients, setCountPatients] = useState(0);
  const [countVisitsToday, setCountVisitsToday] = useState(0);
  const [countCertsToday, setCountCertsToday] = useState(0);
  const [countRxToday, setCountRxToday] = useState(0);

  const [recentVisits, setRecentVisits] = useState([]);

  // mini agenda demo (si todavía no tienes tabla agenda)
  const agendaDemo = useMemo(
    () => [
    
    ],
    []
  );

  async function load() {
    setLoading(true);

    const from = startOfTodayISO();
    const to = endOfTodayISO();

    // 1) pacientes (total)
    const p = await supabase.from("patients").select("id", { count: "exact", head: true });
    if (!p.error) setCountPatients(p.count || 0);

    // 2) consultas de hoy
    const vToday = await supabase
      .from("medical_visits")
      .select("id", { count: "exact", head: true })
      .gte("visit_date", from)
      .lte("visit_date", to);

    if (!vToday.error) setCountVisitsToday(vToday.count || 0);

    // 3) certificados de hoy
    const cToday = await supabase
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .gte("date", from)
      .lte("date", to);

    if (!cToday.error) setCountCertsToday(cToday.count || 0);

    // 4) recetas de hoy (si existe tabla prescriptions)
    const rToday = await supabase
      .from("prescriptions")
      .select("id", { count: "exact", head: true })
      .gte("date", from)
      .lte("date", to);

    // Si no existe la tabla, no rompas el dashboard
    if (rToday.error) {
      setCountRxToday(0);
    } else {
      setCountRxToday(rToday.count || 0);
    }

    // 5) últimas 6 consultas con paciente
    // (nota: para join necesitas relación o lo hacemos en 2 pasos; aquí lo hago en 2 pasos seguro)
    const v = await supabase
      .from("medical_visits")
      .select("id, patient_id, visit_date, reason, cie10_code, cie10_name")
      .order("visit_date", { ascending: false })
      .limit(6);

    if (v.error) {
      console.error(v.error);
      setRecentVisits([]);
      setLoading(false);
      return;
    }

    const visitRows = v.data || [];
    const patientIds = [...new Set(visitRows.map((x) => x.patient_id).filter(Boolean))];

    let patientsMap = {};
    if (patientIds.length) {
      const pp = await supabase
        .from("patients")
        .select("id, name, cedula")
        .in("id", patientIds);

      if (!pp.error) {
        patientsMap = Object.fromEntries((pp.data || []).map((x) => [x.id, x]));
      }
    }

    const merged = visitRows.map((x) => ({
      ...x,
      patient: patientsMap[x.patient_id] || null,
    }));

    setRecentVisits(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14, display: "grid", gap: 14 }}>
      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="mm-cardTitle">Dashboard</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Resumen rápido del consultorio (hoy y actividad reciente)
            </div>
          </div>

          <button className="mm-btn mm-btn--ghost" type="button" onClick={load}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        {/* KPIs */}
        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            <div className="mm-item" style={{ cursor: "default" }}>
              <div className="mm-itemTop" style={{ alignItems: "center" }}>
                <div className="mm-itemName">Pacientes</div>
                <div className="mm-chip">Total</div>
              </div>
              <div className="mm-itemMeta" style={{ fontSize: 28, fontWeight: 900, paddingTop: 4 }}>
                {countPatients}
              </div>
            </div>

            <div className="mm-item" style={{ cursor: "default" }}>
              <div className="mm-itemTop" style={{ alignItems: "center" }}>
                <div className="mm-itemName">Consultas</div>
                <div className="mm-chip">Hoy</div>
              </div>
              <div className="mm-itemMeta" style={{ fontSize: 28, fontWeight: 900, paddingTop: 4 }}>
                {countVisitsToday}
              </div>
            </div>

            <div className="mm-item" style={{ cursor: "default" }}>
              <div className="mm-itemTop" style={{ alignItems: "center" }}>
                <div className="mm-itemName">Certificados</div>
                <div className="mm-chip">Hoy</div>
              </div>
              <div className="mm-itemMeta" style={{ fontSize: 28, fontWeight: 900, paddingTop: 4 }}>
                {countCertsToday}
              </div>
            </div>

            <div className="mm-item" style={{ cursor: "default" }}>
              <div className="mm-itemTop" style={{ alignItems: "center" }}>
                <div className="mm-itemName">Recetas</div>
                <div className="mm-chip">Hoy</div>
              </div>
              <div className="mm-itemMeta" style={{ fontSize: 28, fontWeight: 900, paddingTop: 4 }}>
                {countRxToday}
              </div>
            </div>
          </div>

          <div className="mm-hint" style={{ margin: 0 }}>
            Tip: esto se ve “vendible” porque resume volumen real y productividad del consultorio.
          </div>
        </div>
      </div>

      {/* 2 columnas */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 14 }}>
        {/* Últimas consultas */}
        <div className="mm-card">
          <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
            <div className="mm-cardTitle">Últimas consultas</div>
            <div className="mm-chip">{loading ? "Cargando..." : `${recentVisits.length} recientes`}</div>
          </div>

          <div style={{ padding: 14, display: "grid", gap: 10 }}>
            {loading && <div className="mm-empty">Cargando...</div>}

            {!loading && recentVisits.length === 0 && (
              <div className="mm-empty">Aún no hay consultas registradas.</div>
            )}

            {!loading &&
              recentVisits.map((v) => {
                const diag =
                  v.cie10_code && v.cie10_name
                    ? `${v.cie10_name} (${v.cie10_code})`
                    : v.cie10_name || v.cie10_code || "-";

                return (
                  <div
                    key={v.id}
                    className="mm-item"
                    onClick={() => nav(`/visits/${v.id}`)}
                    style={{ cursor: "pointer" }}
                    title="Abrir consulta"
                  >
                    <div className="mm-itemTop" style={{ alignItems: "flex-start" }}>
                      <div style={{ display: "grid", gap: 2 }}>
                        <div className="mm-itemName">
                          {v.patient?.name || "Paciente"} — {v.reason || "Consulta"}
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.85 }}>{fmtDateTime(v.visit_date)}</div>
                      </div>

                      <div className="mm-chip">Ver</div>
                    </div>

                    <div className="mm-itemMeta">
                      <div>
                        <b>CI:</b> {v.patient?.cedula || "-"}
                      </div>
                      <div>
                        <b>Diagnóstico:</b> {diag}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

       

         
          </div>
        </div>
  );
}
