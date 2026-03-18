import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const DOCTOR_EMAIL = Deno.env.get('DOCTOR_EMAIL') || 'drwmasapanta@gmail.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const appointment = body.appointment || body
    
    if (!appointment) {
      throw new Error('No appointment data received')
    }

    const dateStr = appointment.appointment_date 
      ? new Date(appointment.appointment_date + 'T00:00:00').toLocaleDateString('es-EC', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : 'Fecha no especificada'
      
    const time = appointment.appointment_time 
      ? appointment.appointment_time.substring(0, 5)
      : 'Hora no especificada'

    console.log('Processing appointment:', { dateStr, time, email: appointment.patient_email })

    // ===== 1. TELEGRAM AL DOCTOR =====
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const telegramMessage = `🔔 *Nueva cita agendada*

👤 *Paciente:* ${appointment.patient_name || 'No especificado'}
📅 *Fecha:* ${dateStr}
⏰ *Hora:* ${time}
💬 *Motivo:* ${appointment.appointment_type || appointment.reason || 'No especificado'}
📱 *Teléfono:* ${appointment.patient_phone || 'No especificado'}
✉️ *Email:* ${appointment.patient_email || 'No proporcionado'}

_Cita registrada desde el formulario web_`

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: telegramMessage,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📊 Ver Dashboard', url: 'https://virgenmerced.vercel.app/agenda' }
            ]]
          }
        })
      })
      
      console.log('✅ Telegram sent')
    }

    // ===== 2. EMAIL AL DOCTOR (RESEND) =====
    if (RESEND_API_KEY && DOCTOR_EMAIL) {
      const doctorEmailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f4f7f3; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #1e4d7b 0%, #3ea99f 100%); padding: 40px 20px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 40px 30px; }
    .alert { background: #fff3cd; border-left: 4px solid #ff9800; padding: 16px; margin-bottom: 24px; }
    .info-box { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
    .info-label { font-weight: 600; color: #546e7a; }
    .info-value { color: #1e4d7b; font-weight: 600; }
    .btn { display: inline-block; background: #3ea99f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Nueva Cita Agendada</h1>
    </div>
    <div class="content">
      <div class="alert">
        <strong>⚠️ Atención:</strong> Se ha registrado una nueva cita desde el formulario web.
      </div>
      
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Paciente:</span>
          <span class="info-value">${appointment.patient_name || 'No especificado'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Fecha:</span>
          <span class="info-value">${dateStr}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Hora:</span>
          <span class="info-value">${time}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Motivo:</span>
          <span class="info-value">${appointment.appointment_type || appointment.reason || 'No especificado'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Teléfono:</span>
          <span class="info-value">${appointment.patient_phone || 'No especificado'}</span>
        </div>
        <div class="info-row" style="border-bottom: none;">
          <span class="info-label">Email:</span>
          <span class="info-value">${appointment.patient_email || 'No proporcionado'}</span>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://virgenmerced.vercel.app/agenda" class="btn">📊 Ver en Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>Virgen Merced - Sistema de Gestión de Citas</p>
    </div>
  </div>
</body>
</html>`

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Virgen Merced <onboarding@resend.dev>',
          to: [DOCTOR_EMAIL],
          subject: `🔴 Nueva cita: ${appointment.patient_name || 'Paciente'} - ${dateStr} ${time}`,
          html: doctorEmailHtml
        }),
      })
      
      console.log('✅ Email sent to doctor via Resend')
    }

    // ===== 3. EMAIL AL PACIENTE (RESEND) =====
    if (RESEND_API_KEY && appointment.patient_email) {
      const patientEmailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f4f7f3; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e4d7b 0%, #3ea99f 100%); padding: 40px 20px; text-align: center; }
    .logo { width: 80px; height: 80px; background: white; border-radius: 20px; margin: 0 auto 20px; font-size: 32px; font-weight: 700; color: #1e4d7b; line-height: 80px; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 40px 30px; }
    .success-icon { font-size: 64px; text-align: center; margin: 20px 0; }
    .info-box { background: #e8f5e9; border-radius: 12px; padding: 24px; margin: 24px 0; border: 2px solid #4caf50; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; }
    .info-label { font-weight: 600; color: #546e7a; }
    .info-value { color: #1e4d7b; font-weight: 600; }
    .highlight-box { background: #fff9e6; border-left: 4px solid #ff9800; padding: 16px; margin: 24px 0; border-radius: 8px; }
    .btn { display: inline-block; background: #4caf50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">VM</div>
      <h1>✅ ¡Cita Confirmada!</h1>
    </div>
    <div class="content">
      <div class="success-icon">🎉</div>
      
      <p style="font-size: 16px; text-align: center; color: #2c3e50;">
        Hola <strong>${appointment.patient_name}</strong>,
      </p>
      
      <p style="text-align: center; color: #546e7a;">
        Su cita ha sido registrada exitosamente en el <strong>Consultorio Virgen Merced</strong>.
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">📅 Fecha:</span>
          <span class="info-value">${dateStr}</span>
        </div>
        <div class="info-row">
          <span class="info-label">⏰ Hora:</span>
          <span class="info-value">${time}</span>
        </div>
        <div class="info-row">
          <span class="info-label">💬 Motivo:</span>
          <span class="info-value">${appointment.appointment_type || appointment.reason || 'Consulta'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">📍 Lugar:</span>
          <span class="info-value">Consultorio Virgen Merced</span>
        </div>
      </div>

      <div class="highlight-box">
        <strong>📬 Recordatorios automáticos:</strong>
        <ul style="margin: 12px 0; padding-left: 20px; color: #546e7a;">
          <li>Recibirá un recordatorio <strong>24 horas antes</strong> de su cita</li>
          <li>Recibirá otro recordatorio <strong>2 horas antes</strong></li>
        </ul>
      </div>

      <p style="text-align: center; color: #546e7a; font-size: 14px;">
        Le confirmaremos su cita por <strong>WhatsApp</strong> en breve.
      </p>

      <div style="text-align: center;">
        <a href="https://virgenmerced.vercel.app/agendar" class="btn">📅 Agendar Otra Cita</a>
      </div>

      <p style="font-size: 12px; color: #999; text-align: center; margin-top: 30px;">
        Si necesita cancelar o reprogramar, por favor contáctenos.<br>
        Por favor llegue <strong>10 minutos antes</strong> de su hora agendada.
      </p>
    </div>
    <div class="footer">
      <p><strong>Consultorio Virgen Merced</strong></p>
      <p>Sistema de Gestión de Citas</p>
    </div>
  </div>
</body>
</html>`

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Virgen Merced <onboarding@resend.dev>',
          to: [appointment.patient_email],
          subject: `✅ Cita confirmada - ${dateStr} ${time}`,
          html: patientEmailHtml
        }),
      })
      
      console.log('✅ Email sent to patient via Resend')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notificaciones enviadas',
        telegram: !!TELEGRAM_BOT_TOKEN,
        email_doctor: !!RESEND_API_KEY,
        email_patient: !!(RESEND_API_KEY && appointment.patient_email)
      }),
      { 
        status: 200,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error completo:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})