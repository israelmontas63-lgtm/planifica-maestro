import { useState, useEffect } from "react";
import { cargarPerfil, guardarPerfil, obtenerDocenteId, obtenerPerfil } from "../services/perfilStorage.js";
export { cargarPerfil, guardarPerfil, obtenerDocenteId, obtenerPerfil };

const GRADOS_POR_NIVEL = {
  primario: [
    { id: "1.º", label: "1.º Primaria" },
    { id: "2.º", label: "2.º Primaria" },
    { id: "3.º", label: "3.º Primaria" },
    { id: "4.º", label: "4.º Primaria" },
    { id: "5.º", label: "5.º Primaria" },
    { id: "6.º", label: "6.º Primaria" }
  ],
  inicial: [
    { id: "Maternal", label: "Maternal (Párvulos)" },
    { id: "Kínder", label: "Kínder (Pre-Kínder)" },
    { id: "Pre-primario", label: "Pre-primario" }
  ],
  secundario: [
    { id: "1.º Sec", label: "1.º Secundaria (7mo)" },
    { id: "2.º Sec", label: "2.º Secundaria (8vo)" },
    { id: "3.º Sec", label: "3.º Secundaria (1ro Bach)" },
    { id: "4.º Sec", label: "4.º Secundaria (2do Bach)" },
    { id: "5.º Sec", label: "5.º Secundaria (3ro Bach)" },
    { id: "6.º Sec", label: "6.º Secundaria (4to Bach)" }
  ]
};

function generarEtiquetaGrados(listaGrados, nivel) {
  if (!listaGrados || listaGrados.length === 0) return "";
  const nivelStr = nivel === "inicial" ? "Nivel Inicial" : nivel === "secundario" ? "Secundaria" : "Primaria";
  if (listaGrados.length === 1) {
    return `${listaGrados[0]} de ${nivelStr}`;
  }
  const ordenados = [...listaGrados];
  const ult = ordenados.pop();
  return `${ordenados.join(", ")} y ${ult} de ${nivelStr} (Multigrado)`;
}

