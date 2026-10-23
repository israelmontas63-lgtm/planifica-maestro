// Decide si un texto es una consulta de matemática pura. NO debe quitarle consultas al currículo ni a la planificación.
const PALABRAS = /(?:cu[aá]nto\s+es|\bcalcula\b|\bresuelve\b|\boperaci[oó]n\b|\bsuma\b|\bresta\b|\bmultiplica\b|\bdivide\b|\bporcentaje\b|\bfracci[oó]n\b|\bfracciones\b|\bdecimal\b|\bdecimales\b|\bra[ií]z\s+cuadrada\b|\bpotencia\b|\belevado\s+a\b|\bcon\s+residuo\b|\balgoritmo\b)/i;
const SIGNOS = /^\s*[-+−]?\d[\d.,]*\s*[-+*×÷\/xX:·−–]\s*[-+−]?\d[\d.,]*\s*=?\s*\??\s*$/;
const FRACCIONES = /^\s*\d+\/\d+\s*[-+*×÷\/xX−–]\s*\d+\/\d+\s*=?\s*\??\s*$/;
const PREGUNTA = /(?:cu[aá]nto\s+es|calcula|resultado\s+de)\s+[-+−]?\d/i;
const TEXTO = /cu[aá]nto\s+es\s+(?:un\s+medio|un\s+cuarto|tres\s+cuartos|la\s+mitad|el\s+doble|el\s+triple)\s+(?:m[aá]s|menos|por|entre)\s+/i;
const AFIRMACION = /\d\s*[-+*×÷\/xX:·−–]\s*\d[\d.,]*\s*=\s*\d/;
const DIVISION = /\d[\d.,]*\s*(?:dividido\s+(?:entre|por)\s*(?:cero|\d)|entre\s+cero)/i;
const OPERADOR_PALABRA = /\d[\d.,]*\s+(?:m[aá]s|menos|por|multiplicado\s+por|dividido\s+(?:entre|por))\s+\d/i;
const RAIZ = /\bra[ií]z\s+cuadrada\s+de\s+\d/i;
const DOS_NUMEROS = /\d[\d.,]*\D+\d[\d.,]*/;
const SIN_ORDINALES = /\d+\s*\.?\s*[º°]|\b\d+(?:ro|do|er|to|vo|mo|no)\b/gi;
const EXCLUSION = /\b(?:planifica|planificar|planificaci[oó]n|plan|unidad|clase|secuencia|eval[uú]a|evaluar|r[uú]brica|curr[ií]culo|competencia|competencias|indicador|indicadores|contenido|contenidos|malla|tema|temas)\b/i;

export function esConsultaMatematicaPura(texto) {
  const t = String(texto ?? '');
  if (EXCLUSION.test(t)) return false;
  if (SIGNOS.test(t) || FRACCIONES.test(t) || PREGUNTA.test(t) || TEXTO.test(t) || AFIRMACION.test(t) || DIVISION.test(t) || OPERADOR_PALABRA.test(t)) return true;
  if (!PALABRAS.test(t)) return false;
  const sinOrd = t.replace(SIN_ORDINALES, ' ');
  return RAIZ.test(sinOrd) || DOS_NUMEROS.test(sinOrd);
}
