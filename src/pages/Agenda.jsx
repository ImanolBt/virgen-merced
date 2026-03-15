import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/** ===== Helpers ===== */
const STATUS = [
  { v: "scheduled", t: "Programada" },
  { v: "pending", t: "Pendiente" },
  { v: "confirmed", t: "Confirmada" },
  { v: "done", t: "Hecha" },
  { v: "completed", t: "Completada" },
  { v: "cancelled", t: "Cancelada" },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLocalDateInputValue(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function toLocalDateTimeInputValue(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

// "YYYY-MM-DDTHH:mm" (local) -> ISO UTC
function localDateTimeToIso(dtLocal) {
  const d = new Date(dtLocal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatLocalDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function formatDateOnly(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString('es-EC', { 
    day: '2-digit',
    month: 'short',
    year: 'numeric' 
  });
}

function formatTimeOnly(timeStr) {
  if (!timeStr) return "-";
  return timeStr.substring(0, 5);
}

function digitsOnly(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function toE164Ecuador(phoneRaw) {
  const digits = digitsOnly(phoneRaw);
  if (!digits) return "";
  if (digits.startsWith("593")) return digits;
  if (digits.startsWith("0") && digits.length >= 10) {
    return "593" + digits.slice(1);
  }
  if (digits.startsWith("9") && digits.length >= 9) {
    return "593" + digits;
  }
  return digits;
}

function openWhatsApp({ phone, text }) {
  const msg = encodeURIComponent(text || "");
  const e164 = toE164Ecuador(phone);

  if (!e164 || e164.length < 11) {
    alert("Número inválido. Guarda el teléfono como 09xxxxxxxx o +5939xxxxxxxx.");
    return;
  }

  const url = `https://wa.me/${e164}?text=${msg}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function startOfWeekLocal(dateStr) {
  const d = new Date(`${dateStr}T00:00`);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeekLocal(dateStr) {
  const s = startOfWeekLocal(dateStr);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function buildCitaText({ patientName, whenLocal, reason }) {
  return `Virgen de la Merced - Cita agendada

Paciente: ${patientName}
Fecha/Hora: ${whenLocal}
Motivo: ${reason}

Por favor confirmar asistencia.`;
}

function buildReminderText({ patientName, whenLocal, reason }) {
  return `Virgen de la Merced - Recordatorio

Paciente: ${patientName}
Recuerda tu cita:
Fecha/Hora: ${whenLocal}
Motivo: ${reason}

Gracias.`;
}

/** ===== Page ===== */
export default function Agenda() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("day");
  const [day, setDay] = useState(() => toLocalDateInputValue(new Date()));
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [startAtLocal, setStartAtLocal] = useState(() =>
    toLocalDateTimeInputValue(new Date())
  );
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editStartLocal, setEditStartLocal] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("scheduled");

  const selectedPatient = useMemo(() => {
    const idNum = Number(patientId);
    return patients.find((p) => p.id === idNum) || null;
  }, [patientId, patients]);

  const canCreate = useMemo(() => {
    const okPatient = !!patientId;
    const okReason = reason.trim().length >= 3;
    const iso = localDateTimeToIso(startAtLocal);
    return okPatient && okReason && !!iso && !saving;
  }, [patientId, reason, startAtLocal, saving]);

  async function loadPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("id, name, phone, cedula")
      .order("name", { ascending: true });

    if (error) throw error;
    setPatients(data || []);
    if (!patientId && data && data.length > 0) setPatientId(String(data[0].id));
  }

  async function loadAppointments() {
  try {
    let oldStyleAppointments = [];
    let newStyleAppointments = [];

    // Cargar citas estilo antiguo (con start_at) - SOLO las que tienen start_at
    if (mode === "day") {
      const startLocal = new Date(`${day}T00:00`);
      const endLocal = new Date(`${day}T23:59:59`);
      const { data: oldData } = await supabase
        .from("appointments")
        .select("id, patient_id, start_at, end_at, reason, notes, status, created_via, patients(name, phone, cedula)")
        .not("start_at", "is", null)
        .is("appointment_date", null) // IMPORTANTE: Excluir las del formulario web
        .gte("start_at", startLocal.toISOString())
        .lte("start_at", endLocal.toISOString())
        .order("start_at", { ascending: true });

      oldStyleAppointments = oldData || [];
    } else {
      const ws = startOfWeekLocal(day);
      const we = endOfWeekLocal(day);
      const { data: oldData } = await supabase
        .from("appointments")
        .select("id, patient_id, start_at, end_at, reason, notes, status, created_via, patients(name, phone, cedula)")
        .not("start_at", "is", null)
        .is("appointment_date", null) // IMPORTANTE: Excluir las del formulario web
        .gte("start_at", ws.toISOString())
        .lte("start_at", we.toISOString())
        .order("start_at", { ascending: true });

      oldStyleAppointments = oldData || [];
    }

    // Cargar citas estilo nuevo (con appointment_date + appointment_time) - SOLO del día seleccionado
    const { data: newData } = await supabase
      .from("appointments")
      .select("*")
      .not("appointment_date", "is", null)
      .eq("appointment_date", day)
      .order("appointment_time", { ascending: true });

    newStyleAppointments = newData || [];

    // Unificar todo
    const unified = [
      ...oldStyleAppointments.map(item => ({
        ...item,
        type: 'old',
        displayName: item.patients?.name || 'Paciente',
        displayPhone: item.patients?.phone || '-',
        displayDate: formatLocalDateTime(item.start_at),
        displayReason: item.reason
      })),
      ...newStyleAppointments.map(item => ({
        ...item,
        type: 'new',
        displayName: item.patient_name || 'Paciente',
        displayPhone: item.patient_phone || '-',
        displayDate: `${formatDateOnly(item.appointment_date)} ${formatTimeOnly(item.appointment_time)}`,
        displayReason: item.appointment_type || item.reason
      }))
    ];

    // Ordenar por fecha
    unified.sort((a, b) => {
      const dateA = a.type === 'old' ? new Date(a.start_at) : new Date(`${a.appointment_date}T${a.appointment_time}`);
      const dateB = b.type === 'old' ? new Date(b.start_at) : new Date(`${b.appointment_date}T${b.appointment_time}`);
      return dateA - dateB;
    });

    setItems(unified);
  } catch (e) {
    console.error(e);
    alert(e?.message || "Error cargando citas");
  }
}

  async function reloadAll() {
    setLoading(true);
    try {
      await loadPatients();
      await loadAppointments();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error cargando agenda");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadAppointments();
      } catch (e) {
        console.error(e);
        alert(e?.message || "Error cargando citas");
      } finally {
        setLoading(false);
      }
    })();
  }, [day, mode]);

  async function createAppointment(e) {
    e.preventDefault();
    if (!canCreate) return;

    const startIso = localDateTimeToIso(startAtLocal);
    if (!startIso) return alert("Fecha/hora inválida");

    setSaving(true);
    try {
      const payload = {
        patient_id: Number(patientId),
        start_at: startIso,
        reason: reason.trim(),
        notes: notes.trim() || null,
        status: "scheduled",
      };

      const { error } = await supabase.from("appointments").insert(payload);
      if (error) throw error;

      setReason("");
      setNotes("");

      await loadAppointments();

      if (selectedPatient?.phone) {
        const msg = buildCitaText({
          patientName: selectedPatient.name,
          whenLocal: formatLocalDateTime(startIso),
          reason: payload.reason,
        });
        openWhatsApp({ phone: selectedPatient.phone, text: msg });
      } else {
        alert("Cita guardada. El paciente no tiene teléfono registrado.");
      }
    } catch (e2) {
      console.error(e2);
      alert(e2?.message || "Error creando cita");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAppointment(id) {
    if (!confirm("¿Eliminar esta cita?")) return;
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
      await loadAppointments();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error eliminando cita");
    }
  }

  async function markDone(id) {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "done" })
        .eq("id", id);
      if (error) throw error;
      await loadAppointments();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error marcando como hecha");
    }
  }

  async function confirmAppointment(id) {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "confirmed" })
        .eq("id", id);
      if (error) throw error;
      await loadAppointments();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error confirmando");
    }
  }

  function sendCitaWhatsApp(item) {
    const phone = item.type === 'old' ? item.patients?.phone : item.patient_phone;
    const name = item.displayName;
    
    if (!phone) return alert("Este paciente no tiene teléfono registrado.");

    const whenLocal = item.type === 'old' 
      ? formatLocalDateTime(item.start_at)
      : `${formatDateOnly(item.appointment_date)} ${formatTimeOnly(item.appointment_time)}`;

    const msg = buildCitaText({
      patientName: name,
      whenLocal: whenLocal,
      reason: item.displayReason,
    });
    openWhatsApp({ phone, text: msg });
  }

  function sendReminderWhatsApp(item) {
    const phone = item.type === 'old' ? item.patients?.phone : item.patient_phone;
    const name = item.displayName;
    
    if (!phone) return alert("Este paciente no tiene teléfono registrado.");

    const whenLocal = item.type === 'old' 
      ? formatLocalDateTime(item.start_at)
      : `${formatDateOnly(item.appointment_date)} ${formatTimeOnly(item.appointment_time)}`;

    const msg = buildReminderText({
      patientName: name,
      whenLocal: whenLocal,
      reason: item.displayReason,
    });
    openWhatsApp({ phone, text: msg });
  }

  const pendingCount = items.filter(x => x.status === 'pending').length;

  const headerRange = useMemo(() => {
    if (mode === "day") return day;
    const ws = startOfWeekLocal(day);
    const we = endOfWeekLocal(day);
    return `${toLocalDateInputValue(ws)} → ${toLocalDateInputValue(we)}`;
  }, [mode, day]);

  if (loading) return <div className="mm-empty">Cargando agenda...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14 }}>
      <div className="mm-titleRow">
        <div>
          <h1 style={{ margin: 0 }}>Agenda</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Vista: <b>{mode === "day" ? "Día" : "Semana"}</b> — <b>{headerRange}</b>
          </div>
          {pendingCount > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #ff5252, #ff1744)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontWeight: '600',
              fontSize: '13px',
              display: 'inline-block',
              marginTop: '8px'
            }}>
              🔴 {pendingCount} {pendingCount === 1 ? 'cita nueva' : 'citas nuevas'}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={`mm-btn mm-btn--ghost ${mode === "day" ? "mm-btn--active" : ""}`}
              onClick={() => setMode("day")}
            >
              Día
            </button>
            <button
              type="button"
              className={`mm-btn mm-btn--ghost ${mode === "week" ? "mm-btn--active" : ""}`}
              onClick={() => setMode("week")}
            >
              Semana
            </button>
          </div>

          <input
            className="mm-input"
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            style={{ minWidth: 170 }}
          />

          <button className="mm-btn mm-btn--ghost" onClick={reloadAll} type="button">
            Recargar
          </button>
        </div>
      </div>

      <div className="mm-grid" style={{ marginTop: 14 }}>
        {/* Form */}
        <section className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Nueva cita</div>
            <div className="mm-chip">{saving ? "Guardando..." : "Virgen de la Merced"}</div>
          </div>

          <form className="mm-form" onSubmit={createAppointment}>
            <select
              className="mm-input"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              disabled={saving}
            >
              {patients.length === 0 ? (
                <option value="">No hay pacientes</option>
              ) : (
                patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.cedula ? `- ${p.cedula}` : ""}
                  </option>
                ))
              )}
            </select>

            <input
              className="mm-input"
              type="datetime-local"
              value={startAtLocal}
              onChange={(e) => setStartAtLocal(e.target.value)}
              disabled={saving}
              title="Fecha y hora"
            />

            <input
              className="mm-input"
              placeholder="Motivo (ej: chequeo general)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={saving}
            />

            <input
              className="mm-input"
              placeholder="Notas (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
            />

            <button className="mm-btn" disabled={!canCreate}>
              Agendar cita
            </button>

            <div className="mm-hint">
              Al agendar, se abre WhatsApp con el chat + mensaje listo.
            </div>
          </form>
        </section>

        {/* List */}
        <section className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Citas</div>
            <div className="mm-chip">{items.length} registros</div>
          </div>

          {items.length === 0 ? (
            <div className="mm-empty">No hay citas en esta vista.</div>
          ) : (
            <div className="mm-list">
              {items.map((it) => {
                const statusText =
                  STATUS.find((s) => s.v === it.status)?.t || it.status;

                const isWebForm = it.created_via === 'web_form' || it.type === 'new';

                return (
                  <div key={`${it.type}-${it.id}`} className="mm-item">
                    <div className="mm-itemTop" style={{ alignItems: "center" }}>
                      <div className="mm-itemName">
                        {it.displayDate} — {it.displayName}
                        {isWebForm && (
                          <span style={{ 
                            marginLeft: 8, 
                            fontSize: 11, 
                            background: '#34B7F1', 
                            color: 'white', 
                            padding: '2px 8px', 
                            borderRadius: 10,
                            fontWeight: 600
                          }}>
                            WEB
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <div className="mm-chip">{statusText}</div>

                        {it.status === 'pending' && (
                          <button
                            className="mm-btn"
                            type="button"
                            onClick={() => {
                              sendCitaWhatsApp(it);
                              confirmAppointment(it.id);
                            }}
                            style={{ background: '#25D366' }}
                          >
                            ✓ Confirmar por WhatsApp
                          </button>
                        )}

                        <button
                          className="mm-btn mm-btn--ghost"
                          type="button"
                          onClick={() => sendReminderWhatsApp(it)}
                          title="Abrir WhatsApp con recordatorio"
                        >
                          Recordatorio
                        </button>

                        <button
                          className="mm-btn"
                          type="button"
                          onClick={() => markDone(it.id)}
                          disabled={it.status === "done"}
                          title="Marcar como hecha"
                        >
                          Hecha
                        </button>

                        <button
                          className="mm-btn mm-btn--danger"
                          type="button"
                          onClick={() => deleteAppointment(it.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="mm-itemMeta">
                      <div><b>Motivo:</b> {it.displayReason}</div>
                      <div><b>Tel:</b> {it.displayPhone}</div>
                      {it.notes && <div><b>Notas:</b> {it.notes}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}