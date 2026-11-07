/**
 * client/src/services/planificacionCerebroService.js
 * Servicio de conexión con la ruta HTTP POST /api/planificar (Cerebro Backend Worker).
 * Procesa la respuesta certificada con doble grounding MINERD / CON BASE,
 * extrayendo la matriz didáctica de 3 momentos, tramos diferenciados y alertas del asesor.
 */

/**
 * Resuelve la URL base adecuada: en desarrollo local bajo Vite (puerto 5173),
 * conecta directamente con el Worker local en http://localhost:8787.
 */
export function obtenerBaseUrl() {
  if (typeof window !== 'undefined' && window.location && window.location.port === '5173') {
    return 'http://localhost:8787';
  }
  return '';
}

/**
 * Despacha la solicitud de planificación al Cloudflare Worker
 * @param {Object} params
 * @param {string} params.prompt - Descripción del tema o requerimiento
 * @param {Array<string>} [params.historial] - Historial de temas de la sesión (detector redundancia)
 * @param {string} [params.nivel] - 'primario', 'secundario', 'inicial'
 * @param {number|string} [params.grado] - Grado curricular específico
 * @param {AbortSignal} [params.signal] - Señal de cancelación
 * @returns {Promise<Object>} Resultado con texto plano y matriz parseada
 */
export async function planificarClaseCerebro({
  prompt,
  historial = [],
  nivel = 'primario',
  grado = null,
  signal = null
}) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('El tema o requerimiento de la clase es obligatorio.');
  }

  const endpoint = `${obtenerBaseUrl()}/api/planificar`;
  const cuerpo = {
    prompt: prompt.trim(),
    historial: Array.isArray(historial) ? historial : [],
    nivel: nivel || 'primario',
    grado: grado || null
  };

  const respuesta = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(cuerpo),
    signal
  });

  if (!respuesta.ok) {
    let errorMsg = `Error HTTP ${respuesta.status}`;
    try {
      const errJson = await respuesta.json();
      if (errJson && errJson.error) {
        errorMsg = errJson.error;
      }
    } catch {
      // Ignorar fallo de parseo de error
    }
    throw new Error(errorMsg);
  }

  const data = await respuesta.json();
  const matriz = parsearMatrizPlanificacion(data.planificacion || '');

  return {
    exito: Boolean(data.exito),
    sistema: data.sistema || 'Planifica Maestro — Sistema de Gestión y Planificación Docente',
    auditoria: data.auditoria || { aprobado: false, dictamen: 'Sin auditar' },
    planificacion: data.planificacion || '',
    asesor: data.asesor || null,
    evidencias: data.evidencias || [],
    matriz
  };
}

/**
 * Parsea el texto generado por CerebroRobot y extrae la estructura de la Matriz Didáctica
 * @param {string} texto 
 * @returns {Object} Estructura normalizada de la matriz
 */
