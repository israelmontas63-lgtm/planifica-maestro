/**
 * shared/politicaDignidadImagen.js
 * 
 * POLÍTICA DE DIGNIDAD PARA EDICIÓN DE IMÁGENES - PLANIFICA MAESTRO
 * Protege la dignidad, integridad y privacidad de estudiantes y docentes dominicanos.
 * Cumple con directrices éticas MINERD y normativas de protección de menores (CONANI).
 */

export const VEREDICTOS_POLITICA = {
  PERMITIDO: "PERMITIDO",
  CONFIRMAR: "CONFIRMAR",
  BLOQUEADO: "BLOQUEADO"
};

// ── LÍNEA DE PROTECCIÓN INFANTIL RD ──
export const MENSAJE_CONANI_PROTECCION = 
  "Si sospechas o identificas una situación en la que un niño, niña o adolescente está en riesgo o es víctima de maltrato, por favor acude a las autoridades de protección de la niñez de la República Dominicana: CONANI (Consejo Nacional para la Niñez y la Adolescencia) o comunícate a Línea Vida (809-200-1202 / 911).";

// Patrones dominicanos y universales de riesgo infantil severo
const PATRONES_MENOR_EN_RIESGO = [
  /golpe(?:ado|ada|ar|es)?/i,
  /moret[oó]n(?:es)?/i,
  /sangr(?:ando|e)/i,
  /maltrat(?:o|ado|ada|ador)/i,
  /abuso/i,
  /llorando (?:de dolor|abandonado|sola?)/i,
  /abandonad[oa]/i,
  /agresi[oó]n/i,
  /quemadur(?:a|as)/i,
  /desnutri(?:do|da|ci[oó]n)/i,
  /castigo f[ií]sico/i
];

// Patrones sexuales, desnudez o morbo
const PATRONES_SEXUAL_MORBO = [
  /desnud(?:o|a|ar|ez|itos?)/i,
  /sin (?:camisa|ropa|polo|pantal[oó]n|vestido|prenda|falda)/i,
  /qu[ií]t(?:ar|ale|arle|ame) (?:la |el )?(?:ropa|camisa|blusa|falda|pantal[oó]n)/i,
  /hacer(?:la|lo)? revelador/i,
  /en pantis?/i,
  /en (?:calzoncillos?|traje de ba[ñn]o)/i,
  /sexy/i,
  /morbos[oa]/i,
  /provocativ[oa]/i,
  /er[oó]tic[oa]/i,
  /tocar/i,
  /partes [ií]ntimas/i
];

// Patrones de alteración corporal / burla física
const PATRONES_ALTERACION_CORPORAL = [
  /(?:hacer|h[aá]z|poner|pon)(?:lo|la)? (?:ver )?(?:m[aá]s )?(?:gord[oa]|flac[oa]|obeso|anorexic[oa]|esquel[eé]tic[oa]|fe[oa]|deforme)/i,
  /para re[ií]rnos de (?:su cuerpo|[eé]l|ella)/i,
  /deformar (?:el |su )?cuerpo/i,
  /cambiar(?:le)? (?:la forma del )?cuerpo/i,
  /panza gigante/i,
  /hacer(?:lo|la)? fe[oa]/i,
  /engordar/i,
  /adelgazar/i
];

// Patrones de bullying, burla, apodos humillantes, memes degradantes
const PATRONES_BURLA_BULLYING = [
  /meme (?:de este|para burlar|chistoso de este|para re[ií]rnos de este|pesado)/i,
  /(?:hacer|h[aá]z)(?:le)? un meme (?:al|a la|a este|a esta|del)/i,
  /apodo feo/i,
  /burlar(?:se|nos|me)/i,
  /ridiculizar/i,
  /humillar/i,
  /chopo/i,
  /p[aá]jaro/i,
  /cara de (?:mono|payaso rid[ií]culo|burro|est[uú]pido|loco)/i,
  /deformar (?:su )?rostro para (?:burlar|re[ií]r|hacer chiste)/i,
  /(?:hacer|h[aá]z)(?:lo|la) pasar (?:por delincuente|verg[uü]enza)/i
];

// Patrones de peligro, daño o violencia
const PATRONES_PELIGRO_VIOLENCIA = [
  /situaci[oó]n peligrosa/i,
  /en el vac[ií]o/i,
  /en un precipicio/i,
  /fuego/i,
  /arma(?:s)?/i,
  /pistola/i,
  /cuchillo/i,
  /ahog[aá](?:ndose|ndo|r)?/i,
  /atropellado/i,
  /amarrado/i,
  /secuestrado/i
];

