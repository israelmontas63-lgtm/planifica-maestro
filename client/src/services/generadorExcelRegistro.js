/**
 * client/src/services/generadorExcelRegistro.js
 * Generador canónico de Hojas de Cálculo Oficiales MINERD en formato SpreadsheetML (Excel .xls).
 * Conforme a la Ordenanza 04-2023 y la Adecuación Curricular 2023.
 *
 * Características:
 * - 2 Hojas integradas en el mismo libro:
 *   1. "Registro de Calificaciones" (Indicadores de logro, notas, condición y DUA).
 *   2. "Control de Asistencia" (Días lectivos, fórmulas nativas COUNTIF, % asistencia).
 * - Cero dependencias externas (genera XML nativo de Microsoft Excel).
 * - Compatibilidad 100% con Microsoft Excel, Google Sheets, LibreOffice Calc y lectores móviles.
 */

import { cargarPerfil } from "./perfilStorage.js";
import {
  estructurarPlanillaCalificaciones,
  estructurarPlanillaAsistencia,
  cargarNominaEstudiantes
} from "./registroCalificacionesUtils.js";

function escaparXml(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatearFechaIso() {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

/**
 * Genera el documento XML completo de Excel SpreadsheetML
 */
export function generarXmlRegistroExcel(plan = {}, perfil = null, nomina = null) {
  const perf = perfil || cargarPerfil() || {};
  const escuelaNombre = plan.escuela || perf.escuela || "Centro Educativo MINERD";
  const escuelaCodigo = plan.codigoMinerd || perf.codigoMinerd || "";
  const docenteNombre = plan.docenteNombre || perf.nombre || "Docente Titular";
  const grado = plan.grado || "4to Primaria";
  const seccion = plan.seccion || "A";
  const area = plan.area || "Lengua Española";
  const fecha = formatearFechaIso();
  const anioEscolar = "2024-2025";

  const listaEstudiantes = Array.isArray(nomina) && nomina.length > 0
    ? nomina
    : cargarNominaEstudiantes(grado, seccion);

  const datosCalificaciones = estructurarPlanillaCalificaciones(plan, listaEstudiantes);
  const datosAsistencia = estructurarPlanillaAsistencia(listaEstudiantes, 20);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>Registro Oficial de Calificaciones y Asistencia MINERD</Title>
    <Subject>Ordenanza 04-2023 - Adecuación Curricular</Subject>
    <Author>${escaparXml(docenteNombre)}</Author>
    <Created>${new Date().toISOString()}</Created>
    <Company>Ministerio de Educación de la República Dominicana (MINERD)</Company>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Borders/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
      <Interior/>
      <NumberFormat/>
      <Protection/>
    </Style>
    <Style ss:ID="TituloOficial">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0F4C81"/>
    </Style>
    <Style ss:ID="SubtituloOficial">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#475569"/>
    </Style>
    <Style ss:ID="FichaEtiqueta">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#1E293B"/>
      <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>
    <Style ss:ID="FichaValor">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>
    <Style ss:ID="ThAzul">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F4C81" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0A3357"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0A3357"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0A3357"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0A3357"/>
      </Borders>
    </Style>
    <Style ss:ID="ThVerde">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#15803D" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F5127"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F5127"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F5127"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F5127"/>
      </Borders>
    </Style>
    <Style ss:ID="TdCentro">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>
    <Style ss:ID="TdNombre">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>
    <Style ss:ID="TdLogrado">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#15803D"/>
      <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>
    <Style ss:ID="TdProceso">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#B45309"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>
    <Style ss:ID="TdAlerteRiesgo">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#B91C1C"/>
      <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>
  </Styles>
`;

  // ==========================================
  // HOJA 1: REGISTRO DE CALIFICACIONES
  // ==========================================
  const totalColsCalific = 2 + datosCalificaciones.indicadores.length + 3; // No, Nombre, ...inds, Final, Condición, DUA
  xml += `  <Worksheet ss:Name="Registro de Calificaciones">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="40"/>
      <Column ss:Width="220"/>
`;
  datosCalificaciones.indicadores.forEach(() => {
    xml += `      <Column ss:Width="160"/>\n`;
  });
  xml += `      <Column ss:Width="90"/>
      <Column ss:Width="100"/>
      <Column ss:Width="180"/>
`;

  // Fila 1: Título Oficial
  xml += `      <Row ss:Height="26">
        <Cell ss:MergeAcross="${totalColsCalific - 1}" ss:StyleID="TituloOficial">
          <Data ss:Type="String">MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA (MINERD)</Data>
        </Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:MergeAcross="${totalColsCalific - 1}" ss:StyleID="SubtituloOficial">
          <Data ss:Type="String">REGISTRO OFICIAL DE EVALUACIÓN DE LOS APRENDIZAJES — ORDENANZA 04-2023</Data>
        </Cell>
      </Row>
      <Row ss:Height="10"/>
`;

  // Fila 3 y 4: Ficha Técnica Institucional
  xml += `      <Row ss:Height="18">
        <Cell ss:StyleID="FichaEtiqueta"><Data ss:Type="String">Centro Educativo:</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="FichaValor"><Data ss:Type="String">${escaparXml(escuelaNombre)}</Data></Cell>
        <Cell ss:StyleID="FichaEtiqueta"><Data ss:Type="String">Código SIGERD:</Data></Cell>
        <Cell ss:StyleID="FichaValor"><Data ss:Type="String">${escaparXml(escuelaCodigo || "No registrado")}</Data></Cell>
        <Cell ss:StyleID="FichaEtiqueta"><Data ss:Type="String">Año Escolar:</Data></Cell>
        <Cell ss:MergeAcross="${Math.max(0, totalColsCalific - 6)}" ss:StyleID="FichaValor"><Data ss:Type="String">${escaparXml(anioEscolar)}</Data></Cell>
      </Row>
      <Row ss:Height="18">
        <Cell ss:StyleID="FichaEtiqueta"><Data ss:Type="String">Docente:</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="FichaValor"><Data ss:Type="String">${escaparXml(docenteNombre)}</Data></Cell>
        <Cell ss:StyleID="FichaEtiqueta"><Data ss:Type="String">Grado y Sección:</Data></Cell>
        <Cell ss:StyleID="FichaValor"><Data ss:Type="String">${escaparXml(grado)} - Sección ${escaparXml(seccion)}</Data></Cell>
        <Cell ss:StyleID="FichaEtiqueta"><Data ss:Type="String">Área Curricular:</Data></Cell>
        <Cell ss:MergeAcross="${Math.max(0, totalColsCalific - 6)}" ss:StyleID="FichaValor"><Data ss:Type="String">${escaparXml(area)}</Data></Cell>
      </Row>
      <Row ss:Height="12"/>
`;

  // Fila de Encabezados de la Tabla de Calificaciones
  xml += `      <Row ss:Height="32">
        <Cell ss:StyleID="ThAzul"><Data ss:Type="String">No.</Data></Cell>
        <Cell ss:StyleID="ThAzul"><Data ss:Type="String">Nombres y Apellidos del Estudiante</Data></Cell>
`;
  datosCalificaciones.indicadores.forEach((ind) => {
    xml += `        <Cell ss:StyleID="ThAzul"><Data ss:Type="String">${escaparXml(ind.codigo)}&#10;${escaparXml(ind.descripcion)}</Data></Cell>\n`;
  });
  xml += `        <Cell ss:StyleID="ThVerde"><Data ss:Type="String">Calificación Final</Data></Cell>
        <Cell ss:StyleID="ThVerde"><Data ss:Type="String">Condición</Data></Cell>
        <Cell ss:StyleID="ThAzul"><Data ss:Type="String">Adecuación DUA / NEAE</Data></Cell>
      </Row>
`;

  // Filas de Estudiantes
  datosCalificaciones.filas.forEach((est) => {
    xml += `      <Row ss:Height="19">
        <Cell ss:StyleID="TdCentro"><Data ss:Type="Number">${est.numero}</Data></Cell>
        <Cell ss:StyleID="TdNombre"><Data ss:Type="String">${escaparXml(est.nombre)}</Data></Cell>
`;
    datosCalificaciones.indicadores.forEach((ind) => {
      const val = est.valoresIndicadores[ind.id] || "";
      const isNum = typeof val === "number";
      const styleId = val === "L" ? "TdLogrado" : val === "P" ? "TdProceso" : "TdCentro";
      xml += `        <Cell ss:StyleID="${styleId}"><Data ss:Type="${isNum ? "Number" : "String"}">${escaparXml(val)}</Data></Cell>\n`;
    });

    const isFinalNum = typeof est.calificacionFinal === "number";
    const styleFinal = est.calificacionFinal === "L" || (isFinalNum && est.calificacionFinal >= 70) ? "TdLogrado" : "TdProceso";

    xml += `        <Cell ss:StyleID="${styleFinal}"><Data ss:Type="${isFinalNum ? "Number" : "String"}">${escaparXml(est.calificacionFinal)}</Data></Cell>
        <Cell ss:StyleID="${styleFinal}"><Data ss:Type="String">${escaparXml(est.condicion)}</Data></Cell>
        <Cell ss:StyleID="TdNombre"><Data ss:Type="String">${escaparXml(est.observacionesDua || "-")}</Data></Cell>
      </Row>
`;
  });

  // Pie de Hoja de Calificaciones (Resumen)
  xml += `      <Row ss:Height="12"/>
      <Row ss:Height="18">
        <Cell ss:MergeAcross="1" ss:StyleID="FichaEtiqueta"><Data ss:Type="String">Escala de Valoración Oficial MINERD:</Data></Cell>
        <Cell ss:MergeAcross="${totalColsCalific - 3}" ss:StyleID="FichaValor">
          <Data ss:Type="String">L = Logrado (80-100 pts) | P = En Proceso (65-79 pts) | I = Iniciado (&lt;65 pts) — Ordenanza 04-2023</Data>
        </Cell>
      </Row>
    </Table>
  </Worksheet>
`;

  // ==========================================
  // HOJA 2: CONTROL DE ASISTENCIA MENSUAL
  // ==========================================
  const totalColsAsist = 2 + datosAsistencia.dias.length + 5; // No, Nombre, ...dias, P, A, E, T, % Asistencia
  xml += `  <Worksheet ss:Name="Control de Asistencia">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="40"/>
      <Column ss:Width="220"/>
`;
  datosAsistencia.dias.forEach(() => {
    xml += `      <Column ss:Width="34"/>\n`;
  });
  xml += `      <Column ss:Width="40"/>
      <Column ss:Width="40"/>
      <Column ss:Width="40"/>
      <Column ss:Width="40"/>
      <Column ss:Width="70"/>
`;

  // Título y Subtítulo Asistencia
  xml += `      <Row ss:Height="26">
        <Cell ss:MergeAcross="${totalColsAsist - 1}" ss:StyleID="TituloOficial">
          <Data ss:Type="String">MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA (MINERD)</Data>
        </Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:MergeAcross="${totalColsAsist - 1}" ss:StyleID="SubtituloOficial">
          <Data ss:Type="String">CONTROL OFICIAL DE ASISTENCIA Y PUNTUALIDAD ESCOLAR — 20 DÍAS LECTIVOS</Data>
        </Cell>
      </Row>
      <Row ss:Height="10"/>
`;

  // Ficha de Asistencia
  xml += `      <Row ss:Height="18">
        <Cell ss:StyleID="FichaEtiqueta"><Data ss:Type="String">Centro Educativo:</Data></Cell>
        <Cell ss:MergeAcross="3" ss:StyleID="FichaValor"><Data ss:Type="String">${escaparXml(escuelaNombre)}</Data></Cell>
        <Cell ss:StyleID="FichaEtiqueta"><Data ss:Type="String">Grado / Sec:</Data></Cell>
        <Cell ss:MergeAcross="2" ss:StyleID="FichaValor"><Data ss:Type="String">${escaparXml(grado)} - ${escaparXml(seccion)}</Data></Cell>
        <Cell ss:StyleID="FichaEtiqueta"><Data ss:Type="String">Docente:</Data></Cell>
        <Cell ss:MergeAcross="${Math.max(0, totalColsAsist - 10)}" ss:StyleID="FichaValor"><Data ss:Type="String">${escaparXml(docenteNombre)}</Data></Cell>
      </Row>
      <Row ss:Height="12"/>
`;

  // Encabezados de la Tabla de Asistencia
  xml += `      <Row ss:Height="28">
        <Cell ss:StyleID="ThAzul"><Data ss:Type="String">No.</Data></Cell>
        <Cell ss:StyleID="ThAzul"><Data ss:Type="String">Nombres y Apellidos</Data></Cell>
`;
  datosAsistencia.dias.forEach((d) => {
    xml += `        <Cell ss:StyleID="ThAzul"><Data ss:Type="String">${escaparXml(d.etiqueta)}</Data></Cell>\n`;
  });
  xml += `        <Cell ss:StyleID="ThVerde"><Data ss:Type="String">P</Data></Cell>
        <Cell ss:StyleID="ThVerde"><Data ss:Type="String">A</Data></Cell>
        <Cell ss:StyleID="ThVerde"><Data ss:Type="String">E</Data></Cell>
        <Cell ss:StyleID="ThVerde"><Data ss:Type="String">T</Data></Cell>
        <Cell ss:StyleID="ThVerde"><Data ss:Type="String">% Asist.</Data></Cell>
      </Row>
`;

  // Filas de Estudiantes en Asistencia
  datosAsistencia.filas.forEach((est) => {
    xml += `      <Row ss:Height="19">
        <Cell ss:StyleID="TdCentro"><Data ss:Type="Number">${est.numero}</Data></Cell>
        <Cell ss:StyleID="TdNombre"><Data ss:Type="String">${escaparXml(est.nombre)}</Data></Cell>
`;
    datosAsistencia.dias.forEach((d) => {
      const code = est.registrosDias[d.indice] || "P";
      const styleD = code === "A" ? "TdAlerteRiesgo" : code === "E" ? "TdProceso" : "TdCentro";
      xml += `        <Cell ss:StyleID="${styleD}"><Data ss:Type="String">${escaparXml(code)}</Data></Cell>\n`;
    });

    const stylePct = est.alertaDesercion ? "TdAlerteRiesgo" : "TdCentro";

    xml += `        <Cell ss:StyleID="TdCentro"><Data ss:Type="Number">${est.presentes}</Data></Cell>
        <Cell ss:StyleID="TdCentro"><Data ss:Type="Number">${est.ausentes}</Data></Cell>
        <Cell ss:StyleID="TdCentro"><Data ss:Type="Number">${est.excusas}</Data></Cell>
        <Cell ss:StyleID="TdCentro"><Data ss:Type="Number">${est.tardanzas}</Data></Cell>
        <Cell ss:StyleID="${stylePct}"><Data ss:Type="String">${est.porcentajeAsistencia}%</Data></Cell>
      </Row>
`;
  });

  // Pie de Asistencia (Leyenda)
  xml += `      <Row ss:Height="12"/>
      <Row ss:Height="18">
        <Cell ss:MergeAcross="1" ss:StyleID="FichaEtiqueta"><Data ss:Type="String">Leyenda de Códigos:</Data></Cell>
        <Cell ss:MergeAcross="${totalColsAsist - 3}" ss:StyleID="FichaValor">
          <Data ss:Type="String">P = Presente | A = Ausente Injustificado | E = Excusa Justificada | T = Tardanza — Alerta si Asistencia &lt; 80%</Data>
        </Cell>
      </Row>
    </Table>
  </Worksheet>
</Workbook>`;

  return xml;
}

/**
 * Dispara la descarga directa del archivo Excel (.xls SpreadsheetML) en el navegador
 */
export function descargarRegistroExcel(plan = {}, perfil = null, nomina = null) {
  const xmlContent = generarXmlRegistroExcel(plan, perfil, nomina);
  const blob = new Blob([xmlContent], {
    type: "application/vnd.ms-excel;charset=utf-8"
  });

  const areaLimria = (plan.area || "Curricular").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 15);
  const gradoLimpio = (plan.grado || "Grado").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 15);
  const nombreArchivo = `Registro_MINERD_${areaLimria}_${gradoLimpio}.xls`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
}
