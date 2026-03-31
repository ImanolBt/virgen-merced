import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const CLINIC_PHONE = "0984340286";

function fmtDateLong(dateISO) {
  if (!dateISO) return "-";

  const meses = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre"
  ];

  const [year, month, day] = dateISO.split("-");

  return `${parseInt(day)} de ${meses[parseInt(month) - 1]} de ${year}`;
}

function fmtDateShort(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "2-digit", day: "2-digit" });
}

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

function cleanAllergiesData(value) {
  if (!value) return "";
  let cleaned = value;
  if (Array.isArray(value)) {
    cleaned = value.join(", ");
  }
  cleaned = String(cleaned);
  cleaned = cleaned
    .replace(/\\\\/g, '')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\["/g, '')
    .replace(/"]/g, '')
    .replace(/^\[/g, '')
    .replace(/]$/g, '')
    .replace(/^"/g, '')
    .replace(/"$/g, '')
    .replace(/","/g, ', ')
    .replace(/"\s*,\s*"/g, ', ')
    .trim();
  return cleaned;
}

export default function PrescriptionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const printRef = useRef(null);

  const visitId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [loading, setLoading] = useState(true);

  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);

  const [rxNotes, setRxNotes] = useState("");
  const [items, setItems] = useState([]);

  const doctor = {
    clinic: "Virgen de la Merced",
    fullName: "ESP. WASHINGTON MASAPANTA",
    specialty: "EMERGENCIAS, DIABETES Y OBESIDAD",
    cedula: "050333534-1",
    regMedico: "0503335341 - 1027 - 2023 - 2599595",
    phone: "0984340286",
    email: "drwmasapanta@gmail.com",
    address: "Cotopaxi - Latacunga Calle Gustavo Iturralde",
    place: "Latacunga",
  };

  async function loadAll() {
    if (!visitId) return;
    setLoading(true);

    const v = await supabase
      .from("medical_visits")
      .select("id, patient_id, visit_date, reason, notes, created_at, prescription_notes")
      .eq("id", visitId)
      .single();

    if (v.error) {
      console.error(v.error);
      alert(v.error.message || "No se pudo cargar la consulta");
      setLoading(false);
      return;
    }

    const diagRes = await supabase
      .from("medical_visit_diagnoses")
      .select("cie10_code, cie10_name")
      .eq("visit_id", visitId);

    const diagnoses = diagRes.data || [];

    const p = await supabase.from("patients").select("*").eq("id", v.data.patient_id).single();
    if (p.error) {
      console.error(p.error);
      alert(p.error.message || "No se pudo cargar el paciente");
      setLoading(false);
      return;
    }
    setPatient(p.data);

    setVisit({ ...v.data, diagnoses });
    setRxNotes(v.data?.prescription_notes || "");

    const it = await supabase
      .from("prescription_items")
      .select("id, encounter_id, med, instructions, sort_order")
      .eq("encounter_id", visitId)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (it.error) {
      console.error(it.error);
      setItems([]);
    } else {
      setItems(it.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line
  }, [visitId]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `temp_${Date.now()}_${Math.random()}`,
        med: "",
        instructions: "",
        sort_order: prev.length + 1,
        isNew: true,
      },
    ]);
  }

  function updateItem(id, patch) {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function removeItem(id) {
    setItems((prev) =>
      prev
        .filter((x) => x.id !== id)
        .map((x, idx) => ({ ...x, sort_order: idx + 1 }))
    );
  }

  async function savePrescription() {
    if (!visit || !patient) return;

    const cleaned = (items || [])
      .map((x, idx) => ({
        med: (x.med || "").trim(),
        instructions: (x.instructions || "").trim(),
        sort_order: idx + 1,
      }))
      .filter((x) => x.med && x.instructions);

    try {
      const { error: notesErr } = await supabase
        .from("medical_visits")
        .update({ prescription_notes: rxNotes?.trim() || null })
        .eq("id", visitId);

      if (notesErr) throw notesErr;

      const { error: rxErr } = await supabase.rpc("replace_prescription_items", {
        p_encounter_id: visitId,
        p_items: cleaned,
      });

      if (rxErr) throw rxErr;

      alert("Receta guardada correctamente.");
      loadAll();
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo guardar la receta");
    }
  }

  function printPDF() {
    const node = printRef.current;
    if (!node) return;

    const LOGO_TOP = `${window.location.origin}/logo-top.png`;
    const LOGO_WM = `${window.location.origin}/logo-watermark.png`;

    const html = node.innerHTML;

    const w = window.open("", "_blank", "width=1200,height=900");
    if (!w) return;

    w.document.open();
    w.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receta Médica</title>
  <style>
    @page { 
      size: A4 landscape; 
      margin: 6mm 8mm; 
    }

    body { 
      font-family: Arial, sans-serif; 
      color: #111; 
      margin: 0; 
      padding: 0;
      font-size: 9px;
    }
    
    * {
      box-sizing: border-box;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    @media print {
      body { 
        margin: 0;
        padding: 0;
      }
      img {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="paper">
    <div class="content">
      ${html}
    </div>
  </div>
  <script>
    window.onload = function() {
      const images = document.querySelectorAll('img');
      const totalImages = images.length;
      let loadedImages = 0;

      function checkAndPrint() {
        loadedImages++;
        if (loadedImages === totalImages) {
          setTimeout(() => {
            window.focus();
            window.print();
          }, 300);
        }
      }

      if (totalImages === 0) {
        setTimeout(() => {
          window.focus();
          window.print();
        }, 200);
      } else {
        images.forEach(img => {
          if (img.complete) {
            checkAndPrint();
          } else {
            img.onload = checkAndPrint;
            img.onerror = () => {
              console.warn('Error cargando imagen:', img.src);
              checkAndPrint();
            };
          }
        });
      }
    }
  </script>
</body>
</html>
    `);
    w.document.close();
  }

  if (!visitId) return <div className="mm-empty">ID inválido.</div>;
  if (loading) return <div className="mm-empty">Cargando receta...</div>;
  if (!visit || !patient) return <div className="mm-empty">No se encontró la consulta.</div>;

  const rxDateISO = visit.visit_date ? String(visit.visit_date).slice(0, 10) : new Date().toISOString().slice(0, 10);

  const diag = Array.isArray(visit.diagnoses) && visit.diagnoses.length > 0
    ? visit.diagnoses.map((d) => `${d.cie10_name} (${d.cie10_code})`).join(", ")
    : "-";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14, display: "grid", gap: 14 }}>
      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="mm-cardTitle">Receta médica</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Paciente: <b>{patient.name}</b> · Consulta #{visit.id}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn mm-btn--ghost" type="button" onClick={() => nav(`/visits/${visit.id}`)}>
              Volver a consulta
            </button>
          </div>
        </div>

        <div className="mm-itemMeta" style={{ padding: 14 }}>
          <div><b>Motivo:</b> {visit.reason || "-"}</div>
          <div><b>Diagnóstico(s) CIE10:</b> {diag}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="mm-card">
          <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
            <div className="mm-cardTitle">Medicamentos</div>
            <div className="mm-chip">Consulta #{visit.id}</div>
          </div>

          <div style={{ padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Notas (opcional)</div>
              <input
                className="mm-input"
                placeholder="Ej: No automedicarse"
                value={rxNotes}
                onChange={(e) => setRxNotes(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="mm-btn" type="button" onClick={addItem}>
                + Añadir medicamento
              </button>

              <button className="mm-btn mm-btn--ghost" type="button" onClick={savePrescription}>
                Guardar receta
              </button>

              <button className="mm-btn mm-btn--ghost" type="button" onClick={printPDF}>
                Imprimir / Guardar PDF
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
              {items.length === 0 && <div className="mm-empty">Aún no hay medicamentos. Clic en "Añadir medicamento".</div>}

              {items.map((it, idx) => (
                <div key={it.id} className="mm-item" style={{ cursor: "default" }}>
                  <div className="mm-itemTop" style={{ alignItems: "center" }}>
                    <div className="mm-itemName">Medicamento #{idx + 1}</div>
                    <button className="mm-btn mm-btn--ghost" type="button" onClick={() => removeItem(it.id)}>
                      Quitar
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <input
                      className="mm-input"
                      placeholder="Medicamento (ej: Amoxicilina 500mg)"
                      value={it.med || ""}
                      onChange={(e) => updateItem(it.id, { med: e.target.value })}
                    />

                    <textarea
                      className="mm-input"
                      style={{ minHeight: 80, paddingTop: 10 }}
                      placeholder="Indicaciones (ej: 1 cápsula cada 8 horas por 7 días)"
                      value={it.instructions || ""}
                      onChange={(e) => updateItem(it.id, { instructions: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Vista previa (Receta Horizontal)</div>
            <div className="mm-chip">PDF</div>
          </div>

          <div style={{ padding: 14 }}>
            <div ref={printRef}>
              {/* HEADER: FECHA Y NÚMERO DE RECETA */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 3
              }}>
                <div style={{ fontSize: "10px", color: "#666", fontWeight: 600 }}>
                  Fecha: {fmtDateShort(rxDateISO)}
                </div>
                <div style={{ fontSize: "11px", color: "#666" }}>
                  Receta N° <span style={{ 
                    color: "#e74c3c", 
                    fontWeight: 700,
                    fontSize: "14px",
                    letterSpacing: "1px"
                  }}>
                    {String(visit.id).padStart(7, '0')}
                  </span>
                </div>
              </div>

              {/* HEADER PRINCIPAL - COMPACTO */}
              <div style={{
                border: "2px solid #000",
                borderRadius: 6,
                padding: "5px 10px 7px 10px",
                marginBottom: 3,
                position: "relative",
                overflow: "visible"
              }}>
                {/* Logo */}
                <div style={{ 
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  position: "relative",
                  marginTop: "-18px",
                  marginBottom: "-10px"
                }}>
                  <img 
                    src="/logo-top.png" 
                    alt="Logo"
                    style={{
                      width: "160px",
                      height: "auto",
                      objectFit: "contain",
                      display: "block"
                    }}
                  />
                </div>

                {/* Datos doctor */}
                <div style={{ textAlign: "center", width: "100%" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: 1 }}>
                    Dr. Washington Masapanta MsC
                  </div>
                  <div style={{ fontSize: "7px", lineHeight: 1.15, fontWeight: 600 }}>
                    EMERGENCIAS Y DESASTRES / DIABETES Y OBESIDAD / SEGURIDAD Y SALUD OCUPACIONAL<br/>
                    DIABETES · HIPERTENSIÓN · TIROIDES · MEDICINA GENERAL · CARDIACA · GASTROINTESTINAL · SOBREPESO/OBESIDAD
                  </div>
                  <div style={{ fontSize: "7.5px", marginTop: 2, fontWeight: 600 }}>
                    📍 Gustavo Iturralde 1-67 y Calixto Pino · LATACUNGA · 📞 0995361606 · ✉ drwmasapanta@gmail.com
                  </div>
                </div>
              </div>

              {/* SERVICIO */}
              <div style={{
                border: "1px solid #000",
                padding: "2px 5px",
                marginBottom: 2,
                fontSize: "8.5px",
                fontWeight: 600
              }}>
                SERVICIO / ESPECIALIDAD: {doctor.specialty}
              </div>

              {/* DATOS PACIENTE HEADER */}
              <div style={{
                border: "1px solid #000",
                borderBottom: "none",
                padding: "2px 5px",
                fontSize: "8.5px",
                fontWeight: 700,
                background: "#f5f5f5"
              }}>
                DATOS DEL PACIENTE
              </div>

              {/* FILA 1: NOMBRE + HC + DOC */}
              <div style={{
                display: "flex",
                border: "1px solid #000",
                borderBottom: "none"
              }}>
                <div style={{
                  flex: 2,
                  borderRight: "1px solid #000",
                  padding: "2px 5px",
                  fontSize: "8.5px"
                }}>
                  <b>NOMBRES:</b> {patient.name}
                </div>
                <div style={{
                  width: "85px",
                  borderRight: "1px solid #000",
                  padding: "2px 5px",
                  fontSize: "8.5px"
                }}>
                  <b>H.C.:</b> {patient.id}
                </div>
                <div style={{
                  flex: 1,
                  padding: "2px 5px",
                  fontSize: "8.5px"
                }}>
                  <b>DOC:</b> {patient.cedula || "-"}
                </div>
              </div>

              {/* FILA 2: EDAD + MESES + SEXO + ALERGIAS */}
              <div style={{
                display: "flex",
                border: "1px solid #000",
                borderBottom: "none"
              }}>
                <div style={{
                  width: "75px",
                  borderRight: "1px solid #000",
                  padding: "2px 5px",
                  fontSize: "8.5px"
                }}>
                  <b>EDAD:</b> {calcAgeFromBirthdate(patient.birthdate) || patient.age || "-"} a
                </div>
                <div style={{
                  width: "65px",
                  borderRight: "1px solid #000",
                  padding: "2px 5px",
                  fontSize: "8.5px"
                }}>
                  <b>MESES:</b> {(() => {
                    if (!patient.birthdate) return "-";
                    const b = new Date(patient.birthdate);
                    if (isNaN(b.getTime())) return "-";
                    const today = new Date();
                    let months = today.getMonth() - b.getMonth();
                    if (months < 0) months += 12;
                    return months;
                  })()}
                </div>
                <div style={{
                  width: "75px",
                  borderRight: "1px solid #000",
                  padding: "2px 5px",
                  fontSize: "8.5px"
                }}>
                  <b>SEXO:</b> M{patient.sex === "M" ? "☑" : "☐"} F{patient.sex === "F" ? "☑" : "☐"}
                </div>
                <div style={{
                  flex: 1,
                  padding: "2px 5px",
                  fontSize: "8.5px"
                }}>
                  <b>ALÉRGICO:</b> {cleanAllergiesData(patient.allergies) || "Ninguno"}
                </div>
              </div>

              {/* DIAGNÓSTICO */}
              <div style={{
                display: "flex",
                border: "1px solid #000",
                borderBottom: "none"
              }}>
                <div style={{
                  flex: 1,
                  borderRight: "1px solid #000",
                  padding: "2px 5px",
                  fontSize: "8.5px"
                }}>
                  <b>DIAGNÓSTICO:</b> {diag}
                </div>
                <div style={{
                  width: "130px",
                  padding: "2px 5px",
                  fontSize: "8.5px"
                }}>
                  <b>CIE10:</b> {Array.isArray(visit.diagnoses) && visit.diagnoses.length > 0
                    ? visit.diagnoses.map(d => d.cie10_code).join(", ")
                    : "-"}
                </div>
              </div>

              {/* TABLA MEDICAMENTOS */}
              <div style={{
                position: "relative",
                border: "1px solid #000",
                minHeight: "170px"
              }}>
                {/* Marca de agua */}
                <div style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  opacity: 0.22,
                  zIndex: 0,
                  pointerEvents: "none"
                }}>
                  <img 
                    src="/logo-watermark.png" 
                    alt="Watermark"
                    style={{
                      width: "240px",
                      height: "auto",
                      objectFit: "contain"
                    }}
                  />
                </div>

                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  position: "relative",
                  zIndex: 1
                }}>
                  <thead>
                    <tr>
                      <th style={{
                        border: "1px solid #000",
                        borderLeft: "none",
                        borderTop: "none",
                        padding: "2px 5px",
                        fontSize: "8px",
                        fontWeight: 700,
                        background: "#f5f5f5",
                        textAlign: "left",
                        width: "50%"
                      }}>
                        MEDICAMENTO (Dosis, concentración, forma farmacéutica)
                      </th>
                      <th style={{
                        border: "1px solid #000",
                        borderRight: "none",
                        borderTop: "none",
                        padding: "2px 5px",
                        fontSize: "8px",
                        fontWeight: 700,
                        background: "#f5f5f5",
                        textAlign: "left",
                        width: "50%"
                      }}>
                        INDICACIONES
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(items || [])
                      .filter((x) => (x.med || "").trim() && (x.instructions || "").trim())
                      .map((x, idx) => (
                        <tr key={x.id ?? idx}>
                          <td style={{
                            border: "1px solid #000",
                            borderLeft: "none",
                            padding: "3px 5px",
                            fontSize: "9px",
                            fontWeight: 600,
                            verticalAlign: "top",
                            lineHeight: 1.25
                          }}>
                            {idx + 1}. {x.med}
                          </td>
                          <td style={{
                            border: "1px solid #000",
                            borderRight: "none",
                            padding: "3px 5px",
                            fontSize: "8.5px",
                            verticalAlign: "top",
                            lineHeight: 1.25,
                            whiteSpace: "pre-wrap"
                          }}>
                            {x.instructions}
                          </td>
                        </tr>
                      ))}
                    
                    {items.filter(x => x.med?.trim() && x.instructions?.trim()).length === 0 && (
                      <tr>
                        <td colSpan="2" style={{
                          border: "none",
                          padding: "35px 8px",
                          textAlign: "center",
                          fontSize: "9px",
                          opacity: 0.5
                        }}>
                          No hay medicamentos agregados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* NOTAS */}
              {rxNotes?.trim() && (
                <div style={{
                  border: "1px solid #000",
                  borderTop: "none",
                  padding: "3px 5px",
                  fontSize: "8px",
                  background: "#fffbf0",
                  lineHeight: 1.25
                }}>
                  <b>NOTAS:</b> {rxNotes}
                </div>
              )}

              {/* PRESCRIPTOR */}
              <div style={{
                display: "flex",
                border: "1px solid #000",
                borderTop: rxNotes?.trim() ? "1px solid #000" : "none",
                marginTop: rxNotes?.trim() ? 3 : 0,
                minHeight: "42px"
              }}>
                <div style={{
                  flex: 1,
                  borderRight: "1px solid #000",
                  padding: "3px 5px",
                  fontSize: "8px"
                }}>
                  <b>PRESCRIPTOR:</b> {doctor.fullName}<br/>
                  <span style={{ fontSize: "7.5px" }}>
                    CÉDULA: {doctor.cedula} | REG. MÉDICO: {doctor.regMedico}
                  </span>
                </div>
                <div style={{
                  width: "150px",
                  padding: "3px 5px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <div style={{ 
                    borderTop: "1px solid #333",
                    width: "120px",
                    marginTop: 12,
                    paddingTop: 2,
                    textAlign: "center",
                    fontSize: "7.5px",
                    fontWeight: 600
                  }}>
                    FIRMA Y SELLO
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}