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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders 
    })
  }

  try {
    const body = await req.json()
    console.log('Received payload:', JSON.stringify(body, null, 2))
    
    const appointment = body.appointment || body
    
    if (!appointment) {
      throw new Error('No appointment data received')
    }

    // Formatear fecha
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

    console.log('Formatted data:', { dateStr, time })

    // ===== 1. TELEGRAM =====
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const telegramMessage = `🔔 *Nueva cita agendada*

👤 *Paciente:* ${appointment.patient_name || 'No especificado'}
📅 *Fecha:* ${dateStr}
⏰ *Hora:* ${time}
💬 *Motivo:* ${appointment.appointment_type || appointment.reason || 'No especificado'}
📱 *Teléfono:* ${appointment.patient_phone || 'No especificado'}

_Cita registrada desde el formulario web_`

      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
      
      const telegramResponse = await fetch(telegramUrl, {
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

      const telegramResult = await telegramResponse.json()
      console.log('Telegram response:', telegramResult)
    }

    // ===== 2. EMAIL AL DOCTOR =====
    if (RESEND_API_KEY && DOCTOR_EMAIL) {
      const doctorEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
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
    .btn { display: inline-block; background: #3ea99f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 10px 5px; }
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
        <div class="info-row" style="border-bottom: none;">
          <span class="info-label">Teléfono:</span>
          <span class="info-value">${appointment.patient_phone || 'No especificado'}</span>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://virgenmerced.vercel.app/agenda" class="btn">📊 Ver en Dashboard</a>
      </div>

      <p style="color: #666; font-size: 14px;">
        Puedes confirmar esta cita entrando al dashboard y haciendo click en "Confirmar por WhatsApp".
      </p>
    </div>
    <div class="footer">
      <p>Virgen Merced - Sistema de Gestión de Citas</p>
    </div>
  </div>
</body>
</html>
`

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Virgen Merced <onboarding@resend.dev>',
          to: [DOCTOR_EMAIL],
          subject: `🔴 Nueva cita: ${appointment.patient_name || 'Paciente'} - ${dateStr} ${time}`,
          html: doctorEmailHtml,
        }),
      })

      const emailResult = await emailResponse.json()
      console.log('Email response:', emailResult)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notificaciones enviadas',
        telegram: !!TELEGRAM_BOT_TOKEN,
        email: !!RESEND_API_KEY
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
        error: error.message,
        stack: error.stack 
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