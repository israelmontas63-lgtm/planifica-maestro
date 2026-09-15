import { useState } from "react";

export default function PlanResult({ datosGenerados, onExportar, exportando, onEscuchar, escuchando, audioUrl, onDatosActualizados }) {
  const [campos, setCampos] = useState(datosGenerados || {});
  const [editandoCampo, setEditandoCampo] = useState(null);

  function handleCampoChange(clave, valor) {
    const nuevos = { ...campos, [clave]: valor };
    setCampos(nuevos);
    if (onDatosActualizados) onDatosActualizados(nuevos);
  }

  const claves = Object.keys(campos);

  if (!claves.length) return null;

  return (
    <div className="plan-result-container">
      {/* Aviso de IA */}
      <div className="plan-ia-aviso">
        <span className="plan-ia-icono">⚠️</span>
        <span>Contenido generado con IA — revisa la información antes de usarla oficialmente.</span>
      </div>

      {/* Campos editables */}
      <div className="plan-campos">
        {claves.map((clave) => (
          <div key={clave} className="plan-campo">
            <div className="plan-campo-header">
              <h4 className="plan-campo-titulo">{clave}</h4>
              <button
                className="plan-campo-editar-btn"
                onClick={() => setEditandoCampo(editandoCampo === clave ? null : clave)}
              >
                {editandoCampo === clave ? "✓ Listo" : "✏️ Editar"}
              </button>
            </div>
            {editandoCampo === clave ? (
              <textarea
                className="plan-campo-textarea"
                value={campos[clave]}
                onChange={(e) => handleCampoChange(clave, e.target.value)}
                rows={6}
                autoFocus
              />
            ) : (
              <div className="plan-campo-contenido">{campos[clave]}</div>
            )}
          </div>
        ))}
      </div>

      {/* Botones de acción */}
      <div className="plan-acciones">
        <button className="export-btn" style={{ flex: 1 }} onClick={() => onExportar(campos)} disabled={exportando}>
          {exportando ? "Preparando Word..." : "📄 Exportar a Word"}
        </button>
        <button className="export-btn" style={{ flex: 1, background: 'linear-gradient(135deg, #1d4e6e 0%, #1a7d8c 100%)' }} onClick={() => onEscuchar(campos)} disabled={escuchando}>
          {escuchando ? "Generando audio..." : "🔊 Escuchar"}
        </button>
      </div>
      {audioUrl && (
        <div style={{ marginTop: '10px' }}>
          <audio controls src={audioUrl} autoPlay style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
}
