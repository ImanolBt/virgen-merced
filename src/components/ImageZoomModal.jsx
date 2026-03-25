import { useState, useRef } from "react";

export default function ImageZoomModal({ imageUrl, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 10)); // Incremento más pequeño
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 0.1, 1); // Decremento más pequeño
      if (newZoom === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Zoom más preciso y suave
    const delta = e.deltaY * -0.002; // Factor más pequeño para mayor precisión
    
    setZoom((prev) => {
      const newZoom = Math.max(1, Math.min(10, prev + delta));
      
      // Si regresa a 1, resetear posición
      if (newZoom === 1) {
        setPosition({ x: 0, y: 0 });
      }
      
      return newZoom;
    });
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Atajos de teclado para zoom más preciso
  const handleKeyDown = (e) => {
    if (e.key === "+") {
      handleZoomIn();
    } else if (e.key === "-") {
      handleZoomOut();
    } else if (e.key === "0" || e.key === "Escape") {
      handleReset();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        padding: 20,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        style={{
          position: "relative",
          width: "90vw",
          height: "90vh",
          background: "white",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8f9fa",
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 16, color: "#2c3e50" }}>
            📸 Imagen de la consulta
          </div>
          
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              style={{
                background: zoom <= 1 ? "#e0e0e0" : "#5DADE2",
                color: zoom <= 1 ? "#999" : "white",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: zoom <= 1 ? "not-allowed" : "pointer",
                fontSize: 16,
                fontWeight: "bold",
                transition: "background 0.2s",
              }}
            >
              −
            </button>
            
            <span
              style={{
                fontSize: 14,
                color: "#666",
                minWidth: 60,
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
            
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 10}
              style={{
                background: zoom >= 10 ? "#e0e0e0" : "#5DADE2",
                color: zoom >= 10 ? "#999" : "white",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: zoom >= 10 ? "not-allowed" : "pointer",
                fontSize: 16,
                fontWeight: "bold",
                transition: "background 0.2s",
              }}
            >
              +
            </button>
            
            <button
              onClick={handleReset}
              disabled={zoom === 1}
              style={{
                background: "transparent",
                color: zoom === 1 ? "#999" : "#5DADE2",
                border: `1px solid ${zoom === 1 ? "#e0e0e0" : "#5DADE2"}`,
                borderRadius: 6,
                padding: "6px 12px",
                cursor: zoom === 1 ? "not-allowed" : "pointer",
                fontSize: 13,
                transition: "all 0.2s",
              }}
            >
              Reset
            </button>

            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 24,
                cursor: "pointer",
                color: "#666",
                padding: "4px 8px",
                lineHeight: 1,
                marginLeft: 8,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Contenedor de imagen */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "#f5f5f5",
            cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
            position: "relative",
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              transition: isDragging ? "none" : "transform 0.05s ease-out",
              transformOrigin: "center center",
            }}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Imagen de consulta"
              draggable={false}
              style={{
                display: "block",
                maxWidth: "80vw",
                maxHeight: "75vh",
                objectFit: "contain",
                userSelect: "none",
              }}
              onError={(e) => {
                e.target.src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f0f0f0' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23999' font-size='16'%3EError cargando imagen%3C/text%3E%3C/svg%3E";
              }}
            />
          </div>
        </div>

        {/* Footer con instrucciones */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e0e0e0",
            background: "#f8f9fa",
            textAlign: "center",
            fontSize: 13,
            color: "#666",
            flexShrink: 0,
          }}
        >
          {zoom > 1
            ? "🖱️ Arrastra para mover · 🔍 Scroll para zoom preciso · ⌨️ + / - / 0 para ajustar"
            : "🔍 Usa scroll, botones o teclas + / - para zoom · ⌨️ 0 para resetear"}
        </div>
      </div>
    </div>
  );
}