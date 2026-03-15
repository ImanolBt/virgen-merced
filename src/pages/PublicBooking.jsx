import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PublicBooking() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    appointmentType: '',
    date: '',
    time: ''
  })
  const [availableSlots, setAvailableSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')
  const [successData, setSuccessData] = useState(null)

  const appointmentTypes = [
    'Medicina General',
    'Obesidad',
    'Diabetes'
  ]

  useEffect(() => {
    if (formData.date) {
      loadAvailableSlots()
    }
  }, [formData.date])

  const loadAvailableSlots = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .rpc('get_available_slots_v2', { target_date: formData.date })

      if (error) throw error

      const available = data?.filter(slot => slot.is_available && slot.appointments_count === 0) || []
      setAvailableSlots(available)

      if (available.length === 0) {
        setError('No hay horarios disponibles para esta fecha. Por favor seleccione otro día.')
      }
    } catch (err) {
      console.error('Error loading slots:', err)
      setError('Error al cargar horarios disponibles. Intente nuevamente.')
      setAvailableSlots([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name || !formData.phone || !formData.appointmentType || !formData.date || !formData.time) {
      setError('Por favor complete todos los campos')
      return
    }

    if (formData.phone.length < 10) {
      setError('Ingrese un número de teléfono válido (10 dígitos)')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const appointmentData = {
        patient_name: formData.name,
        patient_phone: formData.phone,
        appointment_type: formData.appointmentType,
        appointment_date: formData.date,
        appointment_time: formData.time,
        reason: formData.appointmentType,
        status: 'pending',
        created_via: 'web_form'
      }

      const { data, error: appointmentError } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single()

      if (appointmentError) throw appointmentError

      console.log('✅ Cita creada:', data)

      // ===== ENVIAR NOTIFICACIONES AUTOMÁTICAS =====
      try {
        console.log('Enviando notificaciones...')
        
        const notifyResponse = await fetch(
          'https://xdnkifgqfyotepgpapxe.supabase.co/functions/v1/notify-new-appointment',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              appointment: data
            })
          }
        )
        
        const notifyResult = await notifyResponse.json()
        console.log('Resultado notificaciones:', notifyResult)
        
        if (notifyResponse.ok) {
          console.log('✅ Notificaciones enviadas exitosamente')
        } else {
          console.error('❌ Error en notificaciones:', notifyResult)
        }
      } catch (notifyError) {
        console.error('❌ Error enviando notificaciones:', notifyError)
        // No detenemos el flujo si fallan las notificaciones
      }

      // Guardar datos para el modal
      setSuccessData({
        name: formData.name,
        date: formData.date,
        time: formData.time,
        type: formData.appointmentType
      })

      // Mostrar éxito
      setShowSuccess(true)

      // Limpiar formulario
      setFormData({
        name: '',
        phone: '',
        appointmentType: '',
        date: '',
        time: ''
      })
      setAvailableSlots([])

    } catch (err) {
      console.error('Error creating appointment:', err)
      setError('Error al agendar la cita. Por favor intente nuevamente o contacte al consultorio.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (time) => time?.substring(0, 5) || time
  
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('es-EC', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const closeModal = () => {
    setShowSuccess(false)
    setSuccessData(null)
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #faf8f5 0%, #ffffff 100%)',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    }}>
      {/* Decoración de fondo */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.4,
        zIndex: 0
      }}>
        <div style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, #3ea99f 0%, transparent 70%)',
          top: '-100px',
          right: '-100px',
          borderRadius: '50%'
        }}></div>
        <div style={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, #e8927c 0%, transparent 70%)',
          bottom: '-50px',
          left: '-50px',
          borderRadius: '50%'
        }}></div>
      </div>

      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '48px',
        maxWidth: '600px',
        width: '100%',
        boxShadow: '0 12px 48px rgba(30, 77, 123, 0.12)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #1e4d7b 0%, #3ea99f 100%)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '32px',
            fontWeight: '700',
            fontFamily: 'Georgia, serif'
          }}>
            VM
          </div>
          <h1 style={{ 
            fontSize: '32px', 
            color: '#1e4d7b', 
            marginBottom: '8px',
            fontWeight: '600'
          }}>
            Agendar Cita
          </h1>
          <p style={{ color: '#546e7a', fontSize: '16px' }}>
            Consultorio Virgen Merced
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '24px',
            borderLeft: '4px solid #e57373',
            fontSize: '14px'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Nombre */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ 
              display: 'block', 
              fontWeight: '600', 
              color: '#2c3e50', 
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              Nombre Completo <span style={{ color: '#e8927c' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Juan Carlos Pérez"
              required
              style={{
                width: '100%',
                padding: '14px 18px',
                border: '2px solid #e8eef3',
                borderRadius: '12px',
                fontSize: '15px',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3ea99f'
                e.target.style.boxShadow = '0 0 0 4px rgba(62, 169, 159, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e8eef3'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Teléfono */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ 
              display: 'block', 
              fontWeight: '600', 
              color: '#2c3e50', 
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              Teléfono / WhatsApp <span style={{ color: '#e8927c' }}>*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
              placeholder="Ej: 0987654321"
              maxLength="10"
              required
              style={{
                width: '100%',
                padding: '14px 18px',
                border: '2px solid #e8eef3',
                borderRadius: '12px',
                fontSize: '15px',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3ea99f'
                e.target.style.boxShadow = '0 0 0 4px rgba(62, 169, 159, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e8eef3'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Motivo */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ 
              display: 'block', 
              fontWeight: '600', 
              color: '#2c3e50', 
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              Motivo de Consulta <span style={{ color: '#e8927c' }}>*</span>
            </label>
            <select
              value={formData.appointmentType}
              onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '14px 18px',
                border: '2px solid #e8eef3',
                borderRadius: '12px',
                fontSize: '15px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none',
                backgroundColor: 'white'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3ea99f'
                e.target.style.boxShadow = '0 0 0 4px rgba(62, 169, 159, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e8eef3'
                e.target.style.boxShadow = 'none'
              }}
            >
              <option value="">Seleccione una opción</option>
              {appointmentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ 
              display: 'block', 
              fontWeight: '600', 
              color: '#2c3e50', 
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              Fecha de la Cita <span style={{ color: '#e8927c' }}>*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })}
              min={today}
              required
              style={{
                width: '100%',
                padding: '14px 18px',
                border: '2px solid #e8eef3',
                borderRadius: '12px',
                fontSize: '15px',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3ea99f'
                e.target.style.boxShadow = '0 0 0 4px rgba(62, 169, 159, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e8eef3'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Horarios */}
          {formData.date && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                color: '#2c3e50', 
                marginBottom: '12px',
                fontSize: '14px'
              }}>
                Horario Disponible <span style={{ color: '#e8927c' }}>*</span>
              </label>
              
              {loading ? (
                <div style={{
                  textAlign: 'center',
                  padding: '24px',
                  color: '#546e7a',
                  background: '#f5f5f5',
                  borderRadius: '10px'
                }}>
                  Cargando horarios...
                </div>
              ) : availableSlots.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: '10px',
                  marginTop: '12px'
                }}>
                  {availableSlots.map((slot) => (
                    <div
                      key={slot.slot_time}
                      onClick={() => setFormData({ ...formData, time: slot.slot_time })}
                      style={{
                        padding: '14px',
                        border: formData.time === slot.slot_time ? '2px solid #1e4d7b' : '2px solid #e8eef3',
                        borderRadius: '10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                        background: formData.time === slot.slot_time ? 'linear-gradient(135deg, #1e4d7b 0%, #3ea99f 100%)' : 'white',
                        color: formData.time === slot.slot_time ? 'white' : '#2c3e50'
                      }}
                      onMouseEnter={(e) => {
                        if (formData.time !== slot.slot_time) {
                          e.target.style.borderColor = '#3ea99f'
                          e.target.style.transform = 'translateY(-2px)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (formData.time !== slot.slot_time) {
                          e.target.style.borderColor = '#e8eef3'
                          e.target.style.transform = 'translateY(0)'
                        }
                      }}
                    >
                      {formatTime(slot.slot_time)}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '24px',
                  color: '#546e7a',
                  background: '#f5f5f5',
                  borderRadius: '10px'
                }}>
                  No hay horarios disponibles para esta fecha
                </div>
              )}
            </div>
          )}

          {/* Botón Submit */}
          <button 
            type="submit" 
            disabled={submitting || !formData.time}
            style={{
              width: '100%',
              padding: '18px',
              background: submitting || !formData.time ? '#cccccc' : 'linear-gradient(135deg, #1e4d7b 0%, #3ea99f 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: submitting || !formData.time ? 'not-allowed' : 'pointer',
              marginTop: '12px',
              transition: 'all 0.3s',
              boxShadow: submitting || !formData.time ? 'none' : '0 8px 24px rgba(30, 77, 123, 0.2)'
            }}
            onMouseEnter={(e) => {
              if (!submitting && formData.time) {
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 12px 32px rgba(30, 77, 123, 0.3)'
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting && formData.time) {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = '0 8px 24px rgba(30, 77, 123, 0.2)'
              }
            }}
          >
            {submitting ? 'Agendando...' : '✓ Confirmar Cita'}
          </button>
        </form>
      </div>

      {/* Modal de Éxito */}
      {showSuccess && successData && (
        <div 
          onClick={closeModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '24px',
              padding: '48px',
              maxWidth: '480px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #4caf50, #66bb6a)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              color: 'white'
            }}>
              ✓
            </div>
            
            <h2 style={{
              fontSize: '28px',
              color: '#1e4d7b',
              marginBottom: '16px',
              fontWeight: '600'
            }}>
              ¡Cita Agendada!
            </h2>
            
            <p style={{
              color: '#546e7a',
              marginBottom: '24px',
              fontSize: '16px'
            }}>
              Su cita ha sido registrada exitosamente.
            </p>
            
            <div style={{
              background: '#e8f5e9',
              padding: '24px',
              borderRadius: '16px',
              margin: '24px 0',
              textAlign: 'left',
              border: '2px solid #4caf50'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0'
              }}>
                <span style={{ fontWeight: '600', color: '#546e7a' }}>Paciente:</span>
                <span style={{ color: '#1e4d7b', fontWeight: '600' }}>{successData.name}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderTop: '1px solid rgba(76, 175, 80, 0.2)'
              }}>
                <span style={{ fontWeight: '600', color: '#546e7a' }}>Fecha:</span>
                <span style={{ color: '#1e4d7b', fontWeight: '600' }}>{formatDate(successData.date)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderTop: '1px solid rgba(76, 175, 80, 0.2)'
              }}>
                <span style={{ fontWeight: '600', color: '#546e7a' }}>Hora:</span>
                <span style={{ color: '#1e4d7b', fontWeight: '600' }}>{formatTime(successData.time)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderTop: '1px solid rgba(76, 175, 80, 0.2)'
              }}>
                <span style={{ fontWeight: '600', color: '#546e7a' }}>Motivo:</span>
                <span style={{ color: '#1e4d7b', fontWeight: '600' }}>{successData.type}</span>
              </div>
            </div>
            
            <p style={{
              fontSize: '14px',
              color: '#546e7a',
              marginBottom: '24px'
            }}>
              Le confirmaremos por WhatsApp pronto.
            </p>
            
            <button 
              onClick={closeModal}
              style={{
                padding: '14px 32px',
                background: '#3ea99f',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '15px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#1e4d7b'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#3ea99f'
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