// Patrones de montajes difamatorios o suplantación
const PATRONES_DIFAMACION_SUPLANTACION = [
  /hacer(?: que)? (?:parezca|parecer) que (?:dijo|hizo|rob[oó]|golpe[oó]|minti[oó])/i,
  /montaje realista para acusar/i,
  /(?:hacer|h[aá]z)(?:lo|la) pasar por delincuente/i
];

// Patrones de identificación biométrica o reconocimiento facial
const PATRONES_IDENTIFICACION_FACIAL = [
  /qui[eé]n es (?:este ni[ñn]o|esta ni[ñn]a|esta persona|este alumno)/i,
  /identificar (?:por su cara|el rostro|a la persona|a cada persona)/i,
  /dime el nombre de (?:esta cara|este rostro)/i,
  /reconocimiento facial/i
];

// Símbolos de odio
const PATRONES_SIMBOLOS_ODIO = [
  /esv[aá]stica/i,
  /nazi/i,
  /ku klux klan/i,
  /supremacista/i
];

// Patrones de confirmación (uso pedagógico, teatral, histórico con alteración de rostro)
const PATRONES_CONFIRMAR = [
  /(?:c[aá]mbia|cambiar)(?:le)? (?:la |el )?(?:cara|rostro)/i,
  /p[ií]ntar?(?:le)? (?:otro |el )?rostro/i,
  /modificar rostro/i,
  /sustituir cara/i,
  /(?:poner|pon)(?:le)? (?:la )?cara de /i,
  /cambiar cara por personaje/i,
  /bigote para dramatizaci[oó]n/i,
  /careta de (?:carnaval|lech[oó]n|diablo cojuelo)/i,
  /para (?:una obra|el teatro escolar|dramatizaci[oó]n|la comparsa)/i
];

// Patrones seguros explícitos (protección de identidad con stickers o emojis, festejos escolares, patrios)
const PATRONES_PERMITIDO_SEGURO = [
  /emoji en la cara (?:para que no se vea|para proteger)/i,
  /tapar (?:la )?cara (?:con|para proteger)/i,
  /proteger (?:la )?identidad/i,
  /sombrero de cumplea[ñn]os/i,
  /banda patria/i,
  /bandera/i,
  /escudo/i,
  /birrete/i,
  /graduaci[oó]n/i,
  /cambia(?:r)? el color del polo/i,
  /color de(?:l)? polo/i,
  /uniforme/i,
  /s[uú]bele la luz/i,
  /mejorar (?:la )?luz/i,
  /aclarar/i,
  /recortar/i,
  /quitar fondo/i,
  /marco escolar/i,
  /acto escolar/i
];

/**
 * Evalúa si una solicitud de edición o interacción con imagen respeta la dignidad.
 * @param {Object} params
 * @param {string} params.instruccion - Texto de lo que el docente solicita.
 * @param {string} [params.textoContexto] - Contexto pedagógico adicional.
 * @returns {Object} Veredicto y metadatos pedagógicos.
 */