export default function PerfilDocente({ user, onActualizarPerfil, onCerrar }) {
  const [nombre, setNombre] = useState("");
  const [escuela, setEscuela] = useState("");
  const [tanda, setTanda] = useState("Jornada Escolar Extendida (JEE)");
  const [seccion, setSeccion] = useState("A");
  const [nivel, setNivel] = useState("primario");
  const [grados, setGrados] = useState([]);
  const [grado, setGrado] = useState("");
  const [regional, setRegional] = useState("");
  const [distrito, setDistrito] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [fechaManual, setFechaManual] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    const perfil = cargarPerfil() || {};
    const userNombre = user?.user_metadata?.nombre || user?.user_metadata?.full_name || perfil?.nombre || "";
    const userEscuela = user?.user_metadata?.escuela || perfil?.escuela || "";

    setNombre(userNombre);
    setEscuela(userEscuela);
    setTanda(perfil?.tanda || "Jornada Escolar Extendida (JEE)");
    setSeccion(perfil?.seccion || "A");
    
    const nivelGuardado = perfil?.nivel || "primario";
    setNivel(nivelGuardado);

    let gradosGuardados = Array.isArray(perfil?.grados) ? perfil.grados : [];
    if (gradosGuardados.length === 0 && perfil?.grado) {
      if (perfil.grado.includes("1.º") && perfil.grado.includes("2.º")) gradosGuardados = ["1.º", "2.º"];
      else if (perfil.grado.includes("1")) gradosGuardados = ["1.º"];
      else if (perfil.grado.includes("2")) gradosGuardados = ["2.º"];
      else if (perfil.grado.includes("3")) gradosGuardados = ["3.º"];
      else if (perfil.grado.includes("4")) gradosGuardados = ["4.º"];
      else if (perfil.grado.includes("5")) gradosGuardados = ["5.º"];
      else if (perfil.grado.includes("6")) gradosGuardados = ["6.º"];
    }
    // El perfil arranca sin grados forzados: nunca se escribe un grado no elegido por el docente
    setGrados(gradosGuardados);
    setGrado(perfil?.grado || (gradosGuardados.length > 0 ? generarEtiquetaGrados(gradosGuardados, nivelGuardado) : ""));

    setRegional(perfil?.regional || "");
    setDistrito(perfil?.distrito || "");
    setFecha(perfil?.fecha || new Date().toISOString().split("T")[0]);
    setFechaManual(Boolean(perfil?.fechaManual));
  }, [user]);

  const handleToggleGrado = (idGrado) => {
    let nuevaLista;
    if (grados.includes(idGrado)) {
      nuevaLista = grados.filter(g => g !== idGrado);
    } else {
      nuevaLista = [...grados, idGrado];
    }
    setGrados(nuevaLista);
    const etiqueta = generarEtiquetaGrados(nuevaLista, nivel);
    setGrado(etiqueta);
  };

  const handleCambiarNivel = (nuevoNivel) => {
    setNivel(nuevoNivel);
    const opcionesNuevoNivel = (GRADOS_POR_NIVEL[nuevoNivel] || []).map(o => o.id);
    const nuevosGrados = grados.filter(g => opcionesNuevoNivel.includes(g));
    setGrados(nuevosGrados);
    setGrado(nuevosGrados.length > 0 ? generarEtiquetaGrados(nuevosGrados, nuevoNivel) : "");
  };

  const handleGuardar = async () => {
    const perfilActual = cargarPerfil() || {};
    const gradoCalculado = grados.length > 0 ? generarEtiquetaGrados(grados, nivel) : "";
    const perfilActualizado = {
      ...perfilActual,
      nombre: nombre.trim(),
      escuela: escuela.trim(),
      tanda,
      seccion: seccion.trim(),
      nivel,
      grados,
      grado: grado.trim() || gradoCalculado,
      regional: regional.trim(),
      distrito: distrito.trim(),
      fecha,
      fechaManual
    };
    guardarPerfil(perfilActualizado);

    if (onActualizarPerfil) {
      try {
        await onActualizarPerfil({
          nombre: perfilActualizado.nombre,
          escuela: perfilActualizado.escuela,
          tanda,
          seccion: perfilActualizado.seccion,
          nivel,
          grados,
          grado: perfilActualizado.grado,
          regional: perfilActualizado.regional,
          distrito: perfilActualizado.distrito
        });
      } catch (err) {
        console.warn("Aviso actualizando metadata en nube:", err);
      }
    }

    setGuardado(true);
    setTimeout(() => {
      setGuardado(false);
      onCerrar();
    }, 1200);
  };

  const listaDisponibles = GRADOS_POR_NIVEL[nivel] || [];

  return (
    <div className="schema-overlay" onClick={onCerrar}>
      <div className="schema-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
        
        <div className="schema-header">
          <h2>Perfil del Docente</h2>
          <button className="schema-close-btn" onClick={onCerrar}>✕</button>
        </div>

        <div className="perfil-body">
          <p className="perfil-intro">
            Tus datos se guardan en este dispositivo y se auto-rellenan en el formato de secuencia didáctica (CON BASE) de cada planificación nueva en Word.
          </p>
          <div style={{
            fontSize: "12px",
            color: "#475569",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            padding: "8px 12px",
            borderRadius: "6px",
            marginBottom: "14px",
            lineHeight: "1.4"
          }}>
            💡 <strong>Nota importante:</strong> Tus planificaciones y perfil se guardan en este dispositivo. Si borras el historial o datos del navegador se perderán, por lo que te recomendamos descargar en Word los trabajos que quieras conservar.
          </div>

          <label className="perfil-label">
            Nombre del Docente
            <input
              type="text"
              className="perfil-input"
              placeholder="Ej: Prof. María Pérez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>

          <label className="perfil-label">
            Escuela / Centro Educativo
            <input
              type="text"
              className="perfil-input"
              placeholder="Ej: Escuela Básica Juan Pablo Duarte"
              value={escuela}
              onChange={(e) => setEscuela(e.target.value)}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label className="perfil-label">
              Nivel Educativo
              <select
                className="perfil-input"
                value={nivel}
                onChange={(e) => handleCambiarNivel(e.target.value)}
                style={{ cursor: "pointer" }}
              >
                <option value="primario">Nivel Primario</option>
                <option value="inicial">Nivel Inicial</option>
                <option value="secundario">Nivel Secundario</option>
              </select>
            </label>

            <label className="perfil-label">
              Tanda / Jornada
              <select
                className="perfil-input"
                value={tanda}
                onChange={(e) => setTanda(e.target.value)}
                style={{ cursor: "pointer" }}
              >
                <option value="Jornada Escolar Extendida (JEE)">Jornada Escolar Extendida (JEE)</option>
                <option value="Matutina">Matutina</option>
                <option value="Vespertina">Vespertina</option>
                <option value="Nocturna">Nocturna</option>
              </select>
            </label>
          </div>

          {/* SELECCIÓN MÚLTIPLE DE GRADOS (MULTIGRADO) */}
          <div style={{ marginTop: "6px", marginBottom: "12px" }}>
            <label className="perfil-label" style={{ marginBottom: "6px" }}>
              Grados a tu cargo (selecciona uno o varios para Multigrado)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
              {listaDisponibles.map((g) => {
                const seleccionado = grados.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleToggleGrado(g.id)}
                    style={{
                      border: seleccionado ? "2px solid #0f766e" : "1px solid #cbd5e1",
                      background: seleccionado ? "#ccfbf1" : "#ffffff",
                      color: seleccionado ? "#0f766e" : "#334155",
                      fontWeight: seleccionado ? "700" : "500",
                      padding: "6px 12px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span>{seleccionado ? "✓" : "+"}</span>
                    <span>{g.label}</span>
                  </button>
                );
              })}
            </div>
            {grados.length > 1 && (
              <div style={{ fontSize: "11px", color: "#0f766e", fontWeight: "600", marginTop: "6px" }}>
                🤝 Modalidad Multigrado activa: las planificaciones y el Word integrarán los grados seleccionados.
              </div>
            )}
          </div>

          <label className="perfil-label">
            Texto de Grado para el Encabezado del Word
            <input
              type="text"
              className="perfil-input"
              placeholder="Ej: 1.º y 2.º de Primaria (Multigrado)"
              value={grado}
              onChange={(e) => setGrado(e.target.value)}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <label className="perfil-label">
              Sección
              <input
                type="text"
                className="perfil-input"
                placeholder="Ej: A, B o Única"
                value={seccion}
                onChange={(e) => setSeccion(e.target.value)}
              />
            </label>

            <label className="perfil-label">
              Regional (Opcional)
              <input
                type="text"
                className="perfil-input"
                placeholder="Ej: 10"
                value={regional}
                onChange={(e) => setRegional(e.target.value)}
              />
            </label>

            <label className="perfil-label">
              Distrito (Opcional)
              <input
                type="text"
                className="perfil-input"
                placeholder="Ej: 10-01"
                value={distrito}
                onChange={(e) => setDistrito(e.target.value)}
              />
            </label>
          </div>

          <label className="perfil-label">
            Fecha (se autocompleta con la fecha de hoy)
            <input
              type="date"
              className="perfil-input"
              value={fecha}
              onChange={(e) => { setFecha(e.target.value); setFechaManual(true); }}
            />
            {fechaManual && (
              <button 
                type="button"
                className="perfil-reset-fecha"
                onClick={() => { setFecha(new Date().toISOString().split("T")[0]); setFechaManual(false); }}
              >
                ↺ Usar fecha de hoy
              </button>
            )}
          </label>

          <button type="button" className="perfil-guardar" onClick={handleGuardar}>
            {guardado ? "✓ Guardado en este Dispositivo" : "Guardar Perfil"}
          </button>

          <div style={{ textAlign: "center", marginTop: "14px", fontSize: "11px", color: "#64748b", fontWeight: "500" }}>
            Planifica Maestro PWA — Versión: <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#0f766e" }}>{typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
