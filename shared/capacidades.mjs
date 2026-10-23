/**
 * shared/capacidades.mjs
 * Manifiesto de capacidades del Cerebro Digital Planifica Maestro (C17).
 */
export const capacidadesManifest = [
  {
    "id": "C1",
    "nombre": "Conversación pedagógica empática",
    "estado": "encendida",
    "archivo": "worker/modoConversacional.js",
    "interruptor": "MODO_CONVERSACIONAL",
    "variable_requerida": null,
    "descripcion": "Saludo según hora local dominicana, charla empática sin generar planes innecesarios y corrección ortográfica respetando el significado."
  },
  {
    "id": "C2",
    "nombre": "Consulta curricular oficial MINERD",
    "estado": "encendida",
    "archivo": "shared/curriculoService.mjs",
    "interruptor": "CONSULTA_CURRICULAR",
    "variable_requerida": "SUPABASE_URL, SUPABASE_ANON_KEY",
    "descripcion": "Consulta verificada sobre 8 áreas de Primaria (1.° a 6.°), citando fuente oficial, página y estado de validación sin alucinar."
  },
  {
    "id": "C3",
    "nombre": "Búsqueda web con consentimiento previo",
    "estado": "encendida",
    "archivo": "server/ia/enrutadorIA.js",
    "interruptor": "PERMITIR_BUSQUEDA_WEB",
    "variable_requerida": "TAVILY_API_KEY",
    "descripcion": "Investigación web verificada que solicita confirmación previa al usuario, priorizando dominios oficiales del MINERD."
  },
  {
    "id": "C4",
    "nombre": "Lectura y extracción de documentos",
    "estado": "apagada",
    "archivo": "worker/services/lectorDocumentos.js",
    "interruptor": "LECTOR_DOCUMENTOS",
    "variable_requerida": null,
    "descripcion": "Extracción de texto limpio en HTML y PDFs, tratando el contenido exclusivamente como dato y nunca como instrucción ejecutable. [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C5",
    "nombre": "Visión computacional y análisis visual",
    "estado": "apagada",
    "archivo": "worker/ojoDigital.js",
    "interruptor": "MODO_VISION",
    "variable_requerida": "GEMINI_API_KEY",
    "descripcion": "Identificación de imágenes educativas, páginas de libros escolares y esquemas, preguntando el objetivo docente antes de procesar. [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C6",
    "nombre": "Visualización de recursos y multimedia",
    "estado": "apagada",
    "archivo": "worker/index.js",
    "interruptor": "VISUALIZAR_MEDIOS",
    "variable_requerida": null,
    "descripcion": "Presentación de mapas geográficos, diagramas y enlaces a videos educativos oficiales sin inventar URLs. [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C7",
    "nombre": "Cálculo y consistencia temporal en planes",
    "estado": "apagada",
    "archivo": "worker/parseadorJsonSeguro.js",
    "interruptor": "MOTOR_MATEMATICO_PLANES",
    "variable_requerida": null,
    "descripcion": "Validación determinista de que la suma de los momentos pedagógicos (inicio, desarrollo, cierre) coincida exactamente con la duración declarada. [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C8",
    "nombre": "Normativa institucional MINERD",
    "estado": "encendida",
    "archivo": "worker/glosarioDocente.js",
    "interruptor": "NORMATIVA_MINERD",
    "variable_requerida": null,
    "descripcion": "Cita exacta de leyes y ordenanzas vigentes (como la de tanda extendida) o solicitud de permiso para búsqueda externa sin inventar artículos ni fechas."
  },
  {
    "id": "C9",
    "nombre": "Planificación pedagógica completa",
    "estado": "apagada",
    "archivo": "worker/index.js",
    "interruptor": "GENERAR_PLANIFICACION",
    "variable_requerida": "GEMINI_API_KEY",
    "descripcion": "Generación de secuencias didácticas y unidades de aprendizaje sin campos vacíos, soporte multigrado y exportación horizontal a Word. [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C10",
    "nombre": "Memoria pedagógica contextual y aislamiento",
    "estado": "apagada",
    "archivo": "worker/index.js",
    "interruptor": "CONTROL_CUOTAS",
    "variable_requerida": null,
    "descripcion": "Recordatorio de contexto entre sesiones para el mismo docente y estricto aislamiento entre dispositivos sin uso de claves en cliente. [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C11",
    "nombre": "Enrutador resiliente de proveedores IA",
    "estado": "apagada",
    "archivo": "server/ia/enrutadorIA.js",
    "interruptor": "ENRUTADOR_IA_MULTI",
    "variable_requerida": "GEMINI_API_KEY",
    "descripcion": "Conmutación por circuit breaker ante errores 429/503 con sello de contingencia y control de cuota. [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C12",
    "nombre": "Síntesis y reconocimiento de voz",
    "estado": "apagada",
    "archivo": "worker/services/voiceProvider.js",
    "interruptor": "VOZ_TTS",
    "variable_requerida": "ELEVENLABS_API_KEY (opcional, respaldo local)",
    "descripcion": "Lectura auditiva de respuestas pedagógicas con respaldo automático; dictado en teléfono móvil a verificar en dispositivo. [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C13",
    "nombre": "Edición y realce de imagen escolar",
    "estado": "apagada",
    "archivo": "shared/catalogoEdicionImagen.js",
    "interruptor": "EDICION_IMAGEN_LOCAL",
    "variable_requerida": null,
    "descripcion": "Ajuste de brillo, contraste, escala de grises y marcos para material escolar, protegido por política estricta de dignidad y seguridad de menores. [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C14",
    "nombre": "Seguridad y neutralización de inyecciones",
    "estado": "encendida",
    "archivo": "worker/politicaDignidadImagen.js",
    "interruptor": "SEGURIDAD_DATOS",
    "variable_requerida": null,
    "descripcion": "Tratamiento de texto de entrada como dato puro, rechazo de intentos de extracción de claves y protección de datos escolares."
  },
  {
    "id": "C15",
    "nombre": "PWA responsive y experiencia de usuario",
    "estado": "apagada",
    "archivo": "client/src/App.jsx",
    "interruptor": "PWA_ACTIVA",
    "variable_requerida": null,
    "descripcion": "Interfaz accesible para docentes dominicanos, tipografía clara, selector de esquema curricular y funcionamiento offline en caché. [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C16",
    "nombre": "Herramientas V2 (Tool-calling dinámico)",
    "estado": "apagada",
    "archivo": "shared/ciclo.js",
    "interruptor": "HERRAMIENTAS_V2",
    "variable_requerida": "HERRAMIENTAS_V2=true",
    "descripcion": "Ciclo de tool-calling dinámico; apagado por defecto para priorizar la latencia y robustez del RAG directo. [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C17",
    "nombre": "Registro y manifiesto transparente de capacidades",
    "estado": "encendida",
    "archivo": "shared/capacidades.json",
    "interruptor": "MANIFIESTO_CAPACIDADES",
    "variable_requerida": null,
    "descripcion": "Manifiesto aditivo consultable que detalla el estado verificado de cada función del asistente educativo."
  },
  {
    "id": "C18",
    "nombre": "Auditoría arquitectural y búsqueda híbrida",
    "estado": "apagada",
    "archivo": "docs/RUNBOOK_SUPABASE.md",
    "interruptor": "AUDITORIA_ARQUITECTURA",
    "variable_requerida": null,
    "descripcion": "Diseño preparado para búsqueda semántica vectorial (SQL preparado para el Dueño sin DDL). [Apagada en cierre 024: prueba cruda no ejecutada en esta sesión]"
  },
  {
    "id": "C19",
    "nombre": "Tutor de aritmética y matemática Primaria",
    "estado": "encendida",
    "archivo": "shared/matematica.mjs",
    "interruptor": "TUTOR_MATEMATICA",
    "variable_requerida": null,
    "descripcion": "Motor determinista con BigInt y Fracción propia (cero errores flotantes), explicación paso a paso con múltiples métodos y resolución exacta de Primaria."
  }
];

export function generarRespuestaQuePuedesHacer() {
  const encendidas = capacidadesManifest.filter(c => c.estado === "encendida");
  const apagadas = capacidadesManifest.filter(c => c.estado === "apagada");

  let texto = "Como colega pedagógico de Planifica Maestro, estas son mis capacidades activas y verificadas:\n\n";
  for (const c of encendidas) {
    texto += `- **${c.nombre}**: ${c.descripcion}\n`;
  }
  if (apagadas.length > 0) {
    texto += "\n**Capacidades desactivadas actualmente:**\n";
    for (const c of apagadas) {
      texto += `- **${c.nombre}**: ${c.descripcion} (Requiere: ${c.variable_requerida || c.interruptor})\n`;
    }
  }
  return texto;
}
