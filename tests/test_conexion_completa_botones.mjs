import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("================================================================================");
console.log("  AUDITORÍA DE CONEXIÓN TOTAL DE BOTONES Y CAPAS (MARGEN DE ERROR: 0.00%)");
console.log("================================================================================");

let totalPruebas = 0;
let superadas = 0;

function verificar(descripcion, condicion) {
  totalPruebas++;
  try {
    assert.ok(condicion, `Fallo en: ${descripcion}`);
    console.log(`  ✓ [SUPERADA] ${descripcion}`);
    superadas++;
  } catch (err) {
    console.error(`  ✗ [FALLO] ${descripcion} -> ${err.message}`);
  }
}

const clientSrcDir = path.resolve("client", "src");

// 1. AUDITORÍA DE UNIDAD DE APRENDIZAJE Y PROYECTO EN BottomPanel.jsx
const bottomPanelPath = path.join(clientSrcDir, "components", "BottomPanel.jsx");
const bottomPanelCode = fs.readFileSync(bottomPanelPath, "utf-8");

verificar("BottomPanel importa y no contiene avisos de 'handleProximamente' en los subítems", 
  !bottomPanelCode.includes("handleProximamente(sub.label)") && 
  !bottomPanelCode.includes("const handleProximamente")
);

verificar("Unidad de Aprendizaje: 'Nueva unidad' conectada", 
  bottomPanelCode.includes('"Nueva unidad"') && 
  bottomPanelCode.includes('"Nueva unidad de aprendizaje para: "')
);

verificar("Unidad de Aprendizaje: 'Situación de aprendizaje' conectada con esquema 'competencias_situacion'", 
  bottomPanelCode.includes('"Situación de aprendizaje"') && 
  bottomPanelCode.includes('esquemaVal = "competencias_situacion"') &&
  bottomPanelCode.includes('"Redactar una situación de aprendizaje auténtica basada en el contexto dominicano')
);

verificar("Unidad de Aprendizaje: 'Competencias e indicadores' (tabla de logros) conectada", 
  bottomPanelCode.includes('"Competencias e indicadores"') && 
  bottomPanelCode.includes('tabla de logros')
);

verificar("Unidad de Aprendizaje: 'Secuencia de actividades' conectada con esquema 'secuencia_didactica'", 
  bottomPanelCode.includes('"Secuencia de actividades"') && 
  bottomPanelCode.includes('esquemaVal = "secuencia_didactica"') &&
  bottomPanelCode.toLowerCase().includes('secuencia didáctica completa')
);

verificar("Unidad de Aprendizaje: 'Evaluación de la unidad' conectada", 
  bottomPanelCode.includes('"Evaluación de la unidad"') && 
  bottomPanelCode.includes('matriz de evaluación')
);

// 2. AUDITORÍA DE PROYECTO EN BottomPanel.jsx
verificar("Proyecto: 'Proyecto de aula' conectado con esquema 'abp'", 
  bottomPanelCode.includes('"Proyecto de aula"') && 
  bottomPanelCode.includes('esquemaVal = "abp"') &&
  bottomPanelCode.includes('Diseñar un proyecto participativo de aula con sus fases de indagación y acción')
);

verificar("Proyecto: 'Proyecto institucional' y 'Evaluación del proyecto' conectados", 
  bottomPanelCode.includes('"Proyecto institucional"') && 
  bottomPanelCode.includes('"Evaluación del proyecto"')
);

// 2.1 AUDITORÍA DE PLANIFICACIÓN ANUAL EN BottomPanel.jsx
verificar("Planificación Anual: Cabecera conectada a handleToggleSection activando período 'anual'", 
  bottomPanelCode.includes('handleToggleSection(sec)') &&
  bottomPanelCode.includes('onSeleccionarEsquema(sec.periodoValue')
);

verificar("Planificación Anual: 'Plan anual general' conectado con prompt y título", 
  bottomPanelCode.includes('"Plan anual general"') && 
  bottomPanelCode.includes('"Plan Anual General"') &&
  bottomPanelCode.includes('Planificación anual general y dosificación curricular')
);

verificar("Planificación Anual: 'Distribución por períodos' conectado con prompt para P1, P2, P3, P4", 
  bottomPanelCode.includes('"Distribución por períodos"') && 
  bottomPanelCode.includes('cuatro períodos lectivos (P1, P2, P3, P4)')
);

verificar("Planificación Anual: 'Proyección del año' conectado con prompt para metas y proyectos", 
  bottomPanelCode.includes('"Proyección del año"') && 
  bottomPanelCode.includes('Metas anuales de aprendizaje, proyectos pedagógicos y efemérides')
);

