import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function cleanAllergiesData(value) {
  if (!value) return "";
  
  // Si ya es string, limpiar directamente
  if (typeof value === 'string') {
    return value
      .replace(/^\["|"\]$/g, '')     // Quita [" al inicio y "] al final
      .replace(/","/g, ', ')          // Reemplaza "," por coma y espacio
      .replace(/\\n/g, '\n')          // Reemplaza \n escapado por salto de línea real
      .replace(/\\\\/g, '')           // Quita backslashes escapados
      .trim();
  }
  
  // Si es array, unir con comas
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  
  // Si es otro tipo, convertir a string y limpiar
  return String(value)
    .replace(/^\["?|"?\]$/g, '')
    .replace(/"\s*,\s*"/g, ', ')
    .replace(/\\n/g, '\n')
    .replace(/\\/g, '')
    .trim();
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
  // Eliminadas las variables de contacto de emergencia que no existen en la BD
  // const [emergencyContact, setEmergencyContact] = useState("");
  // const [emergencyPhone, setEmergencyPhone] = useState("");

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
      // Eliminadas las líneas de emergency_contact y emergency_phone
      // setEmergencyContact(patient.emergency_contact || "");
      // setEmergencyPhone(patient.emergency_phone || "");
    }
  }, [isOpen, patient]);

  // Calcular edad automáticamente desde fecha de nacimiento
  useEffect(() => {
    if (birthdate) {
      const birthDate = new Date(birthdate);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      if (calculatedAge >= 0 && calculatedAge <= 150) {
        setAge(String(calculatedAge));
      }
    }
  }, [birthdate]);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!name.trim()) {
      alert("El nombre es obligatorio");
      return;
    }

    // Validar email si se proporciona
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      alert("El email no es válido");
      return;
    }

    setLoading(true);

    try {
      const safeAge = age?.trim() ? parseInt(age) : null;
      
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
        // Eliminadas las columnas que no existen
        // emergency_contact: emergencyContact?.trim() || null,
        // emergency_phone: emergencyPhone?.trim() || null,
      };

      const { error } = await supabase
        .from("patients")
        .update(updateData)
        .eq("id", patient.id);

      if (error) {
        if (error.code === '23505') {
          alert("Ya existe un paciente con esta cédula");
        } else {
          throw error;
        }
        return;
      }

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
    <div 
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px"
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: "white",
          borderRadius: "18px",
          maxWidth: "900px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.3)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px",
          borderBottom: "1px solid #e0e0e0",
          background: "linear-gradient(90deg, rgba(93, 173, 226, 0.16), rgba(72, 201, 176, 0.10))"
        }}>
          <h2 style={{ fontSize: "20px", fontWeight: 900, margin: 0, color: "#0f172a" }}>
            Editar Paciente
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "32px",
              cursor: "pointer",
              color: "#666",
              padding: 0,
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1
            }}
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "20px", maxHeight: "calc(90vh - 140px)", overflowY: "auto" }}>
            <div style={{ display: "grid", gap: 16 }}>
              {/* INFORMACIÓN BÁSICA */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Información Básica</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label htmlFor="patient-name" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                      Nombre completo *
                    </label>
                    <input
                      id="patient-name"
                      className="mm-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label htmlFor="patient-cedula" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                        Cédula
                      </label>
                      <input
                        id="patient-cedula"
                        className="mm-input"
                        value={cedula}
                        onChange={(e) => setCedula(e.target.value)}
                        maxLength="15"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label htmlFor="patient-birthdate" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                        Fecha de nacimiento
                      </label>
                      <input
                        id="patient-birthdate"
                        className="mm-input"
                        type="date"
                        value={birthdate}
                        onChange={(e) => setBirthdate(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label htmlFor="patient-age" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                        Edad
                      </label>
                      <input
                        id="patient-age"
                        className="mm-input"
                        type="number"
                        min="0"
                        max="150"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="Años"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label htmlFor="patient-sex" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                        Sexo
                      </label>
                      <select
                        id="patient-sex"
                        className="mm-input"
                        value={sex}
                        onChange={(e) => setSex(e.target.value)}
                        disabled={loading}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="patient-bloodtype" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                      Tipo de sangre
                    </label>
                    <select
                      id="patient-bloodtype"
                      className="mm-input"
                      value={bloodType}
                      onChange={(e) => setBloodType(e.target.value)}
                      disabled={loading}
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
                      <label htmlFor="patient-phone" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                        Teléfono
                      </label>
                      <input
                        id="patient-phone"
                        className="mm-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength="20"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label htmlFor="patient-email" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                        Email
                      </label>
                      <input
                        id="patient-email"
                        className="mm-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="patient-address" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                      Dirección
                    </label>
                    <input
                      id="patient-address"
                      className="mm-input"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* INFORMACIÓN MÉDICA */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Información Médica</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label htmlFor="patient-allergies" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                      Alergias
                    </label>
                    <textarea
                      id="patient-allergies"
                      className="mm-input"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      rows={3}
                      placeholder="Ej: Penicilina, Polen, Mariscos"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="patient-medical-history" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#374151" }}>
                      Historial médico
                    </label>
                    <textarea
                      id="patient-medical-history"
                      className="mm-input"
                      value={medicalHistory}
                      onChange={(e) => setMedicalHistory(e.target.value)}
                      rows={3}
                      placeholder="Enfermedades previas, cirugías, medicación actual..."
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* La sección de Contacto de Emergencia ha sido eliminada porque esas columnas no existen en la BD */}
            </div>
          </div>

          <div style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            padding: "20px",
            borderTop: "1px solid #e0e0e0",
            background: "#f9fafb"
          }}>
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