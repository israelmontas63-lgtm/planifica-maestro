const fs = require('fs');
const path = require('path');

const RUTA_ESQUEMA = path.join(__dirname, '../esquemas/con_base_multigrado.schema.json');
let ESQUEMA_CON_BASE = null;
try {
  ESQUEMA_CON_BASE = JSON.parse(fs.readFileSync(RUTA_ESQUEMA, 'utf-8'));
} catch (e) {
  console.error('Error cargando esquema con_base_multigrado.schema.json:', e);
}

const APARTADOS_REQUERIDOS = [
  'apartado_I_insercion_curricular',
  'apartado_II_presentacion_de_la_secuencia',
  'apartado_III_recursos_para_toda_la_secuencia',
  'apartado_IV_desarrollo_de_la_secuencia',
  'apartado_V_criterios_para_la_valoracion',
  'apartado_VI_orientaciones_generales_para_profundizar_la_ensenanza',
  'fuente_pie'
];

const AGRUPAMIENTOS_VALIDOS = ['Grupo total', 'Grupo por grado', 'Grupo cooperativo'];
const GRADOS_PRIMER_CICLO_VALIDOS = ['1.º', '2.º', '3.º'];

const PALABRAS_CON_TILDE = [
  { con: 'Autobiografía', regex: /\bautobiografia\b/i },
  { con: 'Planificación', regex: /\bplanificacion\b/i },
  { con: 'Educación', regex: /\beducacion\b/i },
  { con: 'Didáctica', regex: /\bdidactica\b/i },
  { con: 'Comunicación', regex: /\bcomunicacion\b/i },
  { con: 'Evaluación', regex: /\bevaluacion\b/i },
  { con: 'Atención', regex: /\batencion\b/i },
  { con: 'Lógico', regex: /\blogico\b/i },
  { con: 'Artística', regex: /\bartistica\b/i },
  { con: 'Pedagógica', regex: /\bpedagogica\b/i },
  { con: 'Numeración', regex: /\bnumeracion\b/i }
];

function normalizarGrado(g) {
  if (!g) return '';
  const s = String(g).trim().toLowerCase();
  if (s.startsWith('1') || s.includes('primer')) return '1.º';
  if (s.startsWith('2') || s.includes('segund')) return '2.º';
  if (s.startsWith('3') || s.includes('tercer')) return '3.º';
  if (s.startsWith('4') || s.includes('cuart')) return '4.º';
  if (s.startsWith('5') || s.includes('quint')) return '5.º';
  if (s.startsWith('6') || s.includes('sext')) return '6.º';
  return String(g).trim();
}

