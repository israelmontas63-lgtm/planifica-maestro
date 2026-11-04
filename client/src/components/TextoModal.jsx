import { useState, useEffect, useRef } from "react";

function BookOpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export default function TextoModal({ 
  initialValue = "", 
  titulo = "¿Qué deseas consultar o preparar?", 
  onCancel, 
  onConfirm,
  onConsultarCurriculo
}) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef(null);

  const displayTitle = (titulo === "Describe la planificación" || !titulo)
    ? "¿Qué deseas consultar o preparar?"
    : titulo;

  useEffect(() => {
    setValue(initialValue);
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Colocar el cursor al final del texto predefinido
      const len = (initialValue || "").length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [initialValue]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div 
        className="modal-box max-h-[85dvh] flex flex-col overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: "85dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: 0
        }}
      >
        {/* Cabecera del modal */}
        <div 
          style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            padding: "16px 18px 12px",
            borderBottom: "1px solid #f1f5f9"
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--pm-navy, #12304a)" }}>
            {displayTitle}
          </h3>
          <button 
            type="button" 
            onClick={onCancel}
            style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b", padding: "4px" }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo con el textarea y avisos (con scroll interno) */}
        <div 
          className="overflow-y-auto p-4 flex-1"
          style={{
            overflowY: "auto",
            padding: "16px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}
        >
          <textarea
            ref={textareaRef}
            autoFocus
            placeholder="Escribe una pregunta pedagógica, un tema de clase o la actividad que necesitas..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            style={{
              width: "100%",
              minHeight: "120px",
              borderRadius: "11px",
              border: "1.5px solid var(--gris-borde, #dde8ea)",
              padding: "11px 13px",
              fontSize: "14px",
              fontFamily: "inherit",
              resize: "vertical",
              color: "var(--texto, #12304a)",
              outline: "none",
              boxSizing: "border-box"
            }}
          />

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#475569",
            background: "#f8fafc",
            padding: "8px 10px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0"
          }}>
            <span style={{ fontSize: "13px" }}>🔒</span>
            <span><strong>Privacidad:</strong> Por seguridad de los alumnos, no ingreses nombres de estudiantes ni datos personales sensibles.</span>
          </div>

          {onConsultarCurriculo && (
            <div>
              <button
                type="button"
                onClick={onConsultarCurriculo}
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  color: "#166534",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
                title="Consultar competencias e indicadores en el currículo oficial"
              >
                <BookOpenIcon />
                <span>Ver en Malla Curricular</span>
              </button>
            </div>
          )}
        </div>

        {/* Barra inferior de botones fija sobre el teclado */}
        <div 
          className="sticky bottom-0 bg-white pt-2 border-t border-slate-100 flex gap-2 modal-actions"
          style={{
            position: "sticky",
            bottom: 0,
            backgroundColor: "#ffffff",
            padding: "12px 16px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            gap: "10px",
            margin: 0
          }}
        >
          <button 
            type="button" 
            onClick={onCancel} 
            style={{ 
              background: "#f1f5f9",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              padding: "10px 16px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              flex: 1
            }}
          >
            Cancelar
          </button>
          <button 
            type="button"
            style={{ 
              background: "var(--teal, #1a7d8c)", 
              color: "white",
              border: "none",
              borderRadius: "10px",
              padding: "10px 18px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: value.trim() ? "pointer" : "not-allowed",
              opacity: value.trim() ? 1 : 0.6,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              flex: 1.5
            }} 
            onClick={() => onConfirm(value)} 
            disabled={!value.trim()}
          >
            <span>Enviar consulta</span>
            <span style={{ fontSize: "13px" }}>➤</span>
          </button>
        </div>
      </div>
    </div>
  );
}
