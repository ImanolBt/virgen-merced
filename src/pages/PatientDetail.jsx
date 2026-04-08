import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import VisitForm from "../components/VisitForm";
import PatientEditModal from "../components/PatientEditModal";
import ImageZoomModal from "../components/ImageZoomModal";

function calcAgeFromBirthdate(birthdate) {
  if (!birthdate) return null;

  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;

  return age >= 0 ? age : null;
}

function ageLabelFromBirthdate(birthdate) {
  if (!birthdate) return "-";
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return "-";

  const today = new Date();
  let years = today.getFullYear() - b.getFullYear();
  let months = today.getMonth() - b.getMonth();
  let days = today.getDate() - b.getDate();

  if (days < 0) months--;
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years <= 0) return `${Math.max(months, 0)} mes(es)`;
  return `${years} año(s)`;
}

function fmtNum(n, digits = 1) {
  if (n === null || n === undefined || n === "") return null;
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return x.toFixed(digits);
}

function classifyVitals(v) {
  let level = "ok";
  const setLevel = (next) => {
    const rank = { ok: 0, warn: 1, bad: 2 };
    if (rank[next] > rank[level]) level = next;
  };

  const bpSys = Number(v.bp_sys);
  const bpDia = Number(v.bp_dia);
  if (Number.isFinite(bpSys) && Number.isFinite(bpDia)) {
    if (bpSys >= 140 || bpDia >= 90) setLevel("bad");
    else if (bpSys >= 130 || bpDia >= 85) setLevel("warn");
  }

  const hr = Number(v.hr);
  if (Number.isFinite(hr)) {
    if (hr > 120 || hr < 50) setLevel("warn");
  }

  const spo2 = Number(v.spo2);
  if (Number.isFinite(spo2)) {
    if (spo2 < 92) setLevel("bad");
    else if (spo2 < 95) setLevel("warn");
  }

  const temp = Number(v.temp_c);
  if (Number.isFinite(temp)) {
    if (temp >= 38) setLevel("bad");
    else if (temp >= 37.5) setLevel("warn");
  }

  const map = {
    ok: { emoji: "🟢", text: "Normal" },
    warn: { emoji: "🟡", text: "Atención" },
    bad: { emoji: "🔴", text: "Alerta" },
  };

  return { level, ...map[level] };
}

function vitalsSummary(v) {
  const parts = [];
  if (v.bp_sys && v.bp_dia) parts.push(`PA ${v.bp_sys}/${v.bp_dia}`);
  if (v.hr) parts.push(`FC ${v.hr}`);
  if (v.spo2) parts.push(`SpO₂ ${v.spo2}%`);
  if (v.temp_c !== null && v.temp_c !== undefined && v.temp_c !== "")
    parts.push(`T° ${fmtNum(v.temp_c, 1)}°C`);
  if (v.weight_kg !== null && v.weight_kg !== undefined && v.weight_kg !== "")
    parts.push(`Peso ${fmtNum(v.weight_kg, 1)}kg`);
  if (v.height_cm !== null && v.height_cm !== undefined && v.height_cm !== "")
    parts.push(`Talla ${fmtNum(v.height_cm, 0)}cm`);
  if (v.bmi !== null && v.bmi !== undefined && v.bmi !== "")
    parts.push(`IMC ${fmtNum(v.bmi, 1)}`);
  if (v.pediatric_percentile) parts.push(`OMS ${v.pediatric_percentile}`);
  return parts.length ? parts.join(" · ") : "Sin signos vitales registrados";
}

