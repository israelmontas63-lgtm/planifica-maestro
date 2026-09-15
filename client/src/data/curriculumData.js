/**
 * Base curricular oficial de la República Dominicana (MINERD)
 * Estructura de Competencias Específicas, Contenidos e Indicadores de Logro
 * por Nivel, Grado y Área.
 */

export const CURRICULUM_MINERD = {
  inicial: {
    nombre: "Nivel Inicial",
    descripcion: "Educación Inicial orientada al desarrollo integral lúdico y socioafectivo (0 a 6 años).",
    grados: [
      { id: "prekinder", nombre: "Pre-Kínder (3 años)" },
      { id: "kinder", nombre: "Kínder (4 años)" },
      { id: "preprimario", nombre: "Pre-Primario (5 años)" }
    ],
    areas: [
      {
        id: "comunicacion",
        nombre: "Comunicación y Lenguajes",
        competencias: [
          "Expresa ideas, emociones y vivencias utilizando el lenguaje oral y diversas formas de expresión artística y corporal.",
          "Comprende mensajes orales sencillos en situaciones cotidianas, respondiendo de forma coherente.",
          "Se inicia en la apropiación del lenguaje escrito a través de la lectura compartida de cuentos e imágenes."
        ],
        contenidos: {
          conceptuales: [
            "Textos orales: canciones, adivinanzas, rimas y cuentos cortos.",
            "Vocabulario básico sobre sí mismo, la familia, la escuela y la comunidad.",
            "Formas de expresión plástica: colores primarios, modelado y trazos libres."
          ],
          procedimentales: [
            "Escucha atenta y formulación de preguntas sobre relatos escuchados.",
            "Descripción oral de láminas, personajes y situaciones del entorno.",
            "Ejercicios de grafomotricidad, garabateo controlado y dibujo libre."
          ],
          actitudinales: [
            "Disfrute por la lectura de cuentos y la escucha de poesías.",
            "Respeto por el turno de palabra al comunicarse con sus compañeros.",
            "Interés por explorar diferentes materiales de expresión artística."
          ]
        },
        indicadores: [
          "Participa en diálogos espontáneos expresando sus necesidades y gustos.",
          "Identifica personajes principales y el orden de los sucesos en un cuento.",
          "Realiza trazos con intencionalidad comunicativa y agarre adecuado del lápiz."
        ]
      },
      {
        id: "logico_matematica",
        nombre: "Relaciones Lógico-Matemáticas",
        competencias: [
          "Establece relaciones espaciales, temporales y de cantidad a partir de la manipulación de objetos concretos.",
          "Clasifica y sería objetos según atributos físicos (forma, color, tamaño).",
          "Reconoce el conteo oral y la correspondencia uno a uno en situaciones lúdicas."
        ],
        contenidos: {
          conceptuales: [
            "Nociones espaciales: arriba/abajo, dentro/fuera, cerca/lejos.",
            "Cuantificadores: muchos/pocos, todos/ninguno, más que/menos que.",
            "Números naturales del 1 al 10 en contextos significativos."
          ],
          procedimentales: [
            "Agrupación y clasificación de bloques lógicos por color y tamaño.",
            "Conteo uno a uno utilizando tapitas, botones y juguetes.",
            "Construcción de patrones y secuencias sencillas de dos elementos."
          ],
          actitudinales: [
            "Curiosidad por explorar las formas geométricas en el aula.",
            "Seguridad y perseverancia al resolver desafíos matemáticos cotidianos."
          ]
        },
        indicadores: [
          "Ubica objetos en el espacio siguiendo consignas directas.",
          "Cuenta colecciones de hasta 10 elementos diciendo el cardinal correcto.",
          "Continúa patrones rítmicos y visuales con materiales manipulativos."
        ]
      },
      {
        id: "entorno_natural",
        nombre: "Entorno Natural y Social",
        competencias: [
          "Muestra curiosidad y cuidado por los seres vivos y elementos de la naturaleza.",
          "Reconoce los miembros de su familia y los roles de las personas en su comunidad escolar.",
          "Practica hábitos saludables de higiene y autocuidado personal."
        ],
        contenidos: {
          conceptuales: [
            "Seres vivos: plantas, animales de la comunidad y sus características.",
            "El cuerpo humano y sus partes principales.",
            "Símbolos patrios básicos: la bandera y el himno nacional."
          ],
          procedimentales: [
            "Observación directa y experimentación sensorial con agua, tierra y plantas.",
            "Práctica diaria de lavado de manos, cepillado y orden de útiles."
          ],
          actitudinales: [
            "Respeto y empatía hacia los animales y las plantas.",
            "Valoración y orgullo por su identidad dominicana."
          ]
        },
        indicadores: [
          "Nombra y cuida las partes de su cuerpo y sus pertenencias.",
          "Distingue entre plantas y animales explicando qué necesitan para vivir.",
          "Identifica los colores y escudo de la bandera dominicana."
        ]
      }
    ]
  },

  primario: {
    nombre: "Nivel Primario",
    descripcion: "Educación Primaria organizada en Primer Ciclo (1ro a 3ro) y Segundo Ciclo (4to a 6to).",
    grados: [
      { id: "1primaria", nombre: "1ro de Primaria" },
      { id: "2primaria", nombre: "2do de Primaria" },
      { id: "3primaria", nombre: "3ro de Primaria" },
      { id: "4primaria", nombre: "4to de Primaria" },
      { id: "5primaria", nombre: "5to de Primaria" },
      { id: "6primaria", nombre: "6to de Primaria" }
    ],
    areas: [
      {
        id: "lengua_espanola",
        nombre: "Lengua Española",
        competencias: [
          "Comprensión oral: Comprende textos funcionales y literarios según su grado e interés.",
          "Producción oral: Produce textos orales con coherencia, claridad y vocabulario apropiado.",
          "Comprensión escrita: Lee y comprende el sentido global de textos escritos de uso social.",
          "Producción escrita: Escribe textos funcionales y creativos respetando convenciones gramaticales y ortográficas básicas."
        ],
        contenidos: {
          conceptuales: [
            "Tipologías textuales: el letrero, la lista, la receta, el cuento, la noticia, la carta y el informe de lectura.",
            "Estructura del texto: inicio, desarrollo y conclusión.",
            "Morfosintaxis: sustantivos, adjetivos, verbos, pronombres y conectores de orden.",
            "Ortografía: uso de mayúsculas, signos de puntuación (. , ¿?), acentuación."
          ],
          procedimentales: [
            "Anticipación del contenido del texto a partir del título y paratextos.",
            "Planificación, redacción de borradores y revisión de textos escritos.",
            "Inferencia de significados de palabras desconocidas a partir del contexto."
          ],
          actitudinales: [
            "Interés por leer para informarse y entretenerse.",
            "Valoración de la escritura como medio para comunicar vivencias y sentimientos.",
            "Sensibilidad ante temas sociales y valores promovidos en la literatura."
          ]
        },
        indicadores: [
          "Responde preguntas literales e inferenciales sobre textos leídos.",
          "Redacta oraciones y párrafos con sentido completo y concordancia de género y número.",
          "Reconoce la estructura canónica del texto asignado según el grado escolar."
        ]
      },
      {
        id: "matematica",
        nombre: "Matemática",
        competencias: [
          "Razona y argumenta: Desarrolla y evalúa inferencias y argumentos matemáticos sobre números, patrones y figuras.",
          "Comunica: Expresa ideas matemáticas utilizando lenguaje simbólico, numérico, gráfico y formal.",
          "Modela y representa: Traduce situaciones del contexto real a esquemas y modelos matemáticos.",
          "Resuelve problemas: Formula y resuelve problemas de la vida cotidiana empleando diversas estrategias."
        ],
        contenidos: {
          conceptuales: [
            "Numeración: números naturales, valor de posición, fracciones y decimales.",
            "Operaciones básicas: adición, sustracción, multiplicación y división con algoritmos estándar.",
            "Geometría: figuras planas (polígonos, círculos), cuerpos geométricos, perímetros y áreas.",
            "Medición: longitud, masa, capacidad, tiempo y dinero (el peso dominicano).",
            "Estadística y probabilidad: tablas de frecuencias, gráficos de barras y pictogramas."
          ],
          procedimentales: [
            "Resolución de problemas contextualizados que involucren operaciones combinadas.",
            "Cálculo mental y estimación razonable de resultados numéricos.",
            "Construcción y medición de figuras geométricas utilizando instrumentos adecuados."
          ],
          actitudinales: [
            "Perseverancia y rigor en la búsqueda de soluciones a problemas matemáticos.",
            "Confianza en la propia capacidad para aprender y aplicar conceptos matemáticos."
          ]
        },
        indicadores: [
          "Identifica el valor posicional de los dígitos en números de hasta seis cifras.",
          "Resuelve problemas aditivos y multiplicativos justificando la operación seleccionada.",
          "Calcula perímetros y áreas de polígonos regulares e irregulares de forma correcta."
        ]
      },
      {
        id: "ciencias_sociales",
        nombre: "Ciencias Sociales",
        competencias: [
          "Ubicación en el tiempo y el espacio: Analiza la relación entre sociedad, territorio y procesos históricos.",
          "Pensamiento crítico-social: Examina críticamente hechos históricos y dinámicas sociales de la República Dominicana.",
          "Ciudadanía democrática y convivencia: Promueve valores de paz, identidad nacional, deberes y derechos humanos."
        ],
        contenidos: {
          conceptuales: [
            "Geografía dominicana y caribeña: relieve, clima, hidrografía y división territorial.",
            "Historia nacional: pueblos originarios (Taínos), período colonial, Independencia (1844), Restauración (1865).",
            "Constitución dominicana, poderes del Estado y participación ciudadana."
          ],
          procedimentales: [
            "Lectura e interpretación de mapas, planos y líneas de tiempo históricas.",
            "Indagación en fuentes primarias y secundarias sobre próceres y heroínas patrias."
          ],
          actitudinales: [
            "Amor y respeto por la patria, sus próceres y símbolos nacionales.",
            "Compromiso con el cuidado del patrimonio natural, cultural e histórico dominicano."
          ]
        },
        indicadores: [
          "Ubica en el mapa de la isla de Santo Domingo provincias, cordilleras y ríos principales.",
          "Explica las causas y consecuencias de la gesta independentista del 27 de febrero de 1844.",
          "Identifica sus derechos y deberes fundamentales como niño y ciudadano dominicano."
        ]
      },
      {
        id: "ciencias_naturaleza",
        nombre: "Ciencias de la Naturaleza",
        competencias: [
          "Ofrece explicaciones científicas: Explica fenómenos naturales a partir de conceptos, principios y teorías científicas.",
          "Aplica procedimientos científicos: Diseña y realiza investigaciones sencillas mediante el método científico.",
          "Asume actitud crítica y preventiva: Promueve la salud, la sostenibilidad ambiental y el uso responsable de la tecnología."
        ],
        contenidos: {
          conceptuales: [
            "Sistemas del cuerpo humano: digestivo, respiratorio, circulatorio y locomotor.",
            "Ecosistemas, cadenas alimenticias, biodiversidad y recursos naturales de la República Dominicana.",
            "Materia y energía: estados de la materia, fuentes de energía renovables y no renovables.",
            "Fenómenos atmosféricos y prevención de desastres naturales (huracanes, sismos)."
          ],
          procedimentales: [
            "Diseño de experimentos sencillos con variables controladas y registro de datos.",
            "Elaboración de modelos representativos de células, órganos o ciclos naturales."
          ],
          actitudinales: [
            "Adopción de medidas de higiene y alimentación balanceada para prevenir enfermedades.",
            "Conciencia ecológica frente al cambio climático y la contaminación por plásticos."
          ]
        },
        indicadores: [
          "Describe la función de los órganos principales de los sistemas del cuerpo humano.",
          "Clasifica los recursos naturales dominicanos en renovables y no renovables.",
          "Formula hipótesis y conclusiones fundamentadas a partir de observaciones de campo."
        ]
      }
    ]
  },

  secundario: {
    nombre: "Nivel Secundario",
    descripcion: "Educación Secundaria con modalidades Académica, Técnico-Profesional y en Artes (1ro a 6to de Secundaria).",
    grados: [
      { id: "1secundaria", nombre: "1ro de Secundaria" },
      { id: "2secundaria", nombre: "2do de Secundaria" },
      { id: "3secundaria", nombre: "3ro de Secundaria" },
      { id: "4secundaria", nombre: "4to de Secundaria" },
      { id: "5secundaria", nombre: "5to de Secundaria" },
      { id: "6secundaria", nombre: "6to de Secundaria" }
    ],
    areas: [
      {
        id: "lengua_espanola",
        nombre: "Lengua Española y Literatura",
        competencias: [
          "Comprensión y producción textual avanzada: Analiza críticamente textos argumentativos, ensayos y obras literarias.",
          "Comunicación dialógica y debate: Defiende posturas con argumentos sólidos y respeta la diversidad de opiniones.",
          "Apreciación estética y canon literario: Valora la literatura dominicana, hispanoamericana y universal."
        ],
        contenidos: {
          conceptuales: [
            "Textos argumentativos: el ensayo, el artículo de opinión, la mesa redonda y el debate.",
            "Movimientos literarios: Romanticismo, Modernismo, Vanguardismo y Literatura Dominicana contemporánea.",
            "Análisis sintáctico y pragmalingüística del discurso."
          ],
          procedimentales: [
            "Estructuración de tesis, contraargumentos y conclusiones lógicas en ensayos.",
            "Comentario de texto crítico con análisis estilístico y sociocultural."
          ],
          actitudinales: [
            "Rigor intelectual en la fundamentación de ideas personales.",
            "Defensa de la libertad de expresión y la diversidad cultural."
          ]
        },
        indicadores: [
          "Produce ensayos coherentes aplicando normas APA y citas bibliográficas adecuadas.",
          "Distingue falacias lógicas en discursos políticos y publicitarios.",
          "Interpreta símbolos y temas recurrentes en obras de autores dominicanos."
        ]
      },
      {
        id: "matematica",
        nombre: "Matemática",
        competencias: [
          "Pensamiento algebraico y funciones: Modela situaciones cuantitativas mediante funciones lineales, cuadráticas y exponenciales.",
          "Geometría analítica y trigonometría: Resuelve problemas espaciales y de ondas utilizando razones trigonométricas y vectores.",
          "Probabilidad e inferencia estadística: Toma decisiones fundamentadas a partir del análisis de datos masivos."
        ],
        contenidos: {
          conceptuales: [
            "Álgebra: polinomios, factorización, ecuaciones, sistemas de ecuaciones lineales y cuadráticas.",
            "Funciones: dominio, rango, gráficas y transformaciones de funciones.",
            "Trigonometría: teorema de Pitágoras, funciones trigonométricas, ley de senos y cosenos.",
            "Geometría analítica: distancia entre puntos, ecuación de la recta, parábola y circunferencia.",
            "Cálculo introductorio y estadística inferencial: medidas de dispersión, permutaciones y combinaciones."
          ],
          procedimentales: [
            "Resolución de problemas de optimización aplicando modelos algebraicos.",
            "Uso de software matemático (GeoGebra, calculadoras científicas) para graficar funciones."
          ],
          actitudinales: [
            "Valoración de las matemáticas como herramienta universal para la ciencia y la economía."
          ]
        },
        indicadores: [
          "Resuelve sistemas de ecuaciones con métodos algebraicos y gráficos.",
          "Aplica razones trigonométricas para resolver problemas de elevación y navegación.",
          "Interpreta desviaciones estándar y coeficientes de correlación en estudios estadísticos."
        ]
      },
      {
        id: "ciencias_naturaleza",
        nombre: "Ciencias de la Naturaleza (Biología, Física, Química)",
        competencias: [
          "Modelación y razonamiento científico: Explica la estructura molecular, leyes de la termodinámica, genética y mecánica clásica.",
          "Investigación experimental y laboratorio: Utiliza instrumentos de precisión y normas de bioseguridad en el laboratorio.",
          "Bioética y desarrollo sostenible: Evalúa el impacto socioambiental de la biotecnología y la industria química."
        ],
        contenidos: {
          conceptuales: [
            "Biología: genética mendeliana, ADN/ARN, evolución, ecología y biotecnología.",
            "Química: tabla periódica, enlaces químicos, estequiometría, cinemática y química orgánica.",
            "Física: cinemática, leyes de Newton, trabajo, energía, ondas y electromagnetismo."
          ],
          procedimentales: [
            "Balanceo de ecuaciones químicas y cálculo de rendimientos estequiométricos.",
            "Resolución de problemas de caída libre, tiro parabólico y circuitos eléctricos."
          ],
          actitudinales: [
            "Responsabilidad ética en el manejo de sustancias químicas y organismos biológicos."
          ]
        },
        indicadores: [
          "Predice genotipos y fenotipos utilizando cuadros de Punnett.",
          "Calcula fuerzas, aceleraciones y conservación de energía en sistemas físicos.",
          "Identifica grupos funcionales orgánicos en biomoléculas esenciales."
        ]
      },
      {
        id: "ciencias_sociales",
        nombre: "Ciencias Sociales (Historia y Geografía)",
        competencias: [
          "Pensamiento histórico y conciencia crítica: Analiza los procesos históricos dominicanos del siglo XX y XXI en el contexto global.",
          "Geopolítica y sostenibilidad: Evalúa problemas de migración, urbanización y desarrollo económico sostenible.",
          "Cultura de legalidad e institucionalidad: Fomenta la transparencia, la democracia y los derechos civiles."
        ],
        contenidos: {
          conceptuales: [
            "Siglo XX dominicano: Dictadura de Trujillo (1930-1961), Guerra de Abril de 1965, Transición democrática.",
            "Historia mundial contemporánea: Guerras Mundiales, Guerra Fría y Globalización.",
            "Economía dominicana: sectores productivos, comercio exterior y tratados internacionales."
          ],
          procedimentales: [
            "Análisis comparativo de discursos y documentos históricos de diferentes épocas.",
            "Debates estructurados sobre dilemas éticos y políticos contemporáneos."
          ],
          actitudinales: [
            "Compromiso activo con la memoria histórica y la no repetición de regímenes autoritarios."
          ]
        },
        indicadores: [
          "Analiza los mecanismos de control social y violaciones de derechos humanos durante la era de Trujillo.",
          "Explica los factores que detonaron la Revolución Constitucionalista de 1965.",
          "Evalúa el impacto de la globalización económica en la sociedad dominicana actual."
        ]
      }
    ]
  }
};