function validarRespuestaConBaseMultigrado({ respuesta, gradosPerfil = [], area = 'Lengua Española' }) {
  const errores = [];

  const gradosPerfilNorm = (gradosPerfil || []).map(normalizarGrado);
  const tieneSegundoCiclo = gradosPerfilNorm.some(g => ['4.º', '5.º', '6.º'].includes(g));

  if (tieneSegundoCiclo) {
    return {
      valido: false,
      motivo: 'alcance_primer_ciclo',
      mensajeDocente: '¡Hola, colega! El formato de secuencia didáctica CON BASE (multigrado) está diseñado exclusivamente para el primer ciclo de primaria (1.º, 2.º y 3.º grado). Para los grados de 4.º a 6.º, te recomendamos utilizar el formato general de planificación.',
      errores: ['El perfil docente incluye grados de segundo ciclo (4.º a 6.º) no cubiertos por este formato.']
    };
  }

  if (!respuesta || typeof respuesta !== 'object') {
    return {
      valido: false,
      motivo: 'respuesta_malformada',
      mensajeDocente: 'Estimado maestro/a: La respuesta no tiene un formato válido para procesar.',
      errores: ['La respuesta no es un objeto JSON válido.']
    };
  }

  if (!respuesta.encabezado) {
    errores.push('Falta el bloque obligatorio: encabezado');
  }

  for (const apartado of APARTADOS_REQUERIDOS) {
    if (!respuesta[apartado] || typeof respuesta[apartado] !== 'object') {
      errores.push('Falta el bloque obligatorio: ' + apartado);
    }
  }

  // Nota: Continuamos acumulando errores en los bloques existentes para reporte exhaustivo

  const gradosResp = (respuesta.encabezado.grados || []).map(normalizarGrado);
  if (gradosResp.length === 0) {
    errores.push('El encabezado no contiene ningún grado escolar.');
  }

  const gradosInvalidos = gradosResp.filter(g => !GRADOS_PRIMER_CICLO_VALIDOS.includes(g));
  if (gradosInvalidos.length > 0) {
    errores.push('Grados no permitidos en este formato: ' + gradosInvalidos.join(', ') + '. Solo se admiten 1.º, 2.º y 3.º.');
  }

  if (gradosPerfilNorm.length > 0) {
    const faltanEnResp = gradosPerfilNorm.filter(g => !gradosResp.includes(g));
    const sobranEnResp = gradosResp.filter(g => !gradosPerfilNorm.includes(g));
    if (faltanEnResp.length > 0 || sobranEnResp.length > 0) {
      errores.push('Los grados de la respuesta (' + gradosResp.join(', ') + ') no coinciden con los grados del perfil (' + gradosPerfilNorm.join(', ') + ').');
    }
  }

  const insercion = respuesta.apartado_I_insercion_curricular;
  if (insercion) {
    if (!Array.isArray(insercion.competencias_fundamentales) || insercion.competencias_fundamentales.length !== 7) {
      errores.push('El Apartado I debe contener exactamente las 7 Competencias Fundamentales.');
    }

    if (!Array.isArray(insercion.grados_curriculo) || insercion.grados_curriculo.length === 0) {
      errores.push('El Apartado I debe contener la inserción curricular por cada grado solicitado.');
    } else {
      for (const gc of insercion.grados_curriculo) {
        const gNorm = normalizarGrado(gc.grado);
        if (!gradosResp.includes(gNorm)) {
          errores.push('El grado ' + gc.grado + ' en la inserción curricular no corresponde a los grados del encabezado.');
        }
        if (!gc.competencias_especificas || gc.competencias_especificas.length === 0) {
          errores.push('El grado ' + gc.grado + ' no tiene competencias específicas asignadas.');
        }
        if (!gc.indicadores_de_logro || gc.indicadores_de_logro.length === 0) {
          errores.push('El grado ' + gc.grado + ' no tiene indicadores de logro asignados.');
        }
        if (!gc.fuente_adecuacion_curricular || typeof gc.fuente_adecuacion_curricular !== 'string' || !gc.fuente_adecuacion_curricular.trim()) {
          errores.push('El grado ' + gc.grado + ' carece de referencia a la fuente de la Adecuación Curricular.');
        }
      }
    }
  }

  const desarrollo = respuesta.apartado_IV_desarrollo_de_la_secuencia;
  if (desarrollo) {
    if (!Array.isArray(desarrollo.momentos) || desarrollo.momentos.length === 0) {
      errores.push('El Apartado IV debe contener al menos un momento pedagógico.');
    } else {
      desarrollo.momentos.forEach((mom, idx) => {
        const numMom = mom.momento_numero || ('Momento ' + (idx + 1));
        if (!mom.agrupamiento || typeof mom.agrupamiento !== 'string' || !mom.agrupamiento.trim()) {
          errores.push(numMom + ' no tiene asignado el tipo de agrupamiento (ej. Grupo total, Grupo por grado, Grupo cooperativo).');
        } else if (!AGRUPAMIENTOS_VALIDOS.includes(mom.agrupamiento.trim())) {
          errores.push(numMom + ' tiene un agrupamiento no reconocido (' + mom.agrupamiento + '). Debe ser uno de: ' + AGRUPAMIENTOS_VALIDOS.join(', ') + '.');
        }
        if (!mom.descripcion || !mom.descripcion.trim()) {
          errores.push(numMom + ' no tiene descripción de actividades.');
        }
      });
    }
  }

  const orientaciones = respuesta.apartado_VI_orientaciones_generales_para_profundizar_la_ensenanza;
  if (orientaciones) {
    if (!Array.isArray(orientaciones.actividades_diferenciadas) || orientaciones.actividades_diferenciadas.length === 0) {
      errores.push('El Apartado VI debe contener la lista de actividades diferenciadas por grado.');
    } else {
      const gradosConActividad = orientaciones.actividades_diferenciadas.map(a => normalizarGrado(a.grado_o_grupo));
      for (const g of gradosResp) {
        if (!gradosConActividad.includes(g)) {
          errores.push(`El Apartado VI no contiene una actividad diferenciada para el grado ${g}. Debe incluir una propuesta para cada grado seleccionado.`);
        }
      }
    }
  }

  const areaResp = (respuesta.encabezado?.area || area || '').toLowerCase();
  if (areaResp.includes('matem')) {
    const pie = respuesta.fuente_pie || {};
    const textoPie = (pie.texto || '').toLowerCase();
    const esAdaptacionValida = pie.es_adaptacion === true && textoPie.includes('adaptaci');
    const esGuiaOficialValida = (textoPie.includes('guía') || textoPie.includes('guia')) && (textoPie.includes('matemática') || textoPie.includes('matematica'));
    if (!esAdaptacionValida && !esGuiaOficialValida) {
      errores.push('Para Matemática en multigrado, la fuente debe citar la "Guía Didáctica de Matemática Multigrado (MINERD / UNICEF, 2023)" o marcarse como "adaptación a partir de las guías por grado de Matemática CON BASE".');
    }
  }

  // Validación ortográfica de palabras requeridas con tilde (Regla 5)
  const textoSerializado = JSON.stringify(respuesta);
  for (const item of PALABRAS_CON_TILDE) {
    const match = textoSerializado.match(item.regex);
    if (match) {
      errores.push(`Se detectó ortografía sin tilde en el término "${match[0]}": debe escribirse con tilde (${item.con}).`);
    }
  }

  if (errores.length > 0) {
    return {
      valido: false,
      motivo: 'validacion_fallida',
      mensajeDocente: 'Estimado maestro/a: No fue posible completar todos los apartados requeridos de la secuencia didáctica. Por favor verifica los datos ingresados o intenta generar nuevamente la actividad.',
      errores
    };
  }

  return {
    valido: true,
    motivo: null,
    mensajeDocente: null,
    errores: []
  };
}

