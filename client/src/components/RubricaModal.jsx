import { useState, useMemo } from "react";
import {
  extraerCriteriosEvaluacion,
  estructurarMatrizRubrica,
  estructurarListaCotejo
} from "../services/evaluacionUtils.js";
import { descargarRubricaWord } from "../services/generadorRubricaWord.js";

export default function RubricaModal({
  plan,
  perfil,
  onCerrar
}) {
  const [tipoInstrumento, setTipoInstrumento] = useState("rubrica_analitica");
  const [descargandoWord, setDescargandoWord] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const datosPlan = useMemo(() => {
    if (!plan) return {};
    return plan.datosPlanificacion || plan.datos || (typeof plan === "object" ? plan : {});
  }, [plan]);

  const textoPlan = useMemo(() => {
    if (typeof plan === "string") return plan;
    return plan?.texto || plan?.contenido || "";
  }, [plan]);

  const infoEvaluacion = useMemo(() => {
    return extraerCriteriosEvaluacion(datosPlan, textoPlan);
  }, [datosPlan, textoPlan]);

  const matrizRubrica = useMemo(() => {
    return estructurarMatrizRubrica(infoEvaluacion.criterios, {
      area: infoEvaluacion.area,
      adaptacionesDua: infoEvaluacion.adaptacionesDua
    });
  }, [infoEvaluacion]);

  const listaCotejo = useMemo(() => {
    return estructurarListaCotejo(infoEvaluacion.criterios, {
      adaptacionesDua: infoEvaluacion.adaptacionesDua
    });
  }, [infoEvaluacion]);

  const areaDocente = infoEvaluacion.area || perfil?.area || "Área Curricular";
  const gradoDocente = datosPlan.grado || perfil?.grado || "Grado MINERD";
  const temaDocente = plan?.titulo || datosPlan.tema || datosPlan.secuencia || "Secuencia Didáctica";

  async function handleDescargarWord() {
    setDescargandoWord(true);
    try {
      await descargarRubricaWord({
        plan: textoPlan,
        datos: datosPlan,
        perfil,
        tipoInstrumento,
        titulo: `Instrumento_Evaluacion_${areaDocente}`
      });
    } catch (err) {
      alert("Error descargando instrumento Word: " + err.message);
    } finally {
      setDescargandoWord(false);
    }
  }

  function handleCopiarTabla() {
    let tsv = "";
    if (tipoInstrumento === "rubrica_analitica") {
      tsv += "Criterio e Indicador\tDestacado (4 pts)\tLogrado (3 pts)\tEn Proceso (2 pts)\tIncipiente (1 pt)\tPauta DUA\n";
      matrizRubrica.forEach((item) => {
        tsv += `${item.criterio} - ${item.indicador}\t${item.niveles.destacado.descriptor}\t${item.niveles.logrado.descriptor}\t${item.niveles.en_proceso.descriptor}\t${item.niveles.incipiente.descriptor}\t${item.observacionDua}\n`;
      });
    } else {
      tsv += "N.º\tIndicador de Logro / Criterio\tEscala\tAjuste DUA / NEAE\n";
      listaCotejo.forEach((item) => {
        tsv += `${item.numero}\t${item.indicador}\tLogrado / En Proceso / Iniciado\t${item.ajusteDua}\n`;
      });
    }

    navigator.clipboard.writeText(tsv).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    });
  }

  function handleImprimir() {
    window.print();
  }

  return (
    <div className="modal-backdrop" onClick={onCerrar}>
      <div
        className="modal-box rubrica-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "960px",
          width: "95vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          padding: "20px"
        }}
      >
        {/* Cabecera del modal */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "24px" }}>📊</span>
              <h3 style={{ margin: 0, fontSize: "19px", color: "#0f172a", fontWeight: "700" }}>
                Instrumentos de Evaluación Formativa — MINERD
              </h3>
            </div>
            <p style={{ margin: "4px 0 0 32px", fontSize: "12.5px", color: "#64748b" }}>
              Articulados a la Ordenanza 04-2023 y el Registro de Grado Oficial • {areaDocente} — {gradoDocente}
            </p>
          </div>
          <button
            className="schema-close-btn"
            onClick={onCerrar}
            title="Cerrar"
            style={{ fontSize: "18px", padding: "4px 8px" }}
          >
            ✕
          </button>
        </div>

        {/* Ficha técnica resumida */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "14px", fontSize: "12px" }}>
          <div><strong>Tema / Secuencia:</strong> <span style={{ color: "#0f766e" }}>{temaDocente}</span></div>
          <div><strong>Docente:</strong> <span>{perfil?.nombre || "Docente de Aula"}</span></div>
          <div><strong>Escuela:</strong> <span>{perfil?.escuela || "Centro Educativo"}</span></div>
        </div>

        {/* Selector de pestañas y botones de acción */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
          {/* Pestañas de tipo de instrumento */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setTipoInstrumento("rubrica_analitica")}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: tipoInstrumento === "rubrica_analitica" ? "#0284c7" : "#cbd5e1",
                background: tipoInstrumento === "rubrica_analitica" ? "#e0f2fe" : "#ffffff",
                color: tipoInstrumento === "rubrica_analitica" ? "#0369a1" : "#475569",
                fontWeight: tipoInstrumento === "rubrica_analitica" ? "700" : "500",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              📊 Rúbrica Analítica (4 Niveles)
            </button>
            <button
              onClick={() => setTipoInstrumento("lista_cotejo")}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: tipoInstrumento === "lista_cotejo" ? "#0284c7" : "#cbd5e1",
                background: tipoInstrumento === "lista_cotejo" ? "#e0f2fe" : "#ffffff",
                color: tipoInstrumento === "lista_cotejo" ? "#0369a1" : "#475569",
                fontWeight: tipoInstrumento === "lista_cotejo" ? "700" : "500",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              📋 Lista de Cotejo Formativa
            </button>
          </div>

          {/* Botones de acción (Word, Copiar, Imprimir) */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleCopiarTabla}
              title="Copiar tabla en formato compatible con Excel o Word"
              style={{
                padding: "7px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "12.5px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              {copiado ? "✓ ¡Copiado!" : "📋 Copiar Tabla"}
            </button>
            <button
              onClick={handleImprimir}
              title="Imprimir directamente"
              style={{
                padding: "7px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "12.5px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              🖨️ Imprimir
            </button>
            <button
              onClick={handleDescargarWord}
              disabled={descargandoWord}
              title="Descargar documento Word oficial (.docx)"
              style={{
                padding: "7px 14px",
                borderRadius: "6px",
                border: "none",
                background: "#0284c7",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "12.5px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              {descargandoWord ? "Generando..." : "📄 Descargar Word (.docx)"}
            </button>
          </div>
        </div>

        {/* Contenedor desplazable con la tabla del instrumento */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
          {tipoInstrumento === "rubrica_analitica" ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "10px", width: "24%", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>
                    Criterio e Indicador
                  </th>
                  <th style={{ padding: "10px", width: "19%", borderRight: "1px solid #e2e8f0", background: "#ecfdf5", color: "#166534" }}>
                    ⭐ Destacado (D)<br />
                    <span style={{ fontSize: "11px", fontWeight: "normal" }}>4 pts • Sobresaliente</span>
                  </th>
                  <th style={{ padding: "10px", width: "19%", borderRight: "1px solid #e2e8f0", background: "#f0f9ff", color: "#0369a1" }}>
                    ✓ Logrado (L)<br />
                    <span style={{ fontSize: "11px", fontWeight: "normal" }}>3 pts • Autónomo</span>
                  </th>
                  <th style={{ padding: "10px", width: "19%", borderRight: "1px solid #e2e8f0", background: "#fffbeb", color: "#b45309" }}>
                    ⏳ En Proceso (P)<br />
                    <span style={{ fontSize: "11px", fontWeight: "normal" }}>2 pts • Básico con guía</span>
                  </th>
                  <th style={{ padding: "10px", width: "19%", background: "#fef2f2", color: "#991b1b" }}>
                    ⚠️ Incipiente (I)<br />
                    <span style={{ fontSize: "11px", fontWeight: "normal" }}>1 pt • Inicial asistido</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrizRubrica.map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#ffffff" : "#fbfcfd" }}>
                    <td style={{ padding: "10px", borderRight: "1px solid #e2e8f0", verticalAlign: "top" }}>
                      <strong style={{ color: "#0f172a", display: "block", marginBottom: "4px" }}>
                        {item.criterio}
                      </strong>
                      <p style={{ margin: "0 0 6px 0", color: "#475569", fontSize: "11.5px" }}>
                        {item.indicador}
                      </p>
                      <span style={{ display: "inline-block", background: "#f0fdfa", color: "#0f766e", border: "1px solid #99f6e4", borderRadius: "4px", padding: "2px 6px", fontSize: "10.5px" }}>
                        {item.observacionDua}
                      </span>
                    </td>
                    <td style={{ padding: "10px", borderRight: "1px solid #e2e8f0", verticalAlign: "top", color: "#1e293b", background: "#fafffd" }}>
                      {item.niveles.destacado.descriptor}
                    </td>
                    <td style={{ padding: "10px", borderRight: "1px solid #e2e8f0", verticalAlign: "top", color: "#1e293b", background: "#fbfdff" }}>
                      {item.niveles.logrado.descriptor}
                    </td>
                    <td style={{ padding: "10px", borderRight: "1px solid #e2e8f0", verticalAlign: "top", color: "#1e293b", background: "#fffdfa" }}>
                      {item.niveles.en_proceso.descriptor}
                    </td>
                    <td style={{ padding: "10px", verticalAlign: "top", color: "#1e293b", background: "#fffbfb" }}>
                      {item.niveles.incipiente.descriptor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "10px", width: "6%", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>N.º</th>
                  <th style={{ padding: "10px", width: "50%", borderRight: "1px solid #e2e8f0" }}>Indicador de Logro / Criterio Formativo</th>
                  <th style={{ padding: "10px", width: "22%", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>Escala de Valoración</th>
                  <th style={{ padding: "10px", width: "22%" }}>Ajuste de Inclusión DUA / NEAE</th>
                </tr>
              </thead>
              <tbody>
                {listaCotejo.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#ffffff" : "#fbfcfd" }}>
                    <td style={{ padding: "10px", textAlign: "center", fontWeight: "bold", borderRight: "1px solid #e2e8f0" }}>
                      {item.numero}
                    </td>
                    <td style={{ padding: "10px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>
                      {item.indicador}
                    </td>
                    <td style={{ padding: "10px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: "8px", fontSize: "11px" }}>
                        <span style={{ border: "1px solid #cbd5e1", borderRadius: "4px", padding: "3px 6px", background: "#ecfdf5", color: "#166534" }}>[  ] Logrado (L)</span>
                        <span style={{ border: "1px solid #cbd5e1", borderRadius: "4px", padding: "3px 6px", background: "#fffbeb", color: "#b45309" }}>[  ] En Proceso (P)</span>
                        <span style={{ border: "1px solid #cbd5e1", borderRadius: "4px", padding: "3px 6px", background: "#fef2f2", color: "#991b1b" }}>[  ] Iniciado (I)</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px", color: "#0f766e", fontSize: "11.5px" }}>
                      {item.ajusteDua}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pie del modal con advertencia ministerial */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #e2e8f0", fontSize: "11.5px", color: "#64748b" }}>
          <span>
            📌 Instrumento conforme a la <strong>Ordenanza 04-2023</strong> para anexar a la carpeta pedagógica y Registro de Grado.
          </span>
          <button
            onClick={onCerrar}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
