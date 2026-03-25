import { useMemo, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function toTextArray(csv) {
  const s = (csv || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// ✅ NUEVA: Función para limpiar datos corruptos
function cleanAllergiesData(value) {
  if (!value) return "";
  
  let cleaned = value;
  
  // Si es array, procesar
  if (Array.isArray(value)) {
    cleaned = value.join(", ");
  }
  
  // Convertir a string
  cleaned = String(cleaned);
  
  // Limpiar todos los escapes y caracteres JSON
  cleaned = cleaned
    .replace(/\\\\/g, '')        // Eliminar \\ 
    .replace(/\\"/g, '"')        // Convertir \" a "
    .replace(/\\n/g, '\n')       // Convertir \n a salto de línea
    .replace(/\["/g, '')         // Eliminar ["
    .replace(/"]/g, '')          // Eliminar "]
    .replace(/^\[/g, '')         // Eliminar [ al inicio
    .replace(/]$/g, '')          // Eliminar ] al final
    .replace(/^"/g, '')          // Eliminar " al inicio
    .replace(/"$/g, '')          // Eliminar " al final
    .replace(/","/g, ', ')       // Convertir "," a ,
    .replace(/"\s*,\s*"/g, ', ') // Convertir " , " a ,
    .trim();
  
  return cleaned;
}

function toCSV(value) {
  return cleanAllergiesData(value);
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

export default function PatientEditModal({ open, patient, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [sex, setSex] = useState("F");
  const [cedula, setCedula] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [ageManual, setAgeManual] = useState("");
  const [allergiesCSV, setAllergiesCSV] = useState("");
  const [notes, setNotes] = useState("");

  // ✅ Cargar datos del paciente cuando se abre el modal
  useEffect(() => {
    if (!open || !patient) {
      setName("");
      setSex("F");
      setCedula("");
      setPhone("");
      setBirthdate("");
      setAgeManual("");
      setAllergiesCSV("");
      setNotes("");
      return;
    }

    setName(patient.name || "");
    setSex(patient.sex || "F");
    setCedula(patient.cedula || "");
    setPhone(patient.phone || "");
    
    if (patient.birthdate) {
      const dateStr = String(patient.birthdate);
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        setBirthdate(dateStr);
      } else {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          setBirthdate(`${year}-${month}-${day}`);
        } else {
          setBirthdate("");
        }
      }
    } else {
      setBirthdate("");
    }
    
    setAgeManual(patient.age ? String(patient.age) : "");
    
    // ✅ LIMPIEZA AUTOMÁTICA de datos corruptos
    setAllergiesCSV(cleanAllergiesData(patient.allergies));
    
    // ✅ TAMBIÉN limpiar notas si tienen escapes
    setNotes(cleanAllergiesData(patient.notes));
  }, [open, patient]);

  const autoAge = useMemo(() => calcAgeFromBirthdate(birthdate), [birthdate]);

  useEffect(() => {
    if (birthdate) setAgeManual("");
  }, [birthdate]);

  const ageManualNum = useMemo(() => {
    const s = String(ageManual || "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [ageManual]);

  const canSave = useMemo(() => {
    if (!patient?.id) return false;
    const hasName = name.trim().length >= 3;
    const hasBirthOrAge = Boolean(birthdate) || ageManualNum !== null;
    return hasName && hasBirthOrAge && !saving;
  }, [patient, name, birthdate, ageManualNum, saving]);

  const displayedAgeValue = useMemo(() => {
    if (birthdate && autoAge !== null) return String(autoAge);
    return String(ageManual || "");
  }, [birthdate, autoAge, ageManual]);

  async function save() {
    if (!canSave) return;

    setSaving(true);

    const calculatedAge = birthdate ? calcAgeFromBirthdate(birthdate) : ageManualNum;

    // ✅ Convertir alergias: texto limpio → array simple
    const allergiesArray = toTextArray(allergiesCSV);

    const payload = {
      name: name.trim(),
      sex,
      cedula: cedula.trim() || null,
      phone: phone.trim() || null,
      birthdate: birthdate || null,
      age: calculatedAge,
      allergies: allergiesArray.length > 0 ? allergiesArray : null,
      notes: notes.trim() || null,
    };

    const { error } = await supabase.from("patients").update(payload).eq("id", patient.id);

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message || "Error actualizando paciente");
      return;
    }

    onSaved?.();
    onClose?.();
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "grid",
        placeItems: "center",
        padding: 14,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mm-card"
        style={{ width: "min(760px, 100%)" }}
      >
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div className="mm-cardTitle">Editar paciente</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn mm-btn--ghost" type="button" onClick={onClose}>
              Cerrar
            </button>
            <button className="mm-btn" type="button" onClick={save} disabled={!canSave}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <input
            className="mm-input"
            placeholder="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />

          <div className="mm-row">
            <input
              className="mm-input"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              disabled={saving}
              title="Fecha de nacimiento"
            />

            <input
              className="mm-input"
              type="number"
              min={0}
              step={1}
              placeholder="Edad (si no hay fecha)"
              value={displayedAgeValue}
              onChange={(e) => setAgeManual(e.target.value)}
              disabled={saving || Boolean(birthdate)}
              title={birthdate ? "Se calcula desde la fecha de nacimiento" : "Edad manual solo si no hay fecha"}
            />
          </div>

          <div className="mm-hint" style={{ marginTop: -6 }}>
            Edad calculada: <b>{birthdate ? ageLabelFromBirthdate(birthdate) : (ageManualNum !== null ? `${ageManualNum} año(s)` : "-")}</b>
          </div>

          <div className="mm-row">
            <input
              className="mm-input"
              placeholder="Cédula (opcional)"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              disabled={saving}
            />

            <select
              className="mm-input"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              disabled={saving}
            >
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
            </select>
          </div>

          <input
            className="mm-input"
            placeholder="Teléfono (ej: 0991234567)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={saving}
          />

          <textarea
            className="mm-input"
            placeholder="Alergias (separa con comas). Ej: Penicilina, Mariscos"
            value={allergiesCSV}
            onChange={(e) => setAllergiesCSV(e.target.value)}
            disabled={saving}
            style={{ minHeight: 80, paddingTop: 10, resize: "vertical", whiteSpace: "pre-wrap" }}
          />

          <textarea
            className="mm-input"
            placeholder="Notas / Evolución (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
            style={{ minHeight: 110, paddingTop: 10, resize: "vertical", whiteSpace: "pre-wrap" }}
          />

          <div className="mm-hint" style={{ margin: 0 }}>
            La cédula es opcional. Si no se conoce, el sistema permite guardar sin ese dato.
          </div>
        </div>
      </div>
    </div>
  );
}