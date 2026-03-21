import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PublicBooking() {
  const [formData, setFormData] = useState({
    name: '',
    cedula: '',
    phone: '',
    email: '',
    appointmentType: '',
    date: '',
    time: ''
  })

  const [availableSlots, setAvailableSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  useEffect(() => {
    if (formData.date) {
      loadAvailableSlots(formData.date)
    }
  }, [formData.date])

  async function loadAvailableSlots(date) {
    try {
      const { data, error } = await supabase
        .rpc('get_available_slots_v2', { target_date: date })

      if (error) throw error
      
      const available = (data || [])
        .filter(slot => slot.is_available && slot.appointments_count === 0)
        .map(slot => slot.slot_time)
      
      setAvailableSlots(available)
    } catch (err) {
      console.error('Error loading slots:', err)
      setAvailableSlots([])
    }
  }

 async function handleSubmit(e) {
  e.preventDefault()
  
  if (!formData.name || !formData.cedula || !formData.phone || !formData.email || !formData.appointmentType || !formData.date || !formData.time) {
    alert('Por favor complete todos los campos')
    return
  }

  if (formData.phone.length !== 10) {
    alert('El teléfono debe tener 10 dígitos')
    return
  }

  if (formData.cedula.length !== 10) {
    alert('La cédula debe tener 10 dígitos')
    return
  }

  setLoading(true)

  try {
    // ===== 1. BUSCAR SI EL PACIENTE YA EXISTE (por cédula) =====
    const { data: existingPatients, error: searchError } = await supabase
      .from('patients')
      .select('id')
      .eq('cedula', formData.cedula)
      .limit(1)

    if (searchError) throw searchError

    let patientId = null

    // ===== 2. SI NO EXISTE, CREAR PACIENTE NUEVO =====
    if (!existingPatients || existingPatients.length === 0) {
      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert({
          name: formData.name,
          cedula: formData.cedula,
          phone: formData.phone,
          email: formData.email
          // SIN created_via
        })
        .select()
        .single()

      if (patientError) {
        console.error('❌ Error creando paciente:', patientError)
        throw patientError
      }
      
      patientId = newPatient.id
      console.log('✅ Nuevo paciente creado:', newPatient)
    } else {
      // ===== 3. SI YA EXISTE, USAR ESE ID =====
      patientId = existingPatients[0].id
      console.log('✅ Paciente existente encontrado:', patientId)
      
      // Actualizar datos por si cambiaron
      await supabase
        .from('patients')
        .update({ 
          name: formData.name,
          phone: formData.phone,
          email: formData.email
        })
        .eq('id', patientId)
    }

    // ===== 4. CREAR LA CITA CON EL PATIENT_ID =====
    const appointmentData = {
      patient_id: patientId,
      patient_name: formData.name,
      patient_phone: formData.phone,
      patient_email: formData.email,
      patient_cedula: formData.cedula,
      appointment_type: formData.appointmentType,
      reason: formData.appointmentType,
      appointment_date: formData.date,
      appointment_time: formData.time,
      status: 'pending'
      // SIN created_via
    }

    const { data: appointmentCreated, error: appointmentError } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select()
      .single()

    if (appointmentError) {
      console.error('❌ Error creando cita:', appointmentError)
      throw appointmentError
    }

    console.log('✅ Cita creada exitosamente:', appointmentCreated)

    // ===== 5. ENVIAR NOTIFICACIONES =====
    try {
      await supabase.functions.invoke('notify-new-appointment', {
        body: { appointment: appointmentCreated }
      })
      console.log('✅ Notificaciones enviadas')
    } catch (notifError) {
      console.error('⚠️ Error enviando notificaciones (pero la cita se creó):', notifError)
    }

    setShowSuccess(true)
    setFormData({
      name: '',
      cedula: '',
      phone: '',
      email: '',
      appointmentType: '',
      date: '',
      time: ''
    })

  } catch (err) {
    console.error('Error:', err)
    alert(`Error al agendar la cita: ${err.message}`)
  } finally {
    setLoading(false)
  }
}
const getMinDate = () => {
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, '0')
  const day = String(new Date().getDate()).padStart(2, '0')
  const minDate = `${year}-${month}-${day}`
  console.log('📅 Fecha mínima:', minDate)  // ← DEBUG
  return minDate
}

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1a1a',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden'
      }}>
        
        {/* LOGO - SIN PADDING */}
        <div style={{
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img 
            src="/logo-new.png" 
            alt="Dr. Washington Masapanta" 
            style={{
              width: '100%',
              maxWidth: '100%',
              height: 'auto',
              display: 'block'
            }}
          />
        </div>

        {/* TÍTULO */}
        <div style={{
          padding: '30px 30px 25px',
          textAlign: 'center',
          background: 'white',
          borderBottom: '2px solid #f0f0f0'
        }}>
          <h1 style={{
            margin: '0 0 8px',
            fontSize: '28px',
            fontWeight: '700',
            color: '#2c3e50',
            letterSpacing: '-0.5px'
          }}>
            Agendar Cita Médica
          </h1>
          <p style={{
            margin: 0,
            fontSize: '15px',
            color: '#7f8c8d'
          }}>
            Complete el formulario y le confirmaremos por WhatsApp
          </p>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} style={{
          padding: '35px 30px 45px',
          background: 'white'
        }}>
          
          {/* Nombre */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Nombre Completo <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Ej: Juan Carlos Pérez"
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '15px',
                border: '2px solid #e8e8e8',
                borderRadius: '10px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fafafa',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#D4AF37'
                e.target.style.background = 'white'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e8e8e8'
                e.target.style.background = '#fafafa'
              }}
            />
          </div>