async function ejecutarConReintento(generarFn, { gradosPerfil = [], area = 'Lengua Española' } = {}) {
  let intento1 = null;
  try {
    intento1 = await generarFn({ reintento: false });
  } catch (err) {
    console.warn('Error en intento 1:', err);
  }

  const resVal1 = validarRespuestaConBaseMultigrado({
    respuesta: intento1,
    gradosPerfil,
    area
  });

  if (resVal1.valido) {
    return { exitoso: true, datos: intento1, reintentado: false };
  }

  if (resVal1.motivo === 'alcance_primer_ciclo') {
    return {
      exitoso: false,
      datos: null,
      mensajeDocente: resVal1.mensajeDocente,
      errores: resVal1.errores,
      reintentado: false
    };
  }

  console.log('Validación falló en intento 1. Ejecutando reintento único...', resVal1.errores);
  let intento2 = null;
  try {
    intento2 = await generarFn({ reintento: true, erroresPrevios: resVal1.errores });
  } catch (err) {
    console.warn('Error en intento 2 (reintento):', err);
  }

  const resVal2 = validarRespuestaConBaseMultigrado({
    respuesta: intento2,
    gradosPerfil,
    area
  });

  if (resVal2.valido) {
    return { exitoso: true, datos: intento2, reintentado: true };
  }

  return {
    exitoso: false,
    datos: null,
    mensajeDocente: resVal2.mensajeDocente || 'Estimado maestro/a: No fue posible completar todos los apartados requeridos de la secuencia didáctica. Por favor verifica los datos ingresados o intenta generar nuevamente la actividad.',
    errores: resVal2.errores,
    reintentado: true
  };
}

module.exports = {
  validarRespuestaConBaseMultigrado,
  ejecutarConReintento,
  normalizarGrado,
  AGRUPAMIENTOS_VALIDOS,
  GRADOS_PRIMER_CICLO_VALIDOS,
  APARTADOS_REQUERIDOS,
  PALABRAS_CON_TILDE,
  ESQUEMA_CON_BASE
};
