import { useState, useMemo } from "react";
import {
  estructurarPlanillaCalificaciones,
  estructurarPlanillaAsistencia,
  cargarNominaEstudiantes,
  guardarNominaEstudiantes,
  ESTUDIANTES_EJEMPLO_MINERD
} from "../services/registroCalificacionesUtils.js";
import { descargarRegistroExcel } from "../services/generadorExcelRegistro.js";
import { cargarPerfil } from "../services/perfilStorage.js";

export default function RegistroCalificacionesModal({ plan, onCerrar }) {
  const [pestañaActiva, setPestañaActiva] = useState("calificaciones"); // "calificaciones" | "asistencia" | "nomina"
  const [copiado, setCopiado] = useState(false);
  const [mensajeNomina, setMensajeNomina] = useState(null);

  const perfil = cargarPerfil() || {};
  const escuelaNombre = plan?.escuela || perfil?.escuela || "Centro Educativo MINERD";
  const escuelaCodigo = plan?.codigoMinerd || perfil?.codigoMinerd || "";
  const docenteNombre = plan?.docenteNombre || perfil?.nombre || "Docente Titular";
  const grado = plan?.grado || "4to Primaria";
  const seccion = plan?.seccion || "A";
  const area = plan?.area || "Lengua Española";

  // Nómina editable
  const [nomina, setNomina] = useState(() => cargarNominaEstudiantes(grado, seccion));
  const [textoNomina, setTextoNomina] = useState(() => {
    return nomina.map((e) => e.nombre).join("\n");
  });

  // Datos estructurados reactivos
  const datosCalificaciones = useMemo(() => {
    return estructurarPlanillaCalificaciones(plan, nomina);
  }, [plan, nomina]);

  const datosAsistencia = useMemo(() => {
    return estructurarPlanillaAsistencia(nomina, 20);
  }, [nomina]);

  function handleGuardarNomina() {
    const lineas = textoNomina
      .split("\n")
      .map((l) => l.trim().replace(/^\d+[\.\-\s]+/, "")) // quitar numeración si la pegaron
      .filter((l) => l.length > 2);

    if (lineas.length === 0) {
      setMensajeNomina("⚠️ Ingresa al menos un nombre de estudiante válido.");
      return;
    }

    const nuevaLista = lineas.map((nombre, idx) => ({
      numero: idx + 1,
      nombre
    }));

    guardarNominaEstudiantes(grado, seccion, nuevaLista);
    setNomina(nuevaLista);
    setMensajeNomina(`✓ Nómina guardada con ${nuevaLista.length} estudiantes.`);
    setTimeout(() => setMensajeNomina(null), 3000);
  }

  function handleRestaurarNominaEjemplo() {
    const listaEjemplo = ESTUDIANTES_EJEMPLO_MINERD.map((n, idx) => ({
      numero: idx + 1,
      nombre: n
    }));
    guardarNominaEstudiantes(grado, seccion, listaEjemplo);
    setNomina(listaEjemplo);
    setTextoNomina(listaEjemplo.map((e) => e.nombre).join("\n"));
    setMensajeNomina("✓ Nómina estándar del MINERD restaurada.");
    setTimeout(() => setMensajeNomina(null), 3000);
  }

  function handleCopiarTabla() {
    let tsv = "";
    if (pestañaActiva === "calificaciones") {
      const headers = [
        "No.",
        "Nombres y Apellidos",
        ...datosCalificaciones.indicadores.map((i) => `${i.codigo} - ${i.descripcion}`),
        "Calificación Final",
        "Condición",
        "Adecuación DUA"
      ];
      tsv += headers.join("\t") + "\n";

      datosCalificaciones.filas.forEach((f) => {
        const fila = [
          f.numero,
          f.nombre,
          ...datosCalificaciones.indicadores.map((i) => f.valoresIndicadores[i.id] || ""),
          f.calificacionFinal,
          f.condicion,
          f.observacionesDua || ""
        ];
        tsv += fila.join("\t") + "\n";
      });
    } else if (pestañaActiva === "asistencia") {
      const headers = [
        "No.",
        "Nombres y Apellidos",
        ...datosAsistencia.dias.map((d) => d.etiqueta),
        "P",
        "A",
        "E",
        "T",
        "% Asistencia"
      ];
      tsv += headers.join("\t") + "\n";

      datosAsistencia.filas.forEach((f) => {
        const fila = [
          f.numero,
          f.nombre,
          ...datosAsistencia.dias.map((d) => f.registrosDias[d.indice] || "P"),
          f.presentes,
          f.ausentes,
          f.excusas,
          f.tardanzas,
          `${f.porcentajeAsistencia}%`
        ];
        tsv += fila.join("\t") + "\n";
      });
    }

    navigator.clipboard.writeText(tsv).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  }

  function handleDescargarExcel() {
    descargarRegistroExcel(plan, perfil, nomina);
  }

  function handleImprimir() {
    window.print();
  }

  return (
    <div className="schema-overlay" onClick={onCerrar}>
      <div
        className="schema-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "960px",
          width: "95%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Encabezado Oficial */}
        <div
          className="schema-header"
          style={{
            borderBottom: "2px solid #0f766e",
            paddingBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "24px" }}>📊</span>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f766e" }}>
                Registro Oficial de Calificaciones y Asistencia Escolar
              </h2>
            </div>
            <p style={{ margin: "4px 0 0 32px", fontSize: "12px", color: "#64748b" }}>
              {escuelaNombre} {escuelaCodigo && `• SIGERD: ${escuelaCodigo}`} • {grado} (Sec. {seccion}) • {area}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={handleDescargarExcel}
              style={{
                background: "#15803d",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "7px 13px",
                fontSize: "12px",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}
              title="Descargar libro de cálculo en formato Excel (.xls SpreadsheetML) oficial"
            >
              <span>📥</span>
              <span>Descargar Excel (.xls)</span>
            </button>
            <button
              type="button"
              onClick={handleCopiarTabla}
              style={{
                background: "#f8fafc",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "7px 11px",
                fontSize: "12px",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer"
              }}
              title="Copiar tabla para pegar directamente en Excel o Google Sheets"
            >
              <span>📋</span>
              <span>{copiado ? "¡Copiada!" : "Copiar Tabla"}</span>
            </button>
            <button
              type="button"
              onClick={handleImprimir}
              style={{
                background: "#f8fafc",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "7px 11px",
                fontSize: "12px",
                cursor: "pointer"
              }}
              title="Imprimir planilla"
            >
              <span>🖨️</span>
            </button>
            <button className="schema-close-btn" onClick={onCerrar}>✕</button>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", padding: "10px 0 8px 0" }}>
          <button
            type="button"
            onClick={() => setPestañaActiva("calificaciones")}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: pestañaActiva === "calificaciones" ? "1.5px solid #0f766e" : "1px solid #e2e8f0",
              background: pestañaActiva === "calificaciones" ? "#f0fdfa" : "#ffffff",
              color: pestañaActiva === "calificaciones" ? "#0f766e" : "#64748b",
              fontWeight: pestañaActiva === "calificaciones" ? "700" : "500",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>📝</span>
            <span>Registro de Calificaciones</span>
          </button>
          <button
            type="button"
            onClick={() => setPestañaActiva("asistencia")}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: pestañaActiva === "asistencia" ? "1.5px solid #0f766e" : "1px solid #e2e8f0",
              background: pestañaActiva === "asistencia" ? "#f0fdfa" : "#ffffff",
              color: pestañaActiva === "asistencia" ? "#0f766e" : "#64748b",
              fontWeight: pestañaActiva === "asistencia" ? "700" : "500",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>📅</span>
            <span>Control de Asistencia (20 Días)</span>
          </button>
          <button
            type="button"
            onClick={() => setPestañaActiva("nomina")}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: pestañaActiva === "nomina" ? "1.5px solid #0f766e" : "1px solid #e2e8f0",
              background: pestañaActiva === "nomina" ? "#f0fdfa" : "#ffffff",
              color: pestañaActiva === "nomina" ? "#0f766e" : "#64748b",
              fontWeight: pestañaActiva === "nomina" ? "700" : "500",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>👥</span>
            <span>Editar Nómina ({nomina.length})</span>
          </button>
        </div>

        {/* Contenido Scrolleable */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", padding: "12px 2px" }}>
          {pestañaActiva === "calificaciones" && (
            <div>
              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", marginBottom: "12px", border: "1px solid #e2e8f0", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  <strong>Indicadores de la Unidad:</strong> {datosCalificaciones.indicadores.length} indicadores articulados al Registro de Grado.
                </span>
                <span style={{ color: "#64748b" }}>
                  Escala: <strong>L</strong> (Logrado) • <strong>P</strong> (En Proceso) • <strong>I</strong> (Iniciado)
                </span>
              </div>

              <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "8px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#0f4c81", color: "#ffffff", textAlign: "center" }}>
                      <th style={{ padding: "8px 6px", border: "1px solid #0a3357", width: "35px" }}>No.</th>
                      <th style={{ padding: "8px 10px", border: "1px solid #0a3357", textAlign: "left", minWidth: "200px" }}>Nombres y Apellidos</th>
                      {datosCalificaciones.indicadores.map((ind) => (
                        <th key={ind.id} style={{ padding: "8px 6px", border: "1px solid #0a3357", maxWidth: "180px", fontWeight: "600" }} title={ind.descripcion}>
                          <span style={{ display: "block", fontSize: "11px" }}>{ind.codigo}</span>
                          <span style={{ display: "block", fontSize: "9px", fontWeight: "normal", opacity: 0.9 }}>
                            {ind.descripcion.slice(0, 45)}...
                          </span>
                        </th>
                      ))}
                      <th style={{ padding: "8px 6px", border: "1px solid #0a3357", background: "#15803d", width: "70px" }}>Final</th>
                      <th style={{ padding: "8px 6px", border: "1px solid #0a3357", background: "#15803d", width: "85px" }}>Condición</th>
                      <th style={{ padding: "8px 10px", border: "1px solid #0a3357", minWidth: "150px" }}>Adecuación DUA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datosCalificaciones.filas.map((est, idx) => (
                      <tr key={est.numero} style={{ background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                        <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e2e8f0" }}>{est.numero}</td>
                        <td style={{ padding: "6px 10px", border: "1px solid #e2e8f0", fontWeight: "500" }}>{est.nombre}</td>
                        {datosCalificaciones.indicadores.map((ind) => {
                          const val = est.valoresIndicadores[ind.id];
                          const bg = val === "L" ? "#dcfce7" : val === "P" ? "#fef3c7" : "#fee2e2";
                          const col = val === "L" ? "#15803d" : val === "P" ? "#b45309" : "#b91c1c";
                          return (
                            <td key={ind.id} style={{ padding: "6px", textAlign: "center", border: "1px solid #e2e8f0", background: bg, color: col, fontWeight: "600" }}>
                              {val}
                            </td>
                          );
                        })}
                        <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e2e8f0", fontWeight: "700", color: "#15803d" }}>
                          {est.calificacionFinal}
                        </td>
                        <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: "600" }}>
                          {est.condicion}
                        </td>
                        <td style={{ padding: "6px 10px", border: "1px solid #e2e8f0", fontSize: "11px", color: "#64748b" }}>
                          {est.observacionesDua || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pestañaActiva === "asistencia" && (
            <div>
              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", marginBottom: "12px", border: "1px solid #e2e8f0", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  <strong>Control Mensual:</strong> {datosAsistencia.totalDias} días lectivos computados.
                </span>
                <span style={{ color: "#64748b" }}>
                  <strong>P</strong> = Presente • <strong>A</strong> = Ausente • <strong>E</strong> = Excusa • <strong>T</strong> = Tardanza
                </span>
              </div>

              <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "8px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead>
                    <tr style={{ background: "#0f4c81", color: "#ffffff", textAlign: "center" }}>
                      <th style={{ padding: "6px 4px", border: "1px solid #0a3357", width: "30px" }}>No.</th>
                      <th style={{ padding: "6px 8px", border: "1px solid #0a3357", textAlign: "left", minWidth: "180px" }}>Nombres y Apellidos</th>
                      {datosAsistencia.dias.map((d) => (
                        <th key={d.indice} style={{ padding: "4px 2px", border: "1px solid #0a3357", minWidth: "22px", fontSize: "9px" }}>
                          {d.etiqueta.split(" ")[0][0]}<br/>{d.indice}
                        </th>
                      ))}
                      <th style={{ padding: "6px 4px", border: "1px solid #0a3357", background: "#15803d", width: "24px" }}>P</th>
                      <th style={{ padding: "6px 4px", border: "1px solid #0a3357", background: "#b91c1c", width: "24px" }}>A</th>
                      <th style={{ padding: "6px 4px", border: "1px solid #0a3357", background: "#b45309", width: "24px" }}>E</th>
                      <th style={{ padding: "6px 4px", border: "1px solid #0a3357", background: "#b45309", width: "24px" }}>T</th>
                      <th style={{ padding: "6px 6px", border: "1px solid #0a3357", background: "#15803d", width: "55px" }}>% Asist.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datosAsistencia.filas.map((est, idx) => (
                      <tr key={est.numero} style={{ background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e2e8f0" }}>{est.numero}</td>
                        <td style={{ padding: "4px 8px", border: "1px solid #e2e8f0", fontWeight: "500" }}>{est.nombre}</td>
                        {datosAsistencia.dias.map((d) => {
                          const code = est.registrosDias[d.indice];
                          const bg = code === "A" ? "#fee2e2" : code === "E" ? "#fef3c7" : "#ffffff";
                          const col = code === "A" ? "#b91c1c" : code === "E" ? "#b45309" : "#334155";
                          return (
                            <td key={d.indice} style={{ padding: "4px 1px", textAlign: "center", border: "1px solid #e2e8f0", background: bg, color: col, fontWeight: code !== "P" ? "700" : "normal" }}>
                              {code}
                            </td>
                          );
                        })}
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e2e8f0", fontWeight: "600", color: "#15803d" }}>{est.presentes}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e2e8f0", fontWeight: "600", color: "#b91c1c" }}>{est.ausentes}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e2e8f0", color: "#b45309" }}>{est.excusas}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e2e8f0", color: "#b45309" }}>{est.tardanzas}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e2e8f0", fontWeight: "700", background: est.alertaDesercion ? "#fee2e2" : "#f0fdf4", color: est.alertaDesercion ? "#b91c1c" : "#15803d" }}>
                          {est.porcentajeAsistencia}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pestañaActiva === "nomina" && (
            <div style={{ maxWidth: "680px", margin: "0 auto", padding: "10px" }}>
              <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "8px", padding: "12px", marginBottom: "14px", fontSize: "13px" }}>
                <strong style={{ color: "#0f766e" }}>👥 Configuración de la Nómina del Aula</strong>
                <p style={{ margin: "4px 0 0 0", color: "#334155" }}>
                  Escribe o pega la lista de estudiantes de tu curso (uno por línea). Se guardará automáticamente para <strong>{grado} - Sección {seccion}</strong> en tu navegador.
                </p>
              </div>

              {mensajeNomina && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", padding: "8px 12px", borderRadius: "6px", marginBottom: "10px", fontSize: "12px", fontWeight: "600" }}>
                  {mensajeNomina}
                </div>
              )}

              <textarea
                value={textoNomina}
                onChange={(e) => setTextoNomina(e.target.value)}
                rows={14}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1"
                }}
                placeholder="Pega aquí la lista de estudiantes..."
              />

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleRestaurarNominaEjemplo}
                  style={{
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    padding: "7px 12px",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  🔄 Restaurar Nómina Predeterminada
                </button>
                <button
                  type="button"
                  onClick={handleGuardarNomina}
                  style={{
                    background: "#0f766e",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  💾 Guardar Nómina de Estudiantes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