export function evaluarPoliticaDignidad(peticion = {}) {
  const { instruccion = "", texto: textoParam = "", textoContexto = "", operacionId = "" } = peticion;
  const textoAEvaluar = `${instruccion} ${textoParam} ${textoContexto} ${operacionId}`.trim();

  if (!textoAEvaluar) {
    return {
      veredicto: VEREDICTOS_POLITICA.PERMITIDO,
      motivo: "Sin instrucción de edición específica.",
      requiereConfirmacion: false,
      esBloqueado: false,
      esPermitido: true,
      casoEspecialMenorEnRiesgo: false,
      sugerenciaAlternativa: null
    };
  }

  const texto = textoAEvaluar;

  // 1. CASO ESPECIAL: Menor en riesgo o vulnerabilidad
  for (const rx of PATRONES_MENOR_EN_RIESGO) {
    if (rx.test(texto)) {
      return {
        veredicto: VEREDICTOS_POLITICA.BLOQUEADO,
        motivo: "Se detectó posible situación de vulnerabilidad o riesgo para un menor de edad.",
        mensajeRespetuoso: MENSAJE_CONANI_PROTECCION,
        requiereConfirmacion: false,
        esBloqueado: true,
        esPermitido: false,
        casoEspecialMenorEnRiesgo: true,
        sugerenciaAlternativa: null
      };
    }
  }

  // 2. BLOQUEOS DIRECTOS: Sexual, desnudez, morbo
  for (const rx of PATRONES_SEXUAL_MORBO) {
    if (rx.test(texto)) {
      return {
        veredicto: VEREDICTOS_POLITICA.BLOQUEADO,
        motivo: "No está permitido editar prendas para exponer el cuerpo o crear contenido sugestivo.",
        mensajeRespetuoso: "Por respeto y salvaguarda de la comunidad escolar, no realizamos ediciones de prendas que expongan el cuerpo. Con gusto puedo ayudarte a mejorar la iluminación, ajustar el fondo o añadir un marco escolar.",
        requiereConfirmacion: false,
        esBloqueado: true,
        esPermitido: false,
        casoEspecialMenorEnRiesgo: false,
        sugerenciaAlternativa: "Mejorar la nitidez, recortar el encuadre o agregar un marco temático."
      };
    }
  }

  // 3. BLOQUEOS DIRECTOS: Alteración corporal denigrante
  for (const rx of PATRONES_ALTERACION_CORPORAL) {
    if (rx.test(texto)) {
      return {
        veredicto: VEREDICTOS_POLITICA.BLOQUEADO,
        motivo: "No está permitido modificar la complexión, peso o forma física de las personas.",
        mensajeRespetuoso: "Promovemos el respeto y la autoestima de cada estudiante, por lo que no modificamos la contextura física ni los rasgos corporales. Podemos optimizar los colores o recortar la foto para la actividad.",
        requiereConfirmacion: false,
        esBloqueado: true,
        esPermitido: false,
        casoEspecialMenorEnRiesgo: false,
        sugerenciaAlternativa: "Ajustar el contraste, agregar adornos patrios o crear un collage."
      };
    }
  }

  // 4. BLOQUEOS DIRECTOS: Bullying, burlas, apodos denigrantes, memes humillantes
  for (const rx of PATRONES_BURLA_BULLYING) {
    if (rx.test(texto)) {
      return {
        veredicto: VEREDICTOS_POLITICA.BLOQUEADO,
        motivo: "No está permitido crear contenido humorístico o satírico a expensas de la dignidad de las personas.",
        mensajeRespetuoso: "Cuidamos el clima escolar evitando montajes o expresiones que puedan prestarse a burla o incomodidad. Si lo deseas, puedo generar una lámina ilustrativa o un diploma de reconocimiento para el grupo.",
        requiereConfirmacion: false,
        esBloqueado: true,
        esPermitido: false,
        casoEspecialMenorEnRiesgo: false,
        sugerenciaAlternativa: "Diseñar un diploma de logro, lámina coloreable o marco festivo."
      };
    }
  }

  // 5. BLOQUEOS DIRECTOS: Peligro, daño o violencia
  for (const rx of PATRONES_PELIGRO_VIOLENCIA) {
    if (rx.test(texto)) {
      return {
        veredicto: VEREDICTOS_POLITICA.BLOQUEADO,
        motivo: "No se permiten montajes que simulen peligro, violencia o accidentes con personas reales.",
        mensajeRespetuoso: "Por seguridad de nuestros estudiantes, no representamos situaciones de peligro o violencia con personas reales. Podemos situar la foto en un entorno educativo o cultural positivo.",
        requiereConfirmacion: false,
        esBloqueado: true,
        esPermitido: false,
        casoEspecialMenorEnRiesgo: false,
        sugerenciaAlternativa: "Situar la foto en un aula, museo o parque dominicano."
      };
    }
  }

  // 6. BLOQUEOS DIRECTOS: Difamación y montajes engañosos
  for (const rx of PATRONES_DIFAMACION_SUPLANTACION) {
    if (rx.test(texto)) {
      return {
        veredicto: VEREDICTOS_POLITICA.BLOQUEADO,
        motivo: "No se permiten montajes engañosos que atribuyan actos o declaraciones falsas a personas reales.",
        mensajeRespetuoso: "Mantenemos la integridad de las imágenes escolares evitando montajes que simulen hechos no ocurridos.",
        requiereConfirmacion: false,
        esBloqueado: true,
        esPermitido: false,
        casoEspecialMenorEnRiesgo: false,
        sugerenciaAlternativa: null
      };
    }
  }

  // 7. BLOQUEOS DIRECTOS: Identificación biométrica o reconocimiento facial
  for (const rx of PATRONES_IDENTIFICACION_FACIAL) {
    if (rx.test(texto)) {
      return {
        veredicto: VEREDICTOS_POLITICA.BLOQUEADO,
        motivo: "Privacidad: no realizamos reconocimiento facial ni identificación de personas por su rostro.",
        mensajeRespetuoso: "Por protección de datos personales de menores y docentes, no identifico a personas por su rostro. Puedo describir los elementos visibles del aula, uniformes o materiales presentes.",
        requiereConfirmacion: false,
        esBloqueado: true,
        esPermitido: false,
        casoEspecialMenorEnRiesgo: false,
        sugerenciaAlternativa: "Describir el contexto del aula, uniformes o recursos pedagógicos en la imagen."
      };
    }
  }

  // 8. BLOQUEOS DIRECTOS: Símbolos de odio
  for (const rx of PATRONES_SIMBOLOS_ODIO) {
    if (rx.test(texto)) {
      return {
        veredicto: VEREDICTOS_POLITICA.BLOQUEADO,
        motivo: "No se permite la inclusión de símbolos de odio o discriminación.",
        mensajeRespetuoso: "Esta plataforma está dedicada a la educación y no genera símbolos de discriminación.",
        requiereConfirmacion: false,
        esBloqueado: true,
        esPermitido: false,
        casoEspecialMenorEnRiesgo: false,
        sugerenciaAlternativa: null
      };
    }
  }

  // 9. CASOS PROTEGIDOS EXPLÍCITOS (Tapar cara para privacidad, fechas patrias, uniformes, etc.)
  for (const rx of PATRONES_PERMITIDO_SEGURO) {
    if (rx.test(texto)) {
      return {
        veredicto: VEREDICTOS_POLITICA.PERMITIDO,
        motivo: "Edición escolar positiva o de protección de privacidad.",
        mensajeRespetuoso: null,
        requiereConfirmacion: false,
        esBloqueado: false,
        esPermitido: true,
        casoEspecialMenorEnRiesgo: false,
        sugerenciaAlternativa: null
      };
    }
  }

  // 10. CONFIRMAR: Alteración de rostro para dramatizaciones, historia o teatro
  for (const rx of PATRONES_CONFIRMAR) {
    if (rx.test(texto)) {
      return {
        veredicto: VEREDICTOS_POLITICA.CONFIRMAR,
        motivo: "Modificación de rasgos faciales con posible fin didáctico, teatral o histórico.",
        mensajeRespetuoso: "Esta edición alterará rasgos faciales. Si es para una dramatización escolar, proyecto de historia o actividad artística, confirma que es la intención deseada para continuar.",
        requiereConfirmacion: true,
        esBloqueado: false,
        esPermitido: false,
        casoEspecialMenorEnRiesgo: false,
        sugerenciaAlternativa: "¿Deseas aplicar una máscara artística o marco temático en su lugar?"
      };
    }
  }

  // 11. AMBIGUOS: Instrucciones demasiado vagas o no específicas
  if (/^(?:hazle algo|c[aá]mbialo todo|ponle algo raro|arr[eé]glala)$/i.test(texto.trim())) {
    return {
      veredicto: VEREDICTOS_POLITICA.CONFIRMAR,
      motivo: "Instrucción ambigua que requiere aclaración del objetivo pedagógico.",
      mensajeRespetuoso: "¿Qué cambio pedagógico deseas realizar en la imagen? Por ejemplo: mejorar la luz, colocar un marco escolar o tapar rostros para privacidad.",
      requiereConfirmacion: true,
      esBloqueado: false,
      esPermitido: false,
      casoEspecialMenorEnRiesgo: false,
      sugerenciaAlternativa: "Indica si deseas: (1) Mejorar luz y nitidez, (2) Marco temático, o (3) Sticker protector."
    };
  }

  // Por defecto: Edición permitida
  return {
    veredicto: VEREDICTOS_POLITICA.PERMITIDO,
    motivo: "Solicitud compatible con los principios de dignidad y respeto pedagógico.",
    mensajeRespetuoso: null,
    requiereConfirmacion: false,
    esBloqueado: false,
    esPermitido: true,
    casoEspecialMenorEnRiesgo: false,
    sugerenciaAlternativa: null
  };
}
