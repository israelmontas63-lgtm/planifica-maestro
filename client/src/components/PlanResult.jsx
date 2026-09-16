import { useState } from "react";

export default function PlanResult({
  datosGenerados,
  onExportar,
  exportando,
  onEscuchar,
  escuchando,
  audioUrl,
  onDatosActualizados
}) {
  const [campos, setCampos] = useState(datosGenerados || {});
  const [editandoCampo, setEditandoCampo] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [guardandoArchivo, setGuardandoArchivo] = useState(false);

  function handleCampoChange(clave, valor) {
    const nuevos = { ...campos, [clave]: valor };
    setCampos(nuevos);
    if (onDatosActualizados) onDatosActualizados(nuevos);
  }

  const claves = Object.keys(campos);

  if (!claves.length) return null;

  // Formato de texto para compartir / guardar
  const textoParaCompartir = Object.entries(campos)
    .map(([k, v]) => `📌 ${k}\n${v}`)
    .join("\n\n");

  // 1. IMPRIMIR
  function handleImprimir() {
    window.print();
  }

  // 2. COMPARTIR (Web Share API con fallback)
  async function handleCompartir() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Planificación Curricular - Planifica Maestro",
          text: `Planificación Curricular generada con Planifica Maestro:\n\n${textoParaCompartir}`
        });
        return;
      } catch (err) {
        if (err.name !== "AbortError") {
          // Si el navegador rechaza o falla la API nativa, abrir modal de respaldo
          setShowShareModal(true);
        }
      }
    } else {
      // Si el navegador no soporta Web Share API
      setShowShareModal(true);
    }
  }

  // Guardar archivo .txt descargable (para Bluetooth o envío manual)
  function handleGuardarArchivo() {
    setGuardandoArchivo(true);
    try {
      const contenido = `========================================\nPLANIFICACIÓN CURRICULAR - PLANIFICA MAESTRO\nFecha: ${new Date().toLocaleDateString("es-DO")}\n========================================\n\n${textoParaCompartir}`;
      const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Planificacion_${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setGuardandoArchivo(false), 800);
    }
  }

  // Enlaces de respaldo para compartir
  const resumenWhatsApp = encodeURIComponent(
    `*Planificación Curricular - Planifica Maestro*\n\n` +
    (textoParaCompartir.length > 1500
      ? textoParaCompartir.substring(0, 1500) + "\n\n...[Ver documento completo]"
      : textoParaCompartir)
  );
  const urlWhatsApp = `https://api.whatsapp.com/send?text=${resumenWhatsApp}`;
  const urlFacebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;

  return (
    <div className="plan-result-container">
      {/* Encabezado visible únicamente al imprimir */}
      <div className="plan-print-header">
        <div className="plan-print-brand">Planifica Maestro</div>
        <h2 className="plan-print-title">Planificación Curricular Docente</h2>
        <p className="plan-print-meta">
          Fecha de generación: {new Date().toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* FASE 10: Aviso de IA destacado y permanente (no cerrable ni desactivable) */}
      <div className="plan-ia-banner-destacado no-print">
        <div className="plan-ia-banner-icon">⚠️</div>
        <div className="plan-ia-banner-texto">
          <span className="plan-ia-banner-tag">Aviso Institucional</span>
          <p className="plan-ia-banner-msj">
            Contenido generado con IA — revisa y ajusta antes de uso oficial.
          </p>
        </div>
      </div>

      {/* FASE 10: Todos los campos 100% editables al toque directo, sin bloqueos */}
      <div className="plan-campos">
        {claves.map((clave) => (
          <div
            key={clave}
            className={`plan-campo ${editandoCampo === clave ? "campo-enfocado" : ""}`}
          >
            <div className="plan-campo-header">
              <h4 className="plan-campo-titulo">{clave}</h4>
              <span className="plan-campo-badge no-print">
                {editandoCampo === clave ? "✏️ Editando..." : "✏️ Toca para editar"}
              </span>
            </div>
            <textarea
              className="plan-campo-textarea"
              value={campos[clave] || ""}
              onChange={(e) => handleCampoChange(clave, e.target.value)}
              onFocus={() => setEditandoCampo(clave)}
              onBlur={() => setEditandoCampo(null)}
              rows={Math.max(4, ((campos[clave] || "").match(/\n/g) || []).length + 2)}
              placeholder={`Escribe o ajusta aquí ${clave}...`}
            />
          </div>
        ))}
      </div>

      {/* Botones de acción */}
      <div className="plan-acciones no-print">
        <button
          className="export-btn btn-word"
          onClick={() => onExportar(campos)}
          disabled={exportando}
        >
          {exportando ? "Preparando..." : "📄 Exportar a Word"}
        </button>

        <button
          className="export-btn btn-escuchar"
          onClick={() => onEscuchar(campos)}
          disabled={escuchando}
        >
          {escuchando ? "Generando..." : "🔊 Escuchar"}
        </button>

        <button
          className="export-btn btn-imprimir"
          onClick={handleImprimir}
          title="Imprimir planificación"
        >
          🖨️ Imprimir
        </button>

        <button
          className="export-btn btn-compartir"
          onClick={handleCompartir}
          title="Compartir por WhatsApp, Facebook o Bluetooth"
        >
          ↗️ Compartir
        </button>
      </div>

      {audioUrl && (
        <div style={{ marginTop: '10px' }} className="no-print">
          <audio controls src={audioUrl} autoPlay style={{ width: '100%' }} />
        </div>
      )}

      {/* Modal de respaldo cuando no hay Web Share API nativa */}
      {showShareModal && (
        <div className="modal-backdrop plan-share-backdrop" onClick={() => setShowShareModal(false)}>
          <div className="modal-box plan-share-box" onClick={(e) => e.stopPropagation()}>
            <div className="plan-share-header">
              <h3>Compartir Planificación</h3>
              <button className="schema-close-btn" onClick={() => setShowShareModal(false)}>✕</button>
            </div>
            <p className="plan-share-desc">
              Selecciona cómo deseas compartir tu planificación:
            </p>

            <div className="plan-share-options">
              {/* Opción 1: WhatsApp */}
              <a
                href={urlWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="plan-share-btn btn-share-whatsapp"
                onClick={() => setShowShareModal(false)}
              >
                <span className="share-icon">💬</span>
                <div className="share-btn-text">
                  <strong>WhatsApp</strong>
                  <small>Enviar texto a chat o grupo</small>
                </div>
              </a>

              {/* Opción 2: Facebook */}
              <a
                href={urlFacebook}
                target="_blank"
                rel="noopener noreferrer"
                className="plan-share-btn btn-share-facebook"
                onClick={() => setShowShareModal(false)}
              >
                <span className="share-icon">🌐</span>
                <div className="share-btn-text">
                  <strong>Facebook</strong>
                  <small>Compartir enlace en tu perfil</small>
                </div>
              </a>

              {/* Opción 3: Guardar archivo (para Bluetooth) */}
              <button
                className="plan-share-btn btn-share-file"
                onClick={handleGuardarArchivo}
                disabled={guardandoArchivo}
              >
                <span className="share-icon">📶</span>
                <div className="share-btn-text">
                  <strong>Guardar archivo (Bluetooth / Transferencia)</strong>
                  <small>Descarga el archivo .txt para enviarlo por Bluetooth</small>
                </div>
              </button>
            </div>

            <button className="plan-share-cancel" onClick={() => setShowShareModal(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
