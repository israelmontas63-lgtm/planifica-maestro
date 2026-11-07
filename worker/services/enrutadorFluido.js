/**
 * worker/services/enrutadorFluido.js
 * Enrutador de Fluidez y Doble Modo Operativo (Libre Albedrío vs Modo Producción)
 * Estándar de Ejecución: Planifica Maestro (Cloudflare Workers / Node.js)
 */

export const DOCENTE_PRODUCCION = {
  nombre: 'Israel Montás',
  escuela: 'Escuela Primaria Batey Pinos',
  modalidad: 'Primaria Multigrado (1.º y 2.º Grado)',
  duracion: '45 minutos',
  areasPrioritarias: ['Lengua Española', 'Matemática']
};

export const EJEMPLOS_VEROSIMILES_RD = [
  {
    nombre: 'Lic. Carmen Rodríguez',
    escuela: 'Escuela Primaria Las Caobas, Distrito 10-01',
    modalidad: 'Primaria (3.º Grado)',
    tema: 'La noticia y la estructura de los hechos'
  },
  {
    nombre: 'Prof. Ramón Almonte',
    escuela: 'Centro Educativo Salomé Ureña, Distrito 08-03',
    modalidad: 'Primaria (4.º Grado)',
    tema: 'Fracciones y partes de la unidad en la vida cotidiana'
  },
  {
    nombre: 'Lic. María Mercedes Peña',
    escuela: 'Escuela Básica República de Colombia, Distrito 15-02',
    modalidad: 'Primaria (2.º Grado)',
    tema: 'La fábula y la comprensión de moralejas'
  },
  {
    nombre: 'Prof. Juan Carlos Bautista',
    escuela: 'Escuela Primaria Anacaona, San Juan de la Maguana',
    modalidad: 'Primaria Multigrado (3.º y 4.º)',
    tema: 'Ecosistemas locales y conservación de fuentes de agua'
  }
];

/**
 * Determina el contexto operativo discriminando entre modo demostrativo y producción
 */
export function determinarContextoOperativo(prompt = '', opciones = {}) {
  const p = String(prompt || '').toLowerCase();

  // Detección de intención demostrativa / libre albedrío
  const esEjemplo = Boolean(
    opciones.modo === 'demostrativo' ||
    opciones.modo === 'ejemplo' ||
    /\b(ejemplo|mu[eé]strame|muestra|prueba|ensayo|demostraci[oó]n|demostrativ[oa]|libre)\b/i.test(p) ||
    /modo\s+(?:demostrativo|prueba|libre)/i.test(p) ||
    /otra escuela|otro centro|secundaria|profesor(a)?\s+(?!israel)|liceo/i.test(p)
  );

  if (esEjemplo) {
    const hash = Math.abs(p.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
    const item = EJEMPLOS_VEROSIMILES_RD[hash % EJEMPLOS_VEROSIMILES_RD.length];

    return {
      modo: 'demostrativo',
      esEjemplo: true,
      docente: opciones.docente || item.nombre,
      escuela: opciones.escuela || item.escuela,
      modalidad: opciones.modalidad || item.modalidad,
      duracion: opciones.duracion || '45 minutos',
      tema: opciones.tema || item.tema,
      enfoque: 'Libre albedrío pedagógico verosímil de República Dominicana'
    };
  }

  // Modo Producción Canónico
  return {
    modo: 'produccion',
    esEjemplo: false,
    docente: DOCENTE_PRODUCCION.nombre,
    escuela: DOCENTE_PRODUCCION.escuela,
    modalidad: DOCENTE_PRODUCCION.modalidad,
    duracion: opciones.duracion || DOCENTE_PRODUCCION.duracion,
    areasPrioritarias: DOCENTE_PRODUCCION.areasPrioritarias,
    enfoque: 'Parámetros canónicos de aula Batey Pinos'
  };
}

export class EnrutadorFluido {
  determinarContextoOperativo(prompt, opciones) {
    return determinarContextoOperativo(prompt, opciones);
  }

  formatearMemoriaContexto(contexto) {
    if (contexto.modo === 'demostrativo') {
      return `### CONTEXTO DOCENTE (MODO DEMOSTRATIVO):
- [perfil] nombre_docente: ${contexto.docente}
- [aula] centro_educativo: ${contexto.escuela}
- [aula] modalidad: ${contexto.modalidad}
- [regla_planificacion] tiempo_bloque: ${contexto.duracion}
- [regla_planificacion] enfoque_oficial: Adecuación Curricular MINERD y CON BASE\n`;
    }

    return `### MEMORIA PERMANENTE DEL DOCENTE:
- [perfil] nombre_docente: ${contexto.docente}
- [aula] centro_educativo: ${contexto.escuela}
- [aula] modalidad: ${contexto.modalidad}
- [regla_planificacion] tiempo_bloque: ${contexto.duracion}
- [regla_planificacion] enfoque_oficial: Adecuación Curricular MINERD y CON BASE\n`;
  }
}