<div style={{ marginBottom: '22px' }}>
  <label style={{
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#2c3e50'
  }}>
    Cédula <span style={{ color: '#e74c3c' }}>*</span>
  </label>
  <input
    type="text"
    name="cedula"
    value={formData.cedula}
    onChange={handleChange}
    required
    placeholder="1234567890"
    maxLength="10"
    style={{
      width: '100%',
      padding: '14px 16px',
      fontSize: '15px',
      border: '2px solid #e8e8e8',
      borderRadius: '10px',
      outline: 'none',
      boxSizing: 'border-box',
      background: '#fafafa',
      transition: 'all 0.2s'
    }}
    onFocus={(e) => {
      e.target.style.borderColor = '#D4AF37'
      e.target.style.background = 'white'
    }}
    onBlur={(e) => {
      e.target.style.borderColor = '#e8e8e8'
      e.target.style.background = '#fafafa'
    }}
  />
  <p style={{
    margin: '6px 0 0',
    fontSize: '12px',
    color: '#888'
  }}>
    📋 10 dígitos sin guiones
  </p>
</div>
          {/* Teléfono */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Teléfono / WhatsApp <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="0987654321"
              maxLength="10"
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '15px',
                border: '2px solid #e8e8e8',
                borderRadius: '10px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fafafa',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#D4AF37'
                e.target.style.background = 'white'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e8e8e8'
                e.target.style.background = '#fafafa'
              }}
            />
          </div>

          {/* Email */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Correo Electrónico <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="ejemplo@correo.com"
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '15px',
                border: '2px solid #e8e8e8',
                borderRadius: '10px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fafafa',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#D4AF37'
                e.target.style.background = 'white'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e8e8e8'
                e.target.style.background = '#fafafa'
              }}
            />
          </div>

          {/* Motivo */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Motivo de Consulta <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            <select
              name="appointmentType"
              value={formData.appointmentType}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '15px',
                border: '2px solid #e8e8e8',
                borderRadius: '10px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fafafa',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#D4AF37'
                e.target.style.background = 'white'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e8e8e8'
                e.target.style.background = '#fafafa'
              }}
            >
              <option value="">Seleccione una opción</option>
              <option value="Medicina General">Medicina General</option>
              <option value="Obesidad">Obesidad</option>
              <option value="Diabetes">Diabetes</option>
              <option value="Emergencia">Emergencia</option>
            </select>
          </div>

          {/* Fecha */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Fecha de la Cita <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              min={getMinDate()}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '15px',
                border: '2px solid #e8e8e8',
                borderRadius: '10px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fafafa',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#D4AF37'
                e.target.style.background = 'white'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e8e8e8'
                e.target.style.background = '#fafafa'
              }}
            />
          </div>

          {/* Horario */}
          {formData.date && (
            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block',
                marginBottom: '12px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Horario Disponible <span style={{ color: '#e74c3c' }}>*</span>
              </label>
              
              {availableSlots.length === 0 ? (
                <div style={{
                  padding: '20px',
                  background: '#fff9e6',
                  borderRadius: '10px',
                  textAlign: 'center',
                  color: '#8B7355',
                  fontSize: '14px',
                  border: '2px solid #f0e5d8'
                }}>
                  No hay horarios disponibles
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: '10px'
                }}>
                  {availableSlots.map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, time: slot }))}
                      style={{
                        padding: '13px',
                        fontSize: '14px',
                        fontWeight: '600',
                        border: formData.time === slot ? '2px solid #D4AF37' : '2px solid #e8e8e8',
                        background: formData.time === slot ? '#D4AF37' : '#fafafa',
                        color: formData.time === slot ? '#fff' : '#2c3e50',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (formData.time !== slot) {
                          e.target.style.borderColor = '#D4AF37'
                          e.target.style.background = '#fff9f5'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (formData.time !== slot) {
                          e.target.style.borderColor = '#e8e8e8'
                          e.target.style.background = '#fafafa'
                        }
                      }}
                    >
                      {slot.substring(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Botón */}
          {/* Botón */}
<button
  type="submit"
  disabled={loading}
  style={{
    width: '100%',
    padding: '17px',
    fontSize: '16px',
    fontWeight: '700',
    background: loading ? '#bdc3c7' : 'linear-gradient(135deg, #5DADE2 0%, #48C9B0 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: loading ? 'not-allowed' : 'pointer',
    boxShadow: '0 4px 15px rgba(93, 173, 226, 0.3)',
    transition: 'all 0.3s',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  }}
  onMouseEnter={(e) => {
    if (!loading) {
      e.target.style.transform = 'translateY(-2px)'
      e.target.style.boxShadow = '0 6px 20px rgba(93, 173, 226, 0.4)'
    }
  }}
  onMouseLeave={(e) => {
    e.target.style.transform = 'translateY(0)'
    e.target.style.boxShadow = '0 4px 15px rgba(93, 173, 226, 0.3)'
  }}
>
  {loading ? 'Agendando...' : 'Confirmar Cita'}
</button>
        </form>
      </div>

      {/* MODAL SUCCESS */}
      {showSuccess && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          backdropFilter: 'blur(5px)'
        }}
        onClick={() => setShowSuccess(false)}
        >
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '45px 35px',
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
            <h2 style={{ margin: '0 0 12px', color: '#27ae60', fontSize: '24px', fontWeight: '700' }}>
              ¡Cita Agendada!
            </h2>
            <p style={{ margin: '0 0 28px', color: '#7f8c8d', lineHeight: '1.6' }}>
              Recibirá confirmación por WhatsApp y email en breve.
            </p>
            <button
              onClick={() => setShowSuccess(false)}
              style={{
                padding: '13px 35px',
                background: '#D4AF37',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}