export default function PatientDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const patientId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);

  const [visits, setVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(true);

  // ===== Modal editar paciente =====
  const [editOpen, setEditOpen] = useState(false);

  // 📸 Modal para ver imagen
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalUrl, setImageModalUrl] = useState(null);

  function openEdit() {
    setEditOpen(true);
  }
  
  function closeEdit() {
    setEditOpen(false);
  }

  function openImageModal(imageUrl) {
    setImageModalUrl(imageUrl);
    setImageModalOpen(true);
  }

  function closeImageModal() {
    setImageModalOpen(false);
    setImageModalUrl(null);
  }

  async function loadAll() {
    if (!patientId) return;

    setLoading(true);
    setLoadingVisits(true);

    try {
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();

      if (patientError) throw patientError;
      setPatient(patientData);

      const { data: visitsData, error: visitsError } = await supabase
        .from("medical_visits")
        .select(`
          id, visit_date, reason, notes, created_at, consultation_image_url,
          bp_sys, bp_dia, hr, spo2, temp_c, weight_kg, height_cm, bmi, pediatric_percentile,
          medical_visit_diagnoses:medical_visit_diagnoses ( cie10_code, cie10_name )
        `)
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });

      if (visitsError) throw visitsError;
      setVisits(visitsData || []);
      
    } catch (error) {
      console.error("Error loading data:", error);
      alert(error.message || "Error al cargar los datos");
    } finally {
      setLoading(false);
      setLoadingVisits(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line
  }, [patientId]);

  async function deleteVisit(visitId) {
    const ok = confirm("¿Eliminar esta consulta?");
    if (!ok) return;

    const { error } = await supabase.from("medical_visits").delete().eq("id", visitId);
    if (error) {
      console.error(error);
      alert(error.message || "No se pudo eliminar");
      return;
    }
    loadAll();
  }

  if (!patientId) return <div className="mm-empty">ID inválido.</div>;
  if (loading) return <div className="mm-empty">Cargando ficha...</div>;
  if (!patient) return <div className="mm-empty">Paciente no encontrado.</div>;

  const age = calcAgeFromBirthdate(patient.birthdate);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14, display: "grid", gap: 14 }}>
      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="mm-cardTitle">{patient.name}</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Cédula: <b>{patient.cedula}</b> ·
               Tel: <b>{patient.phone || "-"}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="mm-btn mm-btn--ghost" type="button" onClick={() => nav("/patients")}>
              Volver
            </button>

            <button className="mm-btn" type="button" onClick={openEdit}>
              Editar paciente
            </button>
          </div>
        </div>

        <div className="mm-itemMeta" style={{ padding: 14 }}>
          <div><b>Sexo:</b> {patient.sex === "M" ? "Masculino" : patient.sex === "F" ? "Femenino" : "-"}</div>
          <div><b>Nacimiento:</b> {patient.birthdate || "-"}</div>
          <div><b>Edad:</b> {ageLabelFromBirthdate(patient.birthdate)}</div>
          <div>
            <b>Alergias:</b>{" "}
            {Array.isArray(patient.allergies) ? patient.allergies.join(", ") : patient.allergies || "-"}
          </div>
          <div><b>Notas médicas:</b> {patient.medical_history || "-"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <VisitForm patientId={patientId} onCreated={loadAll} />

        <div className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Historial de consultas</div>
            <div className="mm-chip">{loadingVisits ? "Cargando..." : `${visits.length} registros`}</div>
          </div>

          <div style={{ padding: 14, display: "grid", gap: 10 }}>
            {loadingVisits && <div className="mm-empty">Cargando...</div>}

            {!loadingVisits && visits.length === 0 && (
              <div className="mm-empty">No hay consultas registradas.</div>
            )}

            {!loadingVisits &&
              visits.map((v) => {
                const status = classifyVitals(v);

                return (
                  <div
                    key={v.id}
                    className="mm-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => nav(`/visits/${v.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && nav(`/visits/${v.id}`)}
                    style={{ cursor: "pointer" }}
                    title="Abrir consulta"
                  >
                    <div className="mm-itemTop" style={{ alignItems: "flex-start" }}>
                      <div style={{ display: "grid", gap: 2 }}>
                        <div className="mm-itemName">
                          {v.reason || "Consulta médica"}
                          {v.consultation_image_url && <span style={{ marginLeft: 8 }}>📷</span>}
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.85 }}>
                          {new Date(v.visit_date).toLocaleString("es-EC")}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div className="mm-chip">
                          {Array.isArray(v.medical_visit_diagnoses) && v.medical_visit_diagnoses.length > 0
                            ? `${v.medical_visit_diagnoses.length} dx`
                            : "CIE10"}
                        </div>

                        <div className="mm-chip" title="Estado de signos vitales">
                          {status.emoji} {status.text}
                        </div>

                        {v.consultation_image_url && (
                          <button
                            type="button"
                            className="mm-btn mm-btn--ghost"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openImageModal(v.consultation_image_url);
                            }}
                            style={{ background: '#e3f2fd', color: '#1976d2' }}
                          >
                            📸 Ver imagen
                          </button>
                        )}

                        <button
                          type="button"
                          className="mm-btn mm-btn--ghost"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteVisit(v.id);
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="mm-itemMeta">
                      <div>
                        <b>Diagnósticos:</b>{" "}
                        {Array.isArray(v.medical_visit_diagnoses) && v.medical_visit_diagnoses.length > 0
                          ? v.medical_visit_diagnoses.map((d) => `${d.cie10_name} (${d.cie10_code})`).join(" · ")
                          : "-"}
                      </div>
                      <div><b>Signos vitales:</b> {vitalsSummary(v)}</div>
                      <div><b>Notas:</b> {v.notes || "-"}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* ===== Modal editar paciente - CORREGIDO ===== */}
      {patient && (
        <PatientEditModal
          isOpen={editOpen}
          patient={patient}
          onClose={closeEdit}
          onSuccess={loadAll}
        />
      )}

      {/* Modal para ver imagen con zoom */}
      {imageModalOpen && imageModalUrl && (
        <ImageZoomModal 
          imageUrl={imageModalUrl} 
          onClose={closeImageModal} 
        />
      )}
    </div>
  );
}