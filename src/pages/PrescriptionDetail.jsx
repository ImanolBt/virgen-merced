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

    // ✅ Cargar visita
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

    // ✅ Cargar TODOS los diagnósticos desde tabla separada
    const diagRes = await supabase
      .from("medical_visit_diagnoses")
      .select("cie10_code, cie10_name")
      .eq("visit_id", visitId);

    const diagnoses = diagRes.data || [];

    // ✅ Cargar paciente
    const p = await supabase.from("patients").select("*").eq("id", v.data.patient_id).single();
    if (p.error) {
      console.error(p.error);
      alert(p.error.message || "No se pudo cargar el paciente");
      setLoading(false);
      return;
    }
    setPatient(p.data);

    // ✅ Guardar visita con diagnósticos incluidos
    setVisit({ ...v.data, diagnoses });
    setRxNotes(v.data?.prescription_notes || "");

    // ✅ Cargar items de prescripción
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

    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;

    w.document.open();
    w.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receta Médica</title>
  <style>
    @page { size: A4; margin: 10mm; }

    body { 
      font-family: Arial, sans-serif; 
      color: #111; 
      margin: 0; 
      padding: 0;
    }
    
    .paper { 
      position: relative;
      max-width: 210mm;
      margin: 0 auto;
    }

    /* Marca de agua */
    .watermark {
      position: fixed;
      inset: 0;
      background-image: url("${LOGO_WM}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 500px auto;
      opacity: 0.10;
      pointer-events: none;
      z-index: 0;
    }
    
    .content { 
      position: relative; 
      z-index: 1; 
    }

    /* ✅ HEADER: Logo izquierda, datos doctor derecha */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    
    .logo-section {
      flex-shrink: 0;
    }
    
    .logoTop { 
      height: 60px; 
      width: auto;
      object-fit: contain;
      display: block;
    }

    .location-info {
      font-size: 9px;
      color: #555;
      margin-top: 4px;
      line-height: 1.3;
    }
    
    .doctor-header-info {
      text-align: right;
      font-size: 8.5px;
      color: #333;
      line-height: 1.35;
      font-weight: 600;
    }

    /* Título */
    .title { 
      font-size: 16px; 
      font-weight: 700; 
      text-align: center; 
      margin: 12px 0 10px;
      color: #2c3e50;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* Info del paciente */
    .patient-info { 
      font-size: 11px; 
      line-height: 1.5; 
      margin-bottom: 12px;
    }
    
    .patient-info div {
      margin-bottom: 3px;
    }
    
    .patient-info b { 
      font-weight: 700;
      color: #000;
    }

    /* Tabla de medicamentos */
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 8px 0;
    }
    
    th, td { 
      border: 1px solid #ddd; 
      padding: 7px; 
      vertical-align: top;
      text-align: left;
    }
    
    th { 
      font-size: 10px;
      font-weight: 600;
      background: #f1f3f5;
      color: #2c3e50;
    }
    
    td { 
      font-size: 9.5px; 
      white-space: pre-wrap;
      line-height: 1.4;
    }

    thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }

    /* Notas */
    .notes-section {
      margin-top: 10px;
      padding: 7px;
      background: #fffbf0;
      border-left: 2px solid #f39c12;
      font-size: 9.5px;
      line-height: 1.4;
    }
    
    .notes-section b {
      color: #e67e22;
    }

    /* ✅ FIRMA CON ESPACIO PARA FIRMAR A MANO */
    .signature-section {
      margin-top: 25px;
      page-break-inside: avoid;
      break-inside: avoid;
      text-align: center;
    }
    
    .signature-line {
      width: 280px;
      margin: 0 auto;
      border-bottom: 1.5px solid #333;
      padding-top: 50px;
    }
    
    .doctor-name { 
      font-size: 11px; 
      font-weight: 700; 
      margin-top: 8px;
      margin-bottom: 3px;
      color: #2c3e50;
    }
    
    .doctor-details { 
      font-size: 9px; 
      color: #555; 
      line-height: 1.3;
      margin-bottom: 4px;
    }
    
    .doctor-contact { 
      font-size: 8.5px; 
      color: #777; 
      line-height: 1.2;
    }

    .force-new-page {
      page-break-before: always;
      break-before: page;
    }

    /* Imprimir fondos */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
  </style>
</head>
<body>
  <div class="watermark"></div>

  <div class="paper">
    <div class="content">
      ${html}

      <!-- ✅ Firma al final CON ESPACIO PARA FIRMAR -->
      <div id="sig" class="signature-section">
        <div class="signature-line"></div>
        <div class="doctor-name">ESP. WASHINGTON MASAPANTA</div>
        <div class="doctor-details">
          EMERGENCIAS, DIABETES Y OBESIDAD<br/>
          CÉDULA: 050333534-1<br/>
          REG. MÉDICO: 0503335341 - 1027 - 2023 - 2599595
        </div>
        <div class="doctor-contact">
          Cotopaxi - Latacunga Latacunga Calle Gustavo Iturralde<br/>
          Teléfono: 0984340286 | Email: drwmasapanta@gmail.com
        </div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      function run() {
        const sig = document.getElementById('sig');
        if (!sig) return;

        const rect = sig.getBoundingClientRect();
        const pageH = window.innerHeight;
        const SAFE = 100;

        if (rect.bottom > (pageH - SAFE)) {
          sig.classList.add('force-new-page');
        }

        setTimeout(() => {
          window.focus();
          window.print();
        }, 250);
      }

      if (document.readyState === 'complete') run();
      else window.addEventListener('load', run);
    })();
  </script>
