import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')!

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    const now = new Date()
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    
    // Buscar citas en 24 horas
    const { data: appointments24h } = await supabase
      .from('appointments')
      .select('*')
      .eq('status', 'confirmed')
      .gte('appointment_date', in24Hours.toISOString().split('T')[0])
      .lte('appointment_date', in24Hours.toISOString().split('T')[0])
      .is('reminder_24h_sent', null)
    
    // Buscar citas en 2 horas
    const { data: appointments2h } = await supabase
      .from('appointments')
      .select('*')
      .eq('status', 'confirmed')
      .eq('appointment_date', now.toISOString().split('T')[0])
      .is('reminder_2h_sent', null)
    
    let sent24h = 0
    let sent2h = 0
    
    // Enviar recordatorios 24h
    for (const apt of (appointments24h || [])) {
      const dateStr = new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('es-EC', { 
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
      })
      const time = apt.appointment_time?.substring(0, 5)
      
      if (apt.patient_email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Virgen Merced <onboarding@resend.dev>',
            to: [apt.patient_email],
            subject: `🔔 Recordatorio: Cita mañana ${time}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f7f3;">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #1e4d7b 0%, #3ea99f 100%); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Recordatorio de Cita</h1>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #2c3e50;">Hola <strong>${apt.patient_name}</strong>,</p>
      <p style="color: #546e7a;">Le recordamos que tiene una cita <strong>mañana</strong>:</p>
      <div style="background: #fff9e6; border-left: 4px solid #ff9800; padding: 20px; margin: 24px 0; border-radius: 8px;">
        <div style="margin: 8px 0;"><strong>📅 Fecha:</strong> ${dateStr}</div>
        <div style="margin: 8px 0;"><strong>⏰ Hora:</strong> ${time}</div>
        <div style="margin: 8px 0;"><strong>💬 Motivo:</strong> ${apt.appointment_type || apt.reason}</div>
        <div style="margin: 8px 0;"><strong>📍 Lugar:</strong> Consultorio Virgen Merced</div>
      </div>
      <p style="color: #546e7a; font-size: 14px;">Por favor llegue 10 minutos antes de su cita.</p>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">Si necesita cancelar o reprogramar, por favor contáctenos.</p>
    </div>
  </div>
</body>
</html>
            `,
          }),
        })
      }
      
      await supabase
        .from('appointments')
        .update({ reminder_24h_sent: new Date().toISOString() })
        .eq('id', apt.id)
      
      sent24h++
    }
    
    // Enviar recordatorios 2h
    for (const apt of (appointments2h || [])) {
      const aptTime = apt.appointment_time?.substring(0, 5)
      const [hours, minutes] = aptTime.split(':').map(Number)
      const aptDateTime = new Date(apt.appointment_date + 'T00:00:00')
      aptDateTime.setHours(hours, minutes)
      
      const diffMs = aptDateTime.getTime() - now.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      
      if (diffHours >= 1.5 && diffHours <= 2.5) {
        if (apt.patient_email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Virgen Merced <onboarding@resend.dev>',
              to: [apt.patient_email],
              subject: `⏰ Su cita es en 2 horas - ${aptTime}`,
              html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f7f3;">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">⏰ ¡Su cita es pronto!</h1>
    </div>
    <div style="padding: 32px; text-align: center;">
      <p style="font-size: 18px; color: #2c3e50; margin-bottom: 24px;">Hola <strong>${apt.patient_name}</strong>,</p>
      <div style="background: #ffe6e6; padding: 24px; border-radius: 12px; margin: 24px 0;">
        <div style="font-size: 48px; margin-bottom: 16px;">⏰</div>
        <div style="font-size: 24px; font-weight: 600; color: #e74c3c;">En 2 horas</div>
        <div style="font-size: 32px; font-weight: 700; color: #1e4d7b; margin: 16px 0;">${aptTime}</div>
      </div>
      <p style="color: #546e7a;">📍 Consultorio Virgen Merced</p>
      <p style="color: #999; font-size: 14px; margin-top: 24px;">¡Le esperamos!</p>
    </div>
  </div>
</body>
</html>
              `,
            }),
          })
        }
        
        // Notificar al doctor también
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: `⏰ *Recordatorio: Cita en 2 horas*\n\n👤 ${apt.patient_name}\n🕐 ${aptTime}\n💬 ${apt.appointment_type || apt.reason}`,
              parse_mode: 'Markdown'
            })
          })
        }
        
        await supabase
          .from('appointments')
          .update({ reminder_2h_sent: new Date().toISOString() })
          .eq('id', apt.id)
        
        sent2h++
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        sent24h, 
        sent2h,
        message: `Enviados: ${sent24h} recordatorios 24h, ${sent2h} recordatorios 2h`
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})