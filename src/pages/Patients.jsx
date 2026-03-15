import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

import PatientForm from "../components/PatientForm";
import PatientList from "../components/PatientList";

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState("");

  async function loadPatients() {
    setLoading(true);

    const { data, error } = await supabase
      .from("patients")
      .select("id, name, cedula, phone, sex, birthdate, notes, allergies, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(error.message);
      setPatients([]);
      setLoading(false);
      return;
    }

    setPatients(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPatients();
  }, []);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    if (!s) return patients;

    return patients.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const cedula = (p.cedula || "").toLowerCase();
      const phone = (p.phone || "").toLowerCase();
      return name.includes(s) || cedula.includes(s) || phone.includes(s);
    });
  }, [q, patients]);

  async function addPatient(payload) {
    setSaving(true);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;

    const toInsert = {
      ...payload,
      created_by: userId,
    };

    const { error } = await supabase.from("patients").insert(toInsert);

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await loadPatients();
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 14px 30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "10px 0 4px" }}>Pacientes</h1>
          <div style={{ opacity: 0.75 }}>Pacientes registrados: {patients.length}</div>
        </div>

        <input
          className="mm-search"
          placeholder="Buscar por nombre / cédula / teléfono..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="mm-grid">
        <section className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Nuevo paciente</div>
            <div className="mm-chip">{saving ? "Guardando..." : "Virgen de la Merced"}</div>
          </div>

          <PatientForm onCreate={addPatient} disabled={saving} />
        </section>

        <section className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Lista</div>
            <div className="mm-chip">{loading ? "Cargando..." : `${filtered.length} visibles`}</div>
          </div>

          <div className="mm-listArea">
            <PatientList loading={loading} patients={filtered} onRefresh={loadPatients} />
          </div>
        </section>
      </div>
    </div>
  );
}
