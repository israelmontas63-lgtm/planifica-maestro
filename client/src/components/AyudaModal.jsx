export default function AyudaModal({ onCerrar }) {
  return (
    <div className="schema-overlay" onClick={onCerrar} style={{ zIndex: 1200 }}>
      <div className="schema-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
        
        <div className="schema-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>❓</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Centro de Ayuda y Guía Docente</h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>
                Aprende a planificar fácil con voz, fotos y currículo oficial
              </p>
            </div>
          </div>
          <button className="schema-close-btn" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "75vh", overflowY: "auto" }}>
          
          {/* 1. Métodos de Entrada */}
          <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "14px" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#1e293b" }}>
              🚀 3 Formas Rápidas de Planificar:
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px", color: "#475569" }}>
              <div>
                <strong>🎙️ Por Voz (Recomendado):</strong> Toca el botón <strong>Voz</strong> en la barra inferior, habla con naturalidad (ej. <em>"Planificación de matemáticas para 4to de primaria, tema fracciones..."</em>) y pulsa enviar.
              </div>
              <div>
                <strong>📷 Por Foto (OCR):</strong> Toca <strong>Foto</strong> para capturar una página del libro de texto, cuaderno de trabajo o guía didáctica. La IA leerá el contenido y lo integrará a tu planificación.
              </div>
              <div>
                <strong>⌨️ Por Texto:</strong> Toca <strong>Texto</strong> para redactar o pegar temas, competencias específicas o ideas curriculares directas.
              </div>
            </div>
          </div>

          {/* 2. Tipos de Planificación y Esquemas */}
          <div style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "14px" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#1e293b" }}>
              📋 Esquemas y Tipos de Planificación MINERD:
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#475569" }}>
              <div><strong>• Diaria:</strong> Secuencia de 3 momentos (Inicio, Desarrollo y Cierre) con evaluación formativa.</div>
              <div><strong>• Semanal:</strong> Articulación de áreas curriculares con distribución de bloques de clase.</div>
              <div><strong>• Mensual:</strong> Alineada a efemérides y metas mensuales del calendario escolar oficial.</div>
              <div><strong>• Anual:</strong> Dosificación macro por períodos (P1, P2, P3, P4) y proyectos de centro.</div>
              <div><strong>• Unidad de Aprendizaje:</strong> Anclada a una Situación de Aprendizaje auténtica del contexto dominicano.</div>
              <div><strong>• Proyectos (ABP):</strong> Proyectos participativos de aula e institucionales centrados en resolver un problema real.</div>
            </div>
          </div>

          {/* 3. Exportación y Guardado */}
          <div style={{ background: "#f0fdfa", border: "1.5px solid #99f6e4", borderRadius: "12px", padding: "14px" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#0f766e" }}>
              💾 Exportar y Compartir:
            </h4>
            <p style={{ margin: 0, fontSize: "12.5px", color: "#115e59", lineHeight: "1.5" }}>
              Al generarse tu plan, puedes editar cualquier casilla directamente, exportarlo a <strong>Microsoft Word (.docx)</strong> con formato oficial, imprimirlo o compartirlo por <strong>WhatsApp</strong> y <strong>Bluetooth</strong>.
            </p>
          </div>

          {/* 4. Contacto y Soporte */}
          <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: "12px", padding: "12px", fontSize: "12px" }}>
            <strong style={{ color: "#92400e", display: "block", marginBottom: "4px" }}>
              📬 Soporte y Asistencia Docente:
            </strong>
            <span style={{ color: "#78350f" }}>
              Si tienes dudas o sugerencias, escribe a: <strong>israelmontas65@gmail.com</strong>
            </span>
          </div>

        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
          <button 
            type="button" 
            onClick={onCerrar}
            style={{ padding: "8px 18px", fontSize: "13px", background: "var(--pm-navy, #12304a)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            Cerrar Guía
          </button>
        </div>

      </div>
    </div>
  );
}
