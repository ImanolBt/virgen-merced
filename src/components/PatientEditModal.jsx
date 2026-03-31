import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

export default function PatientEditModal({ isOpen, onClose, patient, onSuccess }) {
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState("");
  const [cedula, setCedula] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  useEffect(() => {
    if (isOpen && patient) {
      setName(patient.name || "");
      setCedula(patient.cedula || "");
      setBirthdate(patient.birthdate || "");
      setAge(patient.age ? String(patient.age) : "");
      setSex(patient.sex || "");
      setPhone(patient.phone || "");
      setEmail(patient.email || "");
      setAddress(patient.address || "");
      setBloodType(patient.blood_type || "");
      setAllergies(cleanAllergiesData(patient.allergies));
      setMedicalHistory(patient.medical_history || "");
      setEmergencyContact(patient.emergency_contact || "");
      setEmergencyPhone(patient.emergency_phone || "");
    } else if (!isOpen) {
      setName("");
      setCedula("");
      setBirthdate("");
      setAge("");
      setSex("");
      setPhone("");
      setEmail("");
      setAddress("");
      setBloodType("");
      setAllergies("");
      setMedicalHistory("");
      setEmergencyContact("");
      setEmergencyPhone("");
    }
  }, [isOpen, patient]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      alert("El nombre es obligatorio");
      return;
    }

    setLoading(true);

    try {
      // PROTEGER CAMPOS NUMÉRICOS CONTRA OVERFLOW
      const safeAge = age?.trim() ? parseInt(age) : null;
      
      // Validar que age sea un número válido y no exceda límites
      if (safeAge !== null && (isNaN(safeAge) || safeAge < 0 || safeAge > 150)) {
        alert("La edad debe ser un número válido entre 0 y 150");
        setLoading(false);
        return;
      }

      const updateData = {
        name: name.trim(),
        cedula: cedula?.trim() || null,
        birthdate: birthdate || null,
        age: safeAge,
        sex: sex || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        blood_type: bloodType || null,
        allergies: allergies?.trim() || null,
        medical_history: medicalHistory?.trim() || null,
        emergency_contact: emergencyContact?.trim() || null,
        emergency_phone: emergencyPhone?.trim() || null,
      };

      const { error } = await supabase
        .from("patients")
        .update(updateData)
        .eq("id", patient.id);

      if (error) throw error;

      alert("Paciente actualizado correctamente");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error al actualizar paciente:", error);
      alert(error.message || "Error al actualizar el paciente");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="mm-modal" onClick={onClose}>
      <div className="mm-modalContent" onClick={(e) => e.stopPropagation()}>
        <div className="mm-modalHeader">
          <h2 className="mm-modalTitle">Editar Paciente</h2>
          <button className="mm-modalClose" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mm-modalBody">
            <div style={{ display: "grid", gap: 16 }}>
              {/* INFORMACIÓN BÁSICA */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Información Básica</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label className="mm-label">Nombre completo *</label>
                    <input
                      className="mm-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="mm-label">Cédula</label>
                      <input
                        className="mm-input"
                        value={cedula}
                        onChange={(e) => setCedula(e.target.value)}
                        maxLength="15"
                      />
                    </div>
                    <div>
                      <label className="mm-label">Fecha de nacimiento</label>
                      <input
                        className="mm-input"
                        type="date"
                        value={birthdate}
                        onChange={(e) => setBirthdate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="mm-label">Edad</label>
                      <input
                        className="mm-input"
                        type="number"
                        min="0"
                        max="150"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="Años"
                      />
                    </div>
                    <div>
                      <label className="mm-label">Sexo</label>
                      <select
                        className="mm-input"
                        value={sex}
                        onChange={(e) => setSex(e.target.value)}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mm-label">Tipo de sangre</label>
                    <select
                      className="mm-input"
                      value={bloodType}
                      onChange={(e) => setBloodType(e.target.value)}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* CONTACTO */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Contacto</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="mm-label">Teléfono</label>
                      <input
                        className="mm-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength="20"
                      />
                    </div>
                    <div>
                      <label className="mm-label">Email</label>
                      <input
                        className="mm-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mm-label">Dirección</label>
                    <input
                      className="mm-input"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* INFORMACIÓN MÉDICA */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Información Médica</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label className="mm-label">Alergias</label>
                    <textarea
                      className="mm-input"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      rows={3}
                      placeholder="Ej: Penicilina, Polen, Mariscos"
                    />
                  </div>

                  <div>
                    <label className="mm-label">Historial médico</label>
                    <textarea
                      className="mm-input"
                      value={medicalHistory}
                      onChange={(e) => setMedicalHistory(e.target.value)}
                      rows={3}
                      placeholder="Enfermedades previas, cirugías, medicación actual..."
                    />
                  </div>
                </div>
              </div>

              {/* CONTACTO DE EMERGENCIA */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Contacto de Emergencia</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="mm-label">Nombre</label>
                    <input
                      className="mm-input"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mm-label">Teléfono</label>
                    <input
                      className="mm-input"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      maxLength="20"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mm-modalFooter">
            <button
              type="button"
              className="mm-btn mm-btn--ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="mm-btn"
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}