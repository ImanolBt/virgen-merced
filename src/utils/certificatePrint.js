function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatLongDateES(dateISO) {
  const d = new Date(dateISO);
  const months = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre"
  ];
  const dd = pad2(d.getDate());
  const mm = months[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd} de ${mm} del ${yyyy}`;
}

function addDays(dateISO, days) {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + (Number(days) || 0));
  return d.toISOString();
}

export function openCertificatePrint({ patient, visit, profile }) {
  // Datos base
  const visitDate = visit.date || visit.created_at || new Date().toISOString();
  const fechaAtencion = formatLongDateES(visitDate);

  const daysRest = Number(visit.days_rest || 0);
  const restFrom = formatLongDateES(visitDate);
  const restTo = formatLongDateES(addDays(visitDate, Math.max(daysRest, 0)));

  // Diagnóstico
  const dx = visit.cie10_name || "-";
  const dxCode = visit.cie10_code ? `(${visit.cie10_code})` : "";

  // Paciente
  const pName = patient.name || "-";
  const pCed = patient.cedula || "-";

  // Defaults (si vienen vacíos)
  const place = visit.place || "Consultorio médico MIC MEDIC";
  const contingency = visit.contingency || "Enfermedad general";
  const attentionType = visit.attention_type || "EMERGENCIAS, DIABETES Y OBESIDAD";
  const treatment = visit.treatment || "Farmacológico";

  // Extra opcional (si lo llenas)
  const entity = visit.patient_entity || "-";
  const position = visit.patient_position || "-";
  const address = visit.patient_address || "-";
  const phone = patient.phone || "-";
  const email = patient.email || "-";

  // Perfil médico
  const clinicName = profile?.clinic_name || "MIC MEDIC";
  const doctorName = profile?.doctor_name || "Med.";
  const specialty = profile?.specialty || "EMERGENCIAS, DIABETES Y OBESIDAD";
  const extraTitles = profile?.extra_titles || "";
  const doctorId = profile?.doctor_id || "";
  const regMedico = profile?.reg_medico || "";
  const docPhone = profile?.phone || "";
  const docEmail = profile?.email || "";
  const docAddress = profile?.address || "";
  const signatureName = profile?.signature_name || doctorName;
  const footerNote = profile?.footer_note || "";

  // IMPORTANTE: coloca tu plantilla como imagen en /public/certificado_bg.png
  // (una imagen limpia del certificado sin datos)
  const bg = "/certificado_bg.png";

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Certificado Médico</title>
  <style>
    @page { size: A4; margin: 0; }
    body { margin:0; font-family: Arial, Helvetica, sans-serif; }
    .page {
      width: 210mm;
      height: 297mm;
      position: relative;
      overflow: hidden;
      background: white;
    }
    .bg {
      position:absolute; inset:0;
      width:100%; height:100%;
      object-fit: cover;
    }
    .content {
      position:absolute;
      left: 22mm;
      top: 48mm;
      right: 22mm;
      color: #111;
      font-size: 12px;
      line-height: 1.4;
    }
    .rightTopDate {
      position:absolute;
      top: 33mm;
      right: 25mm;
      font-size: 11px;
    }
    .title {
      text-align:center;
      font-weight: 700;
      margin: 12px 0 10px;
      letter-spacing: .4px;
    }
    .row { margin: 7px 0; }
    .label { font-weight: 700; }
    .signature {
      position:absolute;
      bottom: 32mm;
      left: 22mm;
      right: 22mm;
      text-align:center;
      font-size: 11px;
    }
    .signature .name { font-weight: 800; margin-top: 8px; }
    .signature .meta { margin-top: 3px; }
    .footerAddr {
      position:absolute;
      bottom: 14mm;
      left: 22mm;
      right: 22mm;
      text-align:center;
      font-size: 10px;
    }
    .hr {
      width: 60mm;
      margin: 12px auto 6px;
      border-top: 1px solid #666;
    }
  </style>
</head>
<body>
  <div class="page">
    <img class="bg" src="${bg}" />
    <div class="rightTopDate">Latacunga, ${fechaAtencion}</div>

    <div class="content">
      <div class="title">CERTIFICADO MEDICO</div>

      <div class="row">A quien interese,</div>

      <div class="row">
        Por medio de la presente CERTIFICO que el paciente <b>${pName}</b> con
        CI. <b>${pCed}</b>, fue atendido por:
      </div>

      <div class="row"><span class="label">Diagnostico:</span> ${dx} CIE10 ${dxCode}</div>
      <div class="row"><span class="label">Numero de historia clinica:</span> ${pCed}</div>
      <div class="row"><span class="label">Lugar de atención:</span> ${place}</div>
      <div class="row"><span class="label">Contingencia:</span> ${contingency}</div>
      <div class="row"><span class="label">Tipo de atención:</span> ${attentionType}</div>
      <div class="row"><span class="label">Fecha de atención:</span> ${fechaAtencion}</div>
      <div class="row"><span class="label">Tratamiento:</span> ${treatment}</div>

      <div class="row">
        <span class="label">Reposo absoluto:</span>
        <b>${daysRest}</b> (TRES) DIAS, DESDE EL ${restFrom} hasta el ${restTo}
      </div>

      <div class="row"><span class="label">Entidad:</span> ${entity}</div>
      <div class="row"><span class="label">Cargo:</span> ${position}</div>
      <div class="row"><span class="label">Domicilio:</span> ${address}</div>
      <div class="row"><span class="label">Correo electrónico:</span> ${email}</div>
      <div class="row"><span class="label">Teléfono de contacto:</span> ${phone}</div>

      <div class="row" style="margin-top: 10px;">${footerNote}</div>
    </div>

    <div class="signature">
      <div>Atentamente</div>
      <div class="hr"></div>
      <div class="name">${signatureName}</div>
      <div class="meta">${specialty}</div>
      <div class="meta"><b>CEDULA:</b> ${doctorId}</div>
      <div class="meta"><b>REG. MEDICO:</b> ${regMedico}</div>
      <div class="meta"><b>CELULAR:</b> ${docPhone}</div>
    </div>

    <div class="footerAddr">
      <div><b>CORREO:</b> ${docEmail}</div>
      <div><b>Dirección:</b> ${docAddress}</div>
    </div>
  </div>

  <script>
    window.onload = () => { window.focus(); window.print(); };
  </script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Bloqueado por el navegador. Permite ventanas emergentes para imprimir.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