</body>
</html>
    `);
    w.document.close();
  }

  if (!visitId) return <div className="mm-empty">ID inválido.</div>;
  if (loading) return <div className="mm-empty">Cargando receta...</div>;
  if (!visit || !patient) return <div className="mm-empty">No se encontró la consulta.</div>;

  // ✅ FORMATEAR MÚLTIPLES DIAGNÓSTICOS
  const diag = visit.diagnoses && visit.diagnoses.length > 0
    ? visit.diagnoses
        .map(d => {
          if (d.cie10_code && d.cie10_name) {
            return `${d.cie10_name} (${d.cie10_code})`;
          }
          return d.cie10_name || d.cie10_code || "";
        })
        .filter(Boolean)
        .join(", ")
    : "-";

  const rxDateISO = visit.visit_date || new Date().toISOString();

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14, display: "grid", gap: 14 }}>
      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="mm-cardTitle">Receta</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Paciente: <b>{patient.name}</b> · CI: <b>{patient.cedula || "-"}</b> · Fecha:{" "}
              <b>{new Date(rxDateISO).toLocaleString("es-EC")}</b>
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
            <div className="mm-cardTitle">Vista previa (Receta)</div>
            <div className="mm-chip">PDF</div>
          </div>

          <div style={{ padding: 14 }}>
            <div ref={printRef}>
              {/* ✅ HEADER: Logo + ubicación a la IZQUIERDA | Datos doctor a la DERECHA */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8
              }}>
                {/* IZQUIERDA: Logo + ubicación */}
                <div style={{ flexShrink: 0 }}>
                  <img 
                    src="/logo-top.png" 
                    alt="Virgen de la Merced"
                    style={{
                      height: "132px",
                      width: "auto",
                      objectFit: "contain",
                      display: "block"
                    }}
                  />
                  <div style={{
                    fontSize: "9px",
                    color: "#555",
                    marginTop: 4,
                    lineHeight: 1.3
                  }}>
                    {doctor.place}, {fmtDateLong(rxDateISO)}<br/>
                    Tel: {CLINIC_PHONE}<br/>
                    {doctor.email}
                  </div>
                </div>

                {/* DERECHA: Datos del doctor */}
                <div style={{
                  textAlign: "right",
                  fontSize: "8.5px",
                  color: "#333",
                  lineHeight: 1.35,
                  fontWeight: 600
                }}>
                  <div>{doctor.fullName}</div>
                  <div>{doctor.specialty}</div>
                  <div>CÉDULA: {doctor.cedula}</div>
                  <div>REG. MÉDICO: {doctor.regMedico}</div>
                </div>
              </div>

              {/* TÍTULO */}
              <div style={{
                fontSize: 16,
                fontWeight: 700,
                textAlign: "center",
                margin: "12px 0 10px",
                color: "#2c3e50",
                textTransform: "uppercase",
                letterSpacing: "0.3px"
              }}>
                RECETA MÉDICA
              </div>

              {/* INFO DEL PACIENTE */}
              <div style={{
                fontSize: 11,
                lineHeight: 1.5,
                marginBottom: 12
              }}>
                <div style={{ marginBottom: 3 }}><b>Paciente:</b> {patient.name}</div>
                <div style={{ marginBottom: 3 }}><b>CI:</b> {patient.cedula || "-"} &nbsp;&nbsp; <b>Tel:</b> {patient.phone || CLINIC_PHONE}</div>
                <div style={{ marginBottom: 3 }}><b>Fecha de atención:</b> {fmtDateShort(rxDateISO)}</div>
                <div><b>Diagnóstico (CIE10):</b> {diag}</div>
              </div>

              {/* TABLA DE MEDICAMENTOS */}
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                margin: "8px 0",
                fontSize: 10
              }}>
                <thead>
                  <tr>
                    <th style={{
                      width: "40%",
                      border: "1px solid #ddd",
                      padding: 7,
                      textAlign: "left",
                      background: "#f1f3f5",
                      fontWeight: 600,
                      fontSize: 10
                    }}>
                      Medicamento
                    </th>
                    <th style={{
                      border: "1px solid #ddd",
                      padding: 7,
                      textAlign: "left",
                      background: "#f1f3f5",
                      fontWeight: 600,
                      fontSize: 10
                    }}>
                      Indicaciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(items || [])
                    .filter((x) => (x.med || "").trim() && (x.instructions || "").trim())
                    .map((x, idx) => (
                      <tr key={x.id ?? idx}>
                        <td style={{
                          border: "1px solid #ddd",
                          padding: 7,
                          verticalAlign: "top",
                          fontSize: "9.5px",
                          lineHeight: 1.4
                        }}>
                          {x.med}
                        </td>
                        <td style={{
                          border: "1px solid #ddd",
                          padding: 7,
                          verticalAlign: "top",
                          fontSize: "9.5px",
                          lineHeight: 1.4,
                          whiteSpace: "pre-wrap"
                        }}>
                          {x.instructions}
                        </td>
                      </tr>
                    ))}

                  {items.filter((x) => (x.med || "").trim() && (x.instructions || "").trim()).length === 0 && (
                    <tr>
                      <td 
                        colSpan={2} 
                        style={{
                          border: "1px solid #ddd",
                          padding: 7,
                          textAlign: "center",
                          opacity: 0.7,
                          fontSize: "9.5px"
                        }}
                      >
                        Aún no hay medicamentos válidos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* NOTAS ADICIONALES */}
              {rxNotes?.trim() ? (
                <div style={{
                  marginTop: 10,
                  padding: 7,
                  background: "#fffbf0",
                  borderLeft: "2px solid #f39c12",
                  fontSize: "9.5px",
                  lineHeight: 1.4
                }}>
                  <b style={{ color: "#e67e22" }}>Notas:</b> {rxNotes}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}