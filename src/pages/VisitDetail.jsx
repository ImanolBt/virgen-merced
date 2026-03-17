import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Cie10MultiPicker from "../components/Cie10MultiPicker";

/**
 * VisitDetail.jsx
 * Ruta: /visits/:id
 * Tablas:
 * - medical_visits (incluye signos vitales)
 * - patients
 * - certificates (rest_from, rest_to, contact_phone)
 * - medical_visit_diagnoses (diagnósticos múltiples)
 */

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

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function calcisoDateOnly(dateISO) {
  if (!dateISO) return "";
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toLocalDatetimeValue(dateISO) {
  if (!dateISO) return "";
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeValue(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function calcAge(birthdate) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

function calcBMI(weightKg, heightCm) {
  const w = toNum(weightKg);
  const h = toNum(heightCm);
  if (!w || !h || h <= 0) return null;
  const m = h / 100;
  const bmi = w / (m * m);
  return Number.isFinite(bmi) ? bmi : null;
}

function classifyVitals(v) {
  let level = "ok";
  const setLevel = (next) => {
    const rank = { ok: 0, warn: 1, bad: 2 };
    if (rank[next] > rank[level]) level = next;
  };

  const bpSys = toNum(v.bp_sys);
  const bpDia = toNum(v.bp_dia);
  if (bpSys !== null && bpDia !== null) {
    if (bpSys >= 140 || bpDia >= 90) setLevel("bad");
    else if (bpSys >= 130 || bpDia >= 85) setLevel("warn");
  }

  const hr = toNum(v.hr);
  if (hr !== null) {
    if (hr > 120 || hr < 50) setLevel("warn");
  }

  const spo2 = toNum(v.spo2);
  if (spo2 !== null) {
    if (spo2 < 92) setLevel("bad");
    else if (spo2 < 95) setLevel("warn");
  }

  const temp = toNum(v.temp_c);
  if (temp !== null) {
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

function vitalsSummary(v, isChild) {
  const parts = [];
  if (v.bp_sys && v.bp_dia) parts.push(`PA ${v.bp_sys}/${v.bp_dia}`);
  if (v.hr) parts.push(`FC ${v.hr}`);
  if (v.spo2) parts.push(`SpO₂ ${v.spo2}%`);
  if (v.temp_c !== null && v.temp_c !== undefined && v.temp_c !== "") parts.push(`T° ${v.temp_c}°C`);
  if (v.weight_kg !== null && v.weight_kg !== undefined && v.weight_kg !== "") parts.push(`Peso ${v.weight_kg}kg`);
  if (v.height_cm !== null && v.height_cm !== undefined && v.height_cm !== "") parts.push(`Talla ${v.height_cm}cm`);
  if (isChild) {
    if (v.pediatric_percentile) parts.push(`OMS ${v.pediatric_percentile}`);
  } else {
    if (v.bmi !== null && v.bmi !== undefined && v.bmi !== "") parts.push(`IMC ${v.bmi}`);
  }
  return parts.length ? parts.join(" · ") : "Sin signos vitales registrados";
}

const MONTHS_ES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtDateShortDMY(dateISO) {
  if (!dateISO) {
    const d = new Date();
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  if (typeof dateISO === 'string' && dateISO.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateISO.split('-').map(Number);
    return `${pad2(day)}/${pad2(month)}/${year}`;
  }
  const d = new Date(dateISO);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function numToWordsEs(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `MENOS ${numToWordsEs(Math.abs(n))}`;
  if (n === 0) return "CERO";

  const U = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const TEENS = ["DIEZ","ONCE","DOCE","TRECE","CATORCE","QUINCE","DIECISEIS","DIECISIETE","DIECIOCHO","DIECINUEVE"];
  const TENS = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const H = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

  const SPECIAL_1_29 = {
    1:"UNO",2:"DOS",3:"TRES",4:"CUATRO",5:"CINCO",6:"SEIS",7:"SIETE",8:"OCHO",9:"NUEVE",
    10:"DIEZ",11:"ONCE",12:"DOCE",13:"TRECE",14:"CATORCE",15:"QUINCE",
    16:"DIECISEIS",17:"DIECISIETE",18:"DIECIOCHO",19:"DIECINUEVE",
    20:"VEINTE",21:"VEINTIUNO",22:"VEINTIDOS",23:"VEINTITRES",24:"VEINTIFICUATRO",
    25:"VEINTICINCO",26:"VEINTISEIS",27:"VEINTISIETE",28:"VEINTIOCHO",29:"VEINTINUEVE"
  };

  if (n <= 29) return SPECIAL_1_29[n];

  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS[t];
    return `${TENS[t]} Y ${U[u]}`;
  }

  if (n === 100) return "CIEN";

  if (n < 1000) {
    const c = Math.floor(n / 100);
    const r = n % 100;
    return `${H[c]}${r ? " " + numToWordsEs(r) : ""}`.trim();
  }

  const miles = Math.floor(n / 1000);
  const r = n % 1000;

  let milesTxt = "";
  if (miles === 1) milesTxt = "MIL";
  else milesTxt = `${numToWordsEs(miles)} MIL`;

  return `${milesTxt}${r ? " " + numToWordsEs(r) : ""}`.trim();
}

function dateToWordsEs(dateISO) {
  if (!dateISO) {
    const d = new Date();
    const day = d.getDate();
    const monthName = MONTHS_ES[d.getMonth()];
    const year = d.getFullYear();
    const dayWords = numToWordsEs(day);
    const yearWords = numToWordsEs(year);
    return `${dayWords} DE ${monthName} DEL ${yearWords}`;
  }

  if (typeof dateISO === 'string' && dateISO.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateISO.split('-').map(Number);
    const monthName = MONTHS_ES[month - 1];
    const dayWords = numToWordsEs(day);
    const yearWords = numToWordsEs(year);
    return `${dayWords} DE ${monthName} DEL ${yearWords}`;
  }

  const d = new Date(dateISO);
  const day = d.getDate();
  const monthName = MONTHS_ES[d.getMonth()];
  const year = d.getFullYear();
  const dayWords = numToWordsEs(day);
  const yearWords = numToWordsEs(year);
  return `${dayWords} DE ${monthName} DEL ${yearWords}`;
}

function calcEndDateInclusive(startISO, days) {
  const start = new Date(startISO);
  const n = Number(days || 0);
  if (!Number.isFinite(start.getTime())) return null;
  if (!Number.isFinite(n) || n <= 0) return start.toISOString();
  const end = new Date(start.getTime() + (n - 1) * 86400000);
  return end.toISOString();
}

export default function VisitDetail() {
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

  const [editVisit, setEditVisit] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);

  const [visitDateEdit, setVisitDateEdit] = useState("");
  const [reasonEdit, setReasonEdit] = useState("");
  const [visitNotesEdit, setVisitNotesEdit] = useState("");

  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [hr, setHr] = useState("");
  const [spo2, setSpo2] = useState("");
  const [tempC, setTempC] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [pediatricPercentile, setPediatricPercentile] = useState("");
  const [showOmsModal, setShowOmsModal] = useState(false);
  const [savingVitals, setSavingVitals] = useState(false);

  const [diags, setDiags] = useState([]);
  const [savingDiags, setSavingDiags] = useState(false);

  const [certId, setCertId] = useState(null);
  const [certDate, setCertDate] = useState(() => new Date().toISOString());
  const [restFrom, setRestFrom] = useState("");
  const [restTo, setRestTo] = useState("");
  const [entity, setEntity] = useState("");
  const [position, setPosition] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [includeNotes, setIncludeNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const clinicName = "Consultorio médico Virgen de la Merced";
  const contingency = "Enfermedad general";
  const attentionType = "EMERGENCIAS, DIABETES Y OBESIDAD";
  const treatment = "Farmacológico";

  const doctor = {
    fullName: "DR. WASHINGTON MASAPANTA MSC.",
    specialty: "EMERGENCIAS, DIABETES Y OBESIDAD",
    cedula: "0502391878",
    phone: "0995361606",
    email: "drwmasapanta@gmail.com",
    address: "Cotopaxi - Latacunga Barrio La Tebaida (Calle Laguna Quilota y pasaje sin nombre)",
    headerLine1: "Dr. Washington Masapanta MSc.",
    headerLine2: "Seguridad y Salud Ocupacional",
    headerLine3: "Emergencias y desastres",
    headerLine4: "EMERGENCIAS, DIABETES Y OBESIDAD",
  };

  const daysRestComputed = useMemo(() => {
    if (!restFrom || !restTo) return 0;
    const a = new Date(restFrom);
    const b = new Date(restTo);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
    const diff = Math.floor((b.getTime() - a.getTime()) / 86400000);
    return diff >= 0 ? diff + 1 : 0;
  }, [restFrom, restTo]);

  function formatDiagnosesForDisplay(diagnosesArray) {
    if (!diagnosesArray || diagnosesArray.length === 0) return "-";
    return diagnosesArray.map(d => 
      d.name ? `${d.name} (${d.code})` : d.code
    ).join("; ");
  }

 async function loadAll() {
  if (!visitId) return;
  setLoading(true);

  try {
    console.log("🔵 1. Cargando visita...");
    const v = await supabase
      .from("medical_visits")
      .select(
        "id, patient_id, visit_date, reason, cie10_code, cie10_name, notes, created_at, user_id, bp_sys, bp_dia, hr, spo2, temp_c, weight_kg, height_cm, bmi, pediatric_percentile"
      )
      .eq("id", visitId)
      .single();

    if (v.error) throw new Error(`Error cargando consulta: ${v.error.message}`);
    console.log("✅ Visita cargada:", v.data);

    console.log("🔵 2. Cargando paciente...");
    const p = await supabase
      .from("patients")
      .select("*")
      .eq("id", v.data.patient_id)
      .single();

    if (p.error) throw new Error(`Error cargando paciente: ${p.error.message}`);
    console.log("✅ Paciente cargado:", p.data);

    setVisit(v.data);
    setPatient(p.data);

    console.log("🔵 3. Seteando estados de edición...");
    setVisitDateEdit(toLocalDatetimeValue(v.data.visit_date));
    setReasonEdit(v.data.reason ?? "");
    setVisitNotesEdit(v.data.notes ?? "");
    console.log("✅ Estados seteados - notes:", v.data.notes);

    setBpSys(v.data.bp_sys ?? "");
    setBpDia(v.data.bp_dia ?? "");
    setHr(v.data.hr ?? "");
    setSpo2(v.data.spo2 ?? "");
    setTempC(v.data.temp_c ?? "");
    setWeightKg(v.data.weight_kg ?? "");
    setHeightCm(v.data.height_cm ?? "");
    setPediatricPercentile(v.data.pediatric_percentile ?? "");

    console.log("🔵 4. Cargando diagnósticos...");
    const d = await supabase
      .from("medical_visit_diagnoses")
      .select("cie10_code, cie10_name")
      .eq("visit_id", visitId)
      .order("id", { ascending: true });

    if (d.error) {
      console.error("⚠️ Error cargando diagnósticos:", d.error);
      setDiags([]);
    } else {
      console.log("✅ Diagnósticos cargados:", d.data);
      setDiags((d.data || []).map((x) => ({ code: x.cie10_code, name: x.cie10_name })));
    }

    console.log("🔵 5. Cargando certificado...");
    const c = await supabase
      .from("certificates")
      .select("*")
      .eq("visit_id", visitId)
      .maybeSingle();

    if (c.error && c.error.code !== 'PGRST116') {
      console.error("⚠️ Error cargando certificado:", c.error);
    } else if (c.data) {
      console.log("✅ Certificado cargado:", c.data);
      setCertId(c.data.id);
      setCertDate(c.data.date || new Date().toISOString());
      setRestFrom(c.data.rest_from ? String(c.data.rest_from) : "");
      setRestTo(c.data.rest_to ? String(c.data.rest_to) : "");
      setEntity(c.data.entity ?? "");
      setPosition(c.data.position ?? "");
      setAddress(c.data.address ?? "");
      setEmail(c.data.email ?? "");
      setContactPhone(c.data.contact_phone ?? "");
      setIncludeNotes(!!c.data.include_notes);
      setNotes(c.data.notes ?? "");
    } else {
      console.log("ℹ️ No hay certificado previo");
      setCertId(null);
      setCertDate(v.data.visit_date || new Date().toISOString());
      const visitDay = v.data.visit_date ? new Date(v.data.visit_date).toISOString().slice(0, 10) : "";
      setRestFrom(visitDay);
      setRestTo("");
      setEntity("");
      setPosition("");
      setAddress("");
      setEmail("");
      setContactPhone("");
      setIncludeNotes(false);
      setNotes("");
    }

    console.log("✅ loadAll() completado exitosamente");

  } catch (error) {
    console.error("❌ Error en loadAll:", error);
    alert(error.message || "Error al cargar los datos");
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

 async function saveVisitEdits() {
  if (!visit) return;
  if (savingVisit) return;

  const nextVisitISO = fromLocalDatetimeValue(visitDateEdit);
  if (!nextVisitISO) {
    alert("Fecha de consulta inválida.");
    return;
  }
  if (!reasonEdit.trim()) {
    alert("El motivo no puede quedar vacío.");
    return;
  }

  const payload = {
    visit_date: nextVisitISO,
    reason: reasonEdit.trim(),
    notes: visitNotesEdit.trim() || null,
  };

  // ✅ DEBUG: Ver qué se está enviando
  console.log("🔍 Guardando consulta con payload:", payload);
  console.log("🔍 Visit ID:", visit.id);

  setSavingVisit(true);
  try {
    const { data, error } = await supabase
      .from("medical_visits")
      .update(payload)
      .eq("id", visit.id)
      .select(); // ✅ AGREGADO: para ver qué devuelve

    if (error) throw error;

    console.log("✅ Respuesta de Supabase:", data);
    alert("Consulta actualizada.");
    setEditVisit(false);
    loadAll();
  } catch (error) {
    console.error("❌ Error guardando:", error);
    alert(error.message || "No se pudo guardar cambios de la consulta");
  } finally {
    setSavingVisit(false);
  }
}

  function cancelVisitEdits() {
    if (!visit) return;
    setVisitDateEdit(toLocalDatetimeValue(visit.visit_date));
    setReasonEdit(visit.reason ?? "");
    setVisitNotesEdit(visit.notes ?? "");
    setEditVisit(false);
  }

  async function saveDiagnoses() {
    if (!visit) return;
    if (savingDiags) return;

    setSavingDiags(true);

    try {
      const del = await supabase
        .from("medical_visit_diagnoses")
        .delete()
        .eq("visit_id", visit.id);

      if (del.error) throw del.error;

      if (diags.length > 0) {
        const payload = diags.map((d) => ({
          visit_id: visit.id,
          cie10_code: d.code,
          cie10_name: d.name,
        }));

        const ins = await supabase
          .from("medical_visit_diagnoses")
          .insert(payload);

        if (ins.error) throw ins.error;
      }

      alert("Diagnósticos guardados.");
      loadAll();
    } catch (error) {
      console.error(error);
      alert(error.message || "No se pudo guardar diagnósticos");
    } finally {
      setSavingDiags(false);
    }
  }

  async function saveVitals() {
    if (!visit || !patient) return;
    if (savingVitals) return;

    const age = calcAge(patient.birthdate) ?? patient.age ?? null;
    const isChild = age !== null ? Number(age) < 10 : false;

    const bmi = isChild ? null : calcBMI(weightKg, heightCm);

    const payload = {
      bp_sys: bpSys === "" ? null : Number(bpSys),
      bp_dia: bpDia === "" ? null : Number(bpDia),
      hr: hr === "" ? null : Number(hr),
      spo2: spo2 === "" ? null : Number(spo2),
      temp_c: tempC === "" ? null : Number(tempC),
      weight_kg: weightKg === "" ? null : Number(weightKg),
      height_cm: heightCm === "" ? null : Number(heightCm),
      bmi: bmi === null ? null : Number(bmi.toFixed(2)),
      pediatric_percentile: isChild ? (pediatricPercentile?.trim() ? pediatricPercentile.trim() : null) : null,
    };

    setSavingVitals(true);
    try {
      const { error } = await supabase
        .from("medical_visits")
        .update(payload)
        .eq("id", visit.id);

      if (error) throw error;

      alert("Signos vitales guardados.");
      loadAll();
    } catch (error) {
      console.error(error);
      alert(error.message || "No se pudo guardar signos vitales");
    } finally {
      setSavingVitals(false);
    }
  }

  async function saveCertificate() {
    if (!visit || !patient) return;

    if (!restFrom || !restTo) {
      alert("Selecciona reposo DESDE y HASTA.");
      return;
    }
    if (daysRestComputed <= 0) {
      alert("Rango de reposo inválido. 'Hasta' debe ser igual o mayor que 'Desde'.");
      return;
    }

    const diagText = diags.length > 0 
      ? diags.map(d => `${d.name || d.code} (${d.code})`).join("; ")
      : (visit.cie10_code && visit.cie10_name)
        ? `${visit.cie10_name} CIE10 (${visit.cie10_code})`
        : visit.cie10_name || visit.cie10_code || "-";

    const startISO = restFrom;
    const endISO = calcEndDateInclusive(startISO, daysRestComputed);
    
    const daysN = Number(daysRestComputed || 0);
    const daysWords = numToWordsEs(daysN);
    
    const startShort = fmtDateShortDMY(startISO);
    const endShort = fmtDateShortDMY(endISO);
    
    const startWords = dateToWordsEs(startISO);
    const endWords = dateToWordsEs(endISO);
    
    const reposoLine = `Reposo absoluto: ${daysN} (${daysWords}) DÍA(S), DESDE EL ${startShort} (${startWords}) HASTA EL ${endShort} (${endWords})`;

    const baseBody = [
      "A quien interese,",
      "",
      `Por medio de la presente CERTIFICO que el paciente ${patient.name} con CI. ${patient.cedula || "-"}, fue atendido por:`,
      "",
      `Diagnóstico: ${diagText}`,
      `Numero de historia clínica: ${patient.cedula || "-"}`,
      `Lugar de atención: ${clinicName}`,
      `Contingencia: ${contingency}`,
      `Tipo de atención: ${attentionType}`,
      `Fecha de atención: ${fmtDateShort(visit.visit_date)}`,
      `Tratamiento: ${treatment}`,
      reposoLine,
      "",
      `Entidad: ${entity || "-"}`,
      `Cargo: ${position || "-"}`,
      `Domicilio: ${address || "-"}`,
      `Correo electrónico: ${email || "-"}`,
      `Teléfono de contacto: ${contactPhone || "-"}`,
      "",
      ...(includeNotes && notes?.trim() ? [
        "NOTAS ADICIONALES:",
        notes.trim(),
        "",
      ] : []),
      "Es todo en cuanto puedo certificar en honor a la verdad, autorizando al interesado hacer uso del presente certificado en trámites pertinentes.",
    ].join("\n");

    const payload = {
      visit_id: visit.id,
      patient_id: patient.id,
      date: certDate ? new Date(certDate).toISOString() : new Date().toISOString(),
      title: "CERTIFICADO MÉDICO",
      body: baseBody,
      days_rest: Number(daysRestComputed || 0),
      rest_from: restFrom || null,
      rest_to: restTo || null,
      notes: notes || null,
      include_notes: !!includeNotes,
      entity: entity || null,
      position: position || null,
      address: address || null,
      email: email || null,
      contact_phone: contactPhone.trim() || null,
    };

    try {
      const { data, error } = await supabase
        .from("certificates")
        .upsert(payload)
        .select("id")
        .single();

      if (error) throw error;

      setCertId(data.id);
      alert("Certificado guardado.");
      loadAll();
    } catch (error) {
      console.error("Error guardando certificado:", error);
      alert(error.message || "No se pudo guardar el certificado");
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
  <title>Certificado</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 8px;
      color: #111;
      font-size: 10px;
      line-height: 1.35;
    }
    .paper { 
      width: 600px; 
      margin: 0 auto; 
      position: relative; 
    }

    .watermark {
      position: absolute;
      inset: 0;
      background-image: url("${LOGO_WM}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 500px auto;
      opacity: 0.3;
      pointer-events: none;
      z-index: 0;
    }

    .content { 
      position: relative; 
      z-index: 1; 
    }

    .headerRow {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 4px;
    }

    .logoTop {
      height: 120px;
      object-fit: contain;
      display: block !important;
      visibility: visible !important;
    }

    * { 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
      color-adjust: exact !important;
    }

    @media print {
      body { 
        padding: 0; 
        margin: 0;
      }
      .paper { 
        width: auto; 
        margin: 0; 
        padding: 8mm;
      }
      img, .logoTop {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .watermark {
        display: block !important;
        visibility: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
    
    .pdfHeader {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin: 0 0 4mm 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .pdfHeader img {
      height: 16mm;
      object-fit: contain;
    }

  </style>
</head>
<body>
  <div class="paper">
    <div class="watermark"></div>

    <div class="content">
      <div class="headerRow">
      </div>

      ${html}
    </div>
  </div>
</body>
</html>
    `);
    w.document.close();

    const images = w.document.querySelectorAll('img');
    let loadedCount = 0;
    const totalImages = images.length;

    function checkAndPrint() {
      loadedCount++;
      if (loadedCount >= totalImages) {
        setTimeout(() => {
          w.focus();
          w.print();
        }, 500);
      }
    }

    if (totalImages === 0) {
      setTimeout(() => {
        w.focus();
        w.print();
      }, 300);
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

  if (!visitId) return <div className="mm-empty">ID inválido.</div>;
  if (loading) return <div className="mm-empty">Cargando consulta...</div>;
  if (!visit || !patient) return <div className="mm-empty">No se encontró la consulta.</div>;

  const age = calcAge(patient.birthdate) ?? patient.age ?? null;
  const isChild = age !== null ? Number(age) < 10 : false;
  const bmiLive = isChild ? null : calcBMI(weightKg, heightCm);
  const status = classifyVitals({
    bp_sys: bpSys,
    bp_dia: bpDia,
    hr,
    spo2,
    temp_c: tempC,
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14, display: "grid", gap: 14 }}>
      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="mm-cardTitle">Consulta</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Paciente: <b>{patient.name}</b> · CI: <b>{patient.cedula || "-"}</b> · Fecha:{" "}
              <b>{new Date(visit.visit_date).toLocaleString("es-EC")}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="mm-chip" title="Estado signos vitales">
              {status.emoji} {status.text}
            </div>

            {!editVisit ? (
              <button className="mm-btn" type="button" onClick={() => setEditVisit(true)}>
                Editar consulta
              </button>
            ) : (
              <>
                <button className="mm-btn" type="button" onClick={saveVisitEdits} disabled={savingVisit}>
                  {savingVisit ? "Guardando..." : "Guardar cambios"}
                </button>
                <button className="mm-btn mm-btn--ghost" type="button" onClick={cancelVisitEdits} disabled={savingVisit}>
                  Cancelar
                </button>
              </>
            )}

            <button className="mm-btn mm-btn--ghost" type="button" onClick={() => nav(`/patients/${patient.id}`)}>
              Volver a ficha
            </button>
          </div>
        </div>

        <div className="mm-itemMeta" style={{ padding: 14, display: "grid", gap: 10 }}>
          {!editVisit ? (
            <>
              <div><b>Motivo:</b> {visit.reason || "-"}</div>
              <div><b>Diagnóstico:</b> {formatDiagnosesForDisplay(diags)}</div>
              <div><b>Notas de consulta:</b> {visit.notes || "-"}</div>
            </>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Fecha y hora de consulta</div>
                  <input
                    className="mm-input"
                    type="datetime-local"
                    value={visitDateEdit}
                    onChange={(e) => setVisitDateEdit(e.target.value)}
                    disabled={savingVisit}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Motivo</div>
                  <input
                    className="mm-input"
                    value={reasonEdit}
                    onChange={(e) => setReasonEdit(e.target.value)}
                    disabled={savingVisit}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Notas de consulta</div>
                <textarea
                  className="mm-input"
                  style={{ minHeight: 90, paddingTop: 10 }}
                  value={visitNotesEdit}
                  onChange={(e) => setVisitNotesEdit(e.target.value)}
                  disabled={savingVisit}
                  placeholder="Notas..."
                />
              </div>
            </div>
          )}

          <div>
            <b>Signos vitales:</b>{" "}
            {vitalsSummary(
              {
                bp_sys: bpSys,
                bp_dia: bpDia,
                hr,
                spo2,
                temp_c: tempC,
                weight_kg: weightKg,
                height_cm: heightCm,
                bmi: bmiLive,
                pediatric_percentile: pediatricPercentile,
              },
              isChild
            )}
          </div>
        </div>
      </div>

      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div className="mm-cardTitle">Diagnósticos (CIE10)</div>
          <div className="mm-chip">{savingDiags ? "Guardando..." : `${diags.length} seleccionados`}</div>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <Cie10MultiPicker selected={diags} onChange={setDiags} />

          <button className="mm-btn" type="button" onClick={saveDiagnoses} disabled={savingDiags}>
            Guardar diagnósticos
          </button>

          <div className="mm-hint" style={{ margin: 0 }}>
            Puedes agregar 3, 4 o 5 diagnósticos. Se guardan en la tabla medical_visit_diagnoses.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ display: "grid", gap: 14 }}>
          <div className="mm-card">
            <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
              <div className="mm-cardTitle">Signos vitales</div>
              <div className="mm-chip">{savingVitals ? "Guardando..." : "Virgen de la Merced"}</div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 12 }}>
              <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>PA Sistólica (mmHg)</div>
                  <input className="mm-input" placeholder="Ej: 120" value={bpSys} onChange={(e) => setBpSys(e.target.value)} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>PA Diastólica (mmHg)</div>
                  <input className="mm-input" placeholder="Ej: 80" value={bpDia} onChange={(e) => setBpDia(e.target.value)} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Frecuencia cardiaca (lpm)</div>
                  <input className="mm-input" placeholder="Ej: 78" value={hr} onChange={(e) => setHr(e.target.value)} />
                </div>
              </div>

              <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Saturación O₂ (%)</div>
                  <input className="mm-input" placeholder="Ej: 98" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Temperatura (°C)</div>
                  <input className="mm-input" placeholder="Ej: 36.7" value={tempC} onChange={(e) => setTempC(e.target.value)} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Edad</div>
                  <input className="mm-input" value={age !== null ? `${age} años` : "-"} disabled />
                </div>
              </div>

              <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Peso (kg)</div>
                  <input className="mm-input" placeholder="Ej: 70" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Talla (cm)</div>
                  <input className="mm-input" placeholder="Ej: 170" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{isChild ? "Curvas OMS (percentil)" : "IMC"}</div>

                  {isChild ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <input
                        className="mm-input"
                        placeholder="Ej: P50, P85, P97"
                        value={pediatricPercentile}
                        onChange={(e) => setPediatricPercentile(e.target.value)}
                      />
                      <button className="mm-btn mm-btn--ghost" type="button" onClick={() => setShowOmsModal(true)}>
                        Ver tabla (guía)
                      </button>
                    </div>
                  ) : (
                    <input className="mm-input" value={bmiLive !== null ? bmiLive.toFixed(1) : "-"} disabled />
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button className="mm-btn" type="button" onClick={saveVitals} disabled={savingVitals}>
                  Guardar signos vitales
                </button>

                <div className="mm-hint" style={{ margin: 0 }}>
                  {isChild
                    ? "Menores de 10: registra percentil OMS manual (P50, P85, etc.)."
                    : "Desde 10+: el sistema calcula IMC automáticamente con peso y talla."}
                </div>
              </div>
            </div>
          </div>

          <div className="mm-card">
            <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
              <div className="mm-cardTitle">Certificado médico</div>
              <div className="mm-chip">{certId ? `ID ${certId}` : "Nuevo"}</div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Fecha del certificado</div>
                  <input
                    className="mm-input"
                    type="date"
                    value={new Date(certDate).toISOString().slice(0, 10)}
                    onChange={(e) => setCertDate(new Date(e.target.value).toISOString())}
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Días de reposo (auto)</div>
                  <input className="mm-input" value={daysRestComputed ? `${daysRestComputed} día(s)` : "-"} disabled />
                </div>
              </div>

              <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Reposo desde</div>
                  <input
                    className="mm-input"
                    type="date"
                    value={restFrom}
                    onChange={(e) => setRestFrom(e.target.value)}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Reposo hasta</div>
                  <input
                    className="mm-input"
                    type="date"
                    value={restTo}
                    min={restFrom || undefined}
                    onChange={(e) => setRestTo(e.target.value)}
                  />
                </div>
              </div>

              <input className="mm-input" placeholder="Entidad (ej: Unidad Educativa ...)" value={entity} onChange={(e) => setEntity(e.target.value)} />
              <input className="mm-input" placeholder="Cargo (ej: Docente)" value={position} onChange={(e) => setPosition(e.target.value)} />
              <input className="mm-input" placeholder="Domicilio" value={address} onChange={(e) => setAddress(e.target.value)} />
              <input className="mm-input" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input
                className="mm-input"
                placeholder="Teléfono de contacto"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />

              <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 4 }}>
                <input
                  id="includeNotes"
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                />
                <label htmlFor="includeNotes" style={{ fontSize: 13 }}>
                  Incluir notas adicionales en el certificado
                </label>
              </div>

              {includeNotes && (
                <textarea
                  className="mm-input"
                  style={{ minHeight: 90, paddingTop: 10 }}
                  placeholder="Notas adicionales (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="mm-btn" type="button" onClick={saveCertificate}>
                  Guardar certificado
                </button>

                <button className="mm-btn mm-btn--ghost" type="button" onClick={printPDF}>
                  Imprimir / Guardar PDF
                </button>

                <button className="mm-btn mm-btn--ghost" type="button" onClick={() => nav(`/visits/${visit.id}/prescription`)}>
                  Receta
                </button>
              </div>

              <div className="mm-hint">
                Consejo: primero guarda, luego imprime. Así queda todo persistido por consulta.
              </div>
            </div>
          </div>
        </div>

        <div className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Vista previa</div>
            <div className="mm-chip">PDF</div>
          </div>

          <div style={{ padding: 14 }}>
            <div ref={printRef}>
              <div
                className="pdfHeader"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <img
                  src="/logo-top.png"
                  alt="Logo"
                  style={{ height: 135, objectFit: "contain" }}
                />

                <div style={{ color: "#333", fontSize: 8.5, lineHeight: 1.15, textAlign: "right" }}>
                  <div style={{ fontWeight: 900 }}>{doctor.headerLine1}</div>
                  <div>{doctor.headerLine2}</div>
                  <div>{doctor.headerLine3}</div>
                  <div style={{ fontWeight: 900 }}>{doctor.headerLine4}</div>
                  <div style={{ marginTop: 6 }}>
                    Latacunga, {fmtDateLong(certDate)}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "center", fontWeight: 900, margin: "12px 0 10px" }}>CERTIFICADO MEDICO</div>

              <div style={{ fontSize: 13, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
{`A quien interese,

Por medio de la presente CERTIFICO que el paciente ${patient.name} con CI. ${patient.cedula || "-"}, fue atendido por:

Diagnostico: ${diags.length > 0 
  ? diags.map(d => `${d.name || d.code} (${d.code})`).join("; ")
  : (visit.cie10_code && visit.cie10_name)
    ? `${visit.cie10_name} CIE10 (${visit.cie10_code})`
    : visit.cie10_name || visit.cie10_code || "-"}

Numero de historia clinica: ${patient.cedula || "-"}

Lugar de atencion: ${clinicName}

Contingencia: ${contingency}

Tipo de atencion: ${attentionType}

Fecha de atencion: ${fmtDateShort(visit.visit_date)}

Tratamiento: ${treatment}

Reposo absoluto: ${Number(daysRestComputed || 0)} (${numToWordsEs(Number(daysRestComputed || 0))}) DIAS, DESDE EL ${fmtDateShortDMY(restFrom)} (${dateToWordsEs(restFrom)}) HASTA EL ${fmtDateShortDMY(restTo)} (${dateToWordsEs(restTo)})

Entidad: ${entity || "-"}

Cargo: ${position || "-"}

Domicilio: ${address || "-"}

Correo electronico: ${email || "-"}

Telefono de contacto: ${contactPhone || "-"}${includeNotes && notes?.trim() ? `

NOTAS ADICIONALES:
${notes.trim()}` : ''}

Es todo en cuanto puedo certificar en honor a la verdad, autorizando al interesado hacer uso del presente certificado en tramites pertinentes.`}
              </div>

              <div style={{ marginTop: 16, textAlign: "center" }}>
                <div style={{ marginTop: 12 }}>Atentamente</div>
                <br />
                <div style={{ margin: "12px 0", borderTop: "1px solid #ddd" }}></div>
                <div style={{ fontWeight: 900 }}>{doctor.fullName}</div>
                <div style={{ fontWeight: 900 }}>{doctor.specialty}</div>
                <div>CEDULA: {doctor.cedula}</div>
                <div>CELULAR: {doctor.phone}</div>
                <div>CORREO: {doctor.email}</div>
                <div style={{ marginTop: 8 }}>Direccion: {doctor.address}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showOmsModal && (
        <div
          onClick={() => setShowOmsModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "grid",
            placeItems: "center",
            padding: 14,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mm-card"
            style={{ width: "min(760px, 100%)" }}
          >
            <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
              <div className="mm-cardTitle">Curvas OMS (guía rápida)</div>
              <button className="mm-btn mm-btn--ghost" type="button" onClick={() => setShowOmsModal(false)}>
                Cerrar
              </button>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
                Aquí se registra el percentil manualmente (ej: <b>P50</b>, <b>P85</b>, <b>P97</b>).
                <br />
                Recomendación: usa la tabla OMS según <b>sexo</b> y <b>edad</b> del paciente, y guarda el percentil final.
              </div>

              <div className="mm-item">
                <div className="mm-itemTop" style={{ alignItems: "center" }}>
                  <div className="mm-itemName">Percentil OMS</div>
                  <div className="mm-chip">Manual</div>
                </div>

                <div className="mm-itemMeta" style={{ display: "grid", gap: 10 }}>
                  <input
                    className="mm-input"
                    placeholder="Ej: P50"
                    value={pediatricPercentile}
                    onChange={(e) => setPediatricPercentile(e.target.value)}
                  />
                  <div className="mm-hint" style={{ margin: 0 }}>
                    Tip rápido: P50 = promedio, P85 = sobrepeso (según caso), P97 = muy alto. (Solo guía visual).
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="mm-btn" type="button" onClick={() => setShowOmsModal(false)}>
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}