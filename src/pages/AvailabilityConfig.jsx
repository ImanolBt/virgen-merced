import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AvailabilityConfig() {
  const [selectedDate, setSelectedDate] = useState('')
  const [timeSlots, setTimeSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Horarios base (7:00 AM a 7:00 PM, cada 30 min)
  const baseTimeSlots = []
  for (let hour = 7; hour <= 19; hour++) {
    for (let min of ['00', '30']) {
      if (hour === 19 && min === '30') break
      const time = `${hour.toString().padStart(2, '0')}:${min}:00`
      baseTimeSlots.push(time)
    }
  }

  useEffect(() => {
    if (selectedDate) {
      loadAvailability()
    }
  }, [selectedDate])

  const loadAvailability = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('doctor_availability')
        .select('*')
        .eq('date', selectedDate)

      if (error) throw error

      // Crear mapa de disponibilidad existente
      const availabilityMap = {}
      if (data) {
        data.forEach(slot => {
          availabilityMap[slot.time_slot] = slot.is_available
        })
      }

      // Combinar con horarios base
      const slots = baseTimeSlots.map(time => ({
        time,
        isAvailable: availabilityMap[time] !== undefined ? availabilityMap[time] : false
      }))

      setTimeSlots(slots)
    } catch (error) {
      console.error('Error loading availability:', error)
      alert('Error al cargar horarios')
    } finally {
      setLoading(false)
    }
  }

  const toggleSlot = (time) => {
    setTimeSlots(prev =>
      prev.map(slot =>
        slot.time === time ? { ...slot, isAvailable: !slot.isAvailable } : slot
      )
    )
  }

  const saveAvailability = async () => {
    if (!selectedDate) {
      alert('Seleccione una fecha primero')
      return
    }

    setSaving(true)
    try {
      // Eliminar horarios existentes de esta fecha
      await supabase
        .from('doctor_availability')
        .delete()
        .eq('date', selectedDate)

      // Insertar solo los horarios disponibles
      const slotsToInsert = timeSlots
        .filter(slot => slot.isAvailable)
        .map(slot => ({
          date: selectedDate,
          time_slot: slot.time,
          is_available: true
        }))

      if (slotsToInsert.length > 0) {
        const { error } = await supabase
          .from('doctor_availability')
          .insert(slotsToInsert)

        if (error) throw error
      }

      alert('✅ Horarios guardados exitosamente')
    } catch (error) {
      console.error('Error saving availability:', error)
      alert('❌ Error al guardar horarios')
    } finally {
      setSaving(false)
    }
  }

  const selectAll = () => {
    setTimeSlots(prev => prev.map(slot => ({ ...slot, isAvailable: true })))
  }

  const clearAll = () => {
    setTimeSlots(prev => prev.map(slot => ({ ...slot, isAvailable: false })))
  }

  // Formatear hora para mostrar (sin segundos)
  const formatTime = (time) => time.substring(0, 5)

  // Fecha mínima: hoy
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="availability-config-page">
      <div className="page-header">
        <h1>📅 Configurar Horarios Disponibles</h1>
        <p>Marque los horarios en los que puede atender pacientes</p>
      </div>

      <div className="config-card">
        {/* Selector de fecha */}
        <div className="date-selector">
          <label htmlFor="config-date">Seleccionar Fecha:</label>
          <input
            type="date"
            id="config-date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={today}
          />
        </div>

        {selectedDate && (
          <>
            {/* Botones de acción rápida */}
            <div className="quick-actions">
              <button onClick={selectAll} className="btn-secondary">
                ✓ Seleccionar Todos
              </button>
              <button onClick={clearAll} className="btn-secondary">
                ✗ Limpiar Todos
              </button>
            </div>

            {/* Grid de horarios */}
            {loading ? (
              <div className="loading-state">Cargando horarios...</div>
            ) : (
              <div className="time-slots-grid">
                {timeSlots.map((slot) => (
                  <div
                    key={slot.time}
                    className={`time-slot-item ${slot.isAvailable ? 'available' : 'unavailable'}`}
                    onClick={() => toggleSlot(slot.time)}
                  >
                    <span className="time-label">{formatTime(slot.time)}</span>
                    <span className="status-icon">
                      {slot.isAvailable ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Botón guardar */}
            <button
              onClick={saveAvailability}
              disabled={saving}
              className="btn-save"
            >
              {saving ? 'Guardando...' : '💾 Guardar Horarios'}
            </button>
          </>
        )}

        {!selectedDate && (
          <div className="empty-state">
            <p>👆 Seleccione una fecha para configurar los horarios</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .availability-config-page {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .page-header h1 {
          font-size: 28px;
          color: #1e4d7b;
          margin-bottom: 8px;
        }

        .page-header p {
          color: #546e7a;
          font-size: 16px;
        }

        .config-card {
          background: white;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        }

        .date-selector {
          margin-bottom: 24px;
        }

        .date-selector label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          color: #2c3e50;
        }

        .date-selector input[type="date"] {
          width: 100%;
          max-width: 300px;
          padding: 12px 16px;
          border: 2px solid #e8eef3;
          border-radius: 8px;
          font-size: 15px;
        }

        .quick-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }

        .btn-secondary {
          padding: 10px 20px;
          border: 2px solid #3ea99f;
          background: white;
          color: #3ea99f;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: #3ea99f;
          color: white;
        }

        .time-slots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .time-slot-item {
          padding: 16px;
          border: 2px solid #e8eef3;
          border-radius: 10px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .time-slot-item.available {
          background: #e8f5e9;
          border-color: #4caf50;
        }

        .time-slot-item.unavailable {
          background: #ffebee;
          border-color: #e57373;
        }

        .time-slot-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .time-label {
          font-weight: 600;
          font-size: 14px;
          color: #2c3e50;
        }

        .status-icon {
          font-size: 18px;
        }

        .time-slot-item.available .status-icon {
          color: #4caf50;
        }

        .time-slot-item.unavailable .status-icon {
          color: #e57373;
        }

        .btn-save {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #1e4d7b 0%, #3ea99f 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-save:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(30, 77, 123, 0.3);
        }

        .btn-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-state,
        .empty-state {
          text-align: center;
          padding: 48px;
          color: #546e7a;
          font-size: 16px;
        }

        @media (max-width: 768px) {
          .time-slots-grid {
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 8px;
          }

          .config-card {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  )
}