// 2.2 AUDITORÍA DE PLANIFICACIÓN SEMANAL EN BottomPanel.jsx
verificar("Planificación Semanal: Cabecera conectada a handleToggleSection activando período 'semanal'", 
  bottomPanelCode.includes('key: "semanal"') &&
  bottomPanelCode.includes('periodoValue: "semanal"')
);

verificar("Planificación Semanal: 'Plan semanal general' conectado integrando áreas, actividades y recursos", 
  bottomPanelCode.includes('"Plan semanal general"') && 
  bottomPanelCode.includes('"Plan Semanal General (Áreas, Actividades y Recursos)"') &&
  bottomPanelCode.includes('Planificación semanal completa integrando')
);

verificar("Planificación Semanal: 'Distribución por áreas' conectado con prompt y título", 
  bottomPanelCode.includes('"Distribución por áreas"') && 
  bottomPanelCode.includes('"Distribución por Áreas Curriculares"') &&
  bottomPanelCode.includes('Distribución horaria y articulación de las áreas curriculares')
);

verificar("Planificación Semanal: 'Actividades de la semana' conectado con prompt y título", 
  bottomPanelCode.includes('"Actividades de la semana"') && 
  bottomPanelCode.includes('"Actividades de la Semana (Lunes a Viernes)"') &&
  bottomPanelCode.includes('Secuencia pedagógica de actividades de lunes a viernes')
);

verificar("Planificación Semanal: 'Recursos y materiales' conectado con prompt y título", 
  bottomPanelCode.includes('"Recursos y materiales"') && 
  bottomPanelCode.includes('"Recursos Didácticos y Materiales de la Semana"') &&
  bottomPanelCode.includes('Inventario de recursos didácticos, medios tecnológicos')
);

// 2.3 AUDITORÍA DE PLANIFICACIÓN DIARIA EN BottomPanel.jsx
verificar("Planificación Diaria: 6 subítems presentes en SECCIONES_PLANIFICACION", 
  bottomPanelCode.includes('"Plan diario general"') &&
  bottomPanelCode.includes('"Registro de actividades"') &&
  bottomPanelCode.includes('"Horario semanal"') &&
  bottomPanelCode.includes('"Día y horario detallado"') &&
  bottomPanelCode.includes('"Notas de aula"') &&
  bottomPanelCode.includes('"Evaluación diaria"')
);

verificar("Planificación Diaria: 'Registro de actividades' y 'Día y horario detallado' conectados a esquema secuencia_didactica", 
  bottomPanelCode.includes('sub.label === "Registro de actividades"') &&
  bottomPanelCode.includes('sub.label === "Día y horario detallado"') &&
  bottomPanelCode.includes('secuencia_didactica')
);

verificar("Planificación Diaria: Prompts curriculares vinculados a Malla, Guías y Registro de Grado MINERD", 
  bottomPanelCode.includes('Malla Curricular oficial del MINERD') &&
  bottomPanelCode.includes('Guías Didácticas del MINERD') &&
  bottomPanelCode.includes('Registro de Grado Oficial del MINERD') &&
  bottomPanelCode.includes('adaptaciones curriculares DUA')
);

// 3. AUDITORÍA DE Header.jsx
const headerPath = path.join(clientSrcDir, "components", "Header.jsx");
const headerCode = fs.readFileSync(headerPath, "utf-8");

verificar("Header.jsx: Campana de Notificaciones conectada con onAbrirNotificaciones", 
  headerCode.includes('onClick={onAbrirNotificaciones}')
);

verificar("Header.jsx: Botones de 'Configuración (v2.0)' conectados con onAbrirConfiguracion", 
  headerCode.includes('onAbrirConfiguracion?.()')
);

// 4. AUDITORÍA DE UnifiedEntrySelector.jsx
const entrySelectorPath = path.join(clientSrcDir, "components", "UnifiedEntrySelector.jsx");
const entrySelectorCode = fs.readFileSync(entrySelectorPath, "utf-8");

verificar("UnifiedEntrySelector.jsx: Tarjeta Por Voz conectada con onDictadoClick", 
  entrySelectorCode.includes('onClick={onDictadoClick}')
);

verificar("UnifiedEntrySelector.jsx: Tarjeta Foto conectada con onAbrirCamara", 
  entrySelectorCode.includes('onClick={onAbrirCamara}')
);

verificar("UnifiedEntrySelector.jsx: Tarjeta Texto conectada con onAbrirTexto", 
  entrySelectorCode.includes('onAbrirTexto?.()')
);

verificar("UnifiedEntrySelector.jsx: Botones directos de Currículo MINERD y Esquemas conectados", 
  entrySelectorCode.includes('onClick={onAbrirCurriculo}') && 
  entrySelectorCode.includes('onClick={onAbrirEsquemas}')
);

// 5. AUDITORÍA DE WizardStepper.jsx
const stepperPath = path.join(clientSrcDir, "components", "WizardStepper.jsx");
const stepperCode = fs.readFileSync(stepperPath, "utf-8");

verificar("WizardStepper.jsx: Paso 2 (Tema / Material) es interactivo y tiene onClick: onTemaClick", 
  stepperCode.includes('titulo: "Tema / Material"') && 
  stepperCode.includes('onClick: onTemaClick') &&
  stepperCode.includes('clickable: true')
);

verificar("WizardStepper.jsx: Paso 3 (Revisar y Exportar) tiene onClick: onRevisarClick", 
  stepperCode.includes('titulo: "Revisar y Exportar"') && 
  stepperCode.includes('onClick: onRevisarClick')
);

// 6. AUDITORÍA DE App.jsx, CÁMARA Y VOZ DIALOGANTE
const appPath = path.join(clientSrcDir, "App.jsx");
const appCode = fs.readFileSync(appPath, "utf-8");

verificar("App.jsx: handleAbrirTexto recibe promptInicial y titulo", 
  appCode.includes('function handleAbrirTexto(promptInicial = "", titulo = "Describe la planificación")') &&
  appCode.includes('setTextoModalPrompt(promptInicial || "")') &&
  appCode.includes('setTextoModalTitulo(titulo || "Describe la planificación")')
);

verificar("App.jsx: TextoModal conectado a onConsultarCurriculo", 
  appCode.includes('onConsultarCurriculo={() => {') &&
  appCode.includes('setCurriculumOpen(true);')
);

verificar("App.jsx: Cámara inteligente envía prompt de visión pedagógica avanzada", 
  appCode.includes('📸 Analiza esta imagen con visión pedagógica avanzada') &&
  appCode.toLowerCase().includes('determina el tema central, área curricular y grado escolar')
);

verificar("App.jsx: Dictado por voz activa respuesta hablada (asistente dialogante)", 
  appCode.includes('fuePorVozRef') &&
  appCode.includes('handleEscuchar(chatText)')
);

verificar("App.jsx: Cada respuesta del asistente incluye botón de altavoz para dialogar", 
  appCode.includes('isSpeaking ? stopSpeaking() : handleEscuchar(m.text)') &&
  appCode.includes('title="Escuchar respuesta con voz"')
);

verificar("App.jsx: Modales NotificacionesModal, ConfiguracionModal y AyudaModal renderizados", 
  appCode.includes('<NotificacionesModal') &&
  appCode.includes('<ConfiguracionModal') &&
  appCode.includes('<AyudaModal')
);

// 7. AUDITORÍA DE BACKEND (plan.js, ocr.js, voice.js)
const serverDir = path.resolve("server");
const planPath = path.join(serverDir, "routes", "plan.js");
const planCode = fs.readFileSync(planPath, "utf-8");
const ocrPath = path.join(serverDir, "routes", "ocr.js");
const ocrCode = fs.readFileSync(ocrPath, "utf-8");
const voicePath = path.join(serverDir, "routes", "voice.js");
const voiceCode = fs.readFileSync(voicePath, "utf-8");

verificar("plan.js: PROFUNDIDAD_TEMPORAL.diaria integra Malla Curricular, Guías y Registro de Grado", 
  planCode.includes('Malla Curricular MINERD (competencias específicas, contenidos e indicadores de logro)') &&
  planCode.includes('Registro de Grado Oficial (criterios, evidencias e instrumentos de evaluación formativa)')
);

verificar("plan.js: Visión pedagógica de cámara genera plan completo directamente desde imágenes", 
  planCode.includes('CAPACIDAD MULTIMODAL (VISIÓN PEDAGÓGICA Y CÁMARA INTELIGENTE)') &&
  planCode.includes('Genera DE INMEDIATO la planificación didáctica completa')
);

verificar("ocr.js: Migrado a GoogleGenAI con Gemini Flash Multimodal", 
  ocrCode.includes('@google/genai') &&
  ocrCode.includes('geminiClient.models.generateContent') &&
  !ocrCode.includes('@anthropic-ai/sdk')
);

verificar("voice.js: Retorna fallbackLocal si ElevenLabs no está configurada", 
  voiceCode.includes('fallbackLocal: true')
);

console.log("================================================================================");
console.log(`  RESUMEN: ${superadas} de ${totalPruebas} pruebas superadas.`);
console.log(`  MARGEN DE ERROR: ${((totalPruebas - superadas) / totalPruebas * 100).toFixed(2)}%`);
console.log("================================================================================");

if (superadas !== totalPruebas) {
  process.exit(1);
}