export function parsearMatrizPlanificacion(texto) {
  if (!texto || typeof texto !== 'string') {
    return {
      metadatos: {},
      inicio: { tiempo: '10 min', actividades: [] },
      desarrollo: { tiempo: '25 min', tramos: [], actividades: [] },
      cierre: { tiempo: '10 min', actividades: [] },
      asesorNotas: [],
      textoOriginal: ''
    };
  }

  const lineas = texto.split('\n');
  const metadatos = {};
  const asesorNotas = [];

  // 1. Extracción de Metadatos
  const regexMetadato = /\*\*(Docente|Centro Educativo|Área|Tema|Tiempo|Grado)[:\s]*\*\*:?\s*(.+)/i;
  for (const l of lineas) {
    const match = l.match(regexMetadato);
    if (match) {
      const clave = match[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      metadatos[clave] = match[2].trim();
    }
    // Notas de asesor inyectadas
    if (l.includes('Nota del Asesor Pedagógico') || l.includes('Orientación Curricular Oficial')) {
      asesorNotas.push(l.replace(/^[>*\s#]+/, '').trim());
    }
  }

  // 2. Extracción de los 3 Momentos Didácticos
  const seccionInicio = extraerBloqueMomento(texto, 'inicio', ['desarrollo', 'cierre']);
  const seccionDesarrollo = extraerBloqueMomento(texto, 'desarrollo', ['cierre', 'nota:']);
  const seccionCierre = extraerBloqueMomento(texto, 'cierre', ['nota:', 'fuente', 'evidencias']);

  // 3. Extracción de Tramos CON BASE dentro de Desarrollo
  const tramosConBase = extraerTramosConBase(seccionDesarrollo);

  return {
    metadatos: {
      docente: metadatos.docente || 'Docente Titular',
      centro: metadatos['centro educativo'] || metadatos.centro || 'Centro Educativo MINERD',
      area: metadatos.area || 'Lengua Española',
      tema: metadatos.tema || 'Clase Curricular',
      tiempo: metadatos.tiempo || '45 minutos',
      grado: metadatos.grado || '1.° y 2.° Primaria'
    },
    inicio: {
      titulo: 'Inicio (Activación & Saberes Previos)',
      tiempo: '10 min',
      contenido: seccionInicio.trim(),
      puntos: extraerPuntosBullet(seccionInicio)
    },
    desarrollo: {
      titulo: 'Desarrollo (Secuencia Didáctica & Tramos CON BASE)',
      tiempo: '25 min',
      contenido: seccionDesarrollo.trim(),
      tramos: tramosConBase,
      puntos: extraerPuntosBullet(seccionDesarrollo)
    },
    cierre: {
      titulo: 'Cierre (Evaluación Formativa & Metacognición)',
      tiempo: '10 min',
      contenido: seccionCierre.trim(),
      puntos: extraerPuntosBullet(seccionCierre)
    },
    asesorNotas,
    textoOriginal: texto
  };
}

function extraerBloqueMomento(texto, nombreMomento, siguientesMomentos) {
  const patronInicio = new RegExp(`(?:###?\\s*)?${nombreMomento}[^\\n]*\\n`, 'i');
  const indexInicio = texto.search(patronInicio);
  if (indexInicio === -1) return '';

  const sub = texto.substring(indexInicio);
  const lineas = sub.split('\n');
  const contenido = [];
  let empezo = false;

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (i === 0) {
      empezo = true;
      continue;
    }
    // Si encontramos el inicio de otro momento, cortar
    const esSiguiente = siguientesMomentos.some(m => new RegExp(`(?:###?\\s*)?${m}[^\\n]*`, 'i').test(linea));
    if (esSiguiente) {
      break;
    }
    contenido.push(linea);
  }

  return contenido.join('\n').replace(/^---+\s*$/gm, '').trim();
}

function extraerTramosConBase(textoDesarrollo) {
  const tramos = [];
  if (!textoDesarrollo) return tramos;

  const regexTramo = /\*\*(Tramo\s*\d[\s\S]*?)\*\*:?\s*([\s\S]*?)(?=(?:\*\*Tramo\s*\d|###|\n---\n|$))/gi;
  let match;
  while ((match = regexTramo.exec(textoDesarrollo)) !== null) {
    const cabecera = match[1].trim();
    const cuerpo = match[2].trim();
    
    // Determinar badge según el número de tramo
    let badgeTipo = 'general';
    let badgeEtiqueta = 'Tramo CON BASE';
    if (/tramo\s*1/i.test(cabecera)) {
      badgeTipo = 'mediacion';
      badgeEtiqueta = 'Tramo 1: Mediación Directa';
    } else if (/tramo\s*2/i.test(cabecera)) {
      badgeTipo = 'autonomo';
      badgeEtiqueta = 'Tramo 2: Trabajo Autónomo';
    } else if (/tramo\s*3/i.test(cabecera)) {
      badgeTipo = 'encuentro';
      badgeEtiqueta = 'Tramo 3: Encuentro Colectivo';
    }

    tramos.push({
      cabecera,
      cuerpo,
      badgeTipo,
      badgeEtiqueta,
      puntos: extraerPuntosBullet(cuerpo)
    });
  }

  return tramos;
}

function extraerPuntosBullet(bloque) {
  if (!bloque) return [];
  const lineas = bloque.split('\n');
  const puntos = [];
  for (const l of lineas) {
    const limpia = l.trim();
    if (limpia.startsWith('*') || limpia.startsWith('-') || /^\d+\./.test(limpia)) {
      puntos.push(limpia.replace(/^[*-\d.]\s*/, '').trim());
    }
  }
  return puntos.length > 0 ? puntos : [bloque.trim()];
}
