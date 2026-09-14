import { useState } from "react";

export default function TextoModal({ initialValue = "", onCancel, onConfirm }) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>Describe la planificacion</h3>
        <textarea
          autoFocus
          placeholder="Ej: Planificacion de Matematicas para 5to de basica, tema fracciones, para el lunes..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="modal-actions">
          <button onClick={onCancel} style={{ background: "#eee" }}>Cancelar</button>
          <button style={{ background: "var(--teal)", color: "white" }} onClick={() => onConfirm(value)} disabled={!value.trim()}>
            Generar
          </button>
        </div>
      </div>
    </div>
  );
}
