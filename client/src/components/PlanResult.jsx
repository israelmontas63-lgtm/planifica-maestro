const NIVELES = [
  { value: "inicial", label: "Nivel Inicial" },
  { value: "primario", label: "Nivel Primario" },
  { value: "secundario", label: "Nivel Secundario" },
  { value: "especial", label: "Educación Especial" },
];

export default function PlanResult({ nivel, setNivel, cargando, plan, onExportar, exportando, onEscuchar, escuchando, audioUrl }) {
  return (
    <div className="result-panel">
      <div className="select-row">
        <select value={nivel} onChange={(e) => setNivel(e.target.value)}>
          {NIVELES.map((n) => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>
      </div>
      {cargando && <p className="status-text">Generando planificacion con IA...</p>}
      {plan && (
        <>
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button className="export-btn" style={{ margin: 0, flex: 1 }} onClick={onExportar} disabled={exportando}>
              {exportando ? "Preparando Word..." : "📄 Exportar a Word"}
            </button>
            <button className="export-btn" style={{ margin: 0, flex: 1, background: 'linear-gradient(135deg, #1d4e6e 0%, #1a7d8c 100%)' }} onClick={onEscuchar} disabled={escuchando}>
              {escuchando ? "Generando audio..." : "🔊 Escuchar Resumen"}
            </button>
          </div>
          {audioUrl && (
            <div style={{ marginTop: '12px' }}>
              <audio controls src={audioUrl} autoPlay style={{ width: '100%' }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
