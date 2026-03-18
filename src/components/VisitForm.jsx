import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Cie10MultiPicker from "./Cie10MultiPicker";

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

function calcBMI(weightKg, heightCm) {
  const w = Number(weightKg);
  const hcm = Number(heightCm);
  if (!Number.isFinite(w) || !Number.isFinite(hcm) || w <= 0 || hcm <= 0) return null;
  const hm = hcm / 100;
  const bmi = w / (hm * hm);
  if (!Number.isFinite(bmi)) return null;
  return Math.round(bmi * 100) / 100;
}

export default function VisitForm({ patientId, onCreated }) {
  const [saving, setSaving] = useState(false);

  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return iso;
  });

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [diags, setDiags] = useState([]);

  // 📸 NUEVO: Imagen de la consulta
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [patient, setPatient] = useState(null);
  const [age, setAge] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadPatient() {
      if (!patientId) return;
      const p = await supabase
        .from("patients")
        .select("id, birthdate, sex")
        .eq("id", patientId)
        .single();

      if (!p.error && mounted) {
        setPatient(p.data);
        setAge(calcAgeFromBirthdate(p.data.birthdate));
      } else if (mounted) {
        setPatient(null);
        setAge(null);
      }
    }

    loadPatient();
    return () => {
      mounted = false;
    };
  }, [patientId]);

  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [spo2, setSpo2] = useState("");
  const [tempC, setTempC] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");

  const [growthPercentile, setGrowthPercentile] = useState("");
  const [growthNote, setGrowthNote] = useState("");

  const [omsOpen, setOmsOpen] = useState(false);
  const [omsSex, setOmsSex] = useState("M");
  const [omsAgeMonths, setOmsAgeMonths] = useState("");
  const [omsIndicator, setOmsIndicator] = useState("bmi_age");

  const liveBMI = useMemo(() => calcBMI(weightKg, heightCm), [weightKg, heightCm]);

  const canSave = useMemo(() => {
    return patientId && reason.trim().length >= 3 && diags.length > 0;
  }, [patientId, reason, diags]);

  // 📸 HANDLER DE IMAGEN
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Por favor seleccione una imagen');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('La imagen no debe superar 10MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  function openOms() {
    const sx = patient?.sex === "F" ? "F" : "M";
    setOmsSex(sx);
    setOmsOpen(true);
  }

  function applyOms() {
    const indLabel =
      omsIndicator === "bmi_age"
        ? "IMC/Edad"
        : omsIndicator === "weight_age"
          ? "Peso/Edad"
          : "Talla/Edad";

    const px = (growthPercentile || "").toString().trim();
    const m = (omsAgeMonths || "").toString().trim();

    const noteParts = [];
    if (m) noteParts.push(`Edad: ${m} meses`);
    noteParts.push(`Sexo: ${omsSex === "F" ? "Niña" : "Niño"}`);
    noteParts.push(`Indicador: ${indLabel}`);

    const extra = growthNote?.trim();
    const base = noteParts.join(" · ");

    setGrowthNote(extra ? `${base} · ${extra}` : base);
    setOmsOpen(false);
  }

  function resetForm() {
    setVisitDate(() => {
      const d = new Date();
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      return iso;
    });
    setReason("");
    setNotes("");
    setDiags([]);
    setImageFile(null);
    setImagePreview(null);

    setBpSys("");
    setBpDia("");
    setHeartRate("");
    setSpo2("");
    setTempC("");
    setWeightKg("");
    setHeightCm("");

    setGrowthPercentile("");
    setGrowthNote("");
  }

  async function createVisit(e) {
    e.preventDefault();
    if (!canSave || saving) return;

    setSaving(true);

    try {
      // 📸 1) Subir imagen si existe
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('consultation-images')
          .upload(fileName, imageFile);
        
        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          alert('Error al subir imagen, pero continuaremos guardando la consulta');
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('consultation-images')
            .getPublicUrl(fileName);
          imageUrl = publicUrl;
        }
      }

      // 2) Crear visita con imagen
      const visitPayload = {
        patient_id: patientId,
        visit_date: visitDate ? new Date(visitDate).toISOString() : new Date().toISOString(),
        reason: reason.trim(),
        notes: notes.trim() || null,
        consultation_image_url: imageUrl,

        bp_sys: bpSys !== "" ? Number(bpSys) : null,
        bp_dia: bpDia !== "" ? Number(bpDia) : null,
        hr: heartRate !== "" ? Number(heartRate) : null,
        spo2: spo2 !== "" ? Number(spo2) : null,
        temp_c: tempC !== "" ? Number(tempC) : null,
        weight_kg: weightKg !== "" ? Number(weightKg) : null,
        height_cm: heightCm !== "" ? Number(heightCm) : null,

        bmi: age !== null && age >= 10 ? (liveBMI ?? null) : null,
        growth_percentile: growthPercentile !== "" ? Number(growthPercentile) : null,
        growth_note: (growthNote || "").trim() ? growthNote.trim() : null,
      };

      const { data: visitData, error: visitError } = await supabase
        .from("medical_visits")
        .insert(visitPayload)
        .select("id")
        .single();

      if (visitError) {
        console.error(visitError);
        alert(visitError.message || "Error guardando consulta");
        setSaving(false);
        return;
      }

      const visitId = visitData.id;

      // 3) Guardar diagnósticos
      if (diags.length > 0) {
        const diagPayload = diags.map((d) => ({
          visit_id: visitId,
          cie10_code: d.code,
          cie10_name: d.name,
        }));

        const { error: diagError } = await supabase
          .from("medical_visit_diagnoses")
          .insert(diagPayload);

        if (diagError) {
          console.error(diagError);
          alert("La consulta se creó, pero falló guardar algunos diagnósticos.");
        }
      }

      setSaving(false);
      resetForm();
      onCreated?.();
      
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
      setSaving(false);
    }
  }

  return (
    <>
      <form className="mm-card mm-form" onSubmit={createVisit}>
        <div className="mm-cardHead">
          <div className="mm-cardTitle">Nueva consulta</div>
          <div className="mm-chip">{saving ? "Guardando..." : "Virgen de la Merced"}</div>
        </div>

        <div className="mm-row">
          <input
            className="mm-input"
            type="datetime-local"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            disabled={saving}
            title="Fecha y hora"
          />

          <input
            className="mm-input"
            placeholder="Motivo de consulta (ej: dolor de garganta, fiebre...)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={saving}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Cie10MultiPicker selected={diags} onChange={setDiags} disabled={saving} />
          <div className="mm-hint" style={{ marginTop: 6 }}>
            Puedes seleccionar múltiples diagnósticos CIE10
          </div>
        </div>

        <textarea
          className="mm-input"
          placeholder="Notas / evolución clínica (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{
            minHeight: "120px",
            resize: "vertical",
            paddingTop: "10px",
            lineHeight: "1.5"
          }}
          disabled={saving}
        />

        {/* 📸 CAMPO DE IMAGEN */}
        <div style={{ marginTop: '16px' }}>
          <label style={{ 
            display: 'block', 
            fontWeight: 600, 
            marginBottom: '8px',
            color: '#2c3e50',
            fontSize: '14px'
          }}>
            📸 Imagen de la consulta <span style={{ fontWeight: 400, color: '#999', fontSize: '12px' }}>(resultados, exámenes, etc. - opcional)</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={saving}
            style={{
              width: '100%',
              padding: '12px',
              border: '2px dashed #ccc',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: saving ? '#f5f5f5' : 'white',
              fontSize: '14px'
            }}
          />
          <p style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>
            Ej: radiografías, laboratorios, electrocardiogramas. Máx: 10MB
          </p>
          
          {imagePreview && (
            <div style={{ 
              marginTop: '12px', 
              textAlign: 'center',
              padding: '12px',
              background: '#f8f9fa',
              borderRadius: '8px'
            }}>
              <img 
                src={imagePreview} 
                alt="Preview" 
                style={{
                  maxWidth: '300px',
                  maxHeight: '200px',
                  borderRadius: '6px',
                  objectFit: 'contain',
                  border: '2px solid #3ea99f'
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
                disabled={saving}
                style={{
                  display: 'block',
                  margin: '10px auto 0',
                  padding: '6px 14px',
                  background: '#ff5252',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                ✕ Eliminar
              </button>
            </div>
          )}
        </div>

        {/* SIGNOS VITALES (sin cambios) */}
        <div className="mm-card" style={{ padding: 14, marginTop: 10 }}>
          <div className="mm-cardTitle" style={{ marginBottom: 10 }}>
            Signos vitales
          </div>

          <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Presión arterial (mmHg)</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  className="mm-input"
                  placeholder="Sistólica"
                  value={bpSys}
                  onChange={(e) => setBpSys(e.target.value)}
                  disabled={saving}
                />
                <input
                  className="mm-input"
                  placeholder="Diastólica"
                  value={bpDia}
                  onChange={(e) => setBpDia(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Frecuencia cardiaca (lpm)</div>
              <input
                className="mm-input"
                placeholder="Ej: 78"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Saturación O2 (%)</div>
              <input
                className="mm-input"
                placeholder="Ej: 98"
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                disabled={saving}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Temperatura (°C)</div>
              <input
                className="mm-input"
                placeholder="Ej: 36.7"
                value={tempC}
                onChange={(e) => setTempC(e.target.value)}
                disabled={saving}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Edad</div>
              <div className="mm-input" style={{ display: "flex", alignItems: "center", opacity: 0.9 }}>
                {age === null ? "—" : `${age} años`}
              </div>
            </div>
          </div>

          <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Peso (kg)</div>
              <input
                className="mm-input"
                placeholder="Ej: 70"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                disabled={saving}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Talla (cm)</div>
              <input
                className="mm-input"
                placeholder="Ej: 170"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                disabled={saving}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {age !== null && age >= 10 ? "IMC (automático)" : "Curvas OMS (<10)"}
              </div>

              {age !== null && age >= 10 ? (
                <div className="mm-input" style={{ display: "flex", alignItems: "center", fontWeight: 900 }}>
                  {liveBMI ?? "—"}
                </div>
              ) : (
                <div
                  style={{
                    border: "1px solid rgba(0,0,0,.08)",
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(150,179,74,.10)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.35 }}>
                    Menores de 10: registrar percentil OMS (manual). Si quieres, abre la tabla y guarda el dato.
                  </div>

                  <button
                    className="mm-btn mm-btn--ghost"
                    type="button"
                    onClick={openOms}
                    disabled={saving}
                    style={{ justifySelf: "start" }}
                  >
                    Ver tabla OMS
                  </button>
                </div>
              )}
            </div>
          </div>

          {age !== null && age < 10 ? (
            <div className="mm-row" style={{ gridTemplateColumns: "1fr 2fr" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Percentil OMS (0–100)</div>
                <input
                  className="mm-input"
                  placeholder="Ej: 50"
                  value={growthPercentile}
                  onChange={(e) => setGrowthPercentile(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Nota (OMS)</div>
                <input
                  className="mm-input"
                  placeholder="Ej: P10, riesgo bajo peso, etc."
                  value={growthNote}
                  onChange={(e) => setGrowthNote(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          ) : null}
        </div>

        <button 
          className="mm-btn" 
          disabled={!canSave || saving} 
          style={{ marginTop: 10 }}
        >
          {saving ? "Guardando..." : "Guardar consulta"}
        </button>

        <div className="mm-hint">
          Requisito: motivo + al menos un diagnóstico CIE10 seleccionado.
          {diags.length > 0 && ` (${diags.length} diagnóstico${diags.length > 1 ? 's' : ''} seleccionado${diags.length > 1 ? 's' : ''})`}
        </div>
      </form>

      {/* MODAL OMS (sin cambios) */}
      {omsOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOmsOpen(false);
          }}
        >
          <div
            className="mm-card"
            style={{
              width: "min(720px, 100%)",
              borderRadius: 18,
              overflow: "hidden",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="mm-cardTitle">Curvas OMS (registro manual)</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Selecciona datos y guarda el percentil.
                </div>
              </div>

              <button className="mm-btn mm-btn--ghost" type="button" onClick={() => setOmsOpen(false)}>
                Cerrar
              </button>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 12 }}>
              <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Sexo</div>
                  <select
                    className="mm-input"
                    value={omsSex}
                    onChange={(e) => setOmsSex(e.target.value)}
                  >
                    <option value="M">Niño</option>
                    <option value="F">Niña</option>
                  </select>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Edad (meses)</div>
                  <input
                    className="mm-input"
                    placeholder="Ej: 36"
                    value={omsAgeMonths}
                    onChange={(e) => setOmsAgeMonths(e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Indicador</div>
                  <select
                    className="mm-input"
                    value={omsIndicator}
                    onChange={(e) => setOmsIndicator(e.target.value)}
                  >
                    <option value="bmi_age">IMC / Edad</option>
                    <option value="weight_age">Peso / Edad</option>
                    <option value="height_age">Talla / Edad</option>
                  </select>
                </div>
              </div>

              <div className="mm-row" style={{ gridTemplateColumns: "1fr 2fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Percentil (0–100)</div>
                  <input
                    className="mm-input"
                    placeholder="Ej: 50"
                    value={growthPercentile}
                    onChange={(e) => setGrowthPercentile(e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Nota social/clinica (opcional)</div>
                  <input
                    className="mm-input"
                    placeholder="Ej: P10, riesgo bajo peso, etc."
                    value={growthNote}
                    onChange={(e) => setGrowthNote(e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  border: "1px dashed rgba(0,0,0,.18)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(0,0,0,.02)",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                Aquí normalmente se consulta la curva OMS y se toma el percentil correspondiente.
                En esta versión, lo registras manual para que el sistema quede funcional y quede guardado en la consulta.
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="mm-btn mm-btn--ghost" type="button" onClick={() => setOmsOpen(false)}>
                  Cancelar
                </button>
                <button className="mm-btn" type="button" onClick={applyOms}>
                  Guardar percentil